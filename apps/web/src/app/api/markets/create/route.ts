import {NextResponse} from 'next/server';
import {z} from 'zod';
import {db, createCustomMarket} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

const createSchema = z.object({
  title: z.string().trim().min(4).max(140),
  subtitle: z.string().trim().max(140).optional(),
  category: z.string().trim().min(1).max(40),
  imageEmoji: z.string().trim().max(8).optional(),
  outcomeLabels: z
    .tuple([z.string().trim().min(1).max(40), z.string().trim().min(1).max(40)])
    .refine(([a, b]) => a.toLowerCase() !== b.toLowerCase(), 'Outcomes must be different'),
  durationMinutes: z.number().int().refine((v) => [5, 10, 15, 30].includes(v), {
    message: 'Duration must be 5, 10, 15, or 30 minutes',
  }),
});

export async function POST(request: Request) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {error: parsed.error.issues[0]?.message ?? 'Invalid market'},
      {status: 400}
    );
  }

  const user = await db.user.findUnique({where: {id: userId}, select: {name: true}});
  if (!user) {
    return NextResponse.json({error: 'User not found'}, {status: 404});
  }

  const market = await createCustomMarket({
    ...parsed.data,
    creatorId: userId,
    creatorName: user.name,
  });

  return NextResponse.json({market});
}
