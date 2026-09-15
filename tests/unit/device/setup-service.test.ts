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
import { claimAccountless } from '@/domains/device/server/service';
import { hashClaimCode } from '@/lib/codes';

const now = new Date('2025-07-01T00:00:00Z');
const CODE = 'TESTCODE123456';

const unclaimedRow = {
  id: 'dev-1',
  slug: 'slug-ones',
  name: 'Test Device',
  status: 'UNCLAIMED',
  ownerId: null,
  claimCodeHash: hashClaimCode(CODE),
  createdAt: now,
  updatedAt: now,
};

type MockFn = ReturnType<typeof vi.fn>;
const q = (table: 'device') => (getDb() as any).query[table];

beforeEach(() => {
  vi.resetAllMocks();
  q('device').findFirst.mockResolvedValue(null);
  q('device').findMany.mockResolvedValue([]);
});

describe('claimAccountless', () => {
  it('returns device info and marks CLAIMED on success', async () => {
    q('device')
      .findFirst.mockResolvedValueOnce(unclaimedRow)
      .mockResolvedValueOnce({
        ...unclaimedRow,
        status: 'CLAIMED',
      });
    const result = await claimAccountless(unclaimedRow.slug, CODE);
    expect(result.id).toBe('dev-1');
    expect(result.slug).toBe('slug-ones');
  });

  it('rejects an invalid slug format', async () => {
    await expect(claimAccountless('no spaces!', CODE)).rejects.toThrow('Device not found');
  });

  it('rejects an unknown claim code', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(claimAccountless(unclaimedRow.slug, 'ZZZZZZ')).rejects.toThrow(
      'Invalid claim code',
    );
  });

  it('rejects a disabled device', async () => {
    q('device').findFirst.mockResolvedValueOnce({ ...unclaimedRow, status: 'DISABLED' });
    await expect(claimAccountless(unclaimedRow.slug, CODE)).rejects.toThrow('disabled');
  });

  it('rejects a published device (already set up)', async () => {
    q('device').findFirst.mockResolvedValueOnce({ ...unclaimedRow, status: 'PUBLISHED' });
    await expect(claimAccountless(unclaimedRow.slug, CODE)).rejects.toThrow('already set up');
  });

  it('rejects an unpublished device (already set up)', async () => {
    q('device').findFirst.mockResolvedValueOnce({ ...unclaimedRow, status: 'UNPUBLISHED' });
    await expect(claimAccountless(unclaimedRow.slug, CODE)).rejects.toThrow('already set up');
  });
});
