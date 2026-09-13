'use client';

import { useSuspenseQuery } from '@tanstack/react-query';

import { scanQueries } from '@/domains/scan/api/queries';

export function LandingClient({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(scanQueries.landing(slug));

  if (data.outcome === 'INACTIVE') {
    return (
      <div className="mx-auto max-w-md py-16 text-center" data-testid="landing-inactive">
        <h1 className="text-xl font-semibold">This device is inactive</h1>
        <p className="mt-2 text-muted-foreground">
          The owner has paused this landing page. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-10 text-center" data-testid="landing-page">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap or scan opened this page — pick a link below.
        </p>
      </header>

      <ul className="mt-8 space-y-3">
        {data.links.map((link) => (
          <li key={link.id}>
            <a href={link.url} className="block rounded border p-4 font-medium hover:bg-muted">
              <span className="block">{link.label ?? link.type}</span>
              <span className="block text-xs text-muted-foreground">{link.type}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
