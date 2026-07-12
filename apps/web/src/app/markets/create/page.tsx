'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {useSession} from 'next-auth/react';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {cn} from '@/lib/utils';

const CATEGORIES = ['Sports', 'Crypto', 'Culture', 'Weather', 'Economics', 'Space', 'Other'];
const DURATIONS = [5, 10, 15, 30];
const EMOJI_SUGGESTIONS = ['❓', '🔥', '🎯', '⚡', '🎲', '🚀', '💡'];

export default function CreateMarketPage() {
  const router = useRouter();
  const {data: session, status} = useSession();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('Sports');
  const [imageEmoji, setImageEmoji] = useState('❓');
  const [outcomeA, setOutcomeA] = useState('Yes');
  const [outcomeB, setOutcomeB] = useState('No');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/markets/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          category,
          imageEmoji,
          outcomeLabels: [outcomeA, outcomeB],
          durationMinutes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not create market');
        return;
      }
      router.push(`/markets/${data.market.slug}`);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-1 font-heading text-3xl font-bold tracking-tight">Create a market</h1>
      <p className="mb-6 text-muted-foreground">
        Ask anything. It goes live immediately, anyone can trade it, and it settles automatically
        when the clock runs out.
      </p>

      <Card className="flex flex-col gap-4 p-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            Question
          </label>
          <Input
            placeholder="Will it snow in Chicago this week?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            Subtitle (optional)
          </label>
          <Input
            placeholder="A little extra context"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={140}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  category === c ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Icon</label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setImageEmoji(emoji)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-colors',
                  imageEmoji === emoji
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Outcome A
            </label>
            <Input value={outcomeA} onChange={(e) => setOutcomeA(e.target.value)} maxLength={40} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              Outcome B
            </label>
            <Input value={outcomeB} onChange={(e) => setOutcomeB(e.target.value)} maxLength={40} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
            Resolves in
          </label>
          <div className="flex gap-2">
            {DURATIONS.map((minutes) => (
              <button
                key={minutes}
                onClick={() => setDurationMinutes(minutes)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  durationMinutes === minutes
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent'
                )}
              >
                {minutes}m
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Outcomes start at 50/50 and settle randomly, weighted by whatever the market's odds
            drift to by the time it closes — same as every other market here.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          size="lg"
          disabled={submitting || title.trim().length < 4 || !session}
          onClick={handleSubmit}
        >
          {submitting ? 'Creating…' : 'Create market'}
        </Button>
      </Card>
    </div>
  );
}
