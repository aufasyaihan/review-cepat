import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
});

import { api } from '@/lib/http';

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

function badJson(status: number, body: unknown) {
  return { ok: false, status, json: async () => body };
}

function badNoJson(status: number) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new Error('no json');
    },
  };
}

describe('lib/http', () => {
  it('api.get sends GET and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ a: 1 }));
    const data = await api.get<{ a: number }>('/x').send();
    expect(data).toEqual({ a: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/x');
    expect(init.method).toBe('GET');
    expect(init.cache).toBe('no-store');
  });

  it('api.post sends POST with JSON body and Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(okJson({ ok: true }));
    await api.post('/x').setBody({ a: 1 }).send();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('setQuery drops undefined values', async () => {
    fetchMock.mockResolvedValueOnce(okJson([]));
    await api.get('/x').setQuery({ a: 1, b: undefined }).send();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/x?a=1');
  });

  it('setHeader forwards custom header', async () => {
    fetchMock.mockResolvedValueOnce(okJson({}));
    await api.get('/x').setHeader('X-Foo', 'bar').send();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Foo']).toBe('bar');
  });

  it('put, patch, and delete methods return builders', async () => {
    fetchMock.mockResolvedValue(okJson({}));
    await api.put('/x').send();
    await api.patch('/x').send();
    await api.delete('/x').send();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE');
  });

  it('non-ok response with JSON error throws the message', async () => {
    fetchMock.mockResolvedValueOnce(badJson(400, { error: { message: 'boom' } }));
    await expect(api.get('/x').send()).rejects.toThrow('boom');
  });

  it('non-ok response without JSON body throws status fallback', async () => {
    fetchMock.mockResolvedValueOnce(badNoJson(404));
    await expect(api.get('/x').send()).rejects.toThrow('Request failed (404)');
  });
});
