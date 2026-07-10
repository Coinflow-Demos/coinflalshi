import Link from 'next/link';
import {auth} from '@/auth';
import {db} from '@coinflalshi/db';
import {Logo} from '@/components/logo';
import {NavClient} from '@/components/nav-client';

export async function Nav() {
  const session = await auth();
  const userId = session?.user?.id;

  const wallet = userId ? await db.wallet.findUnique({where: {userId}}) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <NavClient
          user={session?.user ? {name: session.user.name ?? '', email: session.user.email ?? ''} : null}
          balanceCents={wallet?.balanceCents ?? null}
        />
      </div>
    </header>
  );
}
