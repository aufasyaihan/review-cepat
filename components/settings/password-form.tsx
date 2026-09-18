'use client';

import { KeyRound, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field';
import { PasswordInput } from '@/components/ui/password-input';
import { authClient } from '@/lib/auth-client';

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const currentPassword = String(formData.get('currentPassword') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    await authClient.changePassword(
      { currentPassword, newPassword, revokeOtherSessions: true },
      {
        onSuccess: () => {
          toast.success('Password updated');
          formRef.current?.reset();
        },
        onError: (ctx) => {
          toast.error(ctx.error.message ?? 'Could not update password');
        },
      },
    );
    setSaving(false);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" />
          Password
        </CardTitle>
        <CardDescription>Update your password. This signs you out everywhere else.</CardDescription>
      </CardHeader>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-1 flex-col gap-2">
        <CardContent className="flex-1 space-y-4">
          <Field>
            <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
            <FieldContent>
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                autoComplete="current-password"
                required
                disabled={saving}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <FieldContent>
              <PasswordInput
                id="newPassword"
                name="newPassword"
                autoComplete="new-password"
                required
                disabled={saving}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <FieldContent>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                required
                disabled={saving}
              />
            </FieldContent>
            {error && <FieldError>{error}</FieldError>}
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Update password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
