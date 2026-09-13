import { describe, expect, it } from 'vitest';

import { profileSchema } from '@/domains/merchant/schemas/profile';

describe('profileSchema', () => {
  it('requires businessName', () => {
    const missing = profileSchema.safeParse({});
    expect(missing.success).toBe(false);

    const empty = profileSchema.safeParse({ businessName: '' });
    if (empty.success) throw new Error('expected failure');
    expect(empty.error.issues[0]?.message).toBe('Business name is required');
  });

  it('trims businessName', () => {
    const r = profileSchema.safeParse({ businessName: '  Acme  ' });
    if (!r.success) throw new Error('expected success');
    expect(r.data.businessName).toBe('Acme');
  });

  it('rejects businessName over 120 chars', () => {
    const r = profileSchema.safeParse({ businessName: 'x'.repeat(121) });
    if (r.success) throw new Error('expected failure');
    expect(r.error.issues.some((i) => i.message.includes('120'))).toBe(true);
  });

  it.each([
    ['USA', false],
    ['1A', false],
    ['ID1', false],
    ['ID', true],
    ['us', true],
  ])('country %s valid=%s', (country, valid) => {
    const r = profileSchema.safeParse({ businessName: 'B', country });
    expect(r.success).toBe(valid);
    if (valid && r.success) expect(r.data.country).toBe(country);
  });

  it('trims and caps phone at 30', () => {
    const r = profileSchema.safeParse({
      businessName: 'B',
      phone: `  ${'1'.repeat(40)}  `,
    });
    if (!r.success) throw new Error('expected success');
    expect(r.data.phone).toBe('1'.repeat(30));
  });

  it('accepts omitted phone and country', () => {
    const r = profileSchema.safeParse({ businessName: 'B' });
    if (!r.success) throw new Error('expected success');
    expect(r.data.phone).toBeUndefined();
    expect(r.data.country).toBeUndefined();
  });
});
