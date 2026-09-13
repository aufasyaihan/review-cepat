import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/session', () => ({
  requireApiMerchant: vi
    .fn()
    .mockResolvedValue({ user: { id: 'u1', role: 'MERCHANT' }, merchantId: 7 }),
  requireApiUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'ADMIN' }),
}));
vi.mock('@/domains/device/server/service', () => ({
  claim: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  transfer: vi.fn(),
  adminCreate: vi.fn(),
  adminSetDisabled: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import {
  claimDeviceAction,
  createDeviceAction,
  publishDeviceAction,
  setDeviceDisabledAction,
  transferDeviceAction,
  unpublishDeviceAction,
} from '@/domains/device/server/actions';
import {
  adminCreate,
  adminSetDisabled,
  claim,
  publish,
  transfer,
  unpublish,
} from '@/domains/device/server/service';
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
  });

  // claimDeviceAction
  describe('claimDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(claim).mockResolvedValueOnce(summary as never);
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/devices');
      expect(revalidatePath).toHaveBeenCalledWith('/devices/dev-1');
    });

    it('schema-invalid returns ok:false without calling claim', async () => {
      const result = await claimDeviceAction('');
      expect(result.ok).toBe(false);
      expect(claim).not.toHaveBeenCalled();
    });

    it('service-throws returns ok:false with error message', async () => {
      vi.mocked(claim).mockRejectedValueOnce(new Error('Device not found'));
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Device not found');
    });

    it('non-Error throw maps to generic message', async () => {
      vi.mocked(claim).mockRejectedValueOnce('boom');
      const result = await claimDeviceAction('ABC123');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('Operation failed');
    });
  });

  // publishDeviceAction
  describe('publishDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(publish).mockResolvedValueOnce({ ...summary, status: 'PUBLISHED' } as never);
      const result = await publishDeviceAction('dev-1');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledTimes(2);
    });

    it('service-throws returns ok:false', async () => {
      vi.mocked(publish).mockRejectedValueOnce(new Error('Disabled'));
      const result = await publishDeviceAction('dev-1');
      expect(result.ok).toBe(false);
    });
  });

  // unpublishDeviceAction
  describe('unpublishDeviceAction', () => {
    it('ok path', async () => {
      vi.mocked(unpublish).mockResolvedValueOnce({ ...summary, status: 'UNPUBLISHED' } as never);
      const result = await unpublishDeviceAction('dev-1');
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledTimes(2);
    });

    it('service-throws returns ok:false', async () => {
      vi.mocked(unpublish).mockRejectedValueOnce(new Error('Not found'));
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
});
