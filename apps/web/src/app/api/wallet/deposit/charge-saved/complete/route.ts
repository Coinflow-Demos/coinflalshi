import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowSavedCard, getClientIp} from '@/lib/coinflow/server';

const completeSchema = z.object({
  pendingTransactionId: z.string().min(1),
  threeDsTransactionId: z.string().min(1),
  deviceId: z.string().optional(),
  forterToken: z.string().optional(),
});

// What /charge-saved stashed on the transaction when it returned a 3DS
// challenge — read back here instead of trusting whatever the client sends
// at completion time.
const pendingChargeSchema = z.object({
  cvvVerifiedToken: z.string().min(1),
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
  const {cvvVerifiedToken} = pendingCharge.data;

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
      subtotalCents: transaction.amountCents,
      cvvVerifiedToken,
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

    return NextResponse.json({status: 'success'});
  } catch (error) {
    await db.transaction.update({where: {id: transaction.id}, data: {status: 'FAILED'}});
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
