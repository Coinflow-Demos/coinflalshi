import {db} from './client';
import {resolveMarket} from './resolveMarket';
import {createMarketFromTemplate} from './createMarket';
import {pickRandomTemplate} from './marketTemplates';

/**
 * Resolves any market whose countdown has ended and spawns a replacement for
 * each one, so the board never runs dry. Safe to call on every page load —
 * it's a cheap no-op query when nothing is due, which means the demo doesn't
 * depend on an external cron/scheduler at all.
 *
 * Concurrent requests can all see the same due market before any of them
 * commits — each `updateMany` below is an atomic per-row claim (guarded by
 * `status: 'OPEN'` in the WHERE clause), so only one caller ever wins the
 * race for a given market and spawns its replacement. Without this, multiple
 * simultaneous page loads would each resolve-and-replace the same market,
 * causing runaway market duplication.
 */
export async function resolveDueMarkets() {
  const dueMarkets = await db.market.findMany({
    where: {status: 'OPEN', resolvesAt: {lte: new Date()}},
    select: {id: true, slug: true, title: true},
  });

  if (dueMarkets.length === 0) return {resolvedCount: 0, resolved: []};

  const resolved: {slug: string; title: string; winningOutcome: string}[] = [];
  const recentSlugs = dueMarkets.map((market) => market.slug.replace(/-[a-z0-9]{6}$/, ''));

  for (const market of dueMarkets) {
    const claim = await db.market.updateMany({
      where: {id: market.id, status: 'OPEN'},
      data: {status: 'RESOLVING'},
    });
    if (claim.count === 0) continue; // another request already claimed this one

    const {winningOutcome} = await resolveMarket({marketId: market.id});
    resolved.push({slug: market.slug, title: market.title, winningOutcome: winningOutcome.label});

    const template = pickRandomTemplate(recentSlugs);
    await createMarketFromTemplate({template});
  }

  return {resolvedCount: resolved.length, resolved};
}
