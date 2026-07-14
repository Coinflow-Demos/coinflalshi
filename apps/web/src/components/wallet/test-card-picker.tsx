'use client';

import {useState} from 'react';
import {Check, Copy} from 'lucide-react';
import {Badge} from '@/components/ui/badge';

interface TestCard {
  brand: string;
  number: string;
  cvv: string;
  expMonth?: string;
  expYear?: string;
  note: string;
  outcome: 'success' | 'challenge' | 'failure';
}

const STANDARD_CARDS: TestCard[] = [
  {brand: 'Visa', number: '4242424242424242', cvv: '123', note: 'Any zip succeeds', outcome: 'success'},
  {brand: 'Mastercard', number: '5555555555554444', cvv: '123', note: 'Any zip succeeds', outcome: 'success'},
  {brand: 'Discover', number: '6011010000000003', cvv: '123', note: 'Any zip succeeds', outcome: 'success'},
  {brand: 'Amex', number: '378282246310005', cvv: '1234', note: 'Any zip succeeds', outcome: 'success'},
];

const THREE_DS_CARDS: TestCard[] = [
  {
    brand: 'Mastercard',
    number: '5204247750001471',
    cvv: '123',
    expMonth: '08',
    expYear: '27',
    note: 'Frictionless challenge',
    outcome: 'challenge',
  },
  {
    brand: 'Visa',
    number: '4000020000000000',
    cvv: '123',
    expMonth: '08',
    expYear: '27',
    note: 'Friction challenge',
    outcome: 'challenge',
  },
  {
    brand: 'Visa',
    number: '4055011111111111',
    cvv: '123',
    expMonth: '08',
    expYear: '27',
    note: 'Friction challenge failure',
    outcome: 'failure',
  },
  {
    brand: 'Visa',
    number: '4264281511112228',
    cvv: '123',
    expMonth: '08',
    expYear: '27',
    note: 'Rejection',
    outcome: 'failure',
  },
];

function formatNumber(number: string) {
  return number.replace(/(\d{4})(?=\d)/g, '$1 ');
}

const OUTCOME_BADGE: Record<TestCard['outcome'], 'success' | 'outline' | 'destructive'> = {
  success: 'success',
  challenge: 'outline',
  failure: 'destructive',
};

function CardRow({card, copied, onCopy}: {card: TestCard; copied: string | null; onCopy: (card: TestCard) => void}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(card)}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left hover:bg-accent"
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{card.brand}</span>
          <Badge variant={OUTCOME_BADGE[card.outcome]}>{card.note}</Badge>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {formatNumber(card.number)} · CVV {card.cvv}
          {card.expMonth ? ` · ${card.expMonth}/${card.expYear}` : ''}
        </span>
      </div>
      {copied === card.number ? (
        <Check className="h-4 w-4 shrink-0 text-success" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

/** Coinflow's card form is a PCI iframe with only a `tokenize()` method, so
 * the number can't be injected directly — copying it to the clipboard is the
 * fastest way to get a sandbox test card into it. */
export function TestCardPicker() {
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(card: TestCard) {
    navigator.clipboard.writeText(card.number);
    setCopied(card.number);
    setTimeout(() => setCopied((current) => (current === card.number ? null : current)), 2000);
  }

  return (
    <details className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-muted-foreground">
        Sandbox test cards — tap one to copy its number
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {STANDARD_CARDS.map((card) => (
          <CardRow key={card.number} card={card} copied={copied} onCopy={handleCopy} />
        ))}
        {THREE_DS_CARDS.map((card) => (
          <CardRow key={card.number} card={card} copied={copied} onCopy={handleCopy} />
        ))}
      </div>
    </details>
  );
}
