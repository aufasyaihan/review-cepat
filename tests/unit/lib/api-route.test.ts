import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logRequest: vi.fn(),
  logError: vi.fn(),
}));

import { apiRoute } from '@/lib/api';

afterEach(() => vi.clearAllMocks());

describe('apiRoute wrapper', () => {
  it('returns JSON from the handler and logs the request', async () => {
    const route = apiRoute('GET', '/api/x', async () => ({ ok: true }));
    const res = await route({} as Request, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('passes through an existing Response without wrapping', async () => {
    const route = apiRoute('GET', '/api/x', async () => new Response('raw', { status: 201 }));
    const res = await route({} as Request, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('raw');
  });

  it('translates handler errors into a JSON error response and logs', async () => {
    const route = apiRoute('GET', '/api/x', async () => {
      throw new Error('boom');
    });
    const res = await route({} as Request, { params: Promise.resolve({}) });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { message?: string } };
    expect(typeof body.error.message).toBe('string');
  });
});
