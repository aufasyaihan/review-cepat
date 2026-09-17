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

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  const op = (name: string) =>
    vi.fn((...args: unknown[]) => ({ op: name, args })) as unknown as typeof actual.gte;
  const and = ((...args: unknown[]) => args) as unknown as typeof actual.and;
  return {
    ...actual,
    and,
    inArray: op('inArray'),
    gte: op('gte'),
    lte: op('lte'),
  };
});

import { getDb } from '@/db';
import { adminOverview, breakdown, overview } from '@/domains/analytics/server/service';

const ownerMembership = { id: 'm-owner', organizationId: 'org-1', userId: 'user-1', role: 'owner' };

const whereArgs: unknown[] = [];

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
    from: () => {
      const value = values[call++] ?? [];
      const result = Promise.resolve(value) as Promise<unknown> & {
        where?: (whereArg: unknown) => Promise<unknown> & {
          groupBy?: () => Promise<unknown> & { orderBy?: () => Promise<unknown> };
        };
      };
      result.where = (whereArg: unknown) => {
        whereArgs.push(whereArg);
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
        return chained;
      };
      return result;
    },
  }));
}

// Every `where(...)` argument records the `and(inArray, gte?, lte?)` array the
// service builds; tests assert operators + bound dates (FR-044 date filtering).
function selectWhereOps(): Array<{ op: string; args: unknown[] }> {
  return whereArgs.flat() as Array<{ op: string; args: unknown[] }>;
}

beforeEach(() => {
  vi.clearAllMocks();
  whereArgs.length = 0;
  dbQuery.member.findMany.mockResolvedValue([ownerMembership]);
  dbQuery.device.findFirst.mockResolvedValue(null);
  dbQuery.device.findMany.mockResolvedValue([]);
});

describe('analytics domain (owner-only, SC-008)', () => {
  it('owner with no devices → zeroed overview', async () => {
    const result = await overview('user-1');
    expect(result).toEqual({
      totalScans: 0,
      deviceScans: [],
      dailyScans: [],
      merchantCount: 0,
      userCount: 0,
    });
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

describe('overview date-range window (FR-044)', () => {
  beforeEach(() => {
    dbQuery.device.findMany.mockResolvedValue([
      { id: 'd1', slug: 'a', name: 'Alpha', organizationId: 'org-1' },
    ]);
  });

  it('filters scan events to [from, to] when a window is provided', async () => {
    mockSelectReturn([[{ cnt: 3 }], [{ day: '2025-07-01', cnt: 3 }], [{ deviceId: 'd1', cnt: 3 }]]);
    const from = new Date('2025-06-01T00:00:00Z');
    const to = new Date('2025-07-31T23:59:59Z');
    await overview('user-1', { from, to });

    const ops = selectWhereOps();
    const gte = ops.find((o) => o.op === 'gte');
    const lte = ops.find((o) => o.op === 'lte');
    expect(gte?.args[1]).toBe(from);
    expect(lte?.args[1]).toBe(to);
  });

  it('does not add gte/lte operators when no window is given', async () => {
    mockSelectReturn([[{ cnt: 5 }], [], [{ deviceId: 'd1', cnt: 5 }]]);
    const result = await overview('user-1');
    expect(result.totalScans).toBe(5);
    const ops = selectWhereOps();
    expect(ops.some((o) => o.op === 'gte' || o.op === 'lte')).toBe(false);
  });
});

describe('adminOverview (FR-044)', () => {
  it('rejects a non-admin with 403', async () => {
    await expect(adminOverview({ id: 'u1', role: 'MERCHANT' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('aggregates across ALL devices regardless of organization', async () => {
    dbQuery.device.findMany.mockResolvedValue([
      { id: 'd1', slug: 'a', name: 'Alpha', organizationId: 'org-1' },
      { id: 'd2', slug: 'b', name: 'Beta', organizationId: 'org-2' },
      { id: 'd3', slug: 'c', name: 'Gamma', organizationId: 'org-3' },
    ]);
    // merchant count, user count, totalRows, daily, perDevice — in query order
    mockSelectReturn([
      [{ cnt: 4 }],
      [{ cnt: 12 }],
      [{ cnt: 9 }],
      [{ day: '2025-07-01', cnt: 9 }],
      [
        { deviceId: 'd1', cnt: 3 },
        { deviceId: 'd2', cnt: 4 },
        { deviceId: 'd3', cnt: 2 },
      ],
    ]);

    const result = await adminOverview({ id: 'admin-1', role: 'ADMIN' });
    expect(result.totalScans).toBe(9);
    expect(result.deviceScans).toHaveLength(3);
    expect(result.deviceScans.map((d) => d.slug)).toEqual(['a', 'b', 'c']);
    expect(result.merchantCount).toBe(4);
    expect(result.userCount).toBe(12);
  });

  it('returns non-negative merchant and user counts', async () => {
    dbQuery.device.findMany.mockResolvedValue([]);
    // no organizations, no users, no scans (aggregate early-returns on empty ids)
    mockSelectReturn([[{ cnt: 0 }], [{ cnt: 0 }]]);
    const result = await adminOverview({ id: 'admin-1', role: 'ADMIN' });
    expect(typeof result.merchantCount).toBe('number');
    expect(typeof result.userCount).toBe('number');
    expect(result.merchantCount).toBeGreaterThanOrEqual(0);
    expect(result.userCount).toBeGreaterThanOrEqual(0);
  });

  it('zero-fills for an empty window with no scans', async () => {
    dbQuery.device.findMany.mockResolvedValue([
      { id: 'd1', slug: 'a', name: 'Alpha', organizationId: 'org-1' },
    ]);
    // merchantCart, userCount, then zeroed scans
    mockSelectReturn([[{ cnt: 2 }], [{ cnt: 5 }], [], [], []]);
    const result = await adminOverview(
      { id: 'admin-1', role: 'ADMIN' },
      { from: new Date('2026-01-01'), to: new Date('2026-01-31') },
    );
    expect(result).toEqual({
      totalScans: 0,
      deviceScans: [{ deviceId: 'd1', slug: 'a', name: 'Alpha', scans: 0 }],
      dailyScans: [],
      merchantCount: 2,
      userCount: 5,
    });
  });
});
