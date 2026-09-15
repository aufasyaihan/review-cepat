'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpAction } from '@/domains/auth/server/actions';
import { useAction } from '@/hooks/use-action';

export function RegisterForm() {
  const router = useRouter();
  const signUp = useAction(signUpAction, {
    successMsg: 'Account created',
    onSuccess: () => router.push('/dashboard'),
  });

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', businessName: '' },
    onSubmit: ({ value }) =>
      signUp.mutate({
        name: value.name,
        email: value.email,
        password: value.password,
        businessName: value.businessName || undefined,
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Register</CardTitle>
        <CardDescription>Create a merchant account to manage devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
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
                  minLength={8}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="businessName">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="businessName">Business name (optional)</Label>
                <Input
                  id="businessName"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={signUp.isPending} className="w-full">
            {signUp.isPending ? 'Creating account…' : 'Register'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
