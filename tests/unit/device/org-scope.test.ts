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
      place: { findFirst: vi.fn().mockResolvedValue(null) },
      merchantProfile: { findFirst: vi.fn().mockResolvedValue(null) },
      scanEvent: { findMany: vi.fn().mockResolvedValue([]) },
    },
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { getVisible, listVisible } from '@/domains/device/server/service';

const now = new Date('2025-07-01T00:00:00Z');
const rows = [
  {
    id: 'd1',
    slug: 'a',
    name: 'Assigned',
    status: 'PUBLISHED',
    organizationId: 'org-1',
    memberId: 'm-sub',
    boundUserId: null,
    ownerId: null,
    claimCodeHash: 'h',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'd2',
    slug: 'b',
    name: 'Other',
    status: 'CLAIMED',
    organizationId: 'org-1',
    memberId: null,
    boundUserId: null,
    ownerId: null,
    claimCodeHash: 'h',
    createdAt: now,
    updatedAt: now,
  },
];

const owner = { id: 'm-owner', organizationId: 'org-1', role: 'owner' as const };
const member = { id: 'm-sub', organizationId: 'org-1', role: 'member' as const };
const foreignOwner = { id: 'm-owner2', organizationId: 'org-2', role: 'owner' as const };

type MockFn = ReturnType<typeof vi.fn>;
const q = (table: 'device' | 'destination') =>
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
});

describe('org-scoped device queries (owner vs member)', () => {
  it('owner lists every device in their organization', async () => {
    q('device').findMany.mockResolvedValue(rows);
    const result = await listVisible(owner);
    expect(result.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('member lists only devices assigned to them', async () => {
    q('device').findMany.mockResolvedValue([rows[0]]);
    const result = await listVisible(member);
    expect(result.map((d) => d.id)).toEqual(['d1']);
  });

  it('member sees nothing from another organization', async () => {
    q('device').findMany.mockResolvedValue([]);
    const result = await listVisible({ ...member, organizationId: 'org-2' });
    expect(result).toEqual([]);
  });

  it('getVisible throws 404 for a device outside the caller scope', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(getVisible('d2', member)).rejects.toThrow('Device not found');
  });

  it('getVisible returns a device the member can access', async () => {
    q('device').findFirst.mockResolvedValue(rows[0]);
    q('destination').findMany.mockResolvedValue([]);
    const detail = await getVisible('d1', member);
    expect(detail.id).toBe('d1');
  });

  it('getVisible rejects a device outside the caller organization', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(getVisible('d1', foreignOwner)).rejects.toThrow('Device not found');
  });
});
