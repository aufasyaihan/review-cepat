'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { deviceQueries } from '@/domains/device/api/queries';
import { merchantQueries } from '@/domains/merchant/api/queries';

export function DashboardClient({ userName }: { userName: string }) {
  const { data: devices } = useSuspenseQuery(deviceQueries.list());
  const { data: profile } = useSuspenseQuery({
    ...merchantQueries.profile(),
    retry: false,
  });

  const published = devices.filter((d) => d.status === 'PUBLISHED').length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome, {userName}</h1>
        {!profile && (
          <p className="mt-2 text-muted-foreground">
            <Link href="/devices" className="underline">
              Set up your business profile
            </Link>{' '}
            to claim and configure devices.
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Devices" value={devices.length} />
        <StatCard label="Published" value={published} />
        <StatCard label="Scans" value="View analytics" />
      </div>

      <nav className="flex flex-wrap gap-3">
        <Link href="/devices" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Manage devices
        </Link>
        <Link href="/devices/claim" className="rounded border px-4 py-2 hover:bg-muted">
          Claim a device
        </Link>
        <Link href="/analytics" className="rounded border px-4 py-2 hover:bg-muted">
          Analytics
        </Link>
      </nav>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
