import { describe, expect, it } from 'vitest';

import { PUBLIC_SCAN } from '@/domains/scan/server/permissions';

describe('scan permissions', () => {
  it('scan domain is public', () => {
    expect(PUBLIC_SCAN).toBe(true);
  });
});
