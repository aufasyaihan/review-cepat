'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Settings, Smartphone, Store, Tag, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { SkeletonLoader } from '@/components/common/skeleton-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type DateRange, DateRangePicker } from '@/components/ui/date-range-picker';
import { StatCard } from '@/components/ui/stat-card';
import { type AnalyticsRange, analyticsQueries } from '@/domains/analytics/api/queries';
import type { AnalyticsOverview } from '@/domains/analytics/server/service';

const AREAS = [
  {
    title: 'Devices',
    description: 'Inventory, create, reset and disable devices.',
    href: '/devices',
    icon: Smartphone,
  },
  {
    title: 'Merchants',
    description: 'Manage merchant organizations and their devices.',
    href: '/merchants',
    icon: Store,
  },
  {
    title: 'User management',
    description: 'Members and roles within merchant organizations.',
    href: '/user-management',
    icon: Users,
  },
  {
    title: 'Settings',
    description: 'Account and workspace settings.',
    href: '/settings',
    icon: Settings,
  },
];

export function AdminDashboardClient({ userName }: { userName: string }) {
  const [range, setRange] = useState<DateRange | null>(null);

  const window: AnalyticsRange = range ? { from: range.from, to: range.to } : {};
  const { data: analytics, isPending } = useQuery({
    ...analyticsQueries.adminOverview(window),
    retry: false,
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {userName}</h1>
          <p className="mt-1 text-muted-foreground">
            Platform-wide analytics across all merchant organizations.
          </p>
        </div>
        <DateRangePicker range={range} onApply={setRange} />
      </header>

      <SkeletonLoader loading={isPending}>
        <AdminAnalytics analytics={analytics ?? EMPTY_OVERVIEW} />
      </SkeletonLoader>

      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((area) => (
          <Link key={area.href} href={area.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <area.icon className="size-4 text-primary" />
                </div>
                <div>
                  <CardTitle>{area.title}</CardTitle>
                  <CardDescription>{area.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">
                Manage {area.title.toLowerCase()}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

const EMPTY_OVERVIEW: AnalyticsOverview = { totalScans: 0, deviceScans: [], dailyScans: [] };

function AdminAnalytics({ analytics }: { analytics: AnalyticsOverview }) {
  return (
    <section className="space-y-8">
      <div className="grid auto-rows-min gap-4 sm:grid-cols-2">
        <StatCard label="Total scans" value={analytics.totalScans} icon={BarChart3} />
        <StatCard label="Published devices" value={analytics.deviceScans.length} icon={Tag} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scans per day</CardTitle>
            <CardDescription>Daily scan volume across all organizations.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.dailyScans.length === 0 ? (
              <Empty label="No scans" hint="No scans match this date range." />
            ) : (
              <ul className="divide-y divide-border">
                {analytics.dailyScans.map((d) => (
                  <li key={d.day} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">{d.day}</span>
                    <span className="font-medium">{d.scans}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scans per device</CardTitle>
            <CardDescription>Which devices are getting tapped and scanned.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.deviceScans.length === 0 ? (
              <Empty label="No devices" hint="Create devices to start collecting scans." />
            ) : (
              <ul className="divide-y divide-border">
                {analytics.deviceScans.map((d) => (
                  <li key={d.deviceId} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/devices/${d.deviceId}`} className="hover:underline">
                      {d.name} <code className="text-xs text-muted-foreground">/s/{d.slug}</code>
                    </Link>
                    <span className="font-medium">{d.scans}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Empty({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="font-medium">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
