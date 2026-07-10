import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';

export async function GET(
  _request: Request,
  {params}: {params: Promise<{slug: string}>}
) {
  const {slug} = await params;

  const market = await db.market.findUnique({
    where: {slug},
    include: {outcomes: true},
  });

  if (!market) {
    return NextResponse.json({error: 'Market not found'}, {status: 404});
  }

  return NextResponse.json({market});
}
