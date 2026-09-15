'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { analyticsQueries } from '@/domains/analytics/api/queries';

export function AnalyticsClient() {
  const { data } = useSuspenseQuery(analyticsQueries.overview());

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Analytics</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border p-5">
          <p className="text-sm text-muted-foreground">Total scans</p>
          <p className="mt-1 text-3xl font-semibold">{data.totalScans}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scans per day</h2>
        {data.dailyScans.length === 0 ? (
          <Empty label="No scans yet" hint="Publish a device and scan it once to see data here." />
        ) : (
          <ul className="divide-y rounded border">
            {data.dailyScans.map((d) => (
              <li key={d.day} className="flex items-center justify-between p-3 text-sm">
                <span>{d.day}</span>
                <span className="font-medium">{d.scans}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Scans per device</h2>
        {data.deviceScans.length === 0 ? (
          <Empty label="No devices" hint="Claim and publish a device to start collecting scans." />
        ) : (
          <ul className="divide-y rounded border">
            {data.deviceScans.map((d) => (
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
