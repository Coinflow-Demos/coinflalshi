import {notFound} from 'next/navigation';
import {db, resolveDueMarkets} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Countdown} from '@/components/countdown';
import {BuyPanel} from '@/components/buy-panel';
import {PriceChart} from '@/components/charts/price-chart';
import {getOutcomeColor} from '@/lib/outcome-colors';
import {formatCompactCents, cn} from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MarketPage({
  params,
}: {
  params: Promise<{slug: string}>;
}) {
  const {slug} = await params;
  await resolveDueMarkets();
  const now = new Date();
  const market = await db.market.findUnique({
    where: {slug},
    include: {
      outcomes: {
        include: {pricePoints: {where: {at: {lte: now}}, orderBy: {at: 'asc'}}},
      },
      activity: {where: {at: {lte: now}}, orderBy: {at: 'desc'}, take: 20},
      positions: {
        include: {user: {select: {name: true}}, outcome: {select: {label: true}}},
        orderBy: {createdAt: 'desc'},
        take: 20,
      },
    },
  });

  if (!market) notFound();

  const feed = [
    ...market.activity.map((trade) => ({
      id: trade.id,
      traderName: trade.traderName,
      outcomeLabel: market.outcomes.find((o) => o.id === trade.outcomeId)?.label ?? '',
      shares: trade.shares,
      priceCents: trade.priceCents,
      at: trade.at,
      isReal: false,
    })),
    ...market.positions.map((position) => ({
      id: position.id,
      traderName: position.user.name,
      outcomeLabel: position.outcome.label,
      shares: position.shares,
      priceCents: position.entryPriceCents,
      at: position.createdAt,
      isReal: true,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 15);

  const isOpen = market.status === 'OPEN' && market.closesAt > now;
  const resolvedOutcome = market.outcomes.find(
    (outcome) => outcome.id === market.resolvedOutcomeId
  );

  const outcomesWithCurrentPrice = market.outcomes.map((outcome) => ({
    ...outcome,
    priceCents: outcome.pricePoints.at(-1)?.priceCents ?? outcome.priceCents,
  }));

  const primary = outcomesWithCurrentPrice[0];
  const primaryFirst = market.outcomes[0]?.pricePoints[0]?.priceCents ?? primary?.priceCents ?? 0;
  const primaryDelta = (primary?.priceCents ?? 0) - primaryFirst;

  const series = market.outcomes.map((outcome, index) => ({
    id: outcome.id,
    label: outcome.label,
    color: getOutcomeColor(index),
    points: outcome.pricePoints,
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start gap-4">
        <span className="text-4xl leading-none">{market.imageEmoji ?? '🔮'}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {market.category}
            </p>
            {isOpen && (
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-success">
                <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-success" />
                Live
              </span>
            )}
          </div>
          <h1 className="font-heading text-2xl font-bold leading-snug">{market.title}</h1>
          {market.subtitle && <p className="text-muted-foreground">{market.subtitle}</p>}
          {market.creatorName && (
            <p className="mt-1 text-xs text-muted-foreground">
              Created by <span className="font-medium">{market.creatorName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-5">
        <Card className="p-5 sm:col-span-3">
          {primary && (
            <div className="mb-4 flex items-baseline gap-3">
              <span
                className="font-heading text-3xl font-bold tabular-nums"
                style={{color: getOutcomeColor(0)}}
              >
                {primary.priceCents}¢
              </span>
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  primaryDelta >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {primaryDelta >= 0 ? '▲' : '▼'} {Math.abs(primaryDelta)}¢
              </span>
              <span className="text-sm text-muted-foreground">{primary.label}</span>
            </div>
          )}

          <PriceChart series={series} height={260} />

          <div className="mt-4 flex flex-col gap-2">
            {outcomesWithCurrentPrice.map((outcome, index) => (
              <div
                key={outcome.id}
                className="flex items-center justify-between rounded-lg bg-muted px-4 py-3"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{backgroundColor: getOutcomeColor(index)}}
                  />
                  {outcome.label}
                </span>
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
          <BuyPanel marketSlug={market.slug} outcomes={outcomesWithCurrentPrice} isOpen={isOpen} />
        </Card>
      </div>

      {feed.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 font-heading font-semibold">Recent activity</h2>
          <div className="flex flex-col divide-y divide-border">
            {feed.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium">{trade.traderName}</span>
                  <span className="text-muted-foreground"> bought </span>
                  <span className="font-medium">{trade.shares}</span>
                  <span className="text-muted-foreground"> {trade.outcomeLabel} @ </span>
                  <span className="font-medium tabular-nums">{trade.priceCents}¢</span>
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(trade.at, now)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function timeAgo(at: Date, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - at.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
