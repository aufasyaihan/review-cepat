'use client';

import { BadgeCheck, Loader2, MailWarning, SendHorizonal, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldContent, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

export function ProfileForm() {
  const { data: session, isPending: sessionPending, refetch } = authClient.useSession();
  const user = session?.user;

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);

  if (sessionPending) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join('')
    : 'U';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    await authClient.updateUser(
      { name },
      {
        onSuccess: () => {
          toast.success('Profile updated');
          refetch();
        },
        onError: (ctx) => {
          toast.error(ctx.error.message ?? 'Could not update profile');
        },
      },
    );
    setSaving(false);
  };

  const handleSendVerification = async () => {
    if (!user?.email) return;
    setSendingVerification(true);
    await authClient.sendVerificationEmail(
      { email: user.email, callbackURL: '/settings' },
      {
        onSuccess: () => {
          toast.success('Verification email sent');
        },
        onError: (ctx) => {
          toast.error(ctx.error.message ?? 'Could not send verification email');
        },
      },
    );
    setSendingVerification(false);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" />
              Profile
            </CardTitle>
            <CardDescription>Your name and account email.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-2">
        <CardContent className="flex-1 space-y-4">
          <Field>
            <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
            <FieldContent>
              <Input
                id="profile-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={saving}
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-email">Email</FieldLabel>
            <FieldContent>
              <div className="flex items-center gap-2">
                <Input
                  id="profile-email"
                  type="email"
                  value={user?.email ?? ''}
                  disabled
                  className="flex-1 bg-muted text-muted-foreground"
                />
                {user?.emailVerified ? (
                  <Badge
                    variant="secondary"
                    className="shrink-0 gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                  >
                    <BadgeCheck className="size-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="shrink-0 gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
                  >
                    <MailWarning className="size-3" />
                    Unverified
                  </Badge>
                )}
              </div>
              {!user?.emailVerified && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 gap-1.5 text-xs"
                  onClick={handleSendVerification}
                  disabled={sendingVerification}
                >
                  {sendingVerification ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <SendHorizonal className="size-3" />
                  )}
                  Send verification email
                </Button>
              )}
            </FieldContent>
          </Field>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
