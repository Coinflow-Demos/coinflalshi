import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {coinflowConfig} from '@/lib/coinflow/config';
import {submitCoinflowDelegatedPayout, type CoinflowWithdrawSpeed} from '@/lib/coinflow/server';

const WITHDRAW_SPEEDS = [
  'asap',
  'same_day',
  'standard',
  'card',
  'iban',
  'pix',
  'eft',
  'venmo',
  'paypal',
  'wire',
  'interac',
] as const;

const withdrawSchema = z.object({
  amountCents: z.number().int().min(100),
  token: z.string().min(1),
  speed: z.enum(WITHDRAW_SPEEDS),
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
  const {amountCents, token, speed} = parsed.data;

  const wallet = await db.wallet.findUnique({where: {userId}});
  if (!wallet || wallet.balanceCents < amountCents) {
    return NextResponse.json({error: 'Insufficient balance'}, {status: 402});
  }

  let payout: {signature: string; effectiveSpeed: string};
  try {
    payout = await submitCoinflowDelegatedPayout({
      userId,
      speed: speed as CoinflowWithdrawSpeed,
      account: token,
      amountCents,
      idempotencyKey: crypto.randomUUID(),
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
        coinflowPaymentId: payout.signature,
        metadata: {effectiveSpeed: payout.effectiveSpeed},
      },
    }),
  ]);

  return NextResponse.json({transaction});
}
