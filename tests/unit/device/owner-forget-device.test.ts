import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  query: { device: { findFirst: vi.fn() } },
  delete: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/db', () => ({ getDb: () => dbMock }));

import { ownerForgetDevice } from '@/domains/device/server/service';

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

describe('ownerForgetDevice', () => {
  it('clears config and detaches the org for a device the org owns', async () => {
    dbMock.query.device.findFirst
      .mockResolvedValueOnce({ id: 'dev-1', organizationId: 'org-1' }) // ownership check
      .mockResolvedValueOnce({
        id: 'dev-1',
        slug: 'dev-1-slug',
        name: 'Device 1',
        status: 'UNCLAIMED',
        createdAt: new Date(),
        organizationId: null,
      }); // re-read after update

    const result = await ownerForgetDevice('dev-1', 'org-1');
    expect(result.device.status).toBe('UNCLAIMED');
    expect(result.claimCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it('rejects a device that belongs to a different org', async () => {
    dbMock.query.device.findFirst.mockResolvedValue(undefined);
    await expect(ownerForgetDevice('dev-2', 'org-1')).rejects.toThrow();
  });
});
