// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useMerchantOptions } from '@/domains/merchant/api/use-merchant-options';

const server = setupServer();

beforeAll(() => server.listen());
beforeEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMerchantOptions', () => {
  it('flattens paginated organizations into {id, name} options', async () => {
    server.use(
      http.get('/api/organizations', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('q')).toBe('acme');
        expect(url.searchParams.get('page')).toBe('1');
        expect(url.searchParams.get('limit')).toBe('10');
        return HttpResponse.json({
          rows: [{ id: 'org-1', name: 'Acme', slug: 'acme', deviceCount: 2 }],
          total: 1,
          page: 1,
          limit: 10,
        });
      }),
    );

    const { result } = renderHook(() => useMerchantOptions('acme'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.options).toEqual([{ id: 'org-1', name: 'Acme' }]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('exposes a next page when more rows remain', async () => {
    server.use(
      http.get('/api/organizations', () =>
        HttpResponse.json({
          rows: [{ id: 'org-1', name: 'Acme', slug: 'acme', deviceCount: 2 }],
          total: 25,
          page: 1,
          limit: 10,
        }),
      ),
    );

    const { result } = renderHook(() => useMerchantOptions(''), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });
});
