import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowCard, getClientIp} from '@/lib/coinflow/server';
import {deriveCardDisplay} from '@/lib/coinflow/card-display';

const completeSchema = z.object({
  pendingTransactionId: z.string().min(1),
  threeDsTransactionId: z.string().min(1),
  amountCents: z.number().int().min(100),
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
  saveCard: z.boolean().optional(),
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
  const {
    pendingTransactionId,
    threeDsTransactionId,
    amountCents,
    cardToken,
    expMonth,
    expYear,
    billing,
    deviceId,
    saveCard,
  } = parsed.data;

  const transaction = await db.transaction.findUnique({where: {id: pendingTransactionId}});
  if (!transaction || transaction.userId !== userId || transaction.status !== 'PENDING') {
    return NextResponse.json({error: 'Deposit not found or already finalized'}, {status: 404});
  }

  try {
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await chargeCoinflowCard({
      sessionKey,
      userId,
      subtotalCents: amountCents,
      cardToken,
      expMonth,
      expYear,
      billing,
      authentication3DS: {transactionId: threeDsTransactionId},
      pendingTransactionId,
      deviceId,
      clientIp,
    });

    if (result.status === 'challenge') {
      throw new Error('3DS challenge required again after completion — declined');
    }

    await db.transaction.update({
      where: {id: transaction.id},
      data: {coinflowPaymentId: result.paymentId},
    });

    if (saveCard) {
      const {brand, last4} = deriveCardDisplay(cardToken);
      await db.savedPaymentMethod.create({data: {userId, cardToken, brand, last4, expMonth, expYear}});
    }

    return NextResponse.json({status: 'success'});
  } catch (error) {
    await db.transaction.update({where: {id: transaction.id}, data: {status: 'FAILED'}});
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
