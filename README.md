# Coinflalshi — Payments Integration

How this app integrates Coinflow: direct REST API calls, not the hosted
checkout widget. **Every API call to Coinflow in this codebase lives in one
file: `apps/web/src/lib/coinflow/server.ts`** — that's the file to read.

> **Sandbox only, on purpose.** Always talks to `api-sandbox.coinflow.cash`,
> never production — see `apps/web/src/lib/coinflow/config.ts`.

## Card deposits

| What | Endpoint | Function |
| --- | --- | --- |
| New card | `POST /api/checkout/card/{merchantId}` | `chargeCoinflowCard` |
| Saved card (CVV re-entry) | `POST /api/checkout/token/{merchantId}` | `chargeCoinflowSavedCard` |
| Card on file (no CVV) | `POST /api/checkout/card-on-file` | `chargeCoinflowCardOnFile` |
| Card-on-file eligibility check | `POST /api/checkout/card-on-file-authorized` | `checkCoinflowCardOnFileAuthorized` |
| Save a card without charging | `POST /api/checkout/zero-authorization/{merchantId}` | `zeroAuthorizeCoinflowCard` |
| Remove a saved card | `DELETE /api/customer/card/{cardToken}` | `revokeCoinflowCard` |

Card tokenization happens client-side via `CoinflowCardForm` /
`CoinflowCvvForm` — we never see raw card numbers. Card-on-file and its
eligibility check are authenticated with a merchant API key, not a session
key like everything else here.

## 3DS challenges

A charge can come back `412` with `{transactionId, url, creq}` instead of
succeeding — that means a 3DS challenge is required. We render it
(`ThreeDsChallengeModal`) and complete the charge afterward with
`authentication3DS: {transactionId}`.

In practice, this merchant's challenges come back with `creq` populated —
no config needed, just an auto-submitting iframe form that POSTs `creq` to
the ACS `url`.

## Apple Pay

| What | Endpoint | Function |
| --- | --- | --- |
| Merchant validation | `GET /api/checkout/apple-pay/validatemerchant` | `getCoinflowApplePayMerchantSession` |
| Charge | `POST /api/checkout/v2/apple-pay/{merchantId}` | `chargeCoinflowApplePay` |

Self-hosted `ApplePayButton` drives Apple's native `ApplePaySession` API —
not Coinflow's hosted checkout. Needs a domain-association file plus either
an Apple Developer Merchant ID (with a cert uploaded to Coinflow) or
approval to use Coinflow's shared merchant path.

## Google Pay

| What | Endpoint | Function |
| --- | --- | --- |
| Charge | `POST /api/checkout/google-pay/{merchantId}` | `chargeCoinflowGooglePay` |

Self-hosted `GooglePayButton` loads Google's `pay.js` directly and tokenizes
with `gateway: "coinflow"`.

## Chargeback protection

Every charge (card, saved card, card on file, Apple Pay, Google Pay) sends
`chargebackProtectionData` — a cart item describing the deposit as a
`moneyTopUp`, plus `chargebackProtectionAccountType: 'private'` and
`settlementType: 'USDC'`. This is what covers the transaction against a
later chargeback. One gotcha: the amounts inside that cart item are in
**dollars**, not cents — the one place in the whole request that isn't cents.

Chargeback protection also relies on a device id from Coinflow's fraud
partner, nSure — its SDK is initialized once in the root layout
(`apps/web/src/app/layout.tsx`), and `getFraudProtectionDeviceId()` reads the
resulting device id and sends it as `x-device-id` on every card-family
charge.

## Webhooks

Charging Coinflow only ever creates a `PENDING` transaction —
**the wallet is only credited once Coinflow's webhook confirms the payment
settled**, not when the charge call itself returns success.

- `POST /api/webhooks/coinflow` verifies the `Coinflow-Signature` header
  (HMAC-SHA256 over the timestamp + body).
- Event types handled: `Settled` (credit), `Card Payment Declined` /
  `Card Payment Voided` / `Payment Expiration` (mark failed),
  `Card Payment Chargeback Opened` (reverse a prior credit), and
  `Crypto Payin Funds Received` (crypto deposits).
- Configure the endpoint URL under Developers → Webhooks in the Coinflow
  dashboard, and set `COINFLOW_WEBHOOK_VALIDATION_KEY`.

## Crypto deposits

| What | Endpoint | Function |
| --- | --- | --- |
| List supported chains | `GET /api/merchant/customer-payin-addresses/supported-chains` | `getCoinflowSupportedChains` |
| Create a deposit address | `POST /api/checkout/crypto-deposit-address/{merchantId}` | `createCoinflowDepositAddress` |

Credited via the `Crypto Payin Funds Received` webhook above, not the
card-deposit `Settled` path.

## Withdrawals (payouts)

| What | Endpoint | Function |
| --- | --- | --- |
| Link a payout method | Coinflow's hosted Bank Authentication UI (iframe) | `buildCoinflowBankAuthUrl` |
| List linked methods | `GET /api/withdraw` | `getCoinflowWithdrawer` |
| Send the payout | `POST /api/merchant/withdraws/payout/delegated` | `submitCoinflowDelegatedPayout` |

Requires KYC and a payout method enabled on the merchant account. The actual
payout call is authenticated with a merchant API key only — a user can never
trigger it directly, and Coinflow independently confirms the payout account
belongs to the requesting user.

## Where the money goes

A deposit credits the wallet. Placing a bet debits it. A resolved market
credits winning positions. Withdrawing debits the wallet and triggers a real
payout to the user's bank account.
