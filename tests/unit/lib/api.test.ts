import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logRequest: vi.fn(), logError: vi.fn() }));

import { apiRoute } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { logError, logRequest } from '@/lib/logger';

describe('apiRoute wrapper (constitution III & VI)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('serializes non-Response handler data to JSON and logs a 200', async () => {
    const route = apiRoute('GET', '/api/x', async () => ({ value: 1 }));
    const res = await route(new Request('http://localhost/api/x'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ value: 1 });
    expect(logRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/x', status: 200 }),
    );
  });

  it('passes through a Response returned by the handler', async () => {
    const upstream = Response.json({ ok: true });
    const route = apiRoute('POST', '/api/x', async () => upstream);
    const res = await route(new Request('http://localhost/api/x'), {
      params: Promise.resolve({}),
    });
    expect(res).toBe(upstream);
  });

  it('translates AppError into an error response and logs it', async () => {
    const route = apiRoute('GET', '/api/x', async () => {
      throw new AppError(404, 'NOT_FOUND', 'missing');
    });
    const res = await route(new Request('http://localhost/api/x'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'NOT_FOUND', message: 'missing' } });
    expect(logRequest).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    expect(logError).toHaveBeenCalled();
  });

  it('handles a thrown non-AppError as a 500 INTERNAL', async () => {
    const route = apiRoute('GET', '/api/x', async () => {
      throw new Error('kaboom');
    });
    const res = await route(new Request('http://localhost/api/x'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'INTERNAL', message: 'Unexpected error' },
    });
    expect(logError).toHaveBeenCalled();
  });
});
