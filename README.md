# Coinflalshi

A prediction market — trade on sports, crypto, weather, and more — built as a
showcase of a full Coinflow payments integration (card, Apple Pay, Google Pay,
crypto deposits, 3DS, zero-auth card-on-file, and payouts).

Markets are simulated for demo purposes: each one resolves automatically a few
minutes after it's created (randomly, weighted by its current odds), settles
every open position, and a fresh market spawns to take its place — so there's
always something live to trade.

> **This project is sandbox-only, on purpose.** It only ever talks to
> Coinflow's sandbox API (`api-sandbox.coinflow.cash`). There is no
> production Coinflow environment configured anywhere, no env var that
> switches to one, and no code path that could construct a production
> Coinflow API URL — see `apps/web/src/lib/coinflow/config.ts`.

## Layout

```
apps/web      Next.js 16 app — the main product (marketing site, trading UI,
              auth, wallet, and all API routes). Also the backend the mobile
              app talks to.
apps/mobile   Expo (React Native) app — browse markets, trade, and deposit
              with the same Coinflow-powered wallet, on iOS/Android.
packages/db   Prisma schema + client, shared by the web app's API routes.
```

## Prerequisites

- Node 20+
- A [Neon](https://neon.tech) Postgres database (or any Postgres — Neon is
  the easy path on Vercel)
- A Coinflow merchant account (`predictionmarketmoon`) with a sandbox API key
- Xcode/Android Studio (or the Expo Go app) if you want to run the mobile app

## Setup

```bash
npm install

# Database
cp packages/db/.env.example packages/db/.env      # fill in your Neon URLs
npm run db:push                                    # create tables
npm run db:seed                                     # seed demo markets

# Web app
cp apps/web/.env.example apps/web/.env.local        # fill in Coinflow + auth secrets
npm run dev                                         # http://localhost:3000

# Mobile app (separate terminal)
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile
```

Register an account on the site (or in the app) — every new user gets an
empty demo wallet. Deposit with a test card (or, once configured, Apple
Pay/Google Pay/crypto) to fund it, then trade on any open market.

## Payments — what's wired up, and how

This integrates Coinflow via its direct REST API rather than the hosted
`CoinflowPurchase` checkout widget — `@coinflowlabs/react`'s PCI-compliant
tokenization primitives (`CoinflowCardForm` / `CoinflowCvvForm`, web;
`@coinflowlabs/react-native` equivalents on mobile) collect card data, and the
business logic (charging, 3DS, chargeback-protection data, webhooks) is
hand-wired server-side. See `apps/web/src/lib/coinflow/server.ts`.

| Feature | Status | Notes |
| --- | --- | --- |
| Card deposits | ✅ wired | `CoinflowCardForm` tokenizes the card; the resulting token is charged via `POST /checkout/card/{merchantId}`. 3DS challenges are handled with our own `ThreeDsChallengeModal` (Basis Theory bridge) since there's no hosted SDK to do it for us. |
| Apple Pay | 🚩 feature-flagged | Self-hosted `ApplePayButton` drives the native `ApplePaySession` API directly (Safari/WebKit only) and charges via `POST /checkout/v2/apple-pay/{merchantId}`. Requires an Apple Developer merchant id + domain association file + Coinflow-side cert upload. Set `NEXT_PUBLIC_COINFLOW_APPLE_PAY_ENABLED=true` once configured. |
| Google Pay | 🚩 feature-flagged | Self-hosted `GooglePayButton` (loads Google's `pay.js` directly) tokenizes with `gateway: "coinflow"` and charges via `POST /checkout/google-pay/{merchantId}`. Works out of the box in sandbox (`NEXT_PUBLIC_GOOGLE_PAY_ENVIRONMENT=TEST`); set `NEXT_PUBLIC_COINFLOW_GOOGLE_PAY_ENABLED=true` to show the button. Production needs Google Pay & Wallet Console approval. |
| Card-on-file / zero-auth | ✅ wired | The deposit panel has a "save this card without charging it" toggle, which calls `POST /checkout/zero-authorization/{merchantId}` instead of a real charge. |
| Crypto deposits | ✅ wired | `/api/wallet/crypto/address` calls Coinflow's passive deposit-address API server-side and persists the address per user/chain. Verify the exact request/response shape against `/api-reference` once your sandbox key is live — the fallback chain list in that route covers you if the live lookup errors. |
| Webhooks | ✅ wired | `/api/webhooks/coinflow` verifies the `Coinflow-Signature` HMAC and credits the user's ledger wallet on a `Settled` purchase event. Configure this URL (`https://<your-domain>/api/webhooks/coinflow`) under Developers → Webhooks in the Coinflow dashboard, and copy the Webhook Validation Key into `COINFLOW_WEBHOOK_VALIDATION_KEY`. |
| Payouts | 🚩 feature-flagged | `/api/wallet/withdraw/request` drives Coinflow's KYC → bank-account → payout REST endpoints server-side. This requires KYC and a payout method to be enabled on the merchant account first — set `COINFLOW_PAYOUTS_ENABLED=true` once that's done, and double check the request fields against `/api-reference/withdraw` in the sandbox (this path is less exhaustively verified than the deposit flow above). |

Settlement is left on Coinflow's default — funds land in your managed
Coinflow Wallet — so no extra settlement configuration is required to get
started.

### Where the money actually goes

- A deposit (card/Apple Pay/Google Pay/crypto) is a **real** Coinflow
  transaction. On success, the webhook credits the user's internal ledger
  balance (`Wallet.balanceCents`) for the amount deposited.
- Placing a bet debits that ledger balance and creates a `Position`. No
  Coinflow call happens here — it's bookkeeping against the balance you
  already funded.
- When a market resolves, winning positions credit the ledger balance
  directly (see `packages/db/src/resolveMarket.ts`).
- Withdrawing debits the ledger balance and triggers a real payout from the
  merchant's Coinflow wallet to the user's bank account.

## The market simulation

- `packages/db/src/marketTemplates.ts` — the pool of markets (a mix of real
  teams/events and a few invented ones for fun).
- `packages/db/src/seed.ts` — seeds the initial batch with staggered
  countdowns so you see the resolution loop working right away.
- `apps/web/src/app/api/cron/resolve-markets/route.ts` — resolves any market
  whose countdown has ended (weighted-random by its current odds), settles
  positions, and spawns a replacement market. Configured to run every minute
  in `apps/web/vercel.json`.

## Deploying to Vercel

1. Import the repo, set the **root directory** to `apps/web`.
2. Add a Postgres database (Vercel Marketplace → Neon, or connect your own)
   and pull the resulting `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.
3. Add the rest of the env vars from `apps/web/.env.example`.
4. Set `CRON_SECRET` — Vercel automatically sends it as `Authorization:
   Bearer <value>` to the cron route once the var exists.
5. Deploy. Run `npm run db:push && npm run db:seed` once (locally, pointed at
   the production `DATABASE_URL`, or via a one-off Vercel deploy hook).

The mobile app deploys separately via EAS Build/Submit once you're ready for
TestFlight/Play Console — it just needs `EXPO_PUBLIC_API_BASE_URL` pointed at
your deployed web app.

## Known gaps / next steps

- Apple Pay and Google Pay need your Apple Developer merchant id/certs and
  Google Pay merchant id configured on the Coinflow dashboard before flipping
  their feature flags on.
- Payouts need KYC + a payout method enabled on the merchant account; the
  request-field shapes in `lib/coinflow/server.ts` should be double-checked
  against the live sandbox once that's on.
- No automated test suite yet.
