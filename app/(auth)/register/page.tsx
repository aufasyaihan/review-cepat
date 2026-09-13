'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { merchantMutations } from '@/domains/merchant/api/mutations';
import { authClient } from '@/lib/auth-client';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    phone: '',
    country: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set(name: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { error: signUpError } = await authClient.signUp.email({
      name: form.name,
      email: form.email,
      password: form.password,
    });
    if (signUpError) {
      setError(signUpError.message ?? 'Registration failed');
      setPending(false);
      return;
    }

    try {
      await merchantMutations.profile().mutationFn({
        businessName: form.businessName,
        phone: form.phone || undefined,
        country: form.country || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save business profile');
      setPending(false);
      return;
    }

    setPending(false);
    router.push('/dashboard');
    router.refresh();
  }

  const field = 'mt-1 w-full rounded border px-3 py-2';
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-xl font-semibold">Create your merchant account</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">
          Your name
          <input
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Business name
          <input
            required
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Phone (optional)
          <input
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm">
          Country code (optional, e.g. ID)
          <input
            maxLength={2}
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
            className={field}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? 'Creating account…' : 'Register'}
        </button>
      </form>
    </div>
  );
}
