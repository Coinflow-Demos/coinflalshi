'use client';

import {useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {cn} from '@/lib/utils';

const CHAIN_LABELS: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  base: 'Base',
  arbitrum: 'Arbitrum',
  stellar: 'Stellar',
};

export function CryptoPanel() {
  const [chains, setChains] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/wallet/crypto/chains')
      .then((response) => response.json())
      .then((data) => setChains(data.chains ?? []));
  }, []);

  async function selectChain(chain: string) {
    setSelectedChain(chain);
    setAddress(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/wallet/crypto/address', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({chain, token: 'usdc'}),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not generate a deposit address');
        return;
      }
      setAddress(data.address);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
          Choose a network
        </label>
        <div className="grid grid-cols-3 gap-2">
          {chains.map((chain) => (
            <button
              key={chain}
              onClick={() => selectChain(chain)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                selectedChain === chain
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-accent'
              )}
            >
              {CHAIN_LABELS[chain] ?? chain}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Generating your deposit address…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {address && selectedChain && (
        <div className="flex flex-col gap-2 rounded-lg bg-muted p-4">
          <p className="text-xs text-muted-foreground">
            Send USDC on {CHAIN_LABELS[selectedChain] ?? selectedChain} to this address. Your
            balance updates automatically once the deposit confirms.
          </p>
          <code className="break-all rounded-md bg-background px-3 py-2 text-sm">{address}</code>
          <Button variant="secondary" size="sm" onClick={copyAddress}>
            {copied ? 'Copied!' : 'Copy address'}
          </Button>
        </div>
      )}
    </div>
  );
}
