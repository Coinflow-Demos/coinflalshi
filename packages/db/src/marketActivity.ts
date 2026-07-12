import {db} from './client';

// Simulated third-party traders — not real users, no wallet, no ledger
// impact. Purely to make markets look actively traded instead of empty.
const FAKE_TRADER_NAMES = [
  'Alex R.',
  'Jordan K.',
  'Sam T.',
  'Morgan P.',
  'Casey L.',
  'Riley B.',
  'Taylor M.',
  'Jamie D.',
  'Avery S.',
  'Quinn W.',
  'Drew H.',
  'Reese F.',
  'Skyler N.',
  'Rowan G.',
  'Emerson C.',
];

function randomTraderName(): string {
  return FAKE_TRADER_NAMES[Math.floor(Math.random() * FAKE_TRADER_NAMES.length)];
}

/**
 * Generates simulated trades spread across a market's lifetime, anchored to
 * its already-seeded price walk, and adds their notional value to
 * `Market.volumeCents` — the same trick as price history: precompute the
 * whole thing now, and readers only ever see activity with `at <= now`.
 */
export async function seedMarketActivity({
  marketId,
  outcomes,
  startAt,
  endAt,
}: {
  marketId: string;
  outcomes: {id: string; priceCents: number}[];
  startAt: Date;
  endAt: Date;
}) {
  const durationMs = endAt.getTime() - startAt.getTime();
  const tradeCount = Math.max(6, Math.min(60, Math.round(durationMs / 12_000)));

  let totalVolumeCents = 0;
  const trades = Array.from({length: tradeCount}, () => {
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const shares = Math.round(5 + Math.random() * 195);
    const at = new Date(startAt.getTime() + Math.random() * durationMs);
    totalVolumeCents += shares * outcome.priceCents;
    return {
      marketId,
      outcomeId: outcome.id,
      traderName: randomTraderName(),
      shares,
      priceCents: outcome.priceCents,
      at,
    };
  }).sort((a, b) => a.at.getTime() - b.at.getTime());

  await db.marketActivity.createMany({data: trades});
  await db.market.update({
    where: {id: marketId},
    data: {volumeCents: {increment: totalVolumeCents}},
  });
}
