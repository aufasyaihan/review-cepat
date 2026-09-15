import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const deviceFindFirst = vi.fn().mockResolvedValue(null);
  const deviceFindMany = vi.fn().mockResolvedValue([]);
  const memberFindMany = vi.fn().mockResolvedValue([]);
  const db = {
    query: {
      member: { findMany: memberFindMany },
      device: { findMany: deviceFindMany, findFirst: deviceFindFirst },
      merchantProfile: { findFirst: vi.fn().mockResolvedValue({ id: 7, userId: 'user-1' }) },
    },
    select: vi.fn(),
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { breakdown, overview } from '@/domains/analytics/server/service';

const ownerMembership = { id: 'm-owner', organizationId: 'org-1', userId: 'user-1', role: 'owner' };

type MockFn = ReturnType<typeof vi.fn>;
const dbQuery = {
  get device() {
    const query = getDb().query as unknown as { device: { findFirst: MockFn; findMany: MockFn } };
    return query.device;
  },
  get member() {
    const query = getDb().query as unknown as { member: { findMany: MockFn } };
    return query.member;
  },
};

function mockSelectReturn(values: unknown[]) {
  const db = getDb() as unknown as { select: ReturnType<typeof vi.fn> };
  let call = 0;
  db.select.mockImplementation(() => ({
    from: () => ({
      where: () => {
        const value = values[call++] ?? [];
        const plain = Promise.resolve(value);
        const chained = Promise.resolve(value) as Promise<unknown> & {
          groupBy?: () => Promise<unknown> & { orderBy?: () => Promise<unknown> };
        };
        chained.groupBy = () => {
          const grouped = Promise.resolve(value) as Promise<unknown> & {
            orderBy?: () => Promise<unknown>;
          };
          grouped.orderBy = () => Promise.resolve(value);
          return grouped;
        };
        void plain;
        return chained;
      },
    }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  dbQuery.member.findMany.mockResolvedValue([ownerMembership]);
  dbQuery.device.findFirst.mockResolvedValue(null);
  dbQuery.device.findMany.mockResolvedValue([]);
});

describe('analytics domain (owner-only, SC-008)', () => {
  it('owner with no devices → zeroed overview', async () => {
    const result = await overview('user-1');
    expect(result).toEqual({ totalScans: 0, deviceScans: [], dailyScans: [] });
  });

  it('returns per-device and daily aggregates for owned devices', async () => {
    dbQuery.device.findMany.mockResolvedValue([
      { id: 'd1', slug: 'a', name: 'Alpha', organizationId: 'org-1' },
    ]);
    // totalRows (count), daily, perDevice — in query order
    mockSelectReturn([[{ cnt: 5 }], [{ day: '2025-07-01', cnt: 2 }], [{ deviceId: 'd1', cnt: 3 }]]);
    const result = await overview('user-1');
    expect(result.totalScans).toBe(5);
    expect(result.deviceScans).toEqual([{ deviceId: 'd1', slug: 'a', name: 'Alpha', scans: 3 }]);
    expect(result.dailyScans).toEqual([{ day: '2025-07-01', scans: 2 }]);
  });

  it('falls back to zero for missing total/per-device counts', async () => {
    dbQuery.device.findMany.mockResolvedValue([
      { id: 'd1', slug: 'a', name: 'Alpha', organizationId: 'org-1' },
      { id: 'd2', slug: 'b', name: 'Beta', organizationId: 'org-1' },
    ]);
    // totalRows empty (no rows at all), daily empty, perDevice missing d2
    mockSelectReturn([[], [], [{ deviceId: 'd1', cnt: 1 }]]);
    const result = await overview('user-1');
    expect(result.totalScans).toBe(0);
    expect(result.deviceScans).toEqual([
      { deviceId: 'd1', slug: 'a', name: 'Alpha', scans: 1 },
      { deviceId: 'd2', slug: 'b', name: 'Beta', scans: 0 },
    ]);
  });

  it('flags an unsupported breakdown dimension as 400', async () => {
    dbQuery.device.findFirst.mockResolvedValueOnce({ id: 'd1' });
    await expect(breakdown('user-1', 'd1', 'nope' as never)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects breakdown for a device outside the organization (404)', async () => {
    await expect(breakdown('user-1', 'foreign', 'browser')).rejects.toMatchObject({ status: 404 });
  });

  it('returns mapped breakdown rows for an owned device', async () => {
    dbQuery.device.findFirst.mockResolvedValueOnce({ id: 'd1', organizationId: 'org-1' });
    mockSelectReturn([
      [
        { value: 'Chrome', cnt: 4 },
        { value: null, cnt: 1 },
      ],
    ]);
    const rows = await breakdown('user-1', 'd1', 'browser');
    expect(rows).toEqual([{ value: 'Chrome', scans: 4 }]);
  });

  it('denies analytics to a sub-merchant member (403)', async () => {
    dbQuery.member.findMany.mockResolvedValue([
      { id: 'm-sub', organizationId: 'org-1', userId: 'user-1', role: 'member' },
    ]);
    await expect(overview('user-1')).rejects.toMatchObject({ status: 403 });
  });
});
