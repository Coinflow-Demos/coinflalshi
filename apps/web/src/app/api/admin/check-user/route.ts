import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';

// TEMPORARY — one-time check to confirm guest-account deletion actually
// happened in production, since every other route here returns defensive
// empty defaults rather than a clear signal. This route and VERIFY_SECRET
// both get removed right after use.
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.VERIFY_SECRET}`) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({error: 'Missing id'}, {status: 400});
  }

  const user = await db.user.findUnique({where: {id}});
  const wallet = await db.wallet.findUnique({where: {userId: id}});

  return NextResponse.json({userExists: Boolean(user), walletExists: Boolean(wallet)});
}
