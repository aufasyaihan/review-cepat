import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const selectGroupBy = vi.fn().mockResolvedValue([]);
  const db = {
    query: {
      member: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      device: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      organization: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    select: () => ({
      from: () => ({ where: () => ({ groupBy: selectGroupBy }) }),
    }),
    __selectGroupBy: selectGroupBy,
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { listAllMembers, listMembers } from '@/domains/merchant/server/service';

type MockFn = ReturnType<typeof vi.fn>;
const q = (table: 'member' | 'device') => (getDb() as any).query[table];
const selectGroupBy = () => (getDb() as any).__selectGroupBy as MockFn;

const now = new Date('2025-07-01T00:00:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  q('member').findMany.mockResolvedValue([]);
  q('member').findFirst.mockResolvedValue(null);
  q('device').findFirst.mockResolvedValue(null);
  q('device').findMany.mockResolvedValue([]);
  selectGroupBy().mockResolvedValue([]);
});

describe('listMembers', () => {
  it('joins member rows with user data and device counts', async () => {
    q('member').findMany.mockResolvedValue([
      {
        id: 'm-owner',
        organizationId: 'org-1',
        userId: 'u1',
        role: 'owner',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: {
          id: 'u1',
          name: 'Owner',
          email: 'owner@acme.io',
          role: 'MERCHANT',
          status: 'ACTIVE',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          image: null,
        },
      },
      {
        id: 'm-sub',
        organizationId: 'org-1',
        userId: 'u2',
        role: 'member',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: {
          id: 'u2',
          name: 'Sub',
          email: 'sub@acme.io',
          role: 'MERCHANT',
          status: 'ACTIVE',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          image: null,
        },
      },
    ]);
    q('device').findMany.mockResolvedValue([
      { id: 'd1', memberId: 'm-sub' } as never,
      { id: 'd2', memberId: 'm-sub' } as never,
    ]);
    selectGroupBy().mockResolvedValue([{ memberId: 'm-sub', cnt: 2 }]);

    const members = await listMembers('org-1');
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.id === 'm-sub')).toMatchObject({
      role: 'member',
      email: 'sub@acme.io',
      deviceCount: 2,
      organizationId: 'org-1',
      organizationName: 'Org One',
    });
    expect(members[0].role).toBe('owner');
  });

  it('ignores null memberId in device counts and sorts member-before-owner pairs', async () => {
    q('member').findMany.mockResolvedValue([
      {
        id: 'm-sub',
        organizationId: 'org-1',
        userId: 'u2',
        role: 'member',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'u2', name: 'Sub', email: 'sub@acme.io' },
      },
      {
        id: 'm-owner',
        organizationId: 'org-1',
        userId: 'u1',
        role: 'owner',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'u1', name: 'Owner', email: 'owner@acme.io' },
      },
    ]);
    selectGroupBy().mockResolvedValue([{ memberId: null, cnt: 7 }]);

    const members = await listMembers('org-1');
    expect(members[0].role).toBe('owner');
    expect(members.find((m) => m.role === 'member')?.deviceCount).toBe(0);
  });

  it('leaves relative order unchanged when neither side is an owner', async () => {
    q('member').findMany.mockResolvedValue([
      {
        id: 'm-a',
        organizationId: 'org-1',
        userId: 'u1',
        role: 'member',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'u1', name: 'A', email: 'a@acme.io' },
      },
      {
        id: 'm-b',
        organizationId: 'org-1',
        userId: 'u2',
        role: 'member',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'u2', name: 'B', email: 'b@acme.io' },
      },
    ]);

    const members = await listMembers('org-1');
    expect(members.map((m) => m.id)).toEqual(['m-a', 'm-b']);
  });
});

describe('listAllMembers', () => {
  it('returns members across every organization, owner-first per group, with org fields', async () => {
    q('member').findMany.mockResolvedValue([
      {
        id: 'm-sub-2',
        organizationId: 'org-2',
        userId: 'u4',
        role: 'member',
        organization: { id: 'org-2', name: 'Org Two', slug: 'org-two' },
        user: { id: 'u4', name: 'Sub Two', email: 'sub2@acme.io' },
      },
      {
        id: 'm-owner-1',
        organizationId: 'org-1',
        userId: 'u1',
        role: 'owner',
        organization: { id: 'org-1', name: 'Org One', slug: 'org-one' },
        user: { id: 'u1', name: 'Owner One', email: 'owner1@acme.io' },
      },
    ]);

    const members = await listAllMembers();
    expect(members).toHaveLength(2);
    expect(members.find((m) => m.id === 'm-sub-2')).toMatchObject({
      organizationId: 'org-2',
      organizationName: 'Org Two',
      deviceCount: 0,
    });
    expect(members.find((m) => m.id === 'm-owner-1')).toMatchObject({
      organizationId: 'org-1',
      organizationName: 'Org One',
    });
  });

  it('groups by organization (alpha) and sorts owner-before-member within each group', async () => {
    q('member').findMany.mockResolvedValue([
      {
        id: 'm-member-b',
        organizationId: 'org-b',
        userId: 'u4',
        role: 'member',
        organization: { id: 'org-b', name: 'Org B', slug: 'org-b' },
        user: { id: 'u4', name: 'Member B', email: 'memberb@acme.io' },
      },
      {
        id: 'm-owner-b',
        organizationId: 'org-b',
        userId: 'u3',
        role: 'owner',
        organization: { id: 'org-b', name: 'Org B', slug: 'org-b' },
        user: { id: 'u3', name: 'Owner B', email: 'ownerb@acme.io' },
      },
      {
        id: 'm-member-a',
        organizationId: 'org-a',
        userId: 'u2',
        role: 'member',
        organization: { id: 'org-a', name: 'Org A', slug: 'org-a' },
        user: { id: 'u2', name: 'Member A', email: 'membera@acme.io' },
      },
      {
        id: 'm-owner-a',
        organizationId: 'org-a',
        userId: 'u1',
        role: 'owner',
        organization: { id: 'org-a', name: 'Org A', slug: 'org-a' },
        user: { id: 'u1', name: 'Owner A', email: 'ownera@acme.io' },
      },
    ]);

    const members = await listAllMembers();
    expect(members.map((m) => m.id)).toEqual([
      'm-owner-a',
      'm-member-a',
      'm-owner-b',
      'm-member-b',
    ]);
  });

  it('returns an empty list when there are no members anywhere', async () => {
    const members = await listAllMembers();
    expect(members).toEqual([]);
  });
});
