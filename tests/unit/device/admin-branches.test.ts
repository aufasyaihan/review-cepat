import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const db = {
    query: {
      device: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      destination: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      organization: { findFirst: vi.fn().mockResolvedValue(null) },
      place: { findFirst: vi.fn().mockResolvedValue(null) },
      merchantProfile: { findFirst: vi.fn().mockResolvedValue(null) },
      scanEvent: { findMany: vi.fn().mockResolvedValue([]) },
    },
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { adminCreate, publishVisible, unpublishVisible } from '@/domains/device/server/service';

const now = new Date('2025-07-01T00:00:00Z');
function deviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-1',
    slug: 'slug-one',
    name: 'Device',
    status: 'PUBLISHED',
    ownerId: null,
    organizationId: 'org-1',
    memberId: null,
    boundUserId: null,
    claimCodeHash: 'h',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const ownerMembership = { id: 'm-owner', organizationId: 'org-1', role: 'owner' } as const;

type MockFn = ReturnType<typeof vi.fn>;
const q = (table: 'device' | 'destination' | 'organization') =>
  (
    getDb().query as unknown as Record<
      string,
      { findFirst?: ReturnType<typeof vi.fn>; findMany?: ReturnType<typeof vi.fn> }
    >
  )[table] as any;

beforeEach(() => {
  vi.resetAllMocks();
  q('device').findFirst.mockResolvedValue(null);
  q('device').findMany.mockResolvedValue([]);
  q('destination').findMany.mockResolvedValue([]);
  q('organization').findFirst.mockResolvedValue(null);
});

describe('device admin/branch paths', () => {
  it('adminCreate binds a device to an existing organization', async () => {
    q('organization').findFirst.mockResolvedValue({ id: 'org-1', name: 'Org' });
    q('device')
      .findFirst.mockResolvedValueOnce(null) // slug uniqueness scan
      .mockResolvedValueOnce(deviceRow({ status: 'UNCLAIMED' }));
    const result = await adminCreate({ name: 'Device', organizationId: 'org-1' });
    expect(result.device.status).toBe('UNCLAIMED');
    expect(result.claimCode.length).toBeGreaterThanOrEqual(6);
  });

  it('adminCreate throws when the target organization does not exist', async () => {
    q('organization').findFirst.mockResolvedValue(null);
    await expect(adminCreate({ name: 'Device', organizationId: 'ghost' })).rejects.toThrow(
      'Reseller organization not found',
    );
  });

  it('publishVisible throws NO_DESTINATIONS without an active destination', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ status: 'CLAIMED' }));
    q('destination').findMany.mockResolvedValue([]);
    await expect(publishVisible('dev-1', ownerMembership)).rejects.toMatchObject({
      code: 'NO_DESTINATIONS',
    });
  });

  it('publishVisible throws 404 when the device is outside the caller scope', async () => {
    q('device').findFirst.mockResolvedValueOnce(null);
    await expect(publishVisible('dev-1', ownerMembership)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('publishVisible throws 409 when the device is disabled', async () => {
    q('device').findFirst.mockResolvedValueOnce(deviceRow({ status: 'DISABLED' }));
    await expect(publishVisible('dev-1', ownerMembership)).rejects.toMatchObject({
      status: 409,
      code: 'DEVICE_DISABLED',
    });
  });

  it('publishVisible sets status to PUBLISHED on success', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(deviceRow({ status: 'CLAIMED' }))
      .mockResolvedValueOnce(deviceRow({ status: 'PUBLISHED' }));
    q('destination').findMany.mockResolvedValue([{ active: true }]);
    const result = await publishVisible('dev-1', ownerMembership);
    expect(result.status).toBe('PUBLISHED');
  });

  it('unpublishVisible throws 404 when the device is outside the caller scope', async () => {
    q('device').findFirst.mockResolvedValueOnce(null);
    await expect(unpublishVisible('dev-1', ownerMembership)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('unpublishVisible returns the current status when not PUBLISHED', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ status: 'CLAIMED' }));
    const result = await unpublishVisible('dev-1', ownerMembership);
    expect(result.status).toBe('CLAIMED');
  });

  it('unpublishVisible sets status to UNPUBLISHED on success', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(deviceRow({ status: 'PUBLISHED' }))
      .mockResolvedValueOnce(deviceRow({ status: 'UNPUBLISHED' }));
    const result = await unpublishVisible('dev-1', ownerMembership);
    expect(result.status).toBe('UNPUBLISHED');
  });
});
