'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Filter, Smartphone, Tag } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
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
        <Button render={<Link href="/devices/claim" />} nativeButton={false} className="mt-6">
          Claim a device
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome, {userName}</h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s how your devices are doing.</p>
      </header>

      <div className="grid auto-rows-min gap-4 sm:grid-cols-3">
        <StatCard label="Devices" value={devices.length} icon={Smartphone} />
        <StatCard label="Published" value={published} icon={Tag} />
        <StatCard label="My devices" value={devices.length} icon={Activity} />
      </div>

      <nav className="flex flex-wrap gap-3">
        <Button render={<Link href="/devices" />} nativeButton={false}>
          Manage devices
        </Button>
        <Button render={<Link href="/devices/claim" />} nativeButton={false} variant="outline">
          Claim a device
        </Button>
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

      <div className="grid auto-rows-min gap-4 sm:grid-cols-3">
        <StatCard label="Total scans" value={totalScans} icon={BarChart3} />
        <StatCard label="Published devices" value={published} icon={Tag} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scans per day</CardTitle>
            <CardDescription>Daily scan volume across all devices.</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyScans.length === 0 ? (
              <Empty
                label="No scans yet"
                hint="Publish a device and scan it once to see data here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {dailyScans.map((d) => (
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
            {deviceScans.length === 0 ? (
              <Empty
                label="No devices"
                hint="Claim and publish a device to start collecting scans."
              />
            ) : (
              <ul className="divide-y divide-border">
                {deviceScans.map((d) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Scan breakdowns</CardTitle>
          <CardDescription>Filter scans by device and dimension.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground" />
              {DIMENSIONS.map((d) => (
                <Button
                  key={d.value}
                  type="button"
                  size="sm"
                  variant={dimension === d.value ? 'default' : 'outline'}
                  onClick={() => setDimension(d.value)}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>
          {breakdownData && breakdownData.length === 0 ? (
            <Empty label="No data" hint="No scans match this breakdown yet." />
          ) : (
            <ul className="divide-y divide-border">
              {breakdownData?.map((row) => (
                <li key={row.value} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{row.value}</span>
                  <span className="font-medium">{row.scans}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
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
