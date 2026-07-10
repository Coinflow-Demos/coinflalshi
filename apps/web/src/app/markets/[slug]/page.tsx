import {notFound} from 'next/navigation';
import {db, resolveDueMarkets} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Countdown} from '@/components/countdown';
import {BuyPanel} from '@/components/buy-panel';
import {formatCompactCents} from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MarketPage({
  params,
}: {
  params: Promise<{slug: string}>;
}) {
  const {slug} = await params;
  await resolveDueMarkets();
  const market = await db.market.findUnique({
    where: {slug},
    include: {outcomes: true},
  });

  if (!market) notFound();

  const isOpen = market.status === 'OPEN' && market.closesAt > new Date();
  const resolvedOutcome = market.outcomes.find(
    (outcome) => outcome.id === market.resolvedOutcomeId
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start gap-4">
        <span className="text-4xl leading-none">{market.imageEmoji ?? '🔮'}</span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {market.category}
          </p>
          <h1 className="font-heading text-2xl font-bold leading-snug">{market.title}</h1>
          {market.subtitle && <p className="text-muted-foreground">{market.subtitle}</p>}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-5">
        <Card className="p-5 sm:col-span-3">
          <h2 className="mb-3 font-heading font-semibold">Market</h2>
          <div className="flex flex-col gap-2">
            {market.outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
              >
                <span className="font-medium">{outcome.label}</span>
                <span className="font-semibold tabular-nums">{outcome.priceCents}¢</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatCompactCents(market.volumeCents)} volume</span>
            {isOpen ? (
              <Badge variant="outline">
                Resolves in <Countdown target={market.resolvesAt} />
              </Badge>
            ) : market.status === 'RESOLVED' ? (
              <Badge variant="success">Resolved: {resolvedOutcome?.label}</Badge>
            ) : (
              <Badge variant="outline">Closed — resolving…</Badge>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:col-span-2">
          <h2 className="mb-3 font-heading font-semibold">Trade</h2>
          <BuyPanel marketSlug={market.slug} outcomes={market.outcomes} isOpen={isOpen} />
        </Card>
      </div>
    </div>
  );
}
