import 'server-only';
import {coinflowConfig, COINFLOW_APP_BASE_URL} from './config';

/** Coinflow error bodies are sometimes a string, sometimes a structured
 * validation object — never assume `msg`/`details` is printable as-is. */
function describeCoinflowError({
  data,
  status,
  fallback,
}: {
  data: unknown;
  status: number;
  fallback: string;
}): string {
  const body = (data ?? {}) as Record<string, unknown>;
  const raw = body.msg ?? body.details ?? body.error ?? null;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (raw && typeof raw === 'object') return JSON.stringify(raw);
  return `${fallback} (${status})`;
}

async function coinflowFetch<T>({
  path,
  method = 'GET',
  headers = {},
  body,
}: {
  path: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<T> {
  const response = await fetch(`${coinflowConfig.apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? {'Content-Type': 'application/json'} : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = describeCoinflowError({
      data,
      status: response.status,
      fallback: `Coinflow ${method} ${path} failed`,
    });
    console.error(`[coinflow] ${method} ${path} -> ${response.status}`, data);
    throw new Error(message);
  }
  return data as T;
}

/** Identifies the payer to Coinflow using our internal user id. Valid 24h. */
export async function getCoinflowSessionKey({userId}: {userId: string}) {
  const {key} = await coinflowFetch<{key: string}>({
    path: '/api/auth/session-key',
    headers: {
      Authorization: coinflowConfig.apiKey(),
      'x-coinflow-auth-user-id': userId,
    },
  });
  return key;
}

/** Short-lived JWT scoped to a specific checkout amount, used by the CoinflowPurchase SDK. */
export async function getCoinflowCheckoutJwt({subtotalCents}: {subtotalCents: number}) {
  const {checkoutJwtToken} = await coinflowFetch<{checkoutJwtToken: string}>({
    path: '/api/checkout/jwt-token',
    method: 'POST',
    headers: {Authorization: coinflowConfig.apiKey()},
    body: {subtotal: {cents: subtotalCents}},
  });
  return checkoutJwtToken;
}

export async function getCoinflowTotals({
  sessionKey,
  subtotalCents,
}: {
  sessionKey: string;
  subtotalCents: number;
}) {
  return coinflowFetch<{
    card?: {total: {cents: number}; creditCardFees: {cents: number}};
  }>({
    path: `/api/checkout/totals/${coinflowConfig.merchantId}`,
    method: 'POST',
    headers: {'x-coinflow-auth-session-key': sessionKey},
    body: {subtotal: {cents: subtotalCents}, settlementType: 'USDC'},
  });
}

export interface CardBillingInfo {
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ThreeDsBrowserParams {
  colorDepth: number;
  screenHeight: number;
  screenWidth: number;
  timeZone: number;
}

export type CoinflowChallengeableResult =
  | {status: 'success'; paymentId: string}
  | {status: 'challenge'; transactionId: string; creq: string; url: string};

const moneyTopUpChargebackProtection = (subtotalCents: number) => [
  {
    itemClass: 'moneyTopUp',
    quantity: 1,
    isPresetAmount: true,
    sellingPrice: {valueInCurrency: subtotalCents / 100, currency: 'USD'},
    topUpAmount: {valueInCurrency: subtotalCents / 100, currency: 'USDC'},
  },
];

/**
 * POSTs to any of Coinflow's card-family checkout endpoints
 * (card/token/zero-authorization) and normalizes the 3DS-challenge branch.
 * A 412 with `transactionId` + `url` means a challenge is required — that's a
 * normal outcome, not a failure, so it's returned as a discriminated result
 * rather than thrown. Some providers (e.g. Basis Theory) return a
 * redirect-style ACS challenge with everything embedded in `url` and an empty
 * `creq`, rather than the POST-a-creq-form style Coinflow's docs show — the
 * client renders whichever one it actually got.
 */
async function postCoinflowChallengeableCheckout({
  path,
  sessionKey,
  deviceId,
  body,
}: {
  path: string;
  sessionKey: string;
  deviceId?: string;
  body: unknown;
}): Promise<CoinflowChallengeableResult> {
  const response = await fetch(`${coinflowConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-coinflow-auth-session-key': sessionKey,
      ...(deviceId ? {'x-device-id': deviceId} : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 412 && data.transactionId && data.url) {
    return {status: 'challenge', transactionId: data.transactionId, creq: data.creq ?? '', url: data.url};
  }

  if (!response.ok) {
    const message = describeCoinflowError({data, status: response.status, fallback: 'Charge failed'});
    console.error(`[coinflow] POST ${path} -> ${response.status}`, data);
    throw new Error(message);
  }

  return {status: 'success', paymentId: data.paymentId};
}

/** Direct card charge against POST /checkout/card/{merchantId}. */
export async function chargeCoinflowCard({
  sessionKey,
  subtotalCents,
  cardToken,
  expMonth,
  expYear,
  billing,
  authentication3DS,
  pendingTransactionId,
  saveCard,
  deviceId,
}: {
  sessionKey: string;
  subtotalCents: number;
  cardToken: string;
  expMonth: string;
  expYear: string;
  billing: CardBillingInfo;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  pendingTransactionId: string;
  saveCard?: boolean;
  /** From window.nSureSDK.getDeviceId() on the client — required for
   * Coinflow's fraud/chargeback-protection scoring, or the charge gets
   * auto-declined. */
  deviceId?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/card/${coinflowConfig.merchantId}`,
    sessionKey,
    deviceId,
    body: {
      subtotal: {cents: subtotalCents},
      webhookInfo: {pendingTransactionId},
      authentication3DS,
      saveCard: Boolean(saveCard),
      card: {
        cardToken,
        expMonth,
        expYear,
        email: billing.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
        address1: billing.address1,
        city: billing.city,
        state: billing.state,
        zip: billing.zip,
        country: billing.country,
      },
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents),
      settlementType: 'USDC',
    },
  });
}

/**
 * Saves a card without charging it, via POST /checkout/zero-authorization/{merchantId}.
 * Returns the same discriminated success/challenge result as a real charge.
 */
export async function zeroAuthorizeCoinflowCard({
  sessionKey,
  cardToken,
  expMonth,
  expYear,
  billing,
  authentication3DS,
  deviceId,
}: {
  sessionKey: string;
  cardToken: string;
  expMonth: string;
  expYear: string;
  billing: CardBillingInfo;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  deviceId?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/zero-authorization/${coinflowConfig.merchantId}`,
    sessionKey,
    deviceId,
    body: {
      reason: 'unscheduled',
      authentication3DS,
      card: {
        cardToken,
        expMonth,
        expYear,
        email: billing.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
        address1: billing.address1,
        city: billing.city,
        state: billing.state,
        zip: billing.zip,
        country: billing.country,
      },
    },
  });
}

/**
 * Charges a previously-saved card via POST /checkout/token/{merchantId}. The
 * token must have a fresh CVV association (see CoinflowCvvForm) or this
 * returns a 410 asking for revalidation, surfaced as a thrown error.
 */
export async function chargeCoinflowSavedCard({
  sessionKey,
  subtotalCents,
  cvvVerifiedToken,
  authentication3DS,
  pendingTransactionId,
  deviceId,
}: {
  sessionKey: string;
  subtotalCents: number;
  cvvVerifiedToken: string;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  pendingTransactionId: string;
  deviceId?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/token/${coinflowConfig.merchantId}`,
    sessionKey,
    deviceId,
    body: {
      subtotal: {cents: subtotalCents},
      webhookInfo: {pendingTransactionId},
      authentication3DS,
      token: cvvVerifiedToken,
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents),
      settlementType: 'USDC',
    },
  });
}

export async function getCoinflowSupportedChains() {
  return coinflowFetch<{chains: string[]}>({
    path: '/api/merchant/customer-payin-addresses/supported-chains',
    headers: {Authorization: coinflowConfig.apiKey()},
  });
}

export async function createCoinflowDepositAddress({
  sessionKey,
  chain,
  email,
}: {
  sessionKey: string;
  chain: string;
  /** Required by Coinflow — used for Glide's refund emails on this address. */
  email: string;
}) {
  return coinflowFetch<{depositAddress: string; chain: string; status: string}>({
    path: `/api/checkout/crypto-deposit-address/${coinflowConfig.merchantId}`,
    method: 'POST',
    headers: {'x-coinflow-auth-session-key': sessionKey},
    body: {chain, email},
  });
}

// --- Payouts (withdraws) -----------------------------------------------
// Real flow, verified against Coinflow's own source (not just the docs):
// 1. User links a payout method (bank via Plaid, card, PayPal, etc) through
//    the hosted Bank Authentication UI — we never see routing/account numbers.
// 2. We list what's linked via GET /api/withdraw ("Get Withdrawer"), which
//    accepts the same session-key auth as checkout.
// 3. The user picks one; we submit the payout with that method's token via
//    POST /api/merchant/withdraws/payout/delegated, authenticated with the
//    merchant API key (server-side only, never sent to the client).

export type CoinflowWithdrawSpeed =
  | 'asap'
  | 'same_day'
  | 'standard'
  | 'card'
  | 'iban'
  | 'pix'
  | 'eft'
  | 'venmo'
  | 'paypal'
  | 'wire'
  | 'interac';

export interface LinkedPayoutMethod {
  /** PCI-compliant token — passed as `account` to the delegated payout call. */
  token: string;
  speed: CoinflowWithdrawSpeed;
  label: string;
}

export type CoinflowWithdrawerResult =
  | {status: 'ok'; methods: LinkedPayoutMethod[]}
  | {status: 'verification_required'; verificationLink: string};

/**
 * Builds the hosted Bank Authentication UI URL. Coinflow's own merchant app
 * routes this as `/{blockchain}/link/{merchantId}` (confirmed in
 * apps/ui/core-flows/src/Routes.tsx) — the "solana" segment is just routing
 * boilerplate left over from Coinflow's wallet-first history and has no
 * bearing on card/bank-only merchants like this one. On success the iframe
 * posts a `{method: "accountLinked"}` message to window.parent.
 */
export function buildCoinflowBankAuthUrl({
  sessionKey,
  redirectUrl,
}: {
  sessionKey: string;
  redirectUrl: string;
}): string {
  const params = new URLSearchParams({
    sessionKey,
    bankAccountLinkRedirect: redirectUrl,
  });
  return `${COINFLOW_APP_BASE_URL}/solana/link/${coinflowConfig.merchantId}?${params.toString()}`;
}

interface RawTokenAccount {
  token: string;
  alias?: string;
  isDeleted?: boolean;
}

interface RawWithdrawerResponse {
  withdrawer?: {
    bankAccounts?: (RawTokenAccount & {last4: string; wireRoutingNumber?: string})[];
    cards?: {token: string; last4: string; type?: string; isDeleted?: boolean}[];
    ibans?: (RawTokenAccount & {last4: string})[];
    efts?: (RawTokenAccount & {mask: string})[];
    pixes?: {token: string; key: string}[];
    venmo?: RawTokenAccount;
    paypal?: RawTokenAccount;
    interac?: RawTokenAccount;
  };
  verificationLink?: string;
}

type FetchWithdrawerResult = CoinflowWithdrawerResult | {status: 'no_withdrawer'};

async function fetchWithdrawerOnce({
  sessionKey,
  redirectUrl,
}: {
  sessionKey: string;
  redirectUrl?: string;
}): Promise<FetchWithdrawerResult> {
  const query = redirectUrl ? `?${new URLSearchParams({redirectLink: redirectUrl}).toString()}` : '';
  const response = await fetch(`${coinflowConfig.apiBaseUrl}/api/withdraw${query}`, {
    headers: {Accept: 'application/json', 'x-coinflow-auth-session-key': sessionKey},
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as RawWithdrawerResponse;

  // Coinflow's auth middleware throws this specific 401 when the session key
  // is valid but no withdrawer record exists yet for this user — it has to be
  // created via POST /api/withdraw/kyc first (see registerCoinflowWithdrawer).
  if (response.status === 401) {
    return {status: 'no_withdrawer'};
  }
  if (response.status === 451) {
    return {status: 'verification_required', verificationLink: data.verificationLink ?? ''};
  }
  if (!response.ok) {
    console.error('[coinflow] GET /api/withdraw ->', response.status, data);
    throw new Error(
      describeCoinflowError({
        data,
        status: response.status,
        fallback: 'Failed to load linked payout accounts',
      })
    );
  }

  const w = data.withdrawer ?? {};
  const methods: LinkedPayoutMethod[] = [];

  for (const bank of w.bankAccounts ?? []) {
    if (bank.isDeleted) continue;
    methods.push({
      token: bank.token,
      speed: bank.wireRoutingNumber ? 'wire' : 'standard',
      label: `Bank account •••• ${bank.last4}`,
    });
  }
  for (const card of w.cards ?? []) {
    if (card.isDeleted) continue;
    methods.push({token: card.token, speed: 'card', label: `${card.type ?? 'Card'} •••• ${card.last4}`});
  }
  for (const iban of w.ibans ?? []) {
    methods.push({token: iban.token, speed: 'iban', label: `IBAN •••• ${iban.last4}`});
  }
  for (const eft of w.efts ?? []) {
    if (eft.isDeleted) continue;
    methods.push({token: eft.token, speed: 'eft', label: `Bank account •••• ${eft.mask}`});
  }
  for (const pix of w.pixes ?? []) {
    methods.push({token: pix.token, speed: 'pix', label: `PIX ${pix.key}`});
  }
  if (w.venmo && !w.venmo.isDeleted) {
    methods.push({
      token: w.venmo.token,
      speed: 'venmo',
      label: `Venmo${w.venmo.alias ? ` (${w.venmo.alias})` : ''}`,
    });
  }
  if (w.paypal && !w.paypal.isDeleted) {
    methods.push({
      token: w.paypal.token,
      speed: 'paypal',
      label: `PayPal${w.paypal.alias ? ` (${w.paypal.alias})` : ''}`,
    });
  }
  if (w.interac && !w.interac.isDeleted) {
    methods.push({
      token: w.interac.token,
      speed: 'interac',
      label: `Interac${w.interac.alias ? ` (${w.interac.alias})` : ''}`,
    });
  }

  return {status: 'ok', methods};
}

/**
 * Creates the Coinflow "withdrawer" record for this user, via POST
 * /api/withdraw/kyc — confirmed in WithdrawController's docstring
 * ("Will create a withdrawer record for the user if one does not exist").
 * Without this, GET /api/withdraw 401s with "No withdrawer associated with
 * wallet". Uses the lightweight doc-verification-style body (email +
 * country) rather than the full address/DOB form, since Coinflow will
 * itself request a 451 verification step if more is needed.
 */
async function registerCoinflowWithdrawer({
  sessionKey,
  email,
  country = 'US',
  redirectUrl,
}: {
  sessionKey: string;
  email: string;
  country?: string;
  redirectUrl?: string;
}): Promise<{status: 'ok'} | {status: 'verification_required'; verificationLink: string}> {
  const response = await fetch(`${coinflowConfig.apiBaseUrl}/api/withdraw/kyc`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-coinflow-auth-session-key': sessionKey,
    },
    body: JSON.stringify({email, country, redirectLink: redirectUrl}),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));

  if (response.status === 451) {
    return {status: 'verification_required', verificationLink: data.verificationLink ?? ''};
  }
  if (!response.ok) {
    console.error('[coinflow] POST /api/withdraw/kyc ->', response.status, data);
    throw new Error(
      describeCoinflowError({data, status: response.status, fallback: 'Could not register withdrawer'})
    );
  }
  return {status: 'ok'};
}

/**
 * Lists every payout method (bank/card/PayPal/Venmo/IBAN/PIX/Interac) the
 * user has already linked, via GET /api/withdraw ("Get Withdrawer"). Uses
 * session-key auth — confirmed in Coinflow's WithdrawController that this
 * endpoint accepts `sessionKey` scope, so no separate wallet-based auth is
 * needed. Transparently registers a withdrawer record on first use (see
 * registerCoinflowWithdrawer) and retries once. A 451 (either from this call
 * or from registration) means the user must complete additional
 * KYC/verification before they can withdraw at all.
 */
export async function getCoinflowWithdrawer({
  sessionKey,
  email,
  redirectUrl,
}: {
  sessionKey: string;
  email: string;
  redirectUrl?: string;
}): Promise<CoinflowWithdrawerResult> {
  const first = await fetchWithdrawerOnce({sessionKey, redirectUrl});
  if (first.status !== 'no_withdrawer') return first;

  const registration = await registerCoinflowWithdrawer({sessionKey, email, redirectUrl});
  if (registration.status === 'verification_required') return registration;

  const second = await fetchWithdrawerOnce({sessionKey, redirectUrl});
  if (second.status === 'no_withdrawer') {
    throw new Error('Could not register a withdrawer for this account');
  }
  return second;
}

/**
 * Sends funds straight from the merchant's delegated settlement wallet to a
 * user's linked payout method, via POST /api/merchant/withdraws/payout/delegated.
 * Merchant-authenticated (API key) — must only ever run server-side.
 */
export async function submitCoinflowDelegatedPayout({
  userId,
  speed,
  account,
  amountCents,
  idempotencyKey,
}: {
  userId: string;
  speed: CoinflowWithdrawSpeed;
  account: string;
  amountCents: number;
  idempotencyKey: string;
}) {
  return coinflowFetch<{signature: string; effectiveSpeed: string}>({
    path: '/api/merchant/withdraws/payout/delegated',
    method: 'POST',
    headers: {Authorization: coinflowConfig.apiKey()},
    body: {
      userId,
      speed,
      account,
      amount: {cents: amountCents},
      idempotencyKey,
    },
  });
}
