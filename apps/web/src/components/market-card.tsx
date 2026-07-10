import Link from 'next/link';
import type {Market, Outcome} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Countdown} from '@/components/countdown';
import {formatCompactCents} from '@/lib/utils';

export function MarketCard({market}: {market: Market & {outcomes: Outcome[]}}) {
  return (
    <Link href={`/markets/${market.slug}`}>
      <Card className="flex h-full flex-col gap-4 p-5 transition-colors hover:border-primary/50">
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
        </div>

        <div className="flex flex-col gap-2">
          {market.outcomes.map((outcome) => (
            <div key={outcome.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-sm font-medium">{outcome.label}</span>
              <span className="text-sm font-semibold tabular-nums">{outcome.priceCents}¢</span>
            </div>
          ))}
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
