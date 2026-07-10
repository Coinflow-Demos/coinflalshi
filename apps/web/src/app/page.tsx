import {db, resolveDueMarkets} from '@coinflalshi/db';
import {MarketCard} from '@/components/market-card';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // No cron/scheduler required — resolving due markets on each visit keeps
  // the board self-refreshing without any external infrastructure.
  await resolveDueMarkets();

  const markets = await db.market.findMany({
    where: {status: 'OPEN'},
    include: {outcomes: true},
    orderBy: {createdAt: 'desc'},
  });

  const categories = Array.from(new Set(markets.map((market) => market.category)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Trending markets</h1>
        <p className="mt-1 text-muted-foreground">
          Trade on sports, crypto, weather, and more. Every market settles automatically.
        </p>
      </div>

      {categories.length === 0 && (
        <p className="text-muted-foreground">No open markets right now — check back in a moment.</p>
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
  );
}
