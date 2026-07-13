'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {usePathname} from 'next/navigation';
import {signOut} from 'next-auth/react';
import {Moon, Sun, Wallet, LogOut, Menu, X} from 'lucide-react';
import {useTheme} from 'next-themes';
import {Button} from '@/components/ui/button';
import {formatCents, cn} from '@/lib/utils';

const NAV_LINKS = [
  {href: '/', label: 'Markets'},
  {href: '/markets/create', label: 'Create'},
  {href: '/portfolio', label: 'Portfolio'},
];

export function NavClient({
  user,
  balanceCents,
}: {
  user: {name: string; email: string} | null;
  balanceCents: number | null;
}) {
  const pathname = usePathname();
  const {theme, setTheme} = useTheme();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <nav className="hidden items-center gap-1 sm:flex">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
              pathname === link.href ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <button
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
      >
        {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {user ? (
        <div className="flex items-center gap-2">
          <Link href="/wallet">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              {balanceCents !== null ? formatCents(balanceCents) : '—'}
            </Button>
          </Link>
          <button
            aria-label="Sign out"
            onClick={() => signOut({callbackUrl: '/'})}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent sm:flex"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="hidden items-center gap-2 sm:flex">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Sign up</Button>
          </Link>
        </div>
      )}

      <button
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        onClick={() => setMenuOpen((open) => !open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent sm:hidden"
      >
        {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {menuOpen && (
        <div className="absolute inset-x-0 top-16 z-40 flex flex-col gap-1 border-b border-border bg-background p-3 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent',
                pathname === link.href ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={() => signOut({callbackUrl: '/'})}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
