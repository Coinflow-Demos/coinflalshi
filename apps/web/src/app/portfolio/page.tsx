import {redirect} from 'next/navigation';
import {auth} from '@/auth';
import {db} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {formatCents, cn} from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT = {
  OPEN: 'outline',
  WON: 'success',
  LOST: 'destructive',
  REFUNDED: 'default',
} as const;

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const now = new Date();
  const positions = await db.position.findMany({
    where: {userId: session.user.id},
    include: {
      market: true,
      outcome: {
        include: {pricePoints: {where: {at: {lte: now}}, orderBy: {at: 'desc'}, take: 1}},
      },
    },
    orderBy: {createdAt: 'desc'},
  });

  const rows = positions.map((position) => {
    const currentPriceCents =
      position.outcome.pricePoints[0]?.priceCents ?? position.outcome.priceCents;
    const currentValueCents =
      position.status === 'WON'
        ? position.payoutCents ?? 0
        : position.status === 'LOST'
          ? 0
          : position.shares * currentPriceCents;
    const pnlCents = currentValueCents - position.costCents;
    return {position, currentPriceCents, currentValueCents, pnlCents};
  });

  const totalCostCents = rows.reduce((sum, r) => sum + r.position.costCents, 0);
  const totalPnlCents = rows.reduce((sum, r) => sum + r.pnlCents, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 font-heading text-3xl font-bold tracking-tight">Portfolio</h1>

      {positions.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invested</p>
            <p className="font-heading text-xl font-bold tabular-nums">
              {formatCents(totalCostCents)}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total P&amp;L</p>
            <p
              className={cn(
                'font-heading text-xl font-bold tabular-nums',
                totalPnlCents >= 0 ? 'text-success' : 'text-destructive'
              )}
            >
              {totalPnlCents >= 0 ? '+' : ''}
              {formatCents(totalPnlCents)}
            </p>
          </Card>
          <Card className="col-span-2 p-4 sm:col-span-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Positions</p>
            <p className="font-heading text-xl font-bold tabular-nums">{positions.length}</p>
          </Card>
        </div>
      )}

      {positions.length === 0 ? (
        <p className="text-muted-foreground">
          You haven&apos;t placed any trades yet — head to the markets page to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({position, currentPriceCents, pnlCents}) => (
            <Card key={position.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{position.market.title}</p>
                <p className="text-sm text-muted-foreground">
                  {position.outcome.label} · {position.shares} shares @ {position.entryPriceCents}¢
                  {position.status === 'OPEN' && (
                    <span className="ml-1">
                      · now {currentPriceCents}¢
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {position.status === 'WON'
                      ? `+${formatCents(position.payoutCents ?? 0)}`
                      : formatCents(position.costCents)}
                  </p>
                  {position.status !== 'LOST' && (
                    <p
                      className={cn(
                        'text-xs font-semibold tabular-nums',
                        pnlCents >= 0 ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {pnlCents >= 0 ? '▲ +' : '▼ '}
                      {formatCents(Math.abs(pnlCents))}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[position.status]}>{position.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
