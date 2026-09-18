import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  innerJoin: vi.fn().mockResolvedValue([]),
  groupBy: vi.fn().mockResolvedValue([]),
  merchantFindFirst: vi.fn().mockResolvedValue(null),
  organizationFindMany: vi.fn().mockResolvedValue([]),
  updateWhere: vi.fn().mockResolvedValue(undefined),
  insertValues: vi.fn().mockResolvedValue(undefined),
  fromWhere: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/db', () => {
  const db = {
    query: {
      merchantProfile: { findFirst: dbMocks.merchantFindFirst },
      organization: { findMany: dbMocks.organizationFindMany },
    },
    update: () => ({ set: () => ({ where: dbMocks.updateWhere }) }),
    insert: () => ({ values: dbMocks.insertValues }),
    select: () => ({
      from: () => ({
        innerJoin: dbMocks.innerJoin,
        groupBy: dbMocks.groupBy,
        where: () => Object.assign(dbMocks.fromWhere(), { groupBy: dbMocks.groupBy }),
      }),
    }),
  };
  return { getDb: () => db };
});

import {
  getProfileByUserId,
  listMerchants,
  listOrganizations,
  upsertProfile,
} from '@/domains/merchant/server/service';

beforeEach(() => {
  vi.clearAllMocks();
  dbMocks.merchantFindFirst.mockResolvedValue(null);
  dbMocks.innerJoin.mockResolvedValue([]);
  dbMocks.groupBy.mockResolvedValue([]);
  dbMocks.organizationFindMany.mockResolvedValue([]);
  dbMocks.fromWhere.mockResolvedValue([]);
});
describe('upsertProfile', () => {
  it('inserts when no existing profile', async () => {
    const row = {
      id: 1,
      userId: 'u1',
      businessName: 'Acme',
      phone: null,
      country: null,
    };
    dbMocks.merchantFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(row);

    const result = await upsertProfile('u1', { businessName: 'Acme' });
    expect(result).toEqual(row);
  });

  it('updates when existing profile found', async () => {
    const existing = {
      id: 2,
      userId: 'u1',
      businessName: 'Old',
      phone: null,
      country: null,
    };
    const updated = { ...existing, businessName: 'New' };
    dbMocks.merchantFindFirst.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

    const result = await upsertProfile('u1', { businessName: 'New' });
    expect(result.businessName).toBe('New');
  });

  it('normalizes phone/country to null when undefined', async () => {
    const existing = {
      id: 3,
      userId: 'u1',
      businessName: 'X',
      phone: 'old',
      country: 'US',
    };
    dbMocks.merchantFindFirst
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, phone: null, country: null });

    const result = await upsertProfile('u1', { businessName: 'X' });
    expect(result.phone).toBeNull();
    expect(result.country).toBeNull();
  });

  it('throws AppError 500 when post-write findFirst returns null', async () => {
    dbMocks.merchantFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(upsertProfile('u1', { businessName: 'X' })).rejects.toMatchObject({
      status: 500,
      code: 'PROFILE_CREATE_FAILED',
    });
  });
});

describe('getProfileByUserId', () => {
  it('returns toDto mapping when found', async () => {
    const row = {
      id: 5,
      userId: 'u2',
      businessName: 'B',
      phone: '123',
      country: 'ID',
    };
    dbMocks.merchantFindFirst.mockResolvedValue(row);

    const result = await getProfileByUserId('u2');
    expect(result).toEqual(row);
  });

  it('returns null when not found', async () => {
    const result = await getProfileByUserId('missing');
    expect(result).toBeNull();
  });
});

describe('listMerchants', () => {
  it('merges innerJoin profiles with groupBy device counts', async () => {
    const profiles = [
      { id: 1, userId: 'u1', businessName: 'A', phone: null, country: null, email: 'a@b.com' },
      { id: 2, userId: 'u2', businessName: 'B', phone: null, country: null, email: 'c@d.com' },
    ];
    const counts = [
      { ownerId: 1, cnt: 3 },
      { ownerId: 2, cnt: 1 },
    ];

    dbMocks.innerJoin.mockResolvedValueOnce(profiles);
    dbMocks.groupBy.mockResolvedValueOnce(counts);

    const result = await listMerchants();
    expect(result).toEqual([
      { ...profiles[0], deviceCount: 3, organizationId: null },
      { ...profiles[1], deviceCount: 1, organizationId: null },
    ]);
  });

  it('ignores ownerId null in counts', async () => {
    const profiles = [
      { id: 1, userId: 'u1', businessName: 'A', phone: null, country: null, email: 'a@b.com' },
    ];
    const counts = [{ ownerId: null, cnt: 5 }];

    dbMocks.innerJoin.mockResolvedValueOnce(profiles);
    dbMocks.groupBy.mockResolvedValueOnce(counts);

    const result = await listMerchants();
    expect(result[0].deviceCount).toBe(0);
  });

  it('defaults deviceCount to 0 when no matching count', async () => {
    const profiles = [
      { id: 10, userId: 'u1', businessName: 'A', phone: null, country: null, email: 'a@b.com' },
    ];
    const counts = [{ ownerId: 99, cnt: 2 }];

    dbMocks.innerJoin.mockResolvedValueOnce(profiles);
    dbMocks.groupBy.mockResolvedValueOnce(counts);

    const result = await listMerchants();
    expect(result[0].deviceCount).toBe(0);
  });

  it('maps the owner organization id from the member table', async () => {
    const profiles = [
      { id: 1, userId: 'u1', businessName: 'A', phone: null, country: null, email: 'a@b.com' },
    ];
    const counts = [{ ownerId: 1, cnt: 0 }];
    const ownerRows = [{ userId: 'u1', organizationId: 'org-1' }];

    dbMocks.innerJoin.mockResolvedValueOnce(profiles);
    dbMocks.groupBy.mockResolvedValueOnce(counts);
    dbMocks.fromWhere.mockResolvedValueOnce(ownerRows);

    const result = await listMerchants();
    expect(result[0].organizationId).toBe('org-1');
  });
});

describe('listOrganizations', () => {
  it('merges organizations with device counts', async () => {
    dbMocks.organizationFindMany.mockResolvedValueOnce([
      { id: 'org-1', name: 'Org One', slug: 'org-one' },
      { id: 'org-2', name: 'Org Two', slug: 'org-two' },
    ]);
    dbMocks.groupBy.mockResolvedValueOnce([{ organizationId: 'org-1', cnt: 4 }]);

    const result = await listOrganizations();
    expect(result).toEqual([
      { id: 'org-1', name: 'Org One', slug: 'org-one', deviceCount: 4 },
      { id: 'org-2', name: 'Org Two', slug: 'org-two', deviceCount: 0 },
    ]);
  });

  it('ignores null organizationId in counts', async () => {
    dbMocks.organizationFindMany.mockResolvedValueOnce([
      { id: 'org-1', name: 'Org One', slug: 'org-one' },
    ]);
    dbMocks.groupBy.mockResolvedValueOnce([{ organizationId: null, cnt: 9 }]);

    const result = await listOrganizations();
    expect(result[0].deviceCount).toBe(0);
  });

  it('returns empty list when there are no organizations', async () => {
    const result = await listOrganizations();
    expect(result).toEqual([]);
  });
});
