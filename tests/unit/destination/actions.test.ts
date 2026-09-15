import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/session', () => ({
  requireApiMembership: vi.fn().mockResolvedValue({
    id: 'm1',
    organizationId: 'org-1',
    role: 'owner',
  }),
}));
vi.mock('@/domains/destination/server/service', () => ({
  setForDevice: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { setDestinationsAction } from '@/domains/destination/server/actions';
import { setForDevice } from '@/domains/destination/server/service';

const dtoList = [
  {
    id: 'd1',
    type: 'WEBSITE',
    label: null,
    url: 'https://a.com',
    placeId: null,
    position: 0,
    active: true,
  },
];

describe('destination actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('setDestinationsAction', () => {
    it('ok path', async () => {
      vi.mocked(setForDevice).mockResolvedValueOnce(dtoList as never);
      const result = await setDestinationsAction('dev-1', {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0 }],
      });
      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith('/devices');
      expect(revalidatePath).toHaveBeenCalledWith('/devices/dev-1');
    });

    it('service-throws returns ok:false with error message', async () => {
      vi.mocked(setForDevice).mockRejectedValueOnce(new Error('Device not found'));
      const result = await setDestinationsAction('dev-1', {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0 }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('Device not found');
    });

    it('non-Error throw maps to generic message', async () => {
      vi.mocked(setForDevice).mockRejectedValueOnce('boom');
      const result = await setDestinationsAction('dev-1', {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0 }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('Failed to save destinations');
    });
  });
});
