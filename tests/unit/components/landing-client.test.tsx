// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LandingClient } from '@/app/(redirect)/s/[slug]/landing-client';
import { scanQueries } from '@/domains/scan/api/queries';

function renderWithData(
  payload: ReturnType<typeof scanQueries.landing>['queryFn'] extends () => Promise<infer T>
    ? T
    : never,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(scanQueries.landing('slug-one').queryKey, payload);
  return render(
    <QueryClientProvider client={client}>
      <LandingClient slug="slug-one" />
    </QueryClientProvider>,
  );
}

describe('LandingClient (linktree)', () => {
  afterEach(() => cleanup());

  it('shows a star row that links to the Google review URL for every star', () => {
    renderWithData({
      slug: 'slug-one',
      name: 'Cafe One',
      outcome: 'LANDING_SHOWN',
      links: [
        {
          id: 'd1',
          type: 'GOOGLE_REVIEW',
          label: null,
          url: 'https://search.google.com/local/writereview?placeid=abc',
        },
        { id: 'd2', type: 'INSTAGRAM', label: 'Instagram', url: 'https://instagram.com/cafe' },
      ],
    });

    const stars = screen.getAllByRole('link', { name: /rate \d star/i });
    expect(stars).toHaveLength(5);
    for (const star of stars) {
      expect(star).toHaveAttribute(
        'href',
        'https://search.google.com/local/writereview?placeid=abc',
      );
    }
    expect(screen.getByRole('link', { name: /instagram/i })).toHaveAttribute(
      'href',
      'https://instagram.com/cafe',
    );
  });

  it('omits the star row when there is no Google review destination', () => {
    renderWithData({
      slug: 'slug-one',
      name: 'Cafe One',
      outcome: 'LANDING_SHOWN',
      links: [{ id: 'd1', type: 'WEBSITE', label: 'Site', url: 'https://cafe.example' }],
    });
    expect(screen.queryByRole('link', { name: /rate 1 star/i })).not.toBeInTheDocument();
  });
});
