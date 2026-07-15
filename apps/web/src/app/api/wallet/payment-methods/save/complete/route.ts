import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, zeroAuthorizeCoinflowCard, getClientIp} from '@/lib/coinflow/server';
import {deriveCardDisplay} from '@/lib/coinflow/card-display';

const completeSchema = z.object({
  threeDsTransactionId: z.string().min(1),
  cardToken: z.string().min(1),
  expMonth: z.string().min(1),
  expYear: z.string().min(1),
  billing: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(2).max(2),
  }),
  deviceId: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid request'}, {status: 400});
  }
  const {threeDsTransactionId, cardToken, expMonth, expYear, billing, deviceId} = parsed.data;

  try {
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await zeroAuthorizeCoinflowCard({
      sessionKey,
      cardToken,
      expMonth,
      expYear,
      billing,
      authentication3DS: {transactionId: threeDsTransactionId},
      deviceId,
      clientIp,
    });

    if (result.status === 'challenge') {
      throw new Error('3DS challenge required again after completion — declined');
    }

    const {brand, last4} = deriveCardDisplay(cardToken);
    const savedPaymentMethod = await db.savedPaymentMethod.create({
      data: {userId, cardToken, brand, last4, expMonth, expYear},
    });

    return NextResponse.json({status: 'success', savedPaymentMethodId: savedPaymentMethod.id});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
