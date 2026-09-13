'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { authClient } from '@/lib/auth-client';

export function AuthNav() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  const signOut = useCallback(async () => {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  }, [router]);

  if (isPending) {
    return <span className="text-sm text-muted-foreground">Loading…</span>;
  }

  if (session) {
    const role = (session.user as { role?: string }).role;
    return (
      <nav className="flex items-center gap-3 text-sm">
        <a
          href={role === 'ADMIN' ? '/admin' : '/dashboard'}
          className="text-muted-foreground hover:underline"
        >
          Dashboard
        </a>
        <button
          type="button"
          onClick={signOut}
          className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Sign out
        </button>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3 text-sm">
      <a href="/login" className="text-muted-foreground hover:underline">
        Log in
      </a>
      <a
        href="/register"
        className="rounded bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
      >
        Register
      </a>
    </nav>
  );
}
