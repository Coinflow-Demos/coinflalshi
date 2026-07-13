import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, getCoinflowWithdrawer} from '@/lib/coinflow/server';

/** Lists the user's linked payout methods (bank/card/PayPal/etc) via
 * Coinflow's Get Withdrawer endpoint, so the withdraw UI can offer them
 * directly instead of asking for account/routing numbers. */
export async function GET(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const user = await db.user.findUnique({where: {id: userId}});
  if (!user) {
    return NextResponse.json({error: 'User not found'}, {status: 404});
  }

  try {
    const sessionKey = await getCoinflowSessionKey({userId});
    const result = await getCoinflowWithdrawer({sessionKey, email: user.email});
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
