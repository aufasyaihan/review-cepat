import { describe, expect, it } from 'vitest';

import { fail, ok } from '@/lib/action-result';

describe('lib/action-result', () => {
  it('ok(data) returns { ok: true, data }', () => {
    const result = ok({ id: 1 });
    expect(result).toEqual({ ok: true, data: { id: 1 } });
  });

  it('fail(msg) returns { ok: false, error }', () => {
    const result = fail('nope');
    expect(result).toEqual({ ok: false, error: 'nope' });
  });
});
