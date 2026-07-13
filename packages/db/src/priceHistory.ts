import {db} from './client';

const MIN_PRICE_CENTS = 2;
const MAX_PRICE_CENTS = 98;

function clampPrice(cents: number): number {
  return Math.max(MIN_PRICE_CENTS, Math.min(MAX_PRICE_CENTS, Math.round(cents)));
}

function randomWalk({startCents, steps}: {startCents: number; steps: number}): number[] {
  const path: number[] = [startCents];
  let current = startCents;
  for (let i = 1; i < steps; i++) {
    const volatility = Math.random() < 0.15 ? 6 : 2;
    const step = (Math.random() - 0.5) * 2 * volatility;
    current = clampPrice(current + step);
    path.push(current);
  }
  return path;
}

export async function seedPriceHistory({
  outcomeId,
  basePriceCents,
  startAt,
  endAt,
}: {
  outcomeId: string;
  basePriceCents: number;
  startAt: Date;
  endAt: Date;
}) {
  const durationMs = endAt.getTime() - startAt.getTime();
  const steps = Math.max(8, Math.min(40, Math.round(durationMs / 15_000)));
  const path = randomWalk({startCents: basePriceCents, steps});

  await db.pricePoint.createMany({
    data: path.map((priceCents, index) => ({
      outcomeId,
      priceCents,
      at: new Date(startAt.getTime() + (durationMs * index) / (steps - 1)),
    })),
  });
}

export async function recordPriceMovement({
  outcomeId,
  priceCents,
}: {
  outcomeId: string;
  priceCents: number;
}) {
  await db.pricePoint.create({data: {outcomeId, priceCents: clampPrice(priceCents)}});
}

export async function getCurrentPriceCents({
  outcomeId,
  fallbackCents,
  asOf = new Date(),
}: {
  outcomeId: string;
  fallbackCents: number;
  asOf?: Date;
}): Promise<number> {
  const latest = await db.pricePoint.findFirst({
    where: {outcomeId, at: {lte: asOf}},
    orderBy: {at: 'desc'},
  });
  return latest?.priceCents ?? fallbackCents;
}

export async function nudgePricesForTrade({
  outcomes,
  boughtOutcomeId,
  shares,
}: {
  outcomes: {id: string; priceCents: number}[];
  boughtOutcomeId: string;
  shares: number;
}) {
  const impact = Math.min(8, Math.max(1, Math.round(shares / 25)));
  const others = outcomes.filter((o) => o.id !== boughtOutcomeId);
  const othersTotal = others.reduce((sum, o) => sum + o.priceCents, 0) || 1;

  await Promise.all(
    outcomes.map((outcome) => {
      const priceCents =
        outcome.id === boughtOutcomeId
          ? clampPrice(outcome.priceCents + impact)
          : clampPrice(outcome.priceCents - (impact * outcome.priceCents) / othersTotal);
      return recordPriceMovement({outcomeId: outcome.id, priceCents});
    })
  );
}

export {clampPrice};
