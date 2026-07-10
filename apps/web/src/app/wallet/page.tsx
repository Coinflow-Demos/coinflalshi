import {redirect} from 'next/navigation';
import {auth} from '@/auth';
import {db} from '@coinflalshi/db';
import {Card} from '@/components/ui/card';
import {WalletTabs} from '@/components/wallet/wallet-tabs';
import {formatCents} from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [wallet, transactions] = await Promise.all([
    db.wallet.findUnique({where: {userId: session.user.id}}),
    db.transaction.findMany({
      where: {userId: session.user.id},
      orderBy: {createdAt: 'desc'},
      take: 15,
    }),
  ]);

  const balanceCents = wallet?.balanceCents ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 font-heading text-3xl font-bold tracking-tight">Wallet</h1>
      <p className="mb-6 text-muted-foreground">
        Balance: <span className="font-semibold text-foreground">{formatCents(balanceCents)}</span>
      </p>

      <div className="grid gap-6 sm:grid-cols-5">
        <Card className="p-5 sm:col-span-3">
          <WalletTabs balanceCents={balanceCents} />
        </Card>

        <Card className="p-5 sm:col-span-2">
          <h2 className="mb-3 font-heading font-semibold">Recent activity</h2>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium capitalize">{transaction.type.replace('_', ' ').toLowerCase()}</p>
                    <p className="text-xs text-muted-foreground">{transaction.status.toLowerCase()}</p>
                  </div>
                  <span className="tabular-nums">{formatCents(transaction.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
