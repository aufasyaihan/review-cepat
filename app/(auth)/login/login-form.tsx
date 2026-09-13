'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';

import { signInAction } from '@/domains/auth/server/actions';
import { useAction } from '@/hooks/use-action';

export function LoginForm() {
  const router = useRouter();
  const login = useAction(signInAction, {
    successMsg: 'Signed in',
    onSuccess: (result) => router.push(result.role === 'ADMIN' ? '/admin' : '/dashboard'),
  });

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: ({ value }) => login.mutate(value),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="mt-6 space-y-4"
    >
      <form.Field name="email">
        {(field) => (
          <label className="block text-sm">
            Email
            <input
              type="email"
              required
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <label className="block text-sm">
            Password
            <input
              type="password"
              required
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>
        )}
      </form.Field>
      <button
        type="submit"
        disabled={login.isPending}
        className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {login.isPending ? 'Signing in…' : 'Log in'}
      </button>
    </form>
  );
}
