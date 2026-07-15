import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {getCoinflowSessionKey, chargeCoinflowCard, getClientIp} from '@/lib/coinflow/server';
import {deriveCardDisplay} from '@/lib/coinflow/card-display';

const chargeSchema = z.object({
  amountCents: z.number().int().min(100).max(500_000_00),
  cardToken: z.string().min(1),
  expMonth: z.string().min(1),
  expYear: z.string().min(1),
  billing: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    address1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(2).max(2),
  }),
  authentication3DS: z.object({
    colorDepth: z.number(),
    screenHeight: z.number(),
    screenWidth: z.number(),
    timeZone: z.number(),
  }),
  deviceId: z.string().optional(),
  saveCard: z.boolean().optional(),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = chargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid deposit request'}, {status: 400});
  }
  const {
    amountCents,
    cardToken,
    expMonth,
    expYear,
    billing,
    authentication3DS,
    deviceId,
    saveCard,
  } = parsed.data;

  const transaction = await db.transaction.create({
    data: {userId, type: 'DEPOSIT', status: 'PENDING', amountCents, method: 'CARD'},
  });

  try {
    const clientIp = getClientIp(request);
    const sessionKey = await getCoinflowSessionKey({userId, clientIp});
    const result = await chargeCoinflowCard({
      sessionKey,
      userId,
      subtotalCents: amountCents,
      cardToken,
      expMonth,
      expYear,
      billing,
      authentication3DS,
      pendingTransactionId: transaction.id,
      saveCard,
      deviceId,
      clientIp,
    });

    if (result.status === 'challenge') {
      // Stash what's needed to finish this charge after the 3DS challenge, so
      // /complete reads it back from here instead of trusting whatever the
      // client sends at completion time.
      await db.transaction.update({
        where: {id: transaction.id},
        data: {
          metadata: {
            pendingCharge: {cardToken, expMonth, expYear, billing, saveCard: saveCard ?? false},
          },
        },
      });
      return NextResponse.json({
        status: 'challenge',
        transactionId: result.transactionId,
        creq: result.creq,
        url: result.url,
        pendingTransactionId: transaction.id,
      });
    }

    await db.transaction.update({
      where: {id: transaction.id},
      data: {coinflowPaymentId: result.paymentId},
    });

    if (saveCard) {
      const {brand, last4} = deriveCardDisplay(cardToken);
      await db.savedPaymentMethod.create({data: {userId, cardToken, brand, last4, expMonth, expYear}});
    }

    return NextResponse.json({status: 'success', pendingTransactionId: transaction.id});
  } catch (error) {
    await db.transaction.update({where: {id: transaction.id}, data: {status: 'FAILED'}});
    const message = error instanceof Error ? error.message : 'Coinflow request failed';
    return NextResponse.json({error: message}, {status: 502});
  }
}
