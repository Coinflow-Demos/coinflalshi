import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from '@coinflalshi/db';

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {error: 'Invalid registration details', issues: parsed.error.issues},
      {status: 400}
    );
  }

  const {name, email, password} = parsed.data;

  const existing = await db.user.findUnique({where: {email}});
  if (existing) {
    return NextResponse.json(
      {error: 'An account with that email already exists'},
      {status: 409}
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
      wallet: {create: {balanceCents: 0}},
    },
  });

  return NextResponse.json({id: user.id, email: user.email, name: user.name});
}
