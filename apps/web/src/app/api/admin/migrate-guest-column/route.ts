import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';

// TEMPORARY — applies the isGuest column to production, then this route
// gets deleted. Protected by CRON_SECRET since it's already a private,
// server-only secret this project has for exactly this kind of internal call.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  await db.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;'
  );

  return NextResponse.json({status: 'ok'});
}
