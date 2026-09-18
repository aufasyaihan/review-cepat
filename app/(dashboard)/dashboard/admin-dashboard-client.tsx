'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Store, Tag, Users } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { SkeletonLoader } from '@/components/common/skeleton-loader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { type DateRange, DateRangePicker } from '@/components/ui/date-range-picker';
import { StatCard } from '@/components/ui/stat-card';
import { type AnalyticsRange, analyticsQueries } from '@/domains/analytics/api/queries';
import type { AnalyticsOverview } from '@/domains/analytics/server/service';

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
            Platform-wide analytics across all merchants.
          </p>
        </div>
        <DateRangePicker range={range} onApply={setRange} />
      </header>

      <SkeletonLoader loading={isPending}>
        <AdminAnalytics analytics={analytics ?? EMPTY_OVERVIEW} />
      </SkeletonLoader>
    </div>
  );
}

const EMPTY_OVERVIEW: AnalyticsOverview = {
  totalScans: 0,
  deviceScans: [],
  dailyScans: [],
  merchantCount: 0,
  userCount: 0,
};

const dailyChartConfig = {
  scans: { label: 'Scans', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const deviceChartConfig = {
  scans: { label: 'Scans', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function AdminAnalytics({ analytics }: { analytics: AnalyticsOverview }) {
  const dailyChartData = analytics.dailyScans.map((d) => ({ date: d.day, scans: d.scans }));
  const deviceChartData = analytics.deviceScans.map((d) => ({ name: d.name, scans: d.scans }));

  return (
    <section className="space-y-8">
      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total scans" value={analytics.totalScans} icon={BarChart3} />
        <StatCard label="Published devices" value={analytics.deviceScans.length} icon={Tag} />
        <StatCard label="Merchants" value={analytics.merchantCount} icon={Store} />
        <StatCard label="Users" value={analytics.userCount} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Scans per day</CardTitle>
            <CardDescription>Daily scan volume across all merchants.</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.dailyScans.length === 0 ? (
              <Empty label="No scans" hint="No scans match this date range." />
            ) : (
              <ChartContainer config={dailyChartConfig} className="h-[250px] w-full">
                <BarChart data={dailyChartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="scans" fill="var(--color-scans)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
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
              <ChartContainer config={deviceChartConfig} className="h-[250px] w-full">
                <BarChart data={deviceChartData} layout="vertical">
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="scans" fill="var(--color-scans)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
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
