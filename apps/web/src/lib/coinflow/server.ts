import 'server-only';
import {coinflowConfig} from './config';

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
// These three calls are wired up against Coinflow's documented /withdraw
// REST surface (KYC -> link a bank account -> submit the transaction), using
// the same session-key auth pattern as checkout. The payout endpoints are
// gated behind coinflowConfig.payoutsEnabled since they also require KYC and
// a payout method to be enabled on the merchant dashboard first — verify the
// exact request/response fields against /api-reference/withdraw once that's
// turned on in the sandbox, before relying on this in production.

export async function registerCoinflowKyc({
  sessionKey,
  firstName,
  lastName,
  email,
}: {
  sessionKey: string;
  firstName: string;
  lastName: string;
  email: string;
}) {
  return coinflowFetch<{status: string}>({
    path: '/api/withdraw/kyc',
    method: 'POST',
    headers: {'x-coinflow-auth-session-key': sessionKey},
    body: {kycUserInformation: {firstName, lastName, email}},
  });
}

export async function addCoinflowBankAccount({
  sessionKey,
  routingNumber,
  accountNumber,
  accountType,
}: {
  sessionKey: string;
  routingNumber: string;
  accountNumber: string;
  accountType: 'checking' | 'savings';
}) {
  return coinflowFetch<{id: string}>({
    path: '/api/withdraw/account',
    method: 'POST',
    headers: {'x-coinflow-auth-session-key': sessionKey},
    body: {routingNumber, accountNumber, accountType},
  });
}

export async function submitCoinflowWithdrawal({
  sessionKey,
  amountCents,
  destinationId,
}: {
  sessionKey: string;
  amountCents: number;
  destinationId: string;
}) {
  return coinflowFetch<{id: string; status: string}>({
    path: '/api/withdraw/transaction',
    method: 'POST',
    headers: {'x-coinflow-auth-session-key': sessionKey},
    body: {amountCents, destinationType: 'bank_account', destinationId, speed: 'standard'},
  });
}
