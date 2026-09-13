'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';

import { signUpAction } from '@/domains/auth/server/actions';
import { useAction } from '@/hooks/use-action';

const fieldClass = 'mt-1 w-full rounded border px-3 py-2';

export function RegisterForm() {
  const router = useRouter();
  const signUp = useAction(signUpAction, {
    successMsg: 'Account created',
    onSuccess: () => router.push('/dashboard'),
  });

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', businessName: '', phone: '', country: '' },
    onSubmit: ({ value }) =>
      signUp.mutate({
        name: value.name,
        email: value.email,
        password: value.password,
        businessName: value.businessName || undefined,
      }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="mt-6 space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <label className="block text-sm">
            Your name
            <input
              required
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className={fieldClass}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="email">
        {(field) => (
          <label className="block text-sm">
            Email
            <input
              type="email"
              required
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className={fieldClass}
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
              minLength={8}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className={fieldClass}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="businessName">
        {(field) => (
          <label className="block text-sm">
            Business name (optional)
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className={fieldClass}
            />
          </label>
        )}
      </form.Field>
      <button
        type="submit"
        disabled={signUp.isPending}
        className="w-full rounded bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
      >
        {signUp.isPending ? 'Creating account…' : 'Register'}
      </button>
    </form>
  );
}
