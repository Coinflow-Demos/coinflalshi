import {db} from './client';

const MIN_PRICE_CENTS = 2;
const MAX_PRICE_CENTS = 98;

function clampPrice(cents: number): number {
  return Math.max(MIN_PRICE_CENTS, Math.min(MAX_PRICE_CENTS, Math.round(cents)));
}

/** Bounded random walk — each step drifts a few cents, occasionally more,
 * clamped to a plausible 2-98 cent range. Produces the "real trading chart"
 * look without needing actual order flow. */
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

/**
 * Precomputes a full price path for an outcome's entire lifetime (creation
 * to resolution) and stores it up front. Readers only ever look at points
 * with `at <= now`, so the market appears to "live-update" as real time
 * passes even though nothing runs in the background.
 */
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

/** Appends a live price point, e.g. when a trade nudges the market. */
export async function recordPriceMovement({
  outcomeId,
  priceCents,
}: {
  outcomeId: string;
  priceCents: number;
}) {
  await db.pricePoint.create({data: {outcomeId, priceCents: clampPrice(priceCents)}});
}

/** The latest price visible as of `asOf` (defaults to now), falling back to
 * the outcome's seed price if no history exists yet. */
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

/**
 * Nudges prices after a trade — the bought outcome ticks up proportional to
 * trade size, and the rest absorb the opposite move weighted by their
 * current price, keeping the market's total roughly stable. This is a
 * simplified market-impact model (no real order book), but it's what makes
 * the chart visibly respond to trading instead of only drifting on its own.
 */
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
