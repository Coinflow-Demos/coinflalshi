import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, createCoinflowDepositAddress} from '@/lib/coinflow/server';

const addressSchema = z.object({
  chain: z.string().min(1),
  token: z.string().min(1).default('usdc'),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = addressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid chain/token'}, {status: 400});
  }
  const {chain, token} = parsed.data;

  const existing = await db.cryptoDepositAddress.findUnique({
    where: {userId_chain_token: {userId, chain, token}},
  });
  if (existing) {
    return NextResponse.json({address: existing.address, chain, token});
  }

  let depositAddress: string;
  try {
    const sessionKey = await getCoinflowSessionKey({userId});
    ({depositAddress} = await createCoinflowDepositAddress({sessionKey, chain}));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }

  const saved = await db.cryptoDepositAddress.create({
    data: {userId, chain, token, address: depositAddress},
  });

  return NextResponse.json({address: saved.address, chain, token});
}
