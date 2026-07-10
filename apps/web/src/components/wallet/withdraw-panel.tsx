'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

export function WithdrawPanel({balanceCents}: {balanceCents: number}) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState<'checking' | 'savings'>('checking');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/withdraw/request', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          amountCents: Math.round(Number(amount) * 100),
          routingNumber,
          accountNumber,
          accountType,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not submit payout request');
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-lg font-semibold">Payout requested</p>
        <p className="text-sm text-muted-foreground">
          Your funds are on the way — bank payouts typically settle in 1-3 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Available balance: <span className="font-semibold text-foreground">
          ${(balanceCents / 100).toFixed(2)}
        </span>
      </p>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Amount (USD)
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Routing number
        </label>
        <Input
          required
          maxLength={9}
          value={routingNumber}
          onChange={(event) => setRoutingNumber(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Account number
        </label>
        <Input
          required
          value={accountNumber}
          onChange={(event) => setAccountNumber(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Account type
        </label>
        <div className="flex gap-2">
          {(['checking', 'savings'] as const).map((type) => (
            <button
              type="button"
              key={type}
              onClick={() => setAccountType(type)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                accountType === type ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Request payout'}
      </Button>
    </form>
  );
}
