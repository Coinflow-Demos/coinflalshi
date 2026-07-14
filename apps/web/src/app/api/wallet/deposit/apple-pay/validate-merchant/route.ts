import {NextResponse} from 'next/server';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowApplePayMerchantSession} from '@/lib/coinflow/server';

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const domainName = new URL(request.url).searchParams.get('domainName');
  if (!domainName) {
    return NextResponse.json({error: 'Missing domainName'}, {status: 400});
  }

  try {
    const session = await getCoinflowApplePayMerchantSession({domainName});
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
