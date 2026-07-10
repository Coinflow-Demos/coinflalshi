import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {coinflowConfig} from '@/lib/coinflow/config';
import {
  getCoinflowSessionKey,
  registerCoinflowKyc,
  addCoinflowBankAccount,
  submitCoinflowWithdrawal,
} from '@/lib/coinflow/server';

const withdrawSchema = z.object({
  amountCents: z.number().int().min(100),
  routingNumber: z.string().min(9).max(9),
  accountNumber: z.string().min(4).max(17),
  accountType: z.enum(['checking', 'savings']),
});

export async function POST(request: Request) {
  if (!coinflowConfig.payoutsEnabled) {
    return NextResponse.json(
      {error: 'Payouts are not enabled on this merchant account yet'},
      {status: 501}
    );
  }

  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid withdrawal request'}, {status: 400});
  }
  const {amountCents, routingNumber, accountNumber, accountType} = parsed.data;

  const [user, wallet] = await Promise.all([
    db.user.findUnique({where: {id: userId}}),
    db.wallet.findUnique({where: {userId}}),
  ]);
  if (!user || !wallet || wallet.balanceCents < amountCents) {
    return NextResponse.json({error: 'Insufficient balance'}, {status: 402});
  }

  const [firstName, ...rest] = user.name.split(' ');
  const lastName = rest.join(' ') || firstName;

  let payout: {id: string; status: string};
  try {
    const sessionKey = await getCoinflowSessionKey({userId});
    await registerCoinflowKyc({sessionKey, firstName, lastName, email: user.email});
    const account = await addCoinflowBankAccount({
      sessionKey,
      routingNumber,
      accountNumber,
      accountType,
    });
    payout = await submitCoinflowWithdrawal({
      sessionKey,
      amountCents,
      destinationId: account.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }

  const [, transaction] = await db.$transaction([
    db.wallet.update({where: {userId}, data: {balanceCents: {decrement: amountCents}}}),
    db.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        amountCents,
        method: 'LEDGER',
        coinflowPaymentId: payout.id,
        metadata: {payoutStatus: payout.status},
      },
    }),
  ]);

  return NextResponse.json({transaction});
}
