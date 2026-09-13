import { describe, expect, it } from 'vitest';

import { claimDeviceSchema, createDeviceSchema } from '@/domains/device/schemas';

describe('device schemas', () => {
  it('rejects claim codes outside the accepted alphabet/length', () => {
    expect(claimDeviceSchema.safeParse({ claimCode: 'abc' }).success).toBe(false);
    expect(claimDeviceSchema.safeParse({ claimCode: 'has space!@#' }).success).toBe(false);
  });

  it('accepts a valid claim code (case-insensitive alphanumeric 6–16)', () => {
    expect(claimDeviceSchema.safeParse({ claimCode: '8D3F9KA2' }).success).toBe(true);
  });

  it('requires a device name of 1–120 chars for admin creation', () => {
    expect(createDeviceSchema.safeParse({ name: '' }).success).toBe(false);
    expect(createDeviceSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
    expect(createDeviceSchema.safeParse({ name: 'Awaits shelf' }).success).toBe(true);
  });
});
