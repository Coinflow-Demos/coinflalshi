import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {
  getCoinflowSessionKey,
  getCoinflowCheckoutJwt,
  getClientIp,
} from '@/lib/coinflow/server';
import {coinflowConfig, COINFLOW_SDK_ENV} from '@/lib/coinflow/config';

const depositSchema = z.object({
  amountCents: z.number().int().min(100).max(500_000_00),
  zeroAuth: z.boolean().optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid deposit amount'}, {status: 400});
  }
  const {amountCents, zeroAuth} = parsed.data;

  const clientIp = getClientIp(request);
  let sessionKey: string;
  let checkoutJwtToken: string;
  try {
    [sessionKey, checkoutJwtToken] = await Promise.all([
      getCoinflowSessionKey({userId, clientIp}),
      getCoinflowCheckoutJwt({subtotalCents: zeroAuth ? 0 : amountCents}),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }

  const transaction = await db.transaction.create({
    data: {
      userId,
      type: 'DEPOSIT',
      status: 'PENDING',
      amountCents,
      method: 'CARD',
    },
  });

  return NextResponse.json({
    sessionKey,
    jwtToken: checkoutJwtToken,
    pendingTransactionId: transaction.id,
    merchantId: coinflowConfig.merchantId,
    env: COINFLOW_SDK_ENV,
    applePayEnabled: coinflowConfig.applePayEnabled,
    googlePayEnabled: coinflowConfig.googlePayEnabled,
  });
}
