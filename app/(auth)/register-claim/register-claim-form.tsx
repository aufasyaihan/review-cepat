'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUpWithClaimCodeAction } from '@/domains/merchant/server/claim-actions';
import { useAction } from '@/hooks/use-action';

export function RegisterClaimForm() {
  const router = useRouter();
  const signUp = useAction(signUpWithClaimCodeAction, {
    successMsg: 'Account created — device ready',
    onSuccess: () => router.push('/devices'),
  });

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', claimCode: '' },
    onSubmit: ({ value }) => signUp.mutate(value),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Register with a claim code</CardTitle>
        <CardDescription>
          Create a sub-merchant account and link it to the device whose claim code you have.
        </CardDescription>
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
          <form.Field name="claimCode">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="claimCode">Claim code</Label>
                <Input
                  id="claimCode"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <Button type="submit" disabled={signUp.isPending} className="w-full">
            {signUp.isPending ? 'Creating account…' : 'Register & link device'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
