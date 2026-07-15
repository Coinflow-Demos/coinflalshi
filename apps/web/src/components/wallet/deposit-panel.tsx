'use client';

import {useEffect, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import nextDynamic from 'next/dynamic';
import {CoinflowCardForm, CoinflowCvvForm, type CardFormRef} from '@coinflowlabs/react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {COINFLOW_CHECKOUT_THEME} from '@/lib/coinflow-theme';
import {BillingFields, EMPTY_BILLING, type Billing} from '@/components/wallet/billing-fields';
import {ApplePayButton} from '@/components/wallet/apple-pay-button';
import {GooglePayButton, type GooglePaymentData} from '@/components/wallet/google-pay-button';
import {TestCardPicker} from '@/components/wallet/test-card-picker';
import {SandboxTestingGuide} from '@/components/wallet/sandbox-testing-guide';
import {get3DsBrowserParams, getFraudProtectionDeviceId} from '@/lib/coinflow/browser-signals';
import {cn} from '@/lib/utils';

const APPLE_PAY_ENABLED = process.env.NEXT_PUBLIC_COINFLOW_APPLE_PAY_ENABLED === 'true';
const GOOGLE_PAY_ENABLED = process.env.NEXT_PUBLIC_COINFLOW_GOOGLE_PAY_ENABLED === 'true';

// @basis-theory/web-threeds touches `window` at import time, so it must be
// loaded client-only or SSR crashes.
const ThreeDsChallengeModal = nextDynamic(
  () => import('@/components/wallet/three-ds-challenge-modal').then((mod) => mod.ThreeDsChallengeModal),
  {ssr: false}
);

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
}

interface NewCardChallengeState {
  kind: 'new-card';
  transactionId: string;
  creq: string;
  url: string;
  pendingTransactionId: string;
}

interface SavedCardChallengeState {
  kind: 'saved-card';
  transactionId: string;
  creq: string;
  url: string;
  pendingTransactionId: string;
}

interface CardOnFileChallengeState {
  kind: 'card-on-file';
  transactionId: string;
  creq: string;
  url: string;
  pendingTransactionId: string;
}

type ChallengeState = NewCardChallengeState | SavedCardChallengeState | CardOnFileChallengeState;

export function DepositPanel() {
  const router = useRouter();
  const {data: session} = useSession();
  const cardFormRef = useRef<CardFormRef>(null);
  const cvvFormRef = useRef<CardFormRef>(null);

  const [amount, setAmount] = useState('25');
  const [billing, setBilling] = useState<Billing>({
    ...EMPTY_BILLING,
    email: session?.user?.email ?? '',
  });
  const [saveCard, setSaveCard] = useState(false);

  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [mode, setMode] = useState<'new' | string>('new');
  const [savedCardToken, setSavedCardToken] = useState<string | null>(null);
  // null while checking — treated as "not authorized" so the CVV form stays
  // the default until we know a no-CVV charge is actually possible.
  const [cardOnFileAuthorized, setCardOnFileAuthorized] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [applePayReady, setApplePayReady] = useState(false);
  const [googlePayReady, setGooglePayReady] = useState(false);

  const amountCents = Math.round(Number(amount) * 100);

  useEffect(() => {
    fetch('/api/wallet/payment-methods')
      .then((res) => res.json())
      .then((data) => setSavedMethods(data.savedPaymentMethods ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'new') {
      setSavedCardToken(null);
      setCardOnFileAuthorized(null);
      return;
    }
    setSavedCardToken(null);
    setCardOnFileAuthorized(null);
    fetch(`/api/wallet/payment-methods/${mode}`)
      .then((res) => res.json())
      .then((data) => setSavedCardToken(data.cardToken ?? null))
      .catch(() => {});
    // Coinflow recommends checking this before offering a no-CVV charge —
    // it can be false for reasons ranging from an expired verification
    // window to the feature not being enabled on the merchant yet.
    fetch(`/api/wallet/payment-methods/${mode}/card-on-file-authorized`)
      .then((res) => res.json())
      .then((data) => setCardOnFileAuthorized(Boolean(data.authorized)))
      .catch(() => setCardOnFileAuthorized(false));
  }, [mode]);

  function updateBilling<K extends keyof Billing>(key: K, value: Billing[K]) {
    setBilling((prev) => ({...prev, [key]: value}));
  }

  async function handlePayNewCard() {
    const {token, expMonth, expYear} = (await cardFormRef.current?.tokenize()) ?? {};
    if (!token || !expMonth || !expYear) {
      setError('Enter your card details before continuing');
      return;
    }

    const response = await fetch('/api/wallet/deposit/charge', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        amountCents,
        cardToken: token,
        expMonth,
        expYear,
        billing,
        authentication3DS: get3DsBrowserParams(),
        deviceId: getFraudProtectionDeviceId(),
        saveCard,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Payment failed');
      return;
    }

    if (data.status === 'challenge') {
      setChallenge({
        kind: 'new-card',
        transactionId: data.transactionId,
        creq: data.creq,
        url: data.url,
        pendingTransactionId: data.pendingTransactionId,
      });
      return;
    }

    setSuccess(true);
  }

  async function handlePaySavedCard() {
    if (!savedCardToken) {
      setError('Loading card — try again in a moment');
      return;
    }
    const {token: cvvVerifiedToken} = (await cvvFormRef.current?.tokenize()) ?? {};
    if (!cvvVerifiedToken) {
      setError('Enter your CVV before continuing');
      return;
    }

    const response = await fetch('/api/wallet/deposit/charge-saved', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        amountCents,
        cvvVerifiedToken,
        authentication3DS: get3DsBrowserParams(),
        deviceId: getFraudProtectionDeviceId(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Payment failed');
      return;
    }

    if (data.status === 'challenge') {
      setChallenge({
        kind: 'saved-card',
        transactionId: data.transactionId,
        creq: data.creq,
        url: data.url,
        pendingTransactionId: data.pendingTransactionId,
      });
      return;
    }

    setSuccess(true);
  }

  async function handlePayCardOnFile() {
    const response = await fetch('/api/wallet/deposit/charge-card-on-file', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        amountCents,
        savedPaymentMethodId: mode,
        authentication3DS: get3DsBrowserParams(),
        deviceId: getFraudProtectionDeviceId(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? 'Payment failed');
      return;
    }

    if (data.status === 'challenge') {
      setChallenge({
        kind: 'card-on-file',
        transactionId: data.transactionId,
        creq: data.creq,
        url: data.url,
        pendingTransactionId: data.pendingTransactionId,
      });
      return;
    }

    setSuccess(true);
  }

  async function handleGooglePay(paymentData: GooglePaymentData) {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/wallet/deposit/google-pay', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          amountCents,
          paymentData,
          authentication3DS: get3DsBrowserParams(),
          deviceId: getFraudProtectionDeviceId(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Payment failed');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePay() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'new') {
        await handlePayNewCard();
      } else if (cardOnFileAuthorized) {
        await handlePayCardOnFile();
      } else {
        await handlePaySavedCard();
      }
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
      const deviceId = getFraudProtectionDeviceId();
      const completeUrl = {
        'new-card': '/api/wallet/deposit/charge/complete',
        'saved-card': '/api/wallet/deposit/charge-saved/complete',
        'card-on-file': '/api/wallet/deposit/charge-card-on-file/complete',
      }[challenge.kind];
      const response = await fetch(completeUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          pendingTransactionId: challenge.pendingTransactionId,
          threeDsTransactionId,
          deviceId,
        }),
      });
      const data = await response.json();
      setChallenge(null);
      if (!response.ok) {
        setError(data.error ?? 'Payment failed after verification');
        return;
      }
      setSuccess(true);
    } catch {
      setChallenge(null);
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-lg font-semibold">Deposit received</p>
        <p className="text-sm text-muted-foreground">Your balance will update in a few seconds.</p>
        <Button onClick={() => router.refresh()}>Refresh balance</Button>
      </div>
    );
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

      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Amount to deposit (USD)
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[10, 25, 100, 250].map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(String(preset))}
            className="rounded-lg border border-border py-2 text-sm font-medium hover:bg-accent"
          >
            ${preset}
          </button>
        ))}
      </div>

      {APPLE_PAY_ENABLED && (
        <ApplePayButton
          amountCents={amountCents}
          onSuccess={() => setSuccess(true)}
          onError={(message) => message && setError(message)}
          onReady={setApplePayReady}
        />
      )}
      {GOOGLE_PAY_ENABLED && (
        <GooglePayButton
          amountCents={amountCents}
          disabled={submitting}
          onPaymentData={handleGooglePay}
          onError={setError}
          onReady={setGooglePayReady}
        />
      )}
      {(applePayReady || googlePayReady) && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            or pay another way
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {savedMethods.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedMethods.map((method) => (
            <button
              key={method.id}
              onClick={() => setMode(method.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium',
                mode === method.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent'
              )}
            >
              {method.brand} •••• {method.last4}
            </button>
          ))}
          <button
            onClick={() => setMode('new')}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium',
              mode === 'new' ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
            )}
          >
            + New card
          </button>
        </div>
      )}

      <TestCardPicker />

      {mode === 'new' ? (
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

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={saveCard}
              onChange={(event) => setSaveCard(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            Save this card for future deposits
          </label>
        </>
      ) : cardOnFileAuthorized ? (
        <p className="text-sm text-muted-foreground">
          This card is on file — no need to re-enter your CVV.
        </p>
      ) : (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            Re-enter your CVV to confirm
          </label>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            {savedCardToken ? (
              <CoinflowCvvForm
                ref={cvvFormRef}
                token={savedCardToken}
                merchantId="predictionmarketmoon"
                env="sandbox"
                theme={COINFLOW_CHECKOUT_THEME}
              />
            ) : (
              <p className="py-2 text-sm text-muted-foreground">Loading…</p>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" disabled={submitting || amountCents < 100} onClick={handlePay}>
        {submitting ? 'Processing…' : 'Pay'}
      </Button>

      <SandboxTestingGuide onSetAmount={setAmount} onSetZip={(zip) => updateBilling('zip', zip)} />
    </div>
  );
}
