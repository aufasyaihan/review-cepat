'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { data, error: authError } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (authError) {
      setError(authError.message ?? 'Sign in failed');
      return;
    }
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.push(role === 'ADMIN' ? '/admin' : '/dashboard');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm py-16">
      <h1 className="text-xl font-semibold">Log in</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
