import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {db} from '@coinflalshi/db';

export const {handlers, auth, signIn, signOut} = NextAuth({
  session: {strategy: 'jwt'},
  pages: {signIn: '/login'},
  providers: [
    Credentials({
      credentials: {
        email: {label: 'Email', type: 'email'},
        password: {label: 'Password', type: 'password'},
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await db.user.findUnique({where: {email}});
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash
        );
        if (!passwordMatches) return null;

        return {id: user.id, email: user.email, name: user.name};
      },
    }),
    Credentials({
      id: 'guest',
      name: 'Guest',
      credentials: {},
      // No real credentials — every attempt mints a brand-new, throwaway
      // user with an unguessable password (there's nothing to remember, so
      // there's no way back into this account once it's gone).
      authorize: async () => {
        const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
        const user = await db.user.create({
          data: {
            name: 'Guest',
            email: `guest-${crypto.randomUUID()}@guest.coinflalshi.local`,
            passwordHash,
            isGuest: true,
            wallet: {create: {balanceCents: 0}},
          },
        });
        return {id: user.id, email: user.email, name: user.name};
      },
    }),
  ],
  callbacks: {
    jwt: ({token, user}) => {
      if (user?.id) token.userId = user.id;
      return token;
    },
    session: ({session, token}) => {
      if (token.userId && typeof token.userId === 'string') {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
