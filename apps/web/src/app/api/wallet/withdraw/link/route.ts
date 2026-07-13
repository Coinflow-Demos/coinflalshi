import {NextResponse} from 'next/server';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, buildCoinflowBankAuthUrl, getClientIp} from '@/lib/coinflow/server';

/** Returns a hosted Bank Authentication UI URL for the current user to link
 * a payout method (bank via Plaid, card, etc). Meant to be embedded in an
 * iframe — see withdraw-panel.tsx for the accountLinked postMessage listener. */
export async function GET(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const origin = new URL(request.url).origin;
  try {
    const sessionKey = await getCoinflowSessionKey({userId, clientIp: getClientIp(request)});
    const url = buildCoinflowBankAuthUrl({
      sessionKey,
      redirectUrl: `${origin}/wallet?withdrawLinked=1`,
    });
    return NextResponse.json({url});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
