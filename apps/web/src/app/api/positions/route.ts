import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const now = new Date();
  const positions = await db.position.findMany({
    where: {userId},
    include: {
      market: true,
      outcome: {
        include: {pricePoints: {where: {at: {lte: now}}, orderBy: {at: 'desc'}, take: 1}},
      },
    },
    orderBy: {createdAt: 'desc'},
  });

  return NextResponse.json({positions});
}
