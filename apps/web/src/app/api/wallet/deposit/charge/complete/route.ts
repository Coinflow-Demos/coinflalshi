import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowCard, getClientIp} from '@/lib/coinflow/server';
import {deriveCardDisplay} from '@/lib/coinflow/card-display';

const completeSchema = z.object({
  pendingTransactionId: z.string().min(1),
  threeDsTransactionId: z.string().min(1),
  deviceId: z.string().optional(),
  forterToken: z.string().optional(),
});

// What /charge stashed on the transaction when it returned a 3DS challenge —
// read back here instead of trusting whatever the client sends at completion
// time, so a client can't resubmit different charge details against the same
// threeDsTransactionId.
const pendingChargeSchema = z.object({
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
  const {pendingTransactionId, threeDsTransactionId, deviceId, forterToken} = parsed.data;

  const transaction = await db.transaction.findUnique({where: {id: pendingTransactionId}});
  if (!transaction || transaction.userId !== userId || transaction.status !== 'PENDING') {
    return NextResponse.json({error: 'Deposit not found or already finalized'}, {status: 404});
  }

  const pendingCharge = pendingChargeSchema.safeParse(
    (transaction.metadata as {pendingCharge?: unknown} | null)?.pendingCharge
  );
  if (!pendingCharge.success) {
    return NextResponse.json({error: 'Deposit not found or already finalized'}, {status: 404});
  }
  const {cardToken, expMonth, expYear, billing, saveCard} = pendingCharge.data;

  try {
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await chargeCoinflowCard({
      sessionKey,
      userId,
      subtotalCents: transaction.amountCents,
      cardToken,
      expMonth,
      expYear,
      billing,
      authentication3DS: {transactionId: threeDsTransactionId},
      pendingTransactionId,
      deviceId,
      forterToken,
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
