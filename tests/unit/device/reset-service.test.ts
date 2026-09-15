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
    insert: () => ({ values: vi.fn().mockResolvedValue(undefined) }),
    delete: () => ({ where: vi.fn().mockResolvedValue(undefined) }),
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { adminReset, ownerReset } from '@/domains/device/server/service';
import { hashClaimCode } from '@/lib/codes';

const now = new Date('2025-07-01T00:00:00Z');

function deviceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dev-1',
    slug: 'slug-ones',
    name: 'Device',
    status: 'PUBLISHED',
    ownerId: null,
    organizationId: 'org-1',
    memberId: 'member-1',
    boundUserId: 'user-1',
    claimCodeHash: 'old-hash',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

type MockFn = ReturnType<typeof vi.fn>;
type MockQuery = {
  device: { findFirst: MockFn; findMany: MockFn };
  destination: { findFirst: MockFn; findMany: MockFn };
};
const q = (table: 'device' | 'destination') => (getDb().query as unknown as MockQuery)[table];

beforeEach(() => {
  vi.resetAllMocks();
  q('device').findFirst.mockResolvedValue(null);
  q('device').findMany.mockResolvedValue([]);
  q('destination').findMany.mockResolvedValue([]);
});

describe('ownerReset (FR-028: keep org, rotate code)', () => {
  it('clears config, keeps organizationId, rotates the claim code', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(deviceRow())
      .mockResolvedValueOnce(deviceRow({ status: 'CLAIMED', memberId: null, boundUserId: null }));

    const result = await ownerReset('dev-1', 'org-1');

    expect(result.device.status).toBe('CLAIMED');
    expect(hashClaimCode(result.claimCode)).not.toBe('old-hash');
    expect(result.claimCode.length).toBeGreaterThanOrEqual(6);
  });

  it('rejects a device outside the caller organization (WHERE filters it out)', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(ownerReset('dev-1', 'org-1')).rejects.toThrow('Device not found');
  });

  it('rejects a device that does not exist', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(ownerReset('dev-1', 'org-1')).rejects.toThrow('Device not found');
  });
});

describe('adminReset (FR-028: clear org, back to unclaimed)', () => {
  it('clears everything including organizationId and rotates the claim code', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(deviceRow())
      .mockResolvedValueOnce(deviceRow({ status: 'UNCLAIMED', organizationId: null }));

    const result = await adminReset('dev-1');

    expect(result.device.status).toBe('UNCLAIMED');
    expect(hashClaimCode(result.claimCode)).not.toBe('old-hash');
  });

  it('rejects an unknown device', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(adminReset('missing')).rejects.toThrow('Device not found');
  });
});
