'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import type {Outcome} from '@coinflalshi/db';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {cn} from '@/lib/utils';

export function BuyPanel({
  marketSlug,
  outcomes,
  isOpen,
}: {
  marketSlug: string;
  outcomes: Outcome[];
  isOpen: boolean;
}) {
  const router = useRouter();
  const {data: session} = useSession();
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(outcomes[0]?.id ?? '');
  const [amount, setAmount] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedOutcome = outcomes.find((outcome) => outcome.id === selectedOutcomeId);
  const amountCents = Math.round(Number(amount) * 100);
  const shares =
    selectedOutcome && amountCents > 0 ? Math.floor(amountCents / selectedOutcome.priceCents) : 0;
  const potentialPayout = shares * 100;

  async function handleBuy() {
    if (!session) {
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/markets/${marketSlug}/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({outcomeId: selectedOutcomeId, amountCents}),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }
      setSuccess(`Bought ${data.position.shares} shares of ${selectedOutcome?.label}`);
      router.refresh();
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        This market has closed and is awaiting resolution.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {outcomes.map((outcome) => (
          <button
            key={outcome.id}
            onClick={() => setSelectedOutcomeId(outcome.id)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors',
              selectedOutcomeId === outcome.id
                ? 'border-primary bg-primary/10'
                : 'border-border hover:bg-accent'
            )}
          >
            <span className="text-sm font-medium">{outcome.label}</span>
            <span className="text-lg font-bold tabular-nums">{outcome.priceCents}¢</span>
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Amount (USD)
        </label>
        <Input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
        <span className="text-muted-foreground">Shares / payout if correct</span>
        <span className="font-semibold tabular-nums">
          {shares} shares · ${(potentialPayout / 100).toFixed(2)}
        </span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}

      <Button size="lg" disabled={submitting || shares < 1} onClick={handleBuy}>
        {submitting ? 'Placing bet…' : session ? 'Buy shares' : 'Log in to trade'}
      </Button>
    </div>
  );
}
