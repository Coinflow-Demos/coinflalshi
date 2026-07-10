import type {Metadata} from 'next';
import {Inter, Figtree} from 'next/font/google';
import {ThemeProvider} from '@/components/theme-provider';
import {SessionProvider} from '@/components/session-provider';
import {Nav} from '@/components/nav';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Coinflalshi — Trade on what happens next',
  description:
    'A prediction market for sports, crypto, weather, and more. Deposit with card, Apple Pay, Google Pay, or crypto — powered by Coinflow.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <Nav />
            <main className="flex-1">{children}</main>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
