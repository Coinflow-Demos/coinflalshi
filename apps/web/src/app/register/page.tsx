import Link from 'next/link';
import {Card} from '@/components/ui/card';
import {RegisterForm} from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <Card className="p-6">
        <h1 className="mb-1 font-heading text-2xl font-bold">Create your account</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign up to get a free demo wallet and start trading.
        </p>
        <RegisterForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
