import type {Market, Outcome, PricePoint} from '@coinflalshi/db';
import {cn} from '@/lib/utils';

type MarketWithHistory = Market & {outcomes: (Outcome & {pricePoints: PricePoint[]})[]};

export function MarketTicker({markets}: {markets: MarketWithHistory[]}) {
  const items = markets
    .map((market) => {
      const primary = market.outcomes[0];
      if (!primary) return null;
      const points = primary.pricePoints;
      const current = points.at(-1)?.priceCents ?? primary.priceCents;
      const first = points[0]?.priceCents ?? current;
      return {id: market.id, title: market.title, label: primary.label, current, delta: current - first};
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden border-b border-border bg-card/60">
      <div className="animate-ticker flex w-max gap-8 py-2">
        {[...items, ...items].map((item, index) => (
          <div key={`${item.id}-${index}`} className="flex items-center gap-2 whitespace-nowrap px-2 text-sm">
            <span className="font-medium">{item.title}</span>
            <span className="text-muted-foreground">{item.label}</span>
            <span className="tabular-nums font-semibold">{item.current}¢</span>
            <span
              className={cn(
                'tabular-nums text-xs font-semibold',
                item.delta >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {item.delta >= 0 ? '▲' : '▼'} {Math.abs(item.delta)}¢
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
