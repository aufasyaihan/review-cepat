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
import { setForDeviceSetup } from '@/domains/destination/server/service';

const now = new Date('2025-07-01T00:00:00Z');
const deviceRow = {
  id: 'dev-1',
  slug: 'slug-ones',
  name: 'Device',
  status: 'UNCLAIMED',
  ownerId: null,
  claimCodeHash: 'abc',
  createdAt: now,
  updatedAt: now,
};

type MockFn = ReturnType<typeof vi.fn>;
type MockQuery = {
  device: { findFirst: MockFn; findMany: MockFn };
  destination: { findFirst: MockFn; findMany: MockFn };
};
const q = (table: 'device' | 'destination') => (getDb().query as unknown as MockQuery)[table];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setForDeviceSetup', () => {
  it('saves destinations and sets CLAIMED for an existing device', async () => {
    q('device').findFirst.mockResolvedValue(deviceRow);
    q('destination').findMany.mockResolvedValueOnce([
      {
        id: 'dest-1',
        type: 'WEBSITE',
        label: null,
        url: 'https://example.com',
        placeId: null,
        position: 0,
        active: true,
      },
    ]);

    const result = await setForDeviceSetup('dev-1', {
      destinations: [
        {
          type: 'WEBSITE',
          position: 0,
          active: true,
          url: 'https://example.com',
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('WEBSITE');
    expect(result[0].url).toBe('https://example.com');
  });

  it('rejects a device that does not exist', async () => {
    q('device').findFirst.mockResolvedValue(null);
    await expect(
      setForDeviceSetup('missing', {
        destinations: [{ type: 'WEBSITE', position: 0, active: true, url: 'https://a.com' }],
      }),
    ).rejects.toThrow('Device not found');
  });

  it('rejects a disabled device', async () => {
    q('device').findFirst.mockResolvedValue({ ...deviceRow, status: 'DISABLED' });
    await expect(
      setForDeviceSetup('dev-1', {
        destinations: [{ type: 'WEBSITE', position: 0, active: true, url: 'https://a.com' }],
      }),
    ).rejects.toThrow('Disabled');
  });
});
