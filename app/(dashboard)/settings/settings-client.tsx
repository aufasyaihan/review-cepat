'use client';

import { UserRound } from 'lucide-react';

import { ActiveSessions } from '@/components/settings/active-sessions';
import { PasswordForm } from '@/components/settings/password-form';
import { ProfileForm } from '@/components/settings/profile-form';

export function SettingsClient() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <UserRound className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Account settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile, password, and active sessions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <ProfileForm />
        <PasswordForm />
        <div className="lg:col-span-2">
          <ActiveSessions />
        </div>
      </div>
    </div>
  );
}
