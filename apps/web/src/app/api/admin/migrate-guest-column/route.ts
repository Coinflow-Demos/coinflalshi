import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';

// TEMPORARY — applies the isGuest column to production, then this route
// and MIGRATION_SECRET both get deleted.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  await db.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;'
  );

  return NextResponse.json({status: 'ok'});
}
