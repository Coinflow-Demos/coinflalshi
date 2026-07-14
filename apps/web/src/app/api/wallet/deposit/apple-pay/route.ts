import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowApplePay, getClientIp} from '@/lib/coinflow/server';

const chargeSchema = z.object({
  amountCents: z.number().int().min(100).max(500_000_00),
  applePayPayment: z.unknown(),
  deviceId: z.string().optional(),
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
  const {amountCents, applePayPayment, deviceId} = parsed.data;

  const user = await db.user.findUnique({where: {id: userId}, select: {email: true, name: true}});
  const [firstName, ...lastNameParts] = (user?.name ?? '').split(' ');

  const transaction = await db.transaction.create({
    data: {userId, type: 'DEPOSIT', status: 'PENDING', amountCents, method: 'APPLE_PAY'},
  });

  try {
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await chargeCoinflowApplePay({
      sessionKey,
      userId,
      subtotalCents: amountCents,
      applePayPayment,
      pendingTransactionId: transaction.id,
      billing: {email: user?.email, firstName: firstName || undefined, lastName: lastNameParts.join(' ') || undefined},
      deviceId,
      clientIp,
    });

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
