import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { RegisterForm } from './register-form';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d: deviceToken } = await searchParams;
  if (!deviceToken) {
    redirect('/');
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="mb-4 text-center text-2xl font-semibold">Create account</h1>
        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
