import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, zeroAuthorizeCoinflowCard} from '@/lib/coinflow/server';
import {deriveCardDisplay} from '@/lib/coinflow/card-display';

const billingSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
  country: z.string().min(2).max(2),
});

const saveSchema = z.object({
  cardToken: z.string().min(1),
  expMonth: z.string().min(1),
  expYear: z.string().min(1),
  billing: billingSchema,
  authentication3DS: z.object({
    colorDepth: z.number(),
    screenHeight: z.number(),
    screenWidth: z.number(),
    timeZone: z.number(),
  }),
  deviceId: z.string().optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid request'}, {status: 400});
  }
  const {cardToken, expMonth, expYear, billing, authentication3DS, deviceId} = parsed.data;

  try {
    const sessionKey = await getCoinflowSessionKey({userId});
    const result = await zeroAuthorizeCoinflowCard({
      sessionKey,
      cardToken,
      expMonth,
      expYear,
      billing,
      authentication3DS,
      deviceId,
    });

    if (result.status === 'challenge') {
      return NextResponse.json({
        status: 'challenge',
        transactionId: result.transactionId,
        creq: result.creq,
        url: result.url,
      });
    }

    const {brand, last4} = deriveCardDisplay(cardToken);
    const savedPaymentMethod = await db.savedPaymentMethod.create({
      data: {userId, cardToken, brand, last4, expMonth, expYear},
    });

    return NextResponse.json({status: 'success', savedPaymentMethodId: savedPaymentMethod.id});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
