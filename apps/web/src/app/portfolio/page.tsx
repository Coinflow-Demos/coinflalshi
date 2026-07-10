import {redirect} from 'next/navigation';
import {auth} from '@/auth';
import {db} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {formatCents} from '@/lib/utils';

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

  const positions = await db.position.findMany({
    where: {userId: session.user.id},
    include: {market: true, outcome: true},
    orderBy: {createdAt: 'desc'},
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight">Portfolio</h1>

      {positions.length === 0 ? (
        <p className="text-muted-foreground">
          You haven&apos;t placed any trades yet — head to the markets page to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {positions.map((position) => (
            <Card key={position.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{position.market.title}</p>
                <p className="text-sm text-muted-foreground">
                  {position.outcome.label} · {position.shares} shares @ {position.entryPriceCents}¢
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums">
                  {position.status === 'WON'
                    ? `+${formatCents(position.payoutCents ?? 0)}`
                    : formatCents(position.costCents)}
                </span>
                <Badge variant={STATUS_VARIANT[position.status]}>{position.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
