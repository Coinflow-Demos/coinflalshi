import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db, getCurrentPriceCents, nudgePricesForTrade} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

const betSchema = z.object({
  outcomeId: z.string().min(1),
  amountCents: z.number().int().min(100).max(100_000_00),
});

export async function POST(
  request: Request,
  {params}: {params: Promise<{slug: string}>}
) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const {slug} = await params;
  const body = await request.json().catch(() => null);
  const parsed = betSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid bet request'}, {status: 400});
  }
  const {outcomeId, amountCents} = parsed.data;

  const market = await db.market.findUnique({
    where: {slug},
    include: {outcomes: true},
  });
  if (!market) {
    return NextResponse.json({error: 'Market not found'}, {status: 404});
  }
  if (market.status !== 'OPEN' || market.closesAt < new Date()) {
    return NextResponse.json({error: 'This market is no longer accepting bets'}, {status: 409});
  }

  const outcome = market.outcomes.find((candidate) => candidate.id === outcomeId);
  if (!outcome) {
    return NextResponse.json({error: 'Outcome not found on this market'}, {status: 404});
  }

  const currentPriceCents = await getCurrentPriceCents({
    outcomeId,
    fallbackCents: outcome.priceCents,
  });

  const shares = Math.floor(amountCents / currentPriceCents);
  if (shares < 1) {
    return NextResponse.json({error: 'Amount too small to buy a share'}, {status: 400});
  }
  const costCents = shares * currentPriceCents;

  try {
    const position = await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({where: {userId}});
      if (!wallet || wallet.balanceCents < costCents) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      await tx.wallet.update({
        where: {userId},
        data: {balanceCents: {decrement: costCents}},
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'BET_PLACED',
          status: 'COMPLETED',
          amountCents: costCents,
          method: 'LEDGER',
          metadata: {marketId: market.id, outcomeId},
        },
      });

      await tx.market.update({
        where: {id: market.id},
        data: {volumeCents: {increment: costCents}},
      });

      return tx.position.create({
        data: {
          userId,
          marketId: market.id,
          outcomeId,
          shares,
          entryPriceCents: currentPriceCents,
          costCents,
        },
      });
    });

    await nudgePricesForTrade({
      outcomes: market.outcomes.map((o) =>
        o.id === outcomeId ? {...o, priceCents: currentPriceCents} : o
      ),
      boughtOutcomeId: outcomeId,
      shares,
    });

    return NextResponse.json({position});
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({error: 'Insufficient wallet balance'}, {status: 402});
    }
    throw error;
  }
}
