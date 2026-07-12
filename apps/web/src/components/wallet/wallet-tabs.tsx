'use client';

import {useState} from 'react';
import {DepositPanel} from '@/components/wallet/deposit-panel';
import {CryptoPanel} from '@/components/wallet/crypto-panel';
import {WithdrawPanel} from '@/components/wallet/withdraw-panel';
import {PaymentMethodsPanel} from '@/components/wallet/payment-methods-panel';
import {cn} from '@/lib/utils';

const TABS = [
  {key: 'deposit', label: 'Deposit'},
  {key: 'crypto', label: 'Crypto'},
  {key: 'withdraw', label: 'Withdraw'},
  {key: 'cards', label: 'Cards'},
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function WalletTabs({balanceCents}: {balanceCents: number}) {
  const [active, setActive] = useState<TabKey>('deposit');

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
              active === tab.key
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'deposit' && <DepositPanel />}
      {active === 'crypto' && <CryptoPanel />}
      {active === 'withdraw' && <WithdrawPanel balanceCents={balanceCents} />}
      {active === 'cards' && <PaymentMethodsPanel />}
    </div>
  );
}
