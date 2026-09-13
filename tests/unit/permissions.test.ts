import { describe, expect, it } from 'vitest';
import { requireAnalyticsRole } from '@/domains/analytics/server/permissions';
import { requireDestinationRole } from '@/domains/destination/server/permissions';
import { canManageDevices, requireDeviceRole } from '@/domains/device/server/permissions';
import { PUBLIC_SCAN } from '@/domains/scan/server/permissions';

describe('device permissions', () => {
  it('requireDeviceRole allows MERCHANT', () => {
    expect(() => requireDeviceRole('MERCHANT')).not.toThrow();
  });

  it('requireDeviceRole allows ADMIN', () => {
    expect(() => requireDeviceRole('ADMIN')).not.toThrow();
  });

  it('requireDeviceRole throws for other roles', () => {
    expect(() => requireDeviceRole('GHOST' as never)).toThrow();
  });

  it('canManageDevices true for MERCHANT', () => {
    expect(canManageDevices('MERCHANT')).toBe(true);
  });

  it('canManageDevices true for ADMIN', () => {
    expect(canManageDevices('ADMIN')).toBe(true);
  });

  it('canManageDevices false for others', () => {
    expect(canManageDevices('GHOST' as never)).toBe(false);
  });
});

describe('destination permissions', () => {
  it('requireDestinationRole allows MERCHANT', () => {
    expect(() => requireDestinationRole('MERCHANT')).not.toThrow();
  });

  it('requireDestinationRole throws for non-MERCHANT', () => {
    expect(() => requireDestinationRole('ADMIN' as never)).toThrow();
  });
});

describe('analytics permissions', () => {
  it('requireAnalyticsRole allows MERCHANT', () => {
    expect(() => requireAnalyticsRole('MERCHANT')).not.toThrow();
  });

  it('requireAnalyticsRole throws for non-MERCHANT', () => {
    expect(() => requireAnalyticsRole('ADMIN' as never)).toThrow();
  });
});

describe('scan permissions', () => {
  it('PUBLIC_SCAN is true', () => {
    expect(PUBLIC_SCAN).toBe(true);
  });
});
