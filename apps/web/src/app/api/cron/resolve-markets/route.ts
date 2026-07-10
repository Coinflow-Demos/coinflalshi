import {NextResponse} from 'next/server';
import {resolveDueMarkets} from '@coinflalshi/db';

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // not configured yet (local/dev) — allow through
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const result = await resolveDueMarkets();
  return NextResponse.json(result);
}
