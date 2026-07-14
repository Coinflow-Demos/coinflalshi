// Sandbox-only, always — no env var here can switch to a production URL.
export const COINFLOW_API_BASE_URL = 'https://api-sandbox.coinflow.cash';
export const COINFLOW_APP_BASE_URL = 'https://app-sandbox.coinflow.cash';
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
  payoutsEnabled: process.env.COINFLOW_PAYOUTS_ENABLED === 'true',
};
