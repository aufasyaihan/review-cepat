// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider, useSuspenseQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import React, { Suspense } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deviceQueries } from '@/domains/device/api/queries';

const server = setupServer();

beforeAll(() => server.listen());
beforeEach(() => server.resetHandlers());
afterAll(() => server.close());

function DevicePanel() {
  const { data } = useSuspenseQuery(deviceQueries.list());
  return (
    <ul>
      {data.map((d) => (
        <li key={d.id}>{d.name}</li>
      ))}
    </ul>
  );
}

class Boundary extends React.Component<{ children: React.ReactNode }, { message?: string }> {
  state: { message?: string } = {};
  static getDerivedStateFromError(err: unknown) {
    return { message: err instanceof Error ? err.message : 'Unexpected error' };
  }
  render() {
    if (this.state.message) return <div>{this.state.message}</div>;
    return this.props.children;
  }
}

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

describe('Devices panel (TanStack Query + MSW)', () => {
  it('renders devices fetched through the domain API client', async () => {
    server.use(
      http.get('/api/device', () =>
        HttpResponse.json([
          {
            id: 'a',
            slug: 'tag-a',
            name: 'Counter A',
            status: 'PUBLISHED',
            createdAt: '2026-09-13T00:00:00.000Z',
          },
          {
            id: 'b',
            slug: 'tag-b',
            name: 'Counter B',
            status: 'CLAIMED',
            createdAt: '2026-09-13T00:00:00.000Z',
          },
        ]),
      ),
    );

    renderWithQuery(<DevicePanel />);

    await waitFor(() => {
      expect(screen.getByText('Counter A')).toBeInTheDocument();
      expect(screen.getByText('Counter B')).toBeInTheDocument();
    });
  });

  it('surfaces API errors as a thrown message', async () => {
    server.use(
      http.get('/api/device', () =>
        HttpResponse.json({ error: { message: 'Unavailable' } }, { status: 500 }),
      ),
    );

    renderWithQuery(
      <Boundary>
        <DevicePanel />
      </Boundary>,
    );

    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument();
    });
  });
});
