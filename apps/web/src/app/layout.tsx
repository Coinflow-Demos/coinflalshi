import type {Metadata} from 'next';
import Script from 'next/script';
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
        {/* Coinflow's fraud-scoring script (sandbox partnerId, hardcoded on
            purpose — this project never touches Coinflow production). Must
            load on every page, not just checkout, per Coinflow's chargeback
            protection docs, or card charges get auto-declined with a
            generic "ad blockers" message. */}
        <Script id="nsure-init" strategy="beforeInteractive">
          {`window.nSureAsyncInit = function () {
            window.nSureSDK.init({appId: '9JBW2RHC7JNJN8ZQ', partnerId: 'COINFTEST'});
          };`}
        </Script>
        <Script src="https://sdk.nsureapi.com/sdk.js" strategy="beforeInteractive" />
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
