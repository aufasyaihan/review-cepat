'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { analyticsQueries } from '@/domains/analytics/api/queries';
import type { BreakdownDimension } from '@/domains/analytics/server/service';
import { deviceQueries } from '@/domains/device/api/queries';

const DIMENSIONS: { value: BreakdownDimension; label: string }[] = [
  { value: 'browser', label: 'Browser' },
  { value: 'deviceType', label: 'Device type' },
  { value: 'country', label: 'Country' },
  { value: 'city', label: 'City' },
  { value: 'referrer', label: 'Referrer' },
];

export function DashboardClient({ userName, isOwner }: { userName: string; isOwner: boolean }) {
  const { data: devices } = useSuspenseQuery(deviceQueries.list());
  const { data: analytics } = useQuery({
    ...analyticsQueries.overview(),
    enabled: isOwner,
    retry: false,
  });

  const published = devices.filter((d) => d.status === 'PUBLISHED').length;

  if (devices.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">No devices yet</h1>
        <p className="mt-2 text-muted-foreground">
          Claim a device with its one-time claim code to get started.
        </p>
        <Link
          href="/devices/claim"
          className="mt-6 inline-block rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Claim a device
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome, {userName}</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Devices" value={devices.length} />
        <StatCard label="Published" value={published} />
        <StatCard label="My devices" value={devices.length} />
      </div>

      <nav className="flex flex-wrap gap-3">
        <Link href="/devices" className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Manage devices
        </Link>
        <Link href="/devices/claim" className="rounded border px-4 py-2 hover:bg-muted">
          Claim a device
        </Link>
      </nav>

      {isOwner && analytics && (
        <OwnerAnalytics
          published={published}
          totalScans={analytics.totalScans}
          dailyScans={analytics.dailyScans}
          deviceScans={analytics.deviceScans}
        />
      )}
    </div>
  );
}

function OwnerAnalytics({
  published,
  totalScans,
  dailyScans,
  deviceScans,
}: {
  published: number;
  totalScans: number;
  dailyScans: Array<{ day: string; scans: number }>;
  deviceScans: Array<{ deviceId: string; slug: string; name: string; scans: number }>;
}) {
  const [dimension, setDimension] = useState<BreakdownDimension>('browser');
  const [selectedDevice, setSelectedDevice] = useState('');
  const activeDevice = selectedDevice || deviceScans[0]?.deviceId || '';

  const { data: breakdownData } = useQuery({
    ...analyticsQueries.breakdown(activeDevice, dimension),
    enabled: !!activeDevice,
    retry: false,
  });

  return (
    <section className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold">Analytics</h2>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total scans" value={totalScans} />
        <StatCard label="Published devices" value={published} />
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Scans per day</h3>
        {dailyScans.length === 0 ? (
          <Empty label="No scans yet" hint="Publish a device and scan it once to see data here." />
        ) : (
          <ul className="divide-y rounded border">
            {dailyScans.map((d) => (
              <li key={d.day} className="flex items-center justify-between p-3 text-sm">
                <span>{d.day}</span>
                <span className="font-medium">{d.scans}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Scans per device</h3>
        {deviceScans.length === 0 ? (
          <Empty label="No devices" hint="Claim and publish a device to start collecting scans." />
        ) : (
          <ul className="divide-y rounded border">
            {deviceScans.map((d) => (
              <li key={d.deviceId} className="flex items-center justify-between p-3 text-sm">
                <Link href={`/devices/${d.deviceId}`} className="hover:underline">
                  {d.name} <code className="text-xs text-muted-foreground">/s/{d.slug}</code>
                </Link>
                <span className="font-medium">{d.scans}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Scan breakdowns</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={activeDevice} onValueChange={(value) => setSelectedDevice(value ?? '')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {deviceScans.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {DIMENSIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDimension(d.value)}
                className={
                  dimension === d.value
                    ? 'rounded border bg-primary px-3 py-1.5 text-sm text-primary-foreground'
                    : 'rounded border px-3 py-1.5 text-sm hover:bg-muted'
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        {breakdownData && breakdownData.length === 0 ? (
          <Empty label="No data" hint="No scans match this breakdown yet." />
        ) : (
          <ul className="divide-y rounded border">
            {breakdownData?.map((row) => (
              <li key={row.value} className="flex items-center justify-between p-3 text-sm">
                <span>{row.value}</span>
                <span className="font-medium">{row.scans}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Empty({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded border border-dashed p-6 text-center">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
