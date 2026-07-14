'use client';

import {useEffect, useRef, useState} from 'react';

// Google Pay Web API — https://developers.google.com/pay/api/web/guides/tutorial
// The button, readiness check, and payment sheet are all driven by the
// `pay.js` script we load below; the SDK isn't typed for us, so we declare
// the minimal surface we actually call.
declare global {
  interface Window {
    google?: {
      payments: {
        api: {
          PaymentsClient: new (options: {environment: 'TEST' | 'PRODUCTION'}) => GooglePaymentsClient;
        };
      };
    };
  }
}

interface GooglePaymentsClient {
  isReadyToPay(request: unknown): Promise<{result: boolean}>;
  loadPaymentData(request: unknown): Promise<GooglePaymentData>;
  createButton(options: Record<string, unknown>): HTMLElement;
}

/** Shape Google resolves from loadPaymentData() — forwarded to our API as-is. */
export interface GooglePaymentData {
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

const GOOGLE_PAY_SCRIPT_SRC = 'https://pay.google.com/gp/p/js/pay.js';

// 'TEST' returns un-chargeable test cards; 'PRODUCTION' returns real,
// chargeable tokens and requires a Google-approved merchant id (below).
const ENVIRONMENT = (process.env.NEXT_PUBLIC_GOOGLE_PAY_ENVIRONMENT ?? 'TEST') as 'TEST' | 'PRODUCTION';
// Shown on the Google Pay sheet ("Pay <MERCHANT_NAME>").
const MERCHANT_NAME = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_NAME ?? 'Coinflalshi';
// Your Google Pay & Wallet Console merchant id — required in PRODUCTION only.
const GOOGLE_MERCHANT_ID = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID ?? '';
// The gateway config Coinflow expects: gateway "coinflow" + our Coinflow merchant id.
const GATEWAY = 'coinflow';
const GATEWAY_MERCHANT_ID = 'predictionmarketmoon';

const BASE_REQUEST = {apiVersion: 2, apiVersionMinor: 0} as const;

const CARD_PAYMENT_METHOD = {
  type: 'CARD',
  parameters: {
    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
    allowedCardNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA'],
    // Coinflow's nSure fraud step reads the cardholder name + billing address
    // out of paymentMethodData.info.billingAddress; without this Google omits
    // it and Coinflow throws on the missing `name`. FULL gives name + full
    // address (what nSure/chargeback-protection expects).
    billingAddressRequired: true,
    billingAddressParameters: {
      format: 'FULL',
      phoneNumberRequired: false,
    },
  },
  tokenizationSpecification: {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      gateway: GATEWAY,
      gatewayMerchantId: GATEWAY_MERCHANT_ID,
    },
  },
} as const;

const IS_READY_TO_PAY_REQUEST = {
  ...BASE_REQUEST,
  // isReadyToPay only needs type + parameters, not the tokenization spec.
  allowedPaymentMethods: [{type: CARD_PAYMENT_METHOD.type, parameters: CARD_PAYMENT_METHOD.parameters}],
};

function buildPaymentDataRequest(amountCents: number) {
  return {
    ...BASE_REQUEST,
    allowedPaymentMethods: [CARD_PAYMENT_METHOD],
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice: (amountCents / 100).toFixed(2),
      currencyCode: 'USD',
      countryCode: 'US',
    },
    emailRequired: true,
    merchantInfo: {
      merchantName: MERCHANT_NAME,
      ...(GOOGLE_MERCHANT_ID ? {merchantId: GOOGLE_MERCHANT_ID} : {}),
    },
  };
}

function loadGooglePayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.payments?.api) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_PAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Pay')));
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_PAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Pay'));
    document.head.appendChild(script);
  });
}

interface GooglePayButtonProps {
  amountCents: number;
  disabled?: boolean;
  /** Receives the Google paymentData; should charge it and surface results. */
  onPaymentData: (data: GooglePaymentData) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Fires true once the button has mounted (device supports Google Pay). */
  onReady?: (ready: boolean) => void;
}

export function GooglePayButton({amountCents, disabled, onPaymentData, onError, onReady}: GooglePayButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<GooglePaymentsClient | null>(null);
  const [ready, setReady] = useState(false);

  // The Google button's click handler is registered once, so read the latest
  // amount/disabled/callbacks through refs instead of stale closure values.
  const amountRef = useRef(amountCents);
  const disabledRef = useRef(disabled);
  const onPaymentDataRef = useRef(onPaymentData);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  amountRef.current = amountCents;
  disabledRef.current = disabled;
  onPaymentDataRef.current = onPaymentData;
  onErrorRef.current = onError;
  onReadyRef.current = onReady;

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadGooglePayScript();
        if (cancelled || !window.google?.payments?.api) return;

        const client = new window.google.payments.api.PaymentsClient({environment: ENVIRONMENT});
        clientRef.current = client;

        const {result} = await client.isReadyToPay(IS_READY_TO_PAY_REQUEST);
        if (cancelled || !result) return;

        const button = client.createButton({
          onClick: handleClick,
          buttonType: 'pay',
          buttonColor: 'default',
          buttonSizeMode: 'fill',
          buttonRadius: 8,
        });

        const container = containerRef.current;
        if (container && !cancelled) {
          container.replaceChildren(button);
          setReady(true);
          onReadyRef.current?.(true);
        }
      } catch {
        // Google Pay simply won't be offered — the card form remains available.
      }
    }

    async function handleClick() {
      const client = clientRef.current;
      if (!client) return;
      if (disabledRef.current || amountRef.current < 100) {
        onErrorRef.current?.('Enter an amount of at least $1 before paying');
        return;
      }
      try {
        const paymentData = await client.loadPaymentData(buildPaymentDataRequest(amountRef.current));
        await onPaymentDataRef.current(paymentData);
      } catch (error) {
        // The user closing the sheet reports as CANCELED — not an error worth showing.
        const code = (error as {statusCode?: string} | null)?.statusCode;
        if (code === 'CANCELED') return;
        onErrorRef.current?.('Google Pay was interrupted — please try again');
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rendered but empty until ready, so layout doesn't jump when the button mounts.
  return <div ref={containerRef} className={ready ? 'w-full' : 'hidden'} />;
}
