import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const [wallet, transactions] = await Promise.all([
    db.wallet.findUnique({where: {userId}}),
    db.transaction.findMany({
      where: {userId},
      orderBy: {createdAt: 'desc'},
      take: 25,
    }),
  ]);

  return NextResponse.json({
    balanceCents: wallet?.balanceCents ?? 0,
    transactions,
  });
}
