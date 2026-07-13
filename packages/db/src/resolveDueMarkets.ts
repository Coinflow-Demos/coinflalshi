import {db} from './client';
import {resolveMarket} from './resolveMarket';
import {createMarketFromTemplate} from './createMarket';
import {pickRandomTemplate} from './marketTemplates';

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
    if (claim.count === 0) continue;

    const {winningOutcome} = await resolveMarket({marketId: market.id});
    resolved.push({slug: market.slug, title: market.title, winningOutcome: winningOutcome.label});

    const template = pickRandomTemplate(recentSlugs);
    await createMarketFromTemplate({template});
  }

  return {resolvedCount: resolved.length, resolved};
}
