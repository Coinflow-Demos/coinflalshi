import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowSavedCard, getClientIp} from '@/lib/coinflow/server';

const chargeSchema = z.object({
  amountCents: z.number().int().min(100).max(500_000_00),
  cvvVerifiedToken: z.string().min(1),
  authentication3DS: z.object({
    colorDepth: z.number(),
    screenHeight: z.number(),
    screenWidth: z.number(),
    timeZone: z.number(),
  }),
  deviceId: z.string().optional(),
  forterToken: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = chargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid deposit request'}, {status: 400});
  }
  const {amountCents, cvvVerifiedToken, authentication3DS, deviceId, forterToken} = parsed.data;

  const transaction = await db.transaction.create({
    data: {userId, type: 'DEPOSIT', status: 'PENDING', amountCents, method: 'CARD'},
  });

  try {
    const user = await db.user.findUnique({where: {id: userId}, select: {email: true, name: true}});
    const [firstName, ...lastNameParts] = (user?.name ?? '').split(' ');
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await chargeCoinflowSavedCard({
      sessionKey,
      userId,
      email: user?.email,
      firstName: firstName || undefined,
      lastName: lastNameParts.join(' ') || undefined,
      subtotalCents: amountCents,
      cvvVerifiedToken,
      authentication3DS,
      pendingTransactionId: transaction.id,
      deviceId,
      forterToken,
      clientIp,
    });

    if (result.status === 'challenge') {
      // Stash what's needed to finish this charge after the 3DS challenge, so
      // /complete reads it back from here instead of trusting whatever the
      // client sends at completion time.
      await db.transaction.update({
        where: {id: transaction.id},
        data: {metadata: {pendingCharge: {cvvVerifiedToken}}},
      });
      return NextResponse.json({
        status: 'challenge',
        transactionId: result.transactionId,
        creq: result.creq,
        url: result.url,
        pendingTransactionId: transaction.id,
      });
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
