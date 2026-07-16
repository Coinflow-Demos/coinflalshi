import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

// Called right before signing out. Guest accounts have no password to log
// back in with, so once this runs there's no way back into this session —
// deleting the row (cascades to wallet/transactions/positions/saved cards)
// is what "we don't save guest data" actually means at the DB level.
export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({status: 'ok'});
  }

  const user = await db.user.findUnique({where: {id: userId}, select: {isGuest: true}});
  if (user?.isGuest) {
    await db.user.delete({where: {id: userId}});
  }

  return NextResponse.json({status: 'ok'});
}
