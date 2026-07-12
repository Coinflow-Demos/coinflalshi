import Link from 'next/link';
import type {Market, Outcome, PricePoint} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Countdown} from '@/components/countdown';
import {Sparkline} from '@/components/charts/sparkline';
import {formatCompactCents, cn} from '@/lib/utils';

type OutcomeWithHistory = Outcome & {pricePoints: PricePoint[]};

export function MarketCard({market}: {market: Market & {outcomes: OutcomeWithHistory[]}}) {
  const primary = market.outcomes[0];
  const points = primary?.pricePoints ?? [];
  const currentPrice = points.at(-1)?.priceCents ?? primary?.priceCents ?? 0;
  const firstPrice = points[0]?.priceCents ?? currentPrice;
  const delta = currentPrice - firstPrice;

  return (
    <Link href={`/markets/${market.slug}`}>
      <Card className="group flex h-full flex-col gap-3 p-5 transition-all hover:border-primary/50 hover:shadow-[0_0_0_1px_var(--primary)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none">{market.imageEmoji ?? '🔮'}</span>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {market.category}
              </p>
              <h3 className="font-heading text-base font-semibold leading-snug">{market.title}</h3>
              {market.subtitle && (
                <p className="text-sm text-muted-foreground">{market.subtitle}</p>
              )}
            </div>
          </div>
          {market.status === 'OPEN' && (
            <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-success">
              <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-success" />
              Live
            </span>
          )}
        </div>

        {primary && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-bold tabular-nums">{currentPrice}¢</span>
              <span
                className={cn(
                  'text-xs font-semibold tabular-nums',
                  delta >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}¢
              </span>
            </div>
            <div className="w-24 shrink-0">
              <Sparkline points={points} height={36} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {market.outcomes.map((outcome) => {
            const outcomeCurrent = outcome.pricePoints.at(-1)?.priceCents ?? outcome.priceCents;
            return (
              <div
                key={outcome.id}
                className="flex items-center justify-between rounded-lg bg-muted px-3 py-2"
              >
                <span className="text-sm font-medium">{outcome.label}</span>
                <span className="text-sm font-semibold tabular-nums">{outcomeCurrent}¢</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCompactCents(market.volumeCents)} vol</span>
          {market.status === 'OPEN' ? (
            <Badge variant="outline">
              <Countdown target={market.resolvesAt} />
            </Badge>
          ) : (
            <Badge variant="success">Resolved</Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
