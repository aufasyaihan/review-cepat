import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock: {
  query: { device: { findFirst: ReturnType<typeof vi.fn> } };
  update: ReturnType<typeof vi.fn>;
  setPayload?: Record<string, unknown>;
} = { query: { device: { findFirst: vi.fn() } }, update: vi.fn() };
vi.mock('@/db', () => ({ getDb: () => dbMock }));
vi.mock('@/lib/session', () => ({ requireRole: vi.fn() }));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: (m: { role: string }) => m.role === 'owner',
}));
vi.mock('@/domains/device/server/service', () => ({
  ownerResetOrgLessDevice: vi.fn(),
  ownerForgetDevice: vi.fn(),
}));
vi.mock('@/lib/setup-token', () => ({ resolveSetupToken: vi.fn() }));

import { claimForSelfAction, resellDeviceAction } from '@/domains/device/server/option-actions';
import { ownerForgetDevice, ownerResetOrgLessDevice } from '@/domains/device/server/service';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { requireRole } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';

const TOKEN = 'valid-token';

function chainable() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn((values: Record<string, unknown>) => {
    dbMock.setPayload = values;
    return { where };
  });
  return { where, set };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.update.mockReturnValue(chainable());
  vi.mocked(resolveSetupToken).mockReturnValue('dev-1');
});

describe('claimForSelfAction', () => {
  it('rejects a token that does not prove claim-code validation for this device', async () => {
    vi.mocked(resolveSetupToken).mockReturnValue('some-other-device');
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    const result = await claimForSelfAction('dev-1', TOKEN);
    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('rejects an expired or malformed token', async () => {
    vi.mocked(resolveSetupToken).mockReturnValue(null);
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    const result = await claimForSelfAction('dev-1', 'garbage-token');
    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('rejects a caller who is not an org owner', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await claimForSelfAction('dev-1', TOKEN);
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
      organizationId: null,
    });
    const result = await claimForSelfAction('dev-1', TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectUrl).toBe('/dashboard');
    expect(dbMock.update).toHaveBeenCalled();
    expect(dbMock.setPayload).toMatchObject({
      organizationId: 'org-1',
      memberId: 'mem-1',
      boundUserId: 'user-1',
      status: 'CLAIMED',
    });
  });

  it('fails when the device already belongs to another org', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      status: 'CLAIMED',
      organizationId: 'org-other',
    });
    const result = await claimForSelfAction('dev-1', TOKEN);
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
    const result = await claimForSelfAction('dev-1', TOKEN);
    expect(result.ok).toBe(false);
    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe('resellDeviceAction', () => {
  it('rejects a token that does not prove claim-code validation for this device', async () => {
    vi.mocked(resolveSetupToken).mockReturnValue('some-other-device');
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    const result = await resellDeviceAction('dev-1', TOKEN);
    expect(result.ok).toBe(false);
    expect(ownerForgetDevice).not.toHaveBeenCalled();
    expect(ownerResetOrgLessDevice).not.toHaveBeenCalled();
  });

  it('rejects a non-owner', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'member',
    });
    const result = await resellDeviceAction('dev-1', TOKEN);
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
    vi.mocked(ownerResetOrgLessDevice).mockResolvedValue({
      device: { id: 'dev-1', slug: 's', name: 'D', status: 'UNCLAIMED', createdAt: '' },
      claimCode: 'ABCD1234',
    });
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      status: 'CLAIMED',
      organizationId: null,
    });
    const result = await resellDeviceAction('dev-1', TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.claimCode).toBe('ABCD1234');
    expect(ownerResetOrgLessDevice).toHaveBeenCalledWith('dev-1');
  });

  it('resets an own-org device via ownerForgetDevice', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    vi.mocked(ownerForgetDevice).mockResolvedValue({
      device: { id: 'dev-1', slug: 's', name: 'D', status: 'UNCLAIMED', createdAt: '' },
      claimCode: 'WXYZ9876',
    });
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      status: 'CLAIMED',
      organizationId: 'org-1',
    });
    const result = await resellDeviceAction('dev-1', TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.claimCode).toBe('WXYZ9876');
    expect(ownerForgetDevice).toHaveBeenCalledWith('dev-1', 'org-1');
    expect(ownerResetOrgLessDevice).not.toHaveBeenCalled();
  });

  it('fails when the device belongs to another org', async () => {
    vi.mocked(requireRole).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-1',
      role: 'owner',
    });
    dbMock.query.device.findFirst.mockResolvedValue({
      id: 'dev-1',
      status: 'CLAIMED',
      organizationId: 'org-other',
    });
    const result = await resellDeviceAction('dev-1', TOKEN);
    expect(result.ok).toBe(false);
    expect(ownerForgetDevice).not.toHaveBeenCalled();
    expect(ownerResetOrgLessDevice).not.toHaveBeenCalled();
  });
});
