import {NextResponse} from 'next/server';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey} from '@/lib/coinflow/server';
import {coinflowConfig, COINFLOW_SDK_ENV} from '@/lib/coinflow/config';

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  let sessionKey: string;
  try {
    sessionKey = await getCoinflowSessionKey({userId});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }

  return NextResponse.json({
    sessionKey,
    merchantId: coinflowConfig.merchantId,
    env: COINFLOW_SDK_ENV,
  });
}
