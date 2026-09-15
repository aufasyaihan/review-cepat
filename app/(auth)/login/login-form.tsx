'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={login.isPending} className="w-full">
            {login.isPending ? 'Signing in…' : 'Log in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
