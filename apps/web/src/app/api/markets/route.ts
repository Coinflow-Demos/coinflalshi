import {NextResponse} from 'next/server';
import {db, resolveDueMarkets} from '@coinflalshi/db';

export async function GET(request: Request) {
  await resolveDueMarkets();

  const {searchParams} = new URL(request.url);
  const status = searchParams.get('status') ?? 'OPEN';

  const markets = await db.market.findMany({
    where: status === 'ALL' ? undefined : {status: status as 'OPEN' | 'RESOLVING' | 'RESOLVED'},
    include: {outcomes: true},
    orderBy: {createdAt: 'desc'},
    take: 60,
  });

  return NextResponse.json({markets});
}
