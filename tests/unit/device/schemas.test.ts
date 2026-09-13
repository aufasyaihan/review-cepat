import { describe, expect, it } from 'vitest';

import {
  claimDeviceSchema,
  createDeviceSchema,
  transferDeviceSchema,
} from '@/domains/device/schemas';

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

  describe('transferDeviceSchema', () => {
    it('rejects zero', () => {
      expect(transferDeviceSchema.safeParse({ toMerchantId: 0 }).success).toBe(false);
    });

    it('rejects negative', () => {
      expect(transferDeviceSchema.safeParse({ toMerchantId: -1 }).success).toBe(false);
    });

    it('rejects float', () => {
      expect(transferDeviceSchema.safeParse({ toMerchantId: 1.5 }).success).toBe(false);
    });

    it('accepts positive integer', () => {
      expect(transferDeviceSchema.safeParse({ toMerchantId: 42 }).success).toBe(true);
    });
  });

  describe('claimDeviceSchema boundary', () => {
    it('accepts exactly 5 chars (below min)', () => {
      expect(claimDeviceSchema.safeParse({ claimCode: 'ABCDE' }).success).toBe(false);
    });

    it('accepts exactly 6 chars (min boundary)', () => {
      expect(claimDeviceSchema.safeParse({ claimCode: 'ABCDEF' }).success).toBe(true);
    });

    it('rejects exactly 17 chars (above max)', () => {
      expect(claimDeviceSchema.safeParse({ claimCode: 'A'.repeat(17) }).success).toBe(false);
    });

    it('accepts uppercase and lowercase', () => {
      expect(claimDeviceSchema.safeParse({ claimCode: 'abcdef' }).success).toBe(true);
      expect(claimDeviceSchema.safeParse({ claimCode: 'ABCDEF' }).success).toBe(true);
    });
  });

  describe('createDeviceSchema boundary', () => {
    it('accepts exactly 120 chars (max boundary)', () => {
      expect(createDeviceSchema.safeParse({ name: 'x'.repeat(120) }).success).toBe(true);
    });

    it('rejects exactly 121 chars', () => {
      expect(createDeviceSchema.safeParse({ name: 'x'.repeat(121) }).success).toBe(false);
    });
  });
});
