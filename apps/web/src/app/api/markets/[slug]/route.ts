import {NextResponse} from 'next/server';
import {db, resolveDueMarkets} from '@coinflalshi/db';

export async function GET(
  _request: Request,
  {params}: {params: Promise<{slug: string}>}
) {
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

  if (!market) {
    return NextResponse.json({error: 'Market not found'}, {status: 404});
  }

  return NextResponse.json({market});
}
