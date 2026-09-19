import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  query: { device: { findFirst: vi.fn() } },
  delete: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/db', () => ({ getDb: () => dbMock }));

import { ownerResetOrgLessDevice } from '@/domains/device/server/service';

function chainable() {
  const where = vi.fn().mockResolvedValue(undefined);
  return {
    where,
    set: vi.fn().mockReturnValue({ where }),
    from: vi.fn().mockReturnValue({ where }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.delete.mockReturnValue(chainable());
  dbMock.update.mockReturnValue(chainable());
});

describe('ownerResetOrgLessDevice', () => {
  it('clears config and rotates the claim code for a genuinely org-less device', async () => {
    dbMock.query.device.findFirst
      .mockResolvedValueOnce({ id: 'dev-1', organizationId: null }) // org-less check
      .mockResolvedValueOnce({
        id: 'dev-1',
        slug: 'dev-1-slug',
        name: 'Device 1',
        status: 'UNCLAIMED',
        createdAt: new Date(),
        organizationId: null,
      }); // re-read after update

    const result = await ownerResetOrgLessDevice('dev-1');
    expect(result.device.status).toBe('UNCLAIMED');
    expect(result.claimCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it('rejects a device that already belongs to an organization', async () => {
    dbMock.query.device.findFirst.mockResolvedValue(undefined);
    await expect(ownerResetOrgLessDevice('dev-2')).rejects.toThrow();
  });
});
