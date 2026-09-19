'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';

import { scanQueries } from '@/domains/scan/api/queries';
import { destinationIcon } from '@/lib/destination-icon';

export function LandingClient({ slug }: { slug: string }) {
  const { data } = useSuspenseQuery(scanQueries.landing(slug));

  if (data.outcome === 'INACTIVE') {
    return (
      <div className="w-full max-w-md text-center" data-testid="landing-inactive">
        <h1 className="text-xl font-semibold">This device is inactive</h1>
        <p className="mt-2 text-muted-foreground">
          The owner has paused this landing page. Please try again later.
        </p>
      </div>
    );
  }

  const reviewLink = data.links.find((link) => link.type === 'GOOGLE_REVIEW');
  const otherLinks = data.links.filter((link) => link.type !== 'GOOGLE_REVIEW');

  return (
    <div className="w-full max-w-md text-center" data-testid="landing-page">
      <header>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap or scan opened this page — pick a link below.
        </p>
      </header>

      {reviewLink && (
        <fieldset className="mt-6 flex justify-center gap-1" aria-label="Rate us">
          {[1, 2, 3, 4, 5].map((star) => (
            <a
              key={star}
              href={reviewLink.url}
              aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
              className="text-amber-400 hover:text-amber-500"
            >
              <Star className="size-8 fill-current" />
            </a>
          ))}
        </fieldset>
      )}

      <ul className="mt-8 space-y-3">
        {otherLinks.map((link) => {
          const Icon = destinationIcon(link.type);
          return (
            <li key={link.id}>
              <a
                href={link.url}
                className="flex items-center gap-3 rounded border p-4 text-left font-medium hover:bg-muted"
              >
                <Icon className="size-5 shrink-0" />
                <span className="block">{link.label ?? link.type}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
