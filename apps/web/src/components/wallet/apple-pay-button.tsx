'use client';

import {useEffect, useState} from 'react';
import {getFraudProtectionDeviceId} from '@/lib/coinflow/browser-signals';

declare global {
  interface Window {
    ApplePaySession?: {
      new (version: number, request: unknown): ApplePaySessionInstance;
      canMakePayments(): boolean;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
    };
  }
}

interface ApplePaySessionInstance {
  begin(): void;
  completeMerchantValidation(merchantSession: unknown): void;
  completePayment(result: {status: number}): void;
  onvalidatemerchant: ((event: {validationURL: string}) => void) | null;
  onpaymentauthorized: ((event: {payment: unknown}) => void) | null;
  oncancel: (() => void) | null;
}

export function ApplePayButton({
  amountCents,
  onSuccess,
  onError,
}: {
  amountCents: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSupported(Boolean(window.ApplePaySession?.canMakePayments()));
  }, []);

  if (!supported) return null;

  async function handleClick() {
    if (!window.ApplePaySession) return;
    setSubmitting(true);
    onError('');

    const session = new window.ApplePaySession(3, {
      countryCode: 'US',
      currencyCode: 'USD',
      merchantCapabilities: ['supports3DS'],
      supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
      total: {label: 'Coinflalshi', amount: (amountCents / 100).toFixed(2)},
    });

    session.onvalidatemerchant = async () => {
      try {
        const response = await fetch(
          `/api/wallet/deposit/apple-pay/validate-merchant?${new URLSearchParams({
            domainName: window.location.hostname,
          })}`
        );
        const merchantSession = await response.json();
        if (!response.ok) throw new Error(merchantSession.error ?? 'Merchant validation failed');
        session.completeMerchantValidation(merchantSession);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Apple Pay is not available right now');
        setSubmitting(false);
      }
    };

    session.onpaymentauthorized = async (event) => {
      try {
        const response = await fetch('/api/wallet/deposit/apple-pay', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            amountCents,
            applePayPayment: event.payment,
            deviceId: getFraudProtectionDeviceId(),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Payment failed');
        session.completePayment({status: window.ApplePaySession!.STATUS_SUCCESS});
        onSuccess();
      } catch (error) {
        session.completePayment({status: window.ApplePaySession!.STATUS_FAILURE});
        onError(error instanceof Error ? error.message : 'Payment failed');
      } finally {
        setSubmitting(false);
      }
    };

    session.oncancel = () => setSubmitting(false);

    session.begin();
  }

  return (
    <button
      onClick={handleClick}
      disabled={submitting || amountCents < 100}
      aria-label="Pay with Apple Pay"
      style={{
        WebkitAppearance: '-apple-pay-button',
        appearance: '-apple-pay-button' as never,
        // @ts-expect-error -- non-standard CSS custom properties for the Apple Pay button
        '--apple-pay-button-type': 'plain',
        '--apple-pay-button-style': 'black',
      }}
      className="h-11 w-full rounded-lg disabled:opacity-50"
    />
  );
}
