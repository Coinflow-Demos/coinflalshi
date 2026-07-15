import 'server-only';
import {coinflowConfig, COINFLOW_APP_BASE_URL} from './config';

/** The real end-user IP, forwarded to Coinflow as `x-coinflow-client-ip` so
 * fraud/geo checks see the customer, not our server. */
export function getClientIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim();
  return request.headers.get('x-real-ip') ?? undefined;
}

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
  method?: 'GET' | 'POST' | 'DELETE';
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
export async function getCoinflowSessionKey({
  userId,
  clientIp,
}: {
  userId: string;
  clientIp?: string;
}) {
  const {key} = await coinflowFetch<{key: string}>({
    path: '/api/auth/session-key',
    headers: {
      Authorization: coinflowConfig.apiKey(),
      'x-coinflow-auth-user-id': userId,
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
  });
  return key;
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

interface ChargebackRecipientInfo {
  accountId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  shippingAddress?: {
    country: string;
    state: string;
    city: string;
    street: string;
    postalCode: string;
  };
}

/** Fraud-scoring cart item for a balance top-up. `recipientInfo.accountId`
 * lets Coinflow link repeat purchases to the same buyer. */
const moneyTopUpChargebackProtection = (subtotalCents: number, recipientInfo: ChargebackRecipientInfo) => [
  {
    itemClass: 'moneyTopUp',
    quantity: 1,
    isPresetAmount: true,
    sellingPrice: {valueInCurrency: subtotalCents / 100, currency: 'USD'},
    topUpAmount: {valueInCurrency: subtotalCents / 100, currency: 'USD'},
    recipientInfo,
  },
];

/**
 * POSTs to any of Coinflow's card-family checkout endpoints
 * (card/token/zero-authorization) and normalizes the 3DS-challenge branch. A
 * 412 with `transactionId` + `url` means a challenge is required. Some
 * providers return a redirect-style ACS challenge in `url` with an empty
 * `creq` instead of the POST-a-creq-form style; the client renders whichever
 * one it got.
 */
async function postCoinflowChallengeableCheckout({
  path,
  authHeaders,
  deviceId,
  forterToken,
  clientIp,
  body,
}: {
  path: string;
  /** Whatever auth this checkout endpoint needs — a session key for
   * customer-initiated charges, or a merchant-API-key + user-id pair for
   * merchant-authenticated ones like card-on-file. */
  authHeaders: Record<string, string>;
  /** nSure device id, from the web fraud script. */
  deviceId?: string;
  /** Forter device token, from the native CoinflowCardForm's tokenize(). */
  forterToken?: string;
  clientIp?: string;
  body: unknown;
}): Promise<CoinflowChallengeableResult> {
  const response = await fetch(`${coinflowConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(deviceId ? {'x-device-id': deviceId} : {}),
      ...(forterToken ? {'x-forter-token': forterToken} : {}),
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  // Read the body as text first, then try to parse it. Coinflow's 5xx
  // responses aren't always JSON (an upstream gateway error or an HTML error
  // page comes back as text), and `.json().catch(() => ({}))` threw that away
  // — which is exactly why a failure showed up as an opaque "Charge failed
  // (500)" with no reason attached.
  const rawText = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  const parsed = data as {transactionId?: string; creq?: string; url?: string; paymentId?: string};

  if (response.status === 412 && parsed.transactionId && parsed.url) {
    return {status: 'challenge', transactionId: parsed.transactionId, creq: parsed.creq ?? '', url: parsed.url};
  }

  if (!response.ok) {
    const message = describeCoinflowError({
      data,
      status: response.status,
      fallback: rawText.trim() ? rawText.trim().slice(0, 300) : 'Charge failed',
    });
    console.error(`[coinflow] POST ${path} -> ${response.status}`, {parsed: data, rawBody: rawText});
    throw new Error(message);
  }

  return {status: 'success', paymentId: parsed.paymentId ?? ''};
}

/** Direct card charge against POST /checkout/card/{merchantId}. */
export async function chargeCoinflowCard({
  sessionKey,
  userId,
  subtotalCents,
  cardToken,
  expMonth,
  expYear,
  billing,
  authentication3DS,
  pendingTransactionId,
  saveCard,
  deviceId,
  forterToken,
  clientIp,
}: {
  sessionKey: string;
  userId: string;
  subtotalCents: number;
  cardToken: string;
  expMonth: string;
  expYear: string;
  billing: CardBillingInfo;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  pendingTransactionId: string;
  saveCard?: boolean;
  deviceId?: string;
  forterToken?: string;
  clientIp?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/card/${coinflowConfig.merchantId}`,
    authHeaders: {'x-coinflow-auth-session-key': sessionKey},
    deviceId,
    forterToken,
    clientIp,
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
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents, {
        accountId: userId,
        email: billing.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
        shippingAddress: {
          country: billing.country,
          state: billing.state,
          city: billing.city,
          street: billing.address1,
          postalCode: billing.zip,
        },
      }),
      chargebackProtectionAccountType: 'private',
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
  forterToken,
  clientIp,
}: {
  sessionKey: string;
  cardToken: string;
  expMonth: string;
  expYear: string;
  billing: CardBillingInfo;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  deviceId?: string;
  forterToken?: string;
  clientIp?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/zero-authorization/${coinflowConfig.merchantId}`,
    authHeaders: {'x-coinflow-auth-session-key': sessionKey},
    deviceId,
    forterToken,
    clientIp,
    body: {
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
 * returns a 410 asking for revalidation.
 */
export async function chargeCoinflowSavedCard({
  sessionKey,
  userId,
  email,
  firstName,
  lastName,
  subtotalCents,
  cvvVerifiedToken,
  authentication3DS,
  pendingTransactionId,
  deviceId,
  forterToken,
  clientIp,
}: {
  sessionKey: string;
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  subtotalCents: number;
  cvvVerifiedToken: string;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  pendingTransactionId: string;
  deviceId?: string;
  forterToken?: string;
  clientIp?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/token/${coinflowConfig.merchantId}`,
    authHeaders: {'x-coinflow-auth-session-key': sessionKey},
    deviceId,
    forterToken,
    clientIp,
    body: {
      subtotal: {cents: subtotalCents},
      webhookInfo: {pendingTransactionId},
      authentication3DS,
      token: cvvVerifiedToken,
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents, {
        accountId: userId,
        email,
        firstName,
        lastName,
      }),
      chargebackProtectionAccountType: 'private',
      settlementType: 'USDC',
    },
  });
}

/** Revokes a saved card at Coinflow via DELETE /api/customer/card/{cardToken},
 * so removing a saved payment method here actually removes it from Coinflow's
 * vault instead of just deleting our local reference to it. */
export async function revokeCoinflowCard({sessionKey, cardToken}: {sessionKey: string; cardToken: string}) {
  await coinflowFetch<unknown>({
    path: `/api/customer/card/${cardToken}`,
    method: 'DELETE',
    headers: {'x-coinflow-auth-session-key': sessionKey},
  });
}

/** Checks whether a saved card is currently eligible for a no-CVV
 * card-on-file charge, via POST /api/checkout/card-on-file-authorized.
 * Coinflow recommends calling this before attempting one — it can be false
 * for reasons ranging from an expired CVV-verification window to the feature
 * simply not being enabled on the merchant account. Merchant-authenticated
 * (Authorization + user-id), unlike the session-key checkout endpoints. */
export async function checkCoinflowCardOnFileAuthorized({
  userId,
  cardToken,
  clientIp,
}: {
  userId: string;
  cardToken: string;
  clientIp?: string;
}): Promise<boolean> {
  const {authorized} = await coinflowFetch<{authorized: boolean}>({
    path: '/api/checkout/card-on-file-authorized',
    method: 'POST',
    headers: {
      Authorization: coinflowConfig.apiKey(),
      'x-coinflow-auth-user-id': userId,
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
    body: {token: cardToken},
  });
  return authorized;
}

/** Charges a saved card via POST /api/checkout/card-on-file, referencing its
 * token so Coinflow can find the original CVV-verified purchase on file —
 * no CVV re-entry needed. Merchant-authenticated (Authorization + user-id),
 * unlike every other checkout endpoint here which uses a session key. */
export async function chargeCoinflowCardOnFile({
  userId,
  cardToken,
  subtotalCents,
  authentication3DS,
  pendingTransactionId,
  email,
  firstName,
  lastName,
  deviceId,
  clientIp,
}: {
  userId: string;
  cardToken: string;
  subtotalCents: number;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  pendingTransactionId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  deviceId?: string;
  clientIp?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: '/api/checkout/card-on-file',
    authHeaders: {
      Authorization: coinflowConfig.apiKey(),
      'x-coinflow-auth-user-id': userId,
    },
    deviceId,
    clientIp,
    body: {
      subtotal: {cents: subtotalCents},
      token: cardToken,
      webhookInfo: {pendingTransactionId},
      authentication3DS,
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents, {
        accountId: userId,
        email,
        firstName,
        lastName,
      }),
      chargebackProtectionAccountType: 'private',
      settlementType: 'USDC',
    },
  });
}

/**
 * The Google Pay `paymentData` object exactly as Google's `pay.js`
 * `loadPaymentData()` resolves it. We forward it to Coinflow verbatim under
 * `paymentData` — Coinflow reads `paymentMethodData.tokenizationData.token`
 * (the gateway token Google minted for our Coinflow merchant id) out of it.
 */
export interface GooglePayPaymentData {
  email?: string;
  paymentMethodData: {
    type: string;
    description?: string;
    info?: {cardNetwork?: string; cardDetails?: string};
    tokenizationData: {type: string; token: string};
  };
  apiVersion?: number;
  apiVersionMinor?: number;
}

/**
 * Charges a Google Pay token via POST /api/checkout/google-pay/{merchantId}.
 * Same session-key auth, fraud device id, client ip, and chargeback-protection
 * cart as the direct card charge — the only difference is the payment
 * instrument. Google Pay tokens are pre-authenticated, so a 3DS challenge
 * isn't expected, but this still routes through the same challengeable helper
 * in case Coinflow ever returns one.
 */
export async function chargeCoinflowGooglePay({
  sessionKey,
  userId,
  email,
  firstName,
  lastName,
  subtotalCents,
  paymentData,
  authentication3DS,
  pendingTransactionId,
  deviceId,
  clientIp,
}: {
  sessionKey: string;
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  subtotalCents: number;
  paymentData: GooglePayPaymentData;
  authentication3DS: ThreeDsBrowserParams | {transactionId: string};
  pendingTransactionId: string;
  deviceId?: string;
  clientIp?: string;
}): Promise<CoinflowChallengeableResult> {
  return postCoinflowChallengeableCheckout({
    path: `/api/checkout/google-pay/${coinflowConfig.merchantId}`,
    authHeaders: {'x-coinflow-auth-session-key': sessionKey},
    deviceId,
    clientIp,
    body: {
      subtotal: {cents: subtotalCents},
      webhookInfo: {pendingTransactionId},
      authentication3DS,
      paymentData,
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents, {
        accountId: userId,
        email,
        firstName,
        lastName,
      }),
      chargebackProtectionAccountType: 'private',
      settlementType: 'USDC',
    },
  });
}

/** Apple Pay's merchant-validation handshake — called with the domain the
 * Apple Pay button is running on, returns an Apple merchant session object
 * for the client to pass to ApplePaySession.completeMerchantValidation(). */
export async function getCoinflowApplePayMerchantSession({domainName}: {domainName: string}) {
  return coinflowFetch<Record<string, unknown>>({
    path: `/api/checkout/apple-pay/validatemerchant?${new URLSearchParams({
      domainName,
      merchantId: coinflowConfig.merchantId,
    }).toString()}`,
  });
}

/** Charges an Apple Pay payment via POST /checkout/v2/apple-pay/{merchantId}.
 * Apple handles device authentication itself, so there's no 3DS challenge
 * branch here — this always succeeds or throws. */
export async function chargeCoinflowApplePay({
  sessionKey,
  userId,
  subtotalCents,
  applePayPayment,
  pendingTransactionId,
  billing,
  deviceId,
  clientIp,
}: {
  sessionKey: string;
  userId: string;
  subtotalCents: number;
  applePayPayment: unknown;
  pendingTransactionId: string;
  billing: {email?: string; firstName?: string; lastName?: string};
  deviceId?: string;
  clientIp?: string;
}) {
  return coinflowFetch<{paymentId: string}>({
    path: `/api/checkout/v2/apple-pay/${coinflowConfig.merchantId}`,
    method: 'POST',
    headers: {
      'x-coinflow-auth-session-key': sessionKey,
      ...(deviceId ? {'x-device-id': deviceId} : {}),
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
    body: {
      subtotal: {cents: subtotalCents},
      webhookInfo: {pendingTransactionId},
      applePayPayment,
      chargebackProtectionData: moneyTopUpChargebackProtection(subtotalCents, {
        accountId: userId,
        email: billing.email,
        firstName: billing.firstName,
        lastName: billing.lastName,
      }),
      chargebackProtectionAccountType: 'private',
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
  clientIp,
}: {
  sessionKey: string;
  chain: string;
  email: string;
  clientIp?: string;
}) {
  return coinflowFetch<{depositAddress: string; chain: string; status: string}>({
    path: `/api/checkout/crypto-deposit-address/${coinflowConfig.merchantId}`,
    method: 'POST',
    headers: {
      'x-coinflow-auth-session-key': sessionKey,
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
    body: {chain, email},
  });
}

// --- Payouts (withdraws) -----------------------------------------------
// 1. User links a payout method (bank/card/etc) via the hosted Bank
//    Authentication UI — we never see routing/account numbers.
// 2. We list what's linked via GET /api/withdraw ("Get Withdrawer").
// 3. The user picks one; we submit the payout via
//    POST /api/merchant/withdraws/payout/delegated (merchant-authenticated,
//    server-side only).

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
  /** PCI-compliant token, passed as `account` to the delegated payout call. */
  token: string;
  speed: CoinflowWithdrawSpeed;
  label: string;
}

export type CoinflowWithdrawerResult =
  | {status: 'ok'; methods: LinkedPayoutMethod[]}
  | {status: 'verification_required'; verificationLink: string};

/** Hosted Bank Authentication UI URL. Posts `{method: "accountLinked"}` to
 * window.parent on success. */
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
  clientIp,
}: {
  sessionKey: string;
  redirectUrl?: string;
  clientIp?: string;
}): Promise<FetchWithdrawerResult> {
  const query = redirectUrl ? `?${new URLSearchParams({redirectLink: redirectUrl}).toString()}` : '';
  const response = await fetch(`${coinflowConfig.apiBaseUrl}/api/withdraw${query}`, {
    headers: {
      Accept: 'application/json',
      'x-coinflow-auth-session-key': sessionKey,
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as RawWithdrawerResponse;

  // 401 here means the session key is valid but no withdrawer record
  // exists yet — it has to be created via POST /api/withdraw/kyc first.
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

/** Creates the Coinflow "withdrawer" record for this user via POST
 * /api/withdraw/kyc, so GET /api/withdraw stops 401ing. */
async function registerCoinflowWithdrawer({
  sessionKey,
  email,
  country = 'US',
  redirectUrl,
  clientIp,
}: {
  sessionKey: string;
  email: string;
  country?: string;
  redirectUrl?: string;
  clientIp?: string;
}): Promise<{status: 'ok'} | {status: 'verification_required'; verificationLink: string}> {
  const response = await fetch(`${coinflowConfig.apiBaseUrl}/api/withdraw/kyc`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-coinflow-auth-session-key': sessionKey,
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
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

/** Lists every payout method the user has linked, via GET /api/withdraw
 * ("Get Withdrawer"). Registers a withdrawer on first use and retries once. */
export async function getCoinflowWithdrawer({
  sessionKey,
  email,
  redirectUrl,
  clientIp,
}: {
  sessionKey: string;
  email: string;
  redirectUrl?: string;
  clientIp?: string;
}): Promise<CoinflowWithdrawerResult> {
  const first = await fetchWithdrawerOnce({sessionKey, redirectUrl, clientIp});
  if (first.status !== 'no_withdrawer') return first;

  const registration = await registerCoinflowWithdrawer({sessionKey, email, redirectUrl, clientIp});
  if (registration.status === 'verification_required') return registration;

  const second = await fetchWithdrawerOnce({sessionKey, redirectUrl, clientIp});
  if (second.status === 'no_withdrawer') {
    throw new Error('Could not register a withdrawer for this account');
  }
  return second;
}

/** Sends funds from the merchant's delegated settlement wallet to a user's
 * linked payout method, via POST /api/merchant/withdraws/payout/delegated. */
export async function submitCoinflowDelegatedPayout({
  userId,
  speed,
  account,
  amountCents,
  idempotencyKey,
  clientIp,
}: {
  userId: string;
  speed: CoinflowWithdrawSpeed;
  account: string;
  amountCents: number;
  idempotencyKey: string;
  clientIp?: string;
}) {
  return coinflowFetch<{signature: string; effectiveSpeed: string}>({
    path: '/api/merchant/withdraws/payout/delegated',
    method: 'POST',
    headers: {
      Authorization: coinflowConfig.apiKey(),
      ...(clientIp ? {'x-coinflow-client-ip': clientIp} : {}),
    },
    body: {
      userId,
      speed,
      account,
      amount: {cents: amountCents},
      idempotencyKey,
    },
  });
}
