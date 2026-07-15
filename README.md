# Coinflalshi — Payments Integration

This documents the Coinflow payments integration in this codebase: card
deposits, saved cards, card on file, Apple Pay, Google Pay, 3DS challenges,
chargeback protection, webhooks, crypto deposits, and payouts.

> **This project is sandbox-only, on purpose.** It only ever talks to
> Coinflow's sandbox API (`api-sandbox.coinflow.cash`). There is no
> production Coinflow environment configured anywhere, no env var that
> switches to one, and no code path that could construct a production
> Coinflow API URL — see `apps/web/src/lib/coinflow/config.ts`.

## Payments — what's wired up, and how

This integrates Coinflow via its direct REST API rather than the hosted
`CoinflowPurchase` checkout widget — `@coinflowlabs/react`'s PCI-compliant
tokenization primitives (`CoinflowCardForm` / `CoinflowCvvForm`, web;
`@coinflowlabs/react-native` equivalents on mobile) collect card data, and the
business logic (charging, 3DS, chargeback-protection data, webhooks) is
hand-wired server-side in `apps/web/src/lib/coinflow/server.ts`. Every
endpoint and field name below has been checked directly against Coinflow's
backend source, not just its public docs — the two disagree in one place
(noted below), and where they do, this app follows the actual server
behavior.

### Card deposits

- `CoinflowCardForm` tokenizes the card client-side; the token is charged via
  `POST /api/checkout/card/{merchantId}`, authenticated with a session key
  alone (`x-coinflow-auth-session-key` — no merchant API key needed).
- Saved cards re-verify the CVV (`CoinflowCvvForm`) and charge via
  `POST /api/checkout/token/{merchantId}` instead — this endpoint needs a
  *customer-scoped* session key (minted with `x-coinflow-auth-user-id`), a
  stricter requirement than the plain card charge above.
- If a saved card is eligible for **card on file**, it charges with no CVV
  prompt at all via `POST /api/checkout/card-on-file` — a genuinely different
  endpoint from the one above, authenticated with a merchant API key +
  `x-coinflow-auth-user-id` instead of a session key (every other checkout
  endpoint here uses a session key; this one doesn't). Before offering it,
  `POST /api/checkout/card-on-file-authorized` checks eligibility — it can
  come back `false` for reasons ranging from an expired verification window
  to card-on-file simply not being enabled on the merchant account yet, in
  which case the app falls back to the CVV form automatically with no visible
  difference to the user.
- "Save this card without charging it" uses
  `POST /api/checkout/zero-authorization/{merchantId}`. This endpoint has a
  narrower body than a real charge — no `subtotal`, `chargebackProtectionData`,
  or `settlementType` fields exist on it, and it does **not** accept a
  `reason` field either (that field exists on Coinflow's internal type but is
  stripped from the public endpoint's schema).
- Removing a saved card also calls `DELETE /api/customer/card/{cardToken}`
  (session-key auth) to revoke it at Coinflow — not just deleting our local
  reference, which would otherwise leave the card live and chargeable in
  Coinflow's vault indefinitely.

### 3DS challenges

- A `412` response means a challenge is required, with body
  `{transactionId, url, creq}`. Which fields matter depends on which
  tokenization provider issued the card:
  - **TokenEx**: both `url` (the card issuer's ACS URL) and `creq` (an
    encoded challenge request) are populated — POST `creq` to `url` in an
    auto-submitting iframe form.
  - **Basis Theory**: `creq` is always an empty string; `url` instead points
    at an internal bridge page with challenge params (`acsChallengeUrl`,
    `acsTransactionId`, `sessionId`, `threeDSVersion`) in its query string,
    handed to the `@basis-theory/web-threeds` SDK to render in-page.
- `ThreeDsChallengeModal` picks the right path based on whether `creq` is
  empty. The native app has no DOM for that SDK, so it loads
  `/embed/3ds-challenge` in a WebView and gets the result back via
  `postMessage` instead.
- Completing a challenge sends `authentication3DS: {transactionId}` — that
  object accepts **only** the `transactionId` key, nothing else.
- The original charge details (card token/expiry/billing, the saved card's
  `cvvVerifiedToken`, or the card-on-file `savedPaymentMethodId`) are stashed
  server-side on the pending transaction when the challenge is issued, and
  read back at `/complete` — never re-trusted from what the client resubmits
  after the challenge.
- The browser-signal fields (`colorDepth`, `screenHeight`, `screenWidth`,
  `timeZone`) sent as `authentication3DS` on the initial charge match
  Coinflow's own production checkout widget's code exactly — `timeZone` is
  `getTimezoneOffset()` with no sign change. Coinflow's own public Fern docs
  recipes show it negated instead; this app follows the actual widget code,
  not the docs example, since that's what's verified against the real
  backend.

### Apple Pay

- Self-hosted `ApplePayButton` drives the native `ApplePaySession` API
  directly (Safari/WebKit only) — not Coinflow's hosted checkout.
- Merchant validation: `GET /api/checkout/apple-pay/validatemerchant`
  (unauthenticated) with `domainName` + `merchantId`.
- Charge: `POST /api/checkout/v2/apple-pay/{merchantId}`. No
  `authentication3DS` field — Apple Pay handles device authentication itself
  and never returns a 3DS challenge.
- Needs a domain-association file under `/.well-known/` plus either (a) an
  Apple Developer Merchant ID with its own signed certificate uploaded to
  Coinflow, or (b) approval to use Coinflow's shared "PSP" merchant path via a
  whitelisted-URL request. Set `NEXT_PUBLIC_COINFLOW_APPLE_PAY_ENABLED=true`
  once either is configured.
- Coinflow reads the buyer's email from `shippingContact` first, falling back
  to `billingContact` — but Apple's web payment sheet only reliably populates
  email via `requiredShippingContactFields`, so the button requests it there
  even though this isn't a real shipment.

### Google Pay

- Self-hosted `GooglePayButton`, loads Google's `pay.js` directly — also not
  the hosted checkout widget.
- Tokenizes with `gateway: "coinflow"` and the Coinflow merchant id as
  `gatewayMerchantId`.
- Charge: `POST /api/checkout/google-pay/{merchantId}` — same
  session-key/chargeback-protection/3DS shape as a card charge, since
  Coinflow treats it as another card-family charge. Unlike Apple Pay, it
  *can* return a 412 challenge; this app doesn't attempt to resolve one — it
  fails cleanly and asks the user to pay with the card form instead.
- `billingAddressRequired: true` + `format: 'FULL'` on the Google Pay request
  are load-bearing, not decorative — Coinflow reads the cardholder name and
  address straight out of `paymentMethodData.info.billingAddress` for its
  fraud check.
- Works out of the box in sandbox (`NEXT_PUBLIC_GOOGLE_PAY_ENVIRONMENT=TEST`);
  set `NEXT_PUBLIC_COINFLOW_GOOGLE_PAY_ENABLED=true` to show the button.
  Production needs Google Pay & Wallet Console approval.

### Chargeback protection

- Every charge (card, saved card, Apple Pay, Google Pay) sends
  `chargebackProtectionData` — an array with one `moneyTopUp`-class cart item
  describing the deposit as a balance top-up — plus
  `chargebackProtectionAccountType: 'private'`.
- `sellingPrice`/`topUpAmount` inside that cart item are in **dollars**
  (`valueInCurrency`), not cents — the one place in the whole request that
  isn't cents. Deposits divide the cents amount by 100 specifically for this
  field.
- `recipientInfo.accountId` is set to the user's own internal id, so repeat
  purchases can be linked to the same buyer for risk scoring.

### Webhooks

Every deposit method above (card, saved card, card on file, Apple Pay,
Google Pay) only creates a `PENDING` transaction row and calls Coinflow —
**the wallet balance is only ever credited by this webhook**, not by the
charge API responding "success." A charge can come back successful and the
wallet still won't show the funds until the webhook fires (usually
near-instant, but not synchronous).

- `POST /api/webhooks/coinflow` verifies `HMAC-SHA256("${timestamp}.${body}")`
  against the `Coinflow-Signature: t=<ts>,v1=<hex>` header, compared with a
  constant-time check. A missing or invalid signature is rejected with a
  `401` before anything else runs.
- The pending transaction is looked up by `data.webhookInfo.pendingTransactionId`
  first (the id we passed in on the original charge), falling back to
  `data.id` matched against our stored `coinflowPaymentId` if that's absent.
- Real event names handled: `Settled` (credit the wallet),
  `Card Payment Declined` / `Card Payment Voided` / `Payment Expiration`
  (mark the deposit failed), `Card Payment Chargeback Opened` (reverse a
  previously-credited deposit), and `Crypto Payin Funds Received` (a
  differently-shaped payload — `paymentId`/`customerId`/`amount` instead of
  `id`/`webhookInfo`, since crypto pay-ins aren't tied to a pending
  transaction we created up front).
- Coinflow retries webhook deliveries, so every credit/reversal is gated by
  an atomic, status-conditioned update (`updateMany` with the expected
  current status in the `WHERE` clause) — a duplicate delivery matches zero
  rows and no-ops instead of double-crediting or double-reversing a wallet.
  The crypto path uses a different but equivalent guard: `coinflowPaymentId`
  is a `@unique` column, so a duplicate `Crypto Payin Funds Received` event
  is caught by a lookup before the credit, not by a conditional update.
- Configure the endpoint URL (`https://<your-domain>/api/webhooks/coinflow`)
  under Developers → Webhooks in the Coinflow dashboard, and copy the Webhook
  Validation Key into `COINFLOW_WEBHOOK_VALIDATION_KEY`.

### Crypto deposits

- `GET /api/merchant/customer-payin-addresses/supported-chains`
  (merchant-API-key auth) lists supported chains.
- `POST /api/checkout/crypto-deposit-address/{merchantId}` (session-key auth)
  creates a deposit address, persisted per user/chain so repeat visits reuse
  the same one.
- Credited via the `Crypto Payin Funds Received` webhook above, not the
  card-deposit `Settled` path.

### Withdrawals (payouts)

- Linking a payout method uses Coinflow's hosted Bank Authentication UI in an
  iframe (`app-sandbox.coinflow.cash/solana/link/{merchantId}`) — we never
  see routing/account numbers. Coinflow's own docs show
  `/solana/withdraw/{merchantId}` as the canonical example instead; both are
  real, working entry points against the live sandbox, just documented
  differently.
- `GET /api/withdraw` ("Get Withdrawer") lists linked payout methods. A `401`
  means no withdrawer record exists yet (auto-registered via
  `POST /api/withdraw/kyc`); a `451` means Persona identity verification is
  required before continuing.
- The actual payout — `POST /api/merchant/withdraws/payout/delegated` —
  accepts **only** merchant-API-key auth; there's no session-key alternative,
  so a user can never trigger it directly. Coinflow independently validates
  that the payout account token actually belongs to the requesting user.
- The idempotency key is generated once per withdrawal attempt on the client
  and reused on retry (same amount + account), so a network-level retry
  can't risk a duplicate payout.
- Requires KYC and a payout method enabled on the merchant account — set
  `COINFLOW_PAYOUTS_ENABLED=true` once that's done.

### Known simplifications

Deliberate scope cuts, not bugs — worth knowing if you're extending this:

- Web card charges don't forward the Forter device token (`forterToken`)
  that the mobile app does — a real fraud-signal gap on web, not a
  correctness issue.
- A `410` "revalidate CVV" response shows a generic error message instead of
  Coinflow's specific `RevalidateCVVFields` guidance.
- Card form validation (name length, expiry digit count) is looser than
  Coinflow's actual field constraints — not exploitable, since
  `CoinflowCardForm` already returns valid values, just unenforced
  defense-in-depth.
- A chargeback reversal only handles `Card Payment Chargeback Opened`; a won
  dispute isn't re-credited, since the schema has no field to distinguish
  "reversed by chargeback" from "was never completed."
- The zero-auth "save card without charging" completion route
  (`payment-methods/save/complete`) still trusts client-resubmitted card
  details rather than reading from a stored record, unlike the paid-charge
  completion routes — it has no persisted pending-transaction to extend, and
  moves no money either way, so the risk is much lower.
- The merchant id (`predictionmarketmoon`) is a hardcoded literal in four
  client-side files instead of one shared constant.

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
