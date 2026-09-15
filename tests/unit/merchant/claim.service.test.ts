import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const db = {
    query: {
      device: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      member: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      organization: { findMany: vi.fn().mockResolvedValue([]) },
      merchantProfile: { findFirst: vi.fn().mockResolvedValue(null) },
      destination: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      place: { findFirst: vi.fn().mockResolvedValue(null) },
      scanEvent: { findMany: vi.fn().mockResolvedValue([]) },
    },
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }),
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { claimWithCode } from '@/domains/merchant/server/service';
import { hashClaimCode } from '@/lib/codes';

const now = new Date('2025-07-01T00:00:00Z');
const CODE = 'TESTCODE123456';

function deviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-1',
    slug: 'slug-ones',
    name: 'Device',
    status: 'UNCLAIMED',
    organizationId: 'org-1',
    memberId: null,
    boundUserId: null,
    claimCodeHash: hashClaimCode(CODE),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const ownerMembership = { id: 'm-owner', organizationId: 'org-1', role: 'owner' } as const;
const memberMembership = { id: 'm-member', organizationId: 'org-1', role: 'member' } as const;

type MockDb = {
  query: {
    device: { findFirst: ReturnType<typeof vi.fn> };
    member: { findFirst: ReturnType<typeof vi.fn> };
  };
};
const q = (table: keyof MockDb['query']) => (getDb() as unknown as MockDb).query[table];

beforeEach(() => {
  vi.resetAllMocks();
  q('device').findFirst.mockResolvedValue(null);
});

describe('claimWithCode (org-aware claim, FR-005/023)', () => {
  it('owner adopts an unassigned device into their organization', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ organizationId: null }));
    const result = await claimWithCode('u1', ownerMembership, CODE);
    expect(result.status).toBe('CLAIMED');
    expect(result.slug).toBe('slug-ones');
  });

  it('member claims a device already in their organization', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow());
    const result = await claimWithCode('u1', memberMembership, CODE);
    expect(result.status).toBe('CLAIMED');
  });

  it('rejects a device bound to another account', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ boundUserId: 'someone-else' }));
    await expect(claimWithCode('u1', memberMembership, CODE)).rejects.toThrow(
      'already linked to another account',
    );
  });

  it('allows a user to claim a device already bound to themselves', async () => {
    q('device').findFirst.mockResolvedValue(
      deviceRow({ boundUserId: 'u1', organizationId: 'org-1', memberId: 'm-member' }),
    );
    const result = await claimWithCode('u1', memberMembership, CODE);
    expect(result.status).toBe('CLAIMED');
  });

  it('rejects a device from another organization', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow({ organizationId: 'org-2' }));
    await expect(claimWithCode('u1', memberMembership, CODE)).rejects.toThrow(
      'belongs to another organization',
    );
  });

  it('rejects an unknown claim code', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(claimWithCode('u1', memberMembership, 'ZZZZZZ')).rejects.toThrow(
      'Claim code not found',
    );
  });
});
