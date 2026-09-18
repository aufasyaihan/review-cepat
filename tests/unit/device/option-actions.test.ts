import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = { query: { device: { findFirst: vi.fn() } }, update: vi.fn() };
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/lib/session', () => ({ requireRole: vi.fn() }));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: (m: { role: string }) => m.role === 'owner',
}));
vi.mock('@/domains/device/server/service', () => ({ ownerForgetDevice: vi.fn() }));

import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';
import { ownerForgetDevice } from '@/domains/device/server/service';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { requireRole } from '@/lib/session';

function chainable() {
  const where = vi.fn().mockResolvedValue(undefined);
  return { where, set: vi.fn().mockReturnValue({ where }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.update.mockReturnValue(chainable());
});

describe('claimForSelfAction', () => {
  it('rejects a caller who is not an org owner', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await claimForSelfAction('dev-1');
    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('binds the device to the owner org', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      status: 'UNCLAIMED',
    });
    const result = await claimForSelfAction('dev-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectUrl).toBe('/dashboard');
    expect(dbMock.update).toHaveBeenCalled();
  });

  it('fails when the device is already claimed', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      status: 'CLAIMED',
    });
    const result = await claimForSelfAction('dev-1');
    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('fails when the device is missing', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    dbMock.query.device.findFirst.mockResolvedValue(undefined);
    const result = await claimForSelfAction('dev-1');
    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe('resellDeviceAction', () => {
  it('rejects a non-owner', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await resellDeviceAction('dev-1');
    expect(result.ok).toBe(false);
    expect(ownerForgetDevice).not.toHaveBeenCalled();
  });

  it('resets the device and returns the new claim code', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    vi.mocked(ownerForgetDevice).mockResolvedValue({
      device: { id: 'dev-1', slug: 's', name: 'D', status: 'UNCLAIMED', createdAt: '' },
      claimCode: 'ABCD1234',
    });
    const result = await resellDeviceAction('dev-1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.claimCode).toBe('ABCD1234');
  });
});
