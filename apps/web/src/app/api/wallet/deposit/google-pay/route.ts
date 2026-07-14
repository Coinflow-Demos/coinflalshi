import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowGooglePay, getClientIp} from '@/lib/coinflow/server';

// Google's paymentData is opaque to us — we only need to know it carries a
// gateway token. Every nested object is `.passthrough()` on purpose: Coinflow
// reads fields we don't declare here — notably
// `paymentMethodData.info.{cardNetwork,cardDetails}` — and a plain z.object()
// would strip them, making Coinflow throw on the missing `info`.
const googlePaySchema = z.object({
  amountCents: z.number().int().min(100).max(500_000_00),
  paymentData: z
    .object({
      email: z.string().email().optional(),
      paymentMethodData: z
        .object({
          type: z.string(),
          tokenizationData: z
            .object({
              type: z.string(),
              token: z.string().min(1),
            })
            .passthrough(),
        })
        .passthrough(),
    })
    .passthrough(),
  authentication3DS: z.object({
    colorDepth: z.number(),
    screenHeight: z.number(),
    screenWidth: z.number(),
    timeZone: z.number(),
  }),
  deviceId: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = googlePaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid deposit request'}, {status: 400});
  }
  const {amountCents, paymentData, authentication3DS, deviceId} = parsed.data;

  const user = await db.user.findUnique({where: {id: userId}, select: {email: true, name: true}});
  const [firstName, ...rest] = (user?.name ?? '').trim().split(/\s+/);
  const lastName = rest.join(' ') || undefined;

  const transaction = await db.transaction.create({
    data: {userId, type: 'DEPOSIT', status: 'PENDING', amountCents, method: 'GOOGLE_PAY'},
  });

  try {
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await chargeCoinflowGooglePay({
      sessionKey,
      userId,
      email: paymentData.email ?? user?.email,
      firstName: firstName || undefined,
      lastName,
      subtotalCents: amountCents,
      paymentData,
      authentication3DS,
      pendingTransactionId: transaction.id,
      deviceId,
      clientIp,
    });

    if (result.status === 'challenge') {
      await db.transaction.update({where: {id: transaction.id}, data: {status: 'FAILED'}});
      return NextResponse.json(
        {error: 'This card needs extra verification — please pay with the card form instead.'},
        {status: 409}
      );
    }

    await db.transaction.update({
      where: {id: transaction.id},
      data: {coinflowPaymentId: result.paymentId},
    });

    return NextResponse.json({status: 'success', pendingTransactionId: transaction.id});
  } catch (error) {
    await db.transaction.update({where: {id: transaction.id}, data: {status: 'FAILED'}});
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
