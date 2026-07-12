import Link from 'next/link';
import {db, resolveDueMarkets} from '@coinflalshi/db';
import {MarketCard} from '@/components/market-card';
import {MarketTicker} from '@/components/market-ticker';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // No cron/scheduler required — resolving due markets on each visit keeps
  // the board self-refreshing without any external infrastructure.
  await resolveDueMarkets();

  const now = new Date();
  const markets = await db.market.findMany({
    where: {status: 'OPEN'},
    include: {
      outcomes: {
        include: {pricePoints: {where: {at: {lte: now}}, orderBy: {at: 'asc'}}},
      },
    },
    orderBy: {createdAt: 'desc'},
    // Defensive cap — the board is only ever meant to hold a couple dozen
    // markets at a time; this just guards against ever rendering an
    // unbounded page if something upstream misbehaves.
    take: 60,
  });

  const categories = Array.from(new Set(markets.map((market) => market.category)));

  return (
    <div>
      <MarketTicker markets={markets} />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">Trending markets</h1>
            <p className="mt-1 text-muted-foreground">
              Trade on sports, crypto, weather, and more. Every market settles automatically.
            </p>
          </div>
          <Link
            href="/markets/create"
            className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            + Create a market
          </Link>
        </div>

        {categories.length === 0 && (
          <p className="text-muted-foreground">
            No open markets right now — check back in a moment.
          </p>
        )}

        <div className="flex flex-col gap-10">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-3 font-heading text-lg font-semibold">{category}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {markets
                  .filter((market) => market.category === category)
                  .map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
