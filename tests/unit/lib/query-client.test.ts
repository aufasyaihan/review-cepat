import { afterEach, describe, expect, it } from 'vitest';

import { getQueryClient } from '@/lib/query-client';

type GlobalWithWindow = { window?: unknown };

afterEach(() => {
  delete (globalThis as GlobalWithWindow).window;
});

describe('lib/query-client', () => {
  it('returns a new instance when window is undefined (server)', () => {
    delete (globalThis as GlobalWithWindow).window;
    const a = getQueryClient();
    const b = getQueryClient();
    expect(a).not.toBe(b);
  });

  it('returns the same instance in browser (window defined)', () => {
    (globalThis as GlobalWithWindow).window = {};
    const a = getQueryClient();
    const b = getQueryClient();
    expect(a).toBe(b);
  });
});
