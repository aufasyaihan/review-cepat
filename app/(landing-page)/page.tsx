import type { Metadata } from 'next';
import Link from 'next/link';

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
  [
    'Tap. Scan. Redirect.',
    'Single-link devices forward customers instantly to Google Reviews or any URL.',
  ],
  [
    'Linktree-style pages',
    'Multi-link devices open a mobile-first landing page full of social links.',
  ],
  [
    'Scan analytics',
    'See totals, daily scans, device breakdowns, browsers, locations, and referrers.',
  ],
  [
    'Google Reviews built in',
    'Search businesses on Google Places and attach a review destination in seconds.',
  ],
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="py-16 text-center">
        <h1 className="text-4xl font-bold leading-tight">
          Turn every tap and scan into your next customer action
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          NFC tags and QR codes that redirect to Google Reviews or a branded social link page —
          configured in minutes, with analytics on every scan.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/register"
            className="rounded bg-primary px-5 py-2.5 font-medium text-primary-foreground"
          >
            Get started
          </Link>
          <Link href="/login" className="rounded border px-5 py-2.5 font-medium hover:bg-muted">
            Log in
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-2">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="rounded border p-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
