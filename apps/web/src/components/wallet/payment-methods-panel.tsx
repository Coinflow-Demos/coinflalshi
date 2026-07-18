'use client';

import {useEffect, useRef, useState} from 'react';
import {useSession} from 'next-auth/react';
import {CoinflowCardForm, type CardFormRef} from '@coinflowlabs/react';
import {Button} from '@/components/ui/button';
import {COINFLOW_CHECKOUT_THEME} from '@/lib/coinflow-theme';
import {BillingFields, EMPTY_BILLING, type Billing} from '@/components/wallet/billing-fields';
import {get3DsBrowserParams, getFraudProtectionDeviceId} from '@/lib/coinflow/browser-signals';
import {ThreeDsChallengeModal} from '@/components/wallet/three-ds-challenge-modal';

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
}

interface ChallengeState {
  transactionId: string;
  creq: string;
  url: string;
  cardToken: string;
  expMonth: string;
  expYear: string;
}

export function PaymentMethodsPanel() {
  const {data: session} = useSession();
  const cardFormRef = useRef<CardFormRef>(null);

  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [adding, setAdding] = useState(false);
  const [billing, setBilling] = useState<Billing>({
    ...EMPTY_BILLING,
    email: session?.user?.email ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);

  function loadSavedMethods() {
    fetch('/api/wallet/payment-methods')
      .then((res) => res.json())
      .then((data) => setSavedMethods(data.savedPaymentMethods ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    loadSavedMethods();
  }, []);

  function updateBilling<K extends keyof Billing>(key: K, value: Billing[K]) {
    setBilling((prev) => ({...prev, [key]: value}));
  }

  async function handleRemove(id: string) {
    await fetch(`/api/wallet/payment-methods/${id}`, {method: 'DELETE'});
    loadSavedMethods();
  }

  async function handleSaveCard() {
    setError(null);
    setSubmitting(true);
    try {
      const {token, expMonth, expYear} = (await cardFormRef.current?.tokenize()) ?? {};
      if (!token || !expMonth || !expYear) {
        setError('Enter your card details before continuing');
        return;
      }

      const response = await fetch('/api/wallet/payment-methods/save', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          cardToken: token,
          expMonth,
          expYear,
          billing,
          authentication3DS: get3DsBrowserParams(),
          deviceId: getFraudProtectionDeviceId(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not save card');
        return;
      }

      if (data.status === 'challenge') {
        setChallenge({
          transactionId: data.transactionId,
          creq: data.creq,
          url: data.url,
          cardToken: token,
          expMonth,
          expYear,
        });
        return;
      }

      setAdding(false);
      loadSavedMethods();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChallengeComplete(threeDsTransactionId: string) {
    if (!challenge) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/payment-methods/save/complete', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          threeDsTransactionId,
          cardToken: challenge.cardToken,
          expMonth: challenge.expMonth,
          expYear: challenge.expYear,
          billing,
          deviceId: getFraudProtectionDeviceId(),
        }),
      });
      const data = await response.json();
      setChallenge(null);
      if (!response.ok) {
        setError(data.error ?? 'Could not save card after verification');
        return;
      }
      setAdding(false);
      loadSavedMethods();
    } catch {
      setChallenge(null);
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {challenge && (
        <ThreeDsChallengeModal
          url={challenge.url}
          creq={challenge.creq}
          transactionId={challenge.transactionId}
          onComplete={handleChallengeComplete}
        />
      )}

      {savedMethods.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No saved cards yet.</p>
      )}

      {savedMethods.map((method) => (
        <div
          key={method.id}
          className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
        >
          <span className="font-medium">
            {method.brand} •••• {method.last4}{' '}
            <span className="text-sm text-muted-foreground">
              exp {method.expMonth}/{method.expYear}
            </span>
          </span>
          <button
            onClick={() => handleRemove(method.id)}
            className="text-sm text-destructive underline"
          >
            Remove
          </button>
        </div>
      ))}

      {adding ? (
        <>
          <BillingFields billing={billing} onChange={updateBilling} />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Card</label>
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <CoinflowCardForm
                ref={cardFormRef}
                merchantId="predictionmarketmoon"
                env="sandbox"
                theme={COINFLOW_CHECKOUT_THEME}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAdding(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveCard} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save card (no charge)'}
            </Button>
          </div>
        </>
      ) : (
        <Button onClick={() => setAdding(true)} className="self-start">
          + Add card
        </Button>
      )}
    </div>
  );
}
