'use client';

import {useCallback, useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

interface LinkedPayoutMethod {
  token: string;
  speed: string;
  label: string;
}

type AccountsState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'verification_required'; verificationLink: string}
  | {status: 'ok'; methods: LinkedPayoutMethod[]};

export function WithdrawPanel({balanceCents}: {balanceCents: number}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountsState>({status: 'loading'});
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadAccounts = useCallback(async (silent = false) => {
    if (!silent) setAccounts({status: 'loading'});
    try {
      const response = await fetch('/api/wallet/withdraw/accounts');
      const data = await response.json();
      if (!response.ok) {
        setAccounts({status: 'error', message: data.error ?? 'Could not load linked accounts'});
        return;
      }
      if (data.status === 'verification_required') {
        setAccounts({status: 'verification_required', verificationLink: data.verificationLink});
        return;
      }
      const methods: LinkedPayoutMethod[] = data.methods ?? [];
      setAccounts({status: 'ok', methods});
      setSelectedToken((current) => current ?? methods[0]?.token ?? null);
    } catch {
      setAccounts({status: 'error', message: 'Network error — please try again'});
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Identity verification (Persona) runs on its own timeline, so poll
  // quietly until it clears rather than requiring a manual reload.
  useEffect(() => {
    if (accounts.status !== 'verification_required') return;
    const interval = setInterval(() => loadAccounts(true), 8000);
    return () => clearInterval(interval);
  }, [accounts.status, loadAccounts]);

  // The Bank Authentication UI iframe posts a JSON-stringified
  // {method: "accountLinked"} message to window.parent on success.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (typeof event.data !== 'string') return;
      let parsed: {method?: string};
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (parsed.method === 'accountLinked') {
        setLinking(false);
        setLinkUrl(null);
        loadAccounts();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loadAccounts]);

  async function handleStartLinking() {
    setError(null);
    try {
      const response = await fetch('/api/wallet/withdraw/link');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not start account linking');
        return;
      }
      setLinkUrl(data.url);
      setLinking(true);
    } catch {
      setError('Network error — please try again');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedToken || accounts.status !== 'ok') return;
    const method = accounts.methods.find((m) => m.token === selectedToken);
    if (!method) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/wallet/withdraw/request', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          amountCents: Math.round(Number(amount) * 100),
          token: method.token,
          speed: method.speed,
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
          Your funds are on the way — payouts typically settle in 1-3 business days.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {linking && linkUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex h-[700px] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium text-neutral-600">Link a payout method</span>
              <button
                onClick={() => {
                  setLinking(false);
                  setLinkUrl(null);
                }}
                className="text-sm text-neutral-500 hover:text-neutral-800"
              >
                Close
              </button>
            </div>
            <iframe title="Coinflow bank authentication" src={linkUrl} className="h-full w-full border-0" />
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Available balance:{' '}
        <span className="font-semibold text-foreground">${(balanceCents / 100).toFixed(2)}</span>
      </p>

      {accounts.status === 'loading' && (
        <p className="text-sm text-muted-foreground">Loading linked accounts…</p>
      )}

      {accounts.status === 'error' && <p className="text-sm text-destructive">{accounts.message}</p>}

      {accounts.status === 'verification_required' && (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <p className="text-sm font-medium">Verification required</p>
          <p className="text-sm text-muted-foreground">
            Coinflow needs a bit more information before you can withdraw funds. This page checks
            automatically once you're done — or refresh manually below.
          </p>
          <div className="flex items-center gap-4">
            <a
              href={accounts.verificationLink}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline"
            >
              Complete verification
            </a>
            <button
              type="button"
              onClick={() => loadAccounts()}
              className="text-sm font-medium text-muted-foreground underline"
            >
              Refresh
            </button>
          </div>
        </div>
      )}

      {accounts.status === 'ok' && (
        <>
          {accounts.methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payout methods linked yet — link a bank account or card to withdraw.
            </p>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Payout method
              </label>
              <div className="flex flex-col gap-2">
                {accounts.methods.map((method) => (
                  <button
                    key={method.token}
                    type="button"
                    onClick={() => setSelectedToken(method.token)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                      selectedToken === method.token
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="button" variant="outline" onClick={handleStartLinking} className="self-start">
            + Link a bank account or card
          </Button>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {accounts.methods.length > 0 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <Button type="submit" size="lg" disabled={submitting || !selectedToken}>
                {submitting ? 'Submitting…' : 'Request payout'}
              </Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
