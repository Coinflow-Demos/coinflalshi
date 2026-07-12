import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowSavedCard} from '@/lib/coinflow/server';

const completeSchema = z.object({
  pendingTransactionId: z.string().min(1),
  threeDsTransactionId: z.string().min(1),
  amountCents: z.number().int().min(100),
  cvvVerifiedToken: z.string().min(1),
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
  const {pendingTransactionId, threeDsTransactionId, amountCents, cvvVerifiedToken, deviceId} = parsed.data;

  const transaction = await db.transaction.findUnique({where: {id: pendingTransactionId}});
  if (!transaction || transaction.userId !== userId || transaction.status !== 'PENDING') {
    return NextResponse.json({error: 'Deposit not found or already finalized'}, {status: 404});
  }

  try {
    const sessionKey = await getCoinflowSessionKey({userId});
    const result = await chargeCoinflowSavedCard({
      sessionKey,
      subtotalCents: amountCents,
      cvvVerifiedToken,
      authentication3DS: {transactionId: threeDsTransactionId},
      pendingTransactionId,
      deviceId,
    });

    if (result.status === 'challenge') {
      throw new Error('3DS challenge required again after completion — declined');
    }

    await db.transaction.update({
      where: {id: transaction.id},
      data: {coinflowPaymentId: result.paymentId},
    });

    return NextResponse.json({status: 'success'});
  } catch (error) {
    await db.transaction.update({where: {id: transaction.id}, data: {status: 'FAILED'}});
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
