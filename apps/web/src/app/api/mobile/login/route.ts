import {NextResponse} from 'next/server';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {db} from '@coinflalshi/db';
import {signMobileToken} from '@/lib/mobile-token';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({error: 'Invalid credentials'}, {status: 400});
  }

  const {email, password} = parsed.data;
  const user = await db.user.findUnique({where: {email}});
  if (!user) {
    return NextResponse.json({error: 'Invalid email or password'}, {status: 401});
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json({error: 'Invalid email or password'}, {status: 401});
  }

  const token = await signMobileToken({userId: user.id});

  return NextResponse.json({
    token,
    user: {id: user.id, email: user.email, name: user.name},
  });
}
