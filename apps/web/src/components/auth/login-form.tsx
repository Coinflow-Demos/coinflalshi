'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {signIn} from 'next-auth/react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn('credentials', {email, password, redirect: false});
    if (result?.error) {
      setError('Invalid email or password');
      setSubmitting(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  async function handleGuest() {
    setSubmitting(true);
    setError(null);
    const result = await signIn('guest', {redirect: false});
    if (result?.error) {
      setError('Could not start a guest session — please try again');
      setSubmitting(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Email</label>
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Password</label>
        <Input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? 'Logging in…' : 'Log in'}
      </Button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" size="lg" disabled={submitting} onClick={handleGuest}>
        Continue as guest
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Guest sessions aren&apos;t saved — everything (bets, saved cards) is gone once you sign out.
      </p>
    </form>
  );
}
