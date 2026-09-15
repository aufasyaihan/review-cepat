import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const db = {
    query: {
      member: { findMany: vi.fn().mockResolvedValue([]) },
      organization: { findMany: vi.fn().mockResolvedValue([]) },
      device: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import {
  canAccessDevice,
  getActiveOrganization,
  isOwner,
} from '@/domains/merchant/server/permissions';

type MockFn = ReturnType<typeof vi.fn>;
const q = (table: 'member') => (getDb() as any).query[table];

beforeEach(() => {
  vi.resetAllMocks();
  q('member').findMany.mockResolvedValue([]);
});

const owner = { id: 'm-owner', organizationId: 'org-1', role: 'owner' } as const;
const member = { id: 'm-member', organizationId: 'org-1', role: 'member' } as const;

describe('isOwner', () => {
  it('returns true only for the owner role', () => {
    expect(isOwner(owner)).toBe(true);
    expect(isOwner(member)).toBe(false);
  });
});

describe('canAccessDevice (Authorization Visibility)', () => {
  it('owner sees any device in their organization', () => {
    expect(canAccessDevice(owner, { organizationId: 'org-1', memberId: 'other' })).toBe(true);
  });

  it('owner cannot see devices of another organization', () => {
    expect(canAccessDevice(owner, { organizationId: 'org-2', memberId: null })).toBe(false);
  });

  it('member sees only devices assigned to them', () => {
    expect(canAccessDevice(member, { organizationId: 'org-1', memberId: 'm-member' })).toBe(true);
    expect(canAccessDevice(member, { organizationId: 'org-1', memberId: 'someone-else' })).toBe(
      false,
    );
  });

  it('member cannot see org-owned devices with no assignment', () => {
    expect(canAccessDevice(member, { organizationId: 'org-1', memberId: null })).toBe(false);
  });

  it('rejects unowned devices', () => {
    expect(canAccessDevice(owner, { organizationId: null, memberId: null })).toBe(false);
  });
});

describe('getActiveOrganization', () => {
  it('returns the first membership (active org for MVP)', async () => {
    q('member').findMany.mockResolvedValue([
      { id: 'm1', organizationId: 'org-1', userId: 'u1', role: 'owner' },
    ]);
    const active = await getActiveOrganization('u1');
    expect(active).toEqual({ id: 'm1', organizationId: 'org-1', role: 'owner' });
  });

  it('returns null when the user has no membership', async () => {
    expect(await getActiveOrganization('u1')).toBeNull();
  });
});
