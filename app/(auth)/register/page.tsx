import Link from 'next/link';
import { Suspense } from 'react';

import { RegisterForm } from './register-form';

export default function RegisterPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-semibold">Create account</h1>
        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Have a device claim code?{' '}
          <Link href="/register-claim" className="underline">
            Register with a claim code
          </Link>
        </p>
      </div>
    </div>
  );
}
