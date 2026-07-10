// This project is sandbox-only, on purpose. There is no production Coinflow
// environment anywhere in this codebase, no env var that can switch to one,
// and no code path that could ever construct a production API URL.
export const COINFLOW_API_BASE_URL = 'https://api-sandbox.coinflow.cash';
export const COINFLOW_SDK_ENV = 'sandbox';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const coinflowConfig = {
  merchantId: process.env.COINFLOW_MERCHANT_ID ?? 'predictionmarketmoon',
  apiKey: () => requireEnv('COINFLOW_API_KEY'),
  webhookValidationKey: () => requireEnv('COINFLOW_WEBHOOK_VALIDATION_KEY'),
  apiBaseUrl: COINFLOW_API_BASE_URL,
  // Apple Pay / Google Pay require merchant-side setup (Apple Developer certs,
  // Google Pay merchant id) that isn't provisioned yet. Flip these on once
  // that's configured on the Coinflow merchant dashboard — no other code
  // changes needed, the hosted checkout UI will pick them up automatically.
  applePayEnabled: process.env.NEXT_PUBLIC_COINFLOW_APPLE_PAY_ENABLED === 'true',
  googlePayEnabled: process.env.NEXT_PUBLIC_COINFLOW_GOOGLE_PAY_ENABLED === 'true',
  // Payouts require KYC + a payout method to be configured on the merchant
  // account first. Flip on once that's done in the Coinflow dashboard.
  payoutsEnabled: process.env.COINFLOW_PAYOUTS_ENABLED === 'true',
};

export const NEXT_PUBLIC_COINFLOW_MERCHANT_ID =
  process.env.NEXT_PUBLIC_COINFLOW_MERCHANT_ID ?? coinflowConfig.merchantId;
