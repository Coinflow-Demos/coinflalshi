import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

export async function GET(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const savedPaymentMethods = await db.savedPaymentMethod.findMany({
    where: {userId},
    orderBy: {createdAt: 'desc'},
    select: {id: true, brand: true, last4: true, expMonth: true, expYear: true, createdAt: true},
  });

  return NextResponse.json({savedPaymentMethods});
}
