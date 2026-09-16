import { BarChart3, Link2, ScanLine, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GridBackground } from '@/components/layout/grid-background';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'NFC Platform — NFC & QR Redirect SaaS',
  description:
    'Turn physical NFC tags and QR codes into instant redirects to Google Reviews and social links, with scan analytics.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'NFC Platform — NFC & QR Redirect SaaS',
    description:
      'Turn physical NFC tags and QR codes into instant redirects to Google Reviews and social links, with scan analytics.',
    type: 'website',
  },
};

const FEATURES = [
  {
    title: 'Tap. Scan. Redirect.',
    body: 'Single-link devices forward customers instantly to Google Reviews or any URL.',
    icon: ScanLine,
  },
  {
    title: 'Linktree-style pages',
    body: 'Multi-link devices open a mobile-first landing page full of social links.',
    icon: Link2,
  },
  {
    title: 'Scan analytics',
    body: 'See totals, daily scans, device breakdowns, browsers, locations, and referrers.',
    icon: BarChart3,
  },
  {
    title: 'Google Reviews built in',
    body: 'Search businesses on Google Places and attach a review destination in seconds.',
    icon: Star,
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden py-20 text-center sm:py-28">
        <GridBackground />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            NFC tags and QR codes, configured in minutes
          </span>
          <h1 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            Turn every tap and scan into your next customer action
          </h1>
          <p className="mx-auto max-w-lg text-lg text-muted-foreground">
            Point a physical NFC tag or QR code at Google Reviews or a branded link page, then watch
            every scan land in your analytics.
          </p>
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Button render={<Link href="/register" />} nativeButton={false} size="lg">
            Get started
          </Button>
          <Button render={<Link href="/login" />} nativeButton={false} variant="outline" size="lg">
            Log in
          </Button>
        </div>
      </section>

      <section className="grid gap-4 pb-20 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <feature.icon className="size-5 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-medium">{feature.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="mb-20 rounded-2xl bg-primary/5 px-6 py-14 text-center ring-1 ring-primary/10">
        <h2 className="text-2xl font-semibold">Ready to put your reviews on autopilot?</h2>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Claim your first device and start redirecting scans in minutes.
        </p>
        <Button render={<Link href="/register" />} nativeButton={false} size="lg" className="mt-6">
          Get started
        </Button>
      </section>
    </div>
  );
}
