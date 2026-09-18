import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  deviceFindFirst: vi.fn().mockResolvedValue(null),
  updateSet: vi.fn(),
  updateWhere: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db', () => ({
  getDb: () => ({
    query: {
      device: { findFirst: dbMocks.deviceFindFirst },
    },
    update: () => ({
      set: (values: unknown) => {
        dbMocks.updateSet(values);
        return { where: dbMocks.updateWhere };
      },
    }),
  }),
}));

import { adminRenameDevice, renameVisibleDevice } from '@/domains/device/server/service';

const now = new Date('2025-09-01T00:00:00Z');
const deviceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'dev-1',
  slug: 'dev-one',
  name: 'Point of Sale',
  status: 'CLAIMED',
  organizationId: 'org-1',
  memberId: null,
  ownerId: 1,
  claimCodeHash: 'h',
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const ownerMembership = { id: 'm-owner', organizationId: 'org-1', role: 'owner' as const };
const memberMembership = { id: 'm-sub', organizationId: 'org-1', role: 'member' as const };

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.deviceFindFirst.mockResolvedValue(null);
});

describe('adminRenameDevice (FR-045)', () => {
  it('rejects a missing device', async () => {
    await expect(adminRenameDevice('dev-1', 'New Name')).rejects.toMatchObject({
      status: 404,
      code: 'DEVICE_NOT_FOUND',
    });
  });

  it('rejects a soft-deleted device', async () => {
    dbMocks.deviceFindFirst.mockResolvedValue(deviceRow({ status: 'DELETED' }));
    await expect(adminRenameDevice('dev-1', 'New Name')).rejects.toMatchObject({
      status: 404,
      code: 'DEVICE_NOT_FOUND',
    });
  });

  it('renames the device (name trimmed) and returns the updated summary', async () => {
    dbMocks.deviceFindFirst
      .mockResolvedValueOnce(deviceRow()) // lookup
      .mockResolvedValueOnce(deviceRow({ name: 'New Name' })); // reload after update

    const result = await adminRenameDevice('dev-1', '  New Name  ');

    expect(dbMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
    expect(result).toMatchObject({ id: 'dev-1', name: 'New Name' });
  });
});

describe('renameVisibleDevice (owner and org member scoping, FR-045)', () => {
  it('rejects a device outside the caller scope', async () => {
    await expect(renameVisibleDevice('dev-1', ownerMembership, 'New Name')).rejects.toMatchObject({
      status: 404,
      code: 'DEVICE_NOT_FOUND',
    });
  });

  it('renames a device the owner sees', async () => {
    dbMocks.deviceFindFirst
      .mockResolvedValueOnce(deviceRow())
      .mockResolvedValueOnce(deviceRow({ name: 'New Name' }));

    const result = await renameVisibleDevice('dev-1', ownerMembership, 'New Name');

    expect(dbMocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
    expect(result).toMatchObject({ id: 'dev-1', name: 'New Name' });
  });

  it('renames a device assigned to an org member', async () => {
    dbMocks.deviceFindFirst
      .mockResolvedValueOnce(deviceRow({ memberId: 'm-sub' }))
      .mockResolvedValueOnce(deviceRow({ memberId: 'm-sub', name: 'New Name' }));

    const result = await renameVisibleDevice('dev-1', memberMembership, 'New Name');

    expect(result.name).toBe('New Name');
  });
});
