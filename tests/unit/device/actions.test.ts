import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/session', () => ({
  requireApiMerchant: vi
    .fn()
    .mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' }, merchantId: 7 }),
  requireApiUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'ADMIN' }),
  requireApiMembership: vi.fn().mockResolvedValue({
    id: 'm1',
    organizationId: 'org-1',
    role: 'owner',
  }),
}));
vi.mock('@/domains/device/server/service', () => ({
  publishVisible: vi.fn(),
  unpublishVisible: vi.fn(),
  transfer: vi.fn(),
  adminCreate: vi.fn(),
  adminSetDisabled: vi.fn(),
  adminReset: vi.fn(),
  ownerReset: vi.fn(),
}));
vi.mock('@/domains/merchant/server/service', () => ({
  claimWithCode: vi.fn(),
}));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi
    .fn()
    .mockResolvedValue({ id: 'm1', organizationId: 'org-1', role: 'owner' }),
  isOwner: vi.fn(() => true),
}));

import { revalidatePath } from 'next/cache';
import {
  claimDeviceAction,
  createDeviceAction,
  publishDeviceAction,
  resetDeviceAction,
  setDeviceDisabledAction,
  transferDeviceAction,
  unpublishDeviceAction,
} from '@/domains/device/server/actions';
import {
  adminCreate,
  adminReset,
  adminSetDisabled,
  ownerReset,
  publishVisible,
  transfer,
  unpublishVisible,
} from '@/domains/device/server/service';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { claimWithCode } from '@/domains/merchant/server/service';
import { requireApiMerchant, requireApiUser } from '@/lib/session';

const summary = { id: 'dev-1', slug: 's', name: 'D', status: 'CLAIMED', createdAt: 'x' };

describe('device actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiMerchant).mockResolvedValue({
      user: { id: 'u1', role: 'MERCHANT' } as never,
      merchantId: 7,
    });
    vi.mocked(requireApiUser).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(getActiveOrganization).mockResolvedValue({
      id: 'm1',
      organizationId: 'org-1',
      role: 'owner',
    });
  });

  // claimDeviceAction
  describe('claimDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(claimWithCode).mockResolvedValueOnce(summary as never);
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/devices');
      expect(revalidatePath).toHaveBeenCalledWith('/devices/dev-1');
    });

    it('fails when caller has no active organization', async () => {
      vi.mocked(getActiveOrganization).mockResolvedValueOnce(null);
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('organization');
      expect(claimWithCode).not.toHaveBeenCalled();
    });

    it('schema-invalid returns ok:false without calling claimWithCode', async () => {
      const result = await claimDeviceAction('');
      expect(result.ok).toBe(false);
      expect(claimWithCode).not.toHaveBeenCalled();
    });

    it('service-throws returns ok:false with error message', async () => {
      vi.mocked(claimWithCode).mockRejectedValueOnce(new Error('Device not found'));
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Device not found');
    });

    it('non-Error throw maps to generic message', async () => {
      vi.mocked(claimWithCode).mockRejectedValueOnce('boom');
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('Operation failed');
    });
  });

  // publishDeviceAction
  describe('publishDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(publishVisible).mockResolvedValueOnce({ ...summary, status: 'PUBLISHED' } as never);
      const result = await publishDeviceAction('dev-1');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledTimes(2);
    });

    it('service-throws returns ok:false', async () => {
      vi.mocked(publishVisible).mockRejectedValueOnce(new Error('Disabled'));
      const result = await publishDeviceAction('dev-1');
      expect(result.ok).toBe(false);
    });
  });

  // unpublishDeviceAction
  describe('unpublishDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(unpublishVisible).mockResolvedValueOnce({
        ...summary,
        status: 'UNPUBLISHED',
      } as never);
      const result = await unpublishDeviceAction('dev-1');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledTimes(2);
    });

    it('service-throws returns ok:false', async () => {
      vi.mocked(unpublishVisible).mockRejectedValueOnce(new Error('Not found'));
      const result = await unpublishDeviceAction('dev-1');
      expect(result.ok).toBe(false);
    });
  });

  // transferDeviceAction
  describe('transferDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(transfer).mockResolvedValueOnce(summary as never);
      const result = await transferDeviceAction('dev-1', 99);
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/devices');
    });

    it('schema-invalid returns ok:false without calling transfer', async () => {
      const result = await transferDeviceAction('dev-1', -1);
      expect(result.ok).toBe(false);
      expect(transfer).not.toHaveBeenCalled();
    });

    it('service-throws returns ok:false with error message', async () => {
      vi.mocked(transfer).mockRejectedValueOnce(new Error('Target merchant not found'));
      const result = await transferDeviceAction('dev-1', 99);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Target merchant not found');
    });
  });

  // createDeviceAction
  describe('createDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(adminCreate).mockResolvedValueOnce({ device: summary, claimCode: 'X' } as never);
      const result = await createDeviceAction('New');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/devices');
    });

    it('schema-invalid returns ok:false without calling adminCreate', async () => {
      const result = await createDeviceAction('');
      expect(result.ok).toBe(false);
      expect(adminCreate).not.toHaveBeenCalled();
    });

    it('service-throws returns ok:false with error message', async () => {
      vi.mocked(adminCreate).mockRejectedValueOnce(new Error('Slug exhausted'));
      const result = await createDeviceAction('New');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Slug exhausted');
    });
  });

  // setDeviceDisabledAction
  describe('setDeviceDisabledAction', () => {
    it('ok path', async () => {
      vi.mocked(adminSetDisabled).mockResolvedValueOnce({
        ...summary,
        status: 'DISABLED',
      } as never);
      const result = await setDeviceDisabledAction('dev-1', true);
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/devices');
    });

    it('service-throws returns ok:false', async () => {
      vi.mocked(adminSetDisabled).mockRejectedValueOnce(new Error('Device not found'));
      const result = await setDeviceDisabledAction('dev-1', true);
      expect(result.ok).toBe(false);
    });
  });

  // resetDeviceAction
  describe('resetDeviceAction', () => {
    it('admin scope succeeds', async () => {
      vi.mocked(adminReset).mockResolvedValueOnce({ device: summary, claimCode: 'NEW' } as never);
      const result = await resetDeviceAction('dev-1', 'admin');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/admin/devices');
    });

    it('admin scope maps failures', async () => {
      vi.mocked(adminReset).mockRejectedValueOnce(new Error('Device not found'));
      const result = await resetDeviceAction('dev-1', 'admin');
      expect(result.ok).toBe(false);
    });

    it('owner scope requires an owner membership', async () => {
      vi.mocked(getActiveOrganization).mockResolvedValueOnce(null);
      const result = await resetDeviceAction('dev-1', 'owner');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('owner');
    });

    it('owner scope rejects a member that is not an owner', async () => {
      const { isOwner } = await import('@/domains/merchant/server/permissions');
      vi.mocked(isOwner).mockReturnValueOnce(false);
      const result = await resetDeviceAction('dev-1', 'owner');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('owner');
      expect(ownerReset).not.toHaveBeenCalled();
    });

    it('owner scope succeeds and revalidates device paths', async () => {
      vi.mocked(ownerReset).mockResolvedValueOnce({ device: summary, claimCode: 'NEW' } as never);
      const result = await resetDeviceAction('dev-1', 'owner');
      expect(result.ok).toBe(true);
      expect(ownerReset).toHaveBeenCalledWith('dev-1', 'org-1');
      expect(revalidatePath).toHaveBeenCalledWith('/devices');
    });
  });
});
