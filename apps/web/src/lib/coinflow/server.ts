import 'server-only';
import {coinflowConfig} from './config';

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
    const message = data?.msg || data?.details || `Coinflow ${method} ${path} failed (${response.status})`;
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

export async function getCoinflowSupportedChains() {
  return coinflowFetch<{chains: string[]}>({
    path: '/api/merchant/customer-payin-addresses/supported-chains',
    headers: {Authorization: coinflowConfig.apiKey()},
  });
}

export async function createCoinflowDepositAddress({
  sessionKey,
  chain,
}: {
  sessionKey: string;
  chain: string;
}) {
  return coinflowFetch<{depositAddress: string; chain: string; status: string}>({
    path: `/api/checkout/crypto-deposit-address/${coinflowConfig.merchantId}`,
    method: 'POST',
    headers: {'x-coinflow-auth-session-key': sessionKey},
    body: {chain},
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
