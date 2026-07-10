import Link from 'next/link';
import {Card} from '@/components/ui/card';
import {LoginForm} from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <Card className="p-6">
        <h1 className="mb-1 font-heading text-2xl font-bold">Welcome back</h1>
        <p className="mb-6 text-sm text-muted-foreground">Log in to keep trading.</p>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-foreground underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
