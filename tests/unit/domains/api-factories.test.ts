import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/http', () => {
  const send = vi.fn();
  const setQuery = vi.fn(() => ({ send }));
  const setBody = vi.fn(() => ({ send }));
  const api = {
    get: vi.fn(() => ({ setQuery, send: send })),
    post: vi.fn(() => ({ setBody, send: send })),
  };
  return { api };
});

import { adminQueries } from '@/domains/admin/api/queries';
import { destinationQueries } from '@/domains/destination/api/mutations';
import { api } from '@/lib/http';

describe('domain API factories', () => {
  it('adminQueries.organizations hits the organizations endpoint', async () => {
    const q = adminQueries.organizations();
    expect(q.queryKey).toEqual(['admin', 'organizations']);
    await q.queryFn();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/api/admin/organizations');
  });

  it('adminQueries.merchants hits the merchants endpoint', async () => {
    const q = adminQueries.merchants();
    await q.queryFn();
    expect(vi.mocked(api.get)).toHaveBeenCalledWith('/api/admin/merchants');
  });

  it('destinationQueries.places forwards the query param', async () => {
    const q = destinationQueries.places('cafe');
    await q.queryFn();
    const builder = vi.mocked(api.get).mock.results.at(-1)?.value as {
      setQuery: ReturnType<typeof vi.fn>;
    };
    expect(builder.setQuery).toHaveBeenCalledWith({ query: 'cafe' });
  });
});
