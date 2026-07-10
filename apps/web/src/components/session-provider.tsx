'use client';

import {SessionProvider as NextAuthSessionProvider} from 'next-auth/react';
import type {ComponentProps} from 'react';

export function SessionProvider({
  children,
  ...props
}: ComponentProps<typeof NextAuthSessionProvider>) {
  return <NextAuthSessionProvider {...props}>{children}</NextAuthSessionProvider>;
}
