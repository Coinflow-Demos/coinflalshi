'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import {CoinflowPurchase, PaymentMethods, SettlementType} from '@coinflowlabs/react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {COINFLOW_CHECKOUT_THEME} from '@/lib/coinflow-theme';

interface DepositSession {
  sessionKey: string;
  jwtToken: string;
  pendingTransactionId: string;
  merchantId: string;
  applePayEnabled: boolean;
  googlePayEnabled: boolean;
}

export function DepositPanel() {
  const router = useRouter();
  const {data: session} = useSession();
  const [amount, setAmount] = useState('25');
  const [zeroAuth, setZeroAuth] = useState(false);
  const [checkout, setCheckout] = useState<DepositSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = Math.round(Number(amount) * 100);

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/deposit/init', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({amountCents, zeroAuth}),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not start checkout');
        return;
      }
      setCheckout(data);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-lg font-semibold">{zeroAuth ? 'Card saved' : 'Deposit received'}</p>
        <p className="text-sm text-muted-foreground">
          {zeroAuth
            ? 'Your card is on file for faster checkout next time.'
            : 'Your balance will update in a few seconds.'}
        </p>
        <Button onClick={() => router.refresh()}>Refresh balance</Button>
      </div>
    );
  }

  if (checkout) {
    const allowedPaymentMethods = [
      PaymentMethods.card,
      ...(checkout.applePayEnabled ? [PaymentMethods.applePay] : []),
      ...(checkout.googlePayEnabled ? [PaymentMethods.googlePay] : []),
    ];

    return (
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setCheckout(null)}
          className="self-start text-sm text-muted-foreground underline"
        >
          ← Change amount
        </button>
        <div className="overflow-hidden rounded-xl border border-border" style={{minHeight: 520}}>
          <CoinflowPurchase
            merchantId={checkout.merchantId}
            env="sandbox"
            blockchain="user"
            sessionKey={checkout.sessionKey}
            jwtToken={checkout.jwtToken}
            subtotal={{cents: zeroAuth ? 0 : amountCents}}
            email={session?.user?.email ?? undefined}
            webhookInfo={{pendingTransactionId: checkout.pendingTransactionId}}
            allowedPaymentMethods={allowedPaymentMethods}
            settlementType={SettlementType.USDC}
            isZeroAuthorization={zeroAuth}
            theme={COINFLOW_CHECKOUT_THEME}
            onSuccess={() => setSuccess(true)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
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
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={zeroAuth}
          onChange={(event) => setZeroAuth(event.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        Save this card for later instead of charging it now (zero-auth)
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="lg" disabled={loading || (!zeroAuth && amountCents < 100)} onClick={startCheckout}>
        {loading ? 'Loading…' : zeroAuth ? 'Save card' : 'Continue to payment'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Card is available now. Apple Pay and Google Pay turn on automatically once configured on
        the merchant account — no code changes needed.
      </p>
    </div>
  );
}
