import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({ logRequest: vi.fn(), logError: vi.fn() }));

import { apiRoute, fromActionResult } from '@/lib/api';
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

describe('fromActionResult', () => {
  it('returns the data as JSON when ok', async () => {
    const res = fromActionResult({ ok: true, data: { id: 1 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 1 });
  });

  it('defaults to { ok: true } when there is no data', async () => {
    const res = fromActionResult({ ok: true, data: undefined });
    expect(await res.json()).toEqual({ ok: true });
  });

  it('returns a 400 error response when not ok', async () => {
    const res = fromActionResult({ ok: false, error: 'Invalid input' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { message: 'Invalid input' } });
  });
});
