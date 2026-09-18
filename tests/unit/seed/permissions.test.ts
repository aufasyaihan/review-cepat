import { describe, expect, it } from 'vitest';
import { LINK_ROWS, PERMISSION_ROWS } from '@/db/seed/permissions';

describe('PERMISSION_ROWS after dashboard pruning', () => {
  it('no longer has a /devices/claim menu row', () => {
    expect(PERMISSION_ROWS.some((r) => r.path === '/devices/claim')).toBe(false);
  });

  it('no longer has the api.claim_device row (superseded by /s/[slug] flow)', () => {
    expect(PERMISSION_ROWS.some((r) => r.path === '/api/device/claim')).toBe(false);
  });

  it('has an api.forget_device row scoped to owners', () => {
    expect(PERMISSION_ROWS.some((r) => r.path === '/api/device/forget')).toBe(true);
  });
});

describe('LINK_ROWS after dashboard pruning', () => {
  it('/merchants is admin-only (merchant: false)', () => {
    const row = LINK_ROWS.find((r) => r.path === '/merchants');
    expect(row?.merchant).toBe(false);
  });
});
