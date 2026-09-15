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
import type { DeviceStatus } from '@/domains/device/constants';
import {
  adminCreate,
  adminDeviceScanCount,
  adminList,
  adminSetDisabled,
  claim,
  getById,
  getBySlug,
  getForOwner,
  isPublishable,
  listOwned,
  publish,
  transfer,
  unpublish,
} from '@/domains/device/server/service';

type MockFn = ReturnType<typeof vi.fn>;

type MockDb = {
  query: {
    device: { findFirst: MockFn; findMany: MockFn };
    destination: { findFirst: MockFn; findMany: MockFn };
    place: { findFirst: MockFn };
    merchantProfile: { findFirst: MockFn };
    scanEvent: { findMany: MockFn };
  };
  update: () => unknown;
  insert: () => unknown;
  delete: () => unknown;
};

function q<K extends keyof MockDb['query']>(table: K): MockDb['query'][K] {
  return (getDb() as unknown as MockDb).query[table];
}

const now = new Date('2025-06-01T00:00:00Z');
const deviceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'dev-1',
  slug: 'slug-one',
  name: 'Device 1',
  status: 'CLAIMED',
  ownerId: 7,
  claimCodeHash: 'abc',
  createdAt: now,
  updatedAt: now,
  ...overrides,
});
const destRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'dest-1',
  deviceId: 'dev-1',
  type: 'WEBSITE',
  label: 'Home',
  url: 'https://example.com',
  placeId: null,
  position: 0,
  active: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('device service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    q('device').findFirst.mockResolvedValue(null);
    q('device').findMany.mockResolvedValue([]);
    q('destination').findMany.mockResolvedValue([]);
    q('merchantProfile').findFirst.mockResolvedValue(null);
    q('scanEvent').findMany.mockResolvedValue([]);
  });

  // --- listOwned ---
  describe('listOwned', () => {
    it('returns empty list when no devices', async () => {
      const result = await listOwned(1);
      expect(result).toEqual([]);
    });

    it('maps rows to DeviceSummary', async () => {
      q('device').findMany.mockResolvedValueOnce([deviceRow()]);
      const result = await listOwned(7);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'dev-1', status: 'CLAIMED' });
    });
  });

  // --- getForOwner ---
  describe('getForOwner', () => {
    it('throws 404 when device not found', async () => {
      await expect(getForOwner('x', 1)).rejects.toMatchObject({ status: 404 });
    });

    it('returns device with destinations ordered by position', async () => {
      const row = deviceRow();
      q('device').findFirst.mockResolvedValueOnce(row);
      q('destination').findMany.mockResolvedValueOnce([
        destRow({ position: 0 }),
        destRow({ position: 1 }),
      ]);
      const result = await getForOwner('dev-1', 7);
      expect(result.destinations).toHaveLength(2);
      expect(result.destinations[0].position).toBe(0);
      expect(result.destinations[1].position).toBe(1);
    });
  });

  // --- getById ---
  describe('getById', () => {
    it('returns null when not found', async () => {
      expect(await getById('x')).toBeNull();
    });

    it('returns DeviceDetail with destinations', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      q('destination').findMany.mockResolvedValueOnce([destRow()]);
      const result = await getById('dev-1');
      expect(result).not.toBeNull();
      expect(result!.destinations).toHaveLength(1);
    });
  });

  // --- getBySlug ---
  describe('getBySlug', () => {
    it('returns null for invalid slug without querying device table', async () => {
      const result = await getBySlug('bad!');
      expect(result).toBeNull();
      expect(q('device').findFirst).not.toHaveBeenCalled();
    });

    it('returns null when slug not in DB', async () => {
      q('device').findFirst.mockResolvedValueOnce(null);
      const result = await getBySlug('validsl');
      expect(result).toBeNull();
    });

    it('delegates to getById when slug is found', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow({ slug: 'validsl' })) // slug lookup
        .mockResolvedValueOnce(deviceRow({ slug: 'validsl' })); // id lookup via getById
      const result = await getBySlug('validsl');
      expect(result).not.toBeNull();
    });
  });

  // --- claim ---
  describe('claim', () => {
    it('throws ZodError on invalid input', async () => {
      await expect(claim(1, {})).rejects.toThrow();
    });

    it('throws 404 when claim code not found', async () => {
      await expect(claim(1, { claimCode: 'ABC123' })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('throws 409 when device already claimed', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow({ ownerId: 5 }));
      await expect(claim(1, { claimCode: 'ABC123' })).rejects.toMatchObject({
        status: 409,
      });
    });

    it('updates device and returns summary on success', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow({ ownerId: null })) // find by hash
        .mockResolvedValueOnce(deviceRow({ ownerId: 1, status: 'CLAIMED' })); // readDeviceOrFail
      const result = await claim(1, { claimCode: 'ABC123' });
      expect(result).toMatchObject({ id: 'dev-1', status: 'CLAIMED' });
    });

    it('throws DEVICE_READ_FAILED when the reload returns null', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow({ ownerId: null })) // find by hash
        .mockResolvedValueOnce(null); // readDeviceOrFail reload misses
      await expect(claim(1, { claimCode: 'ABC123' })).rejects.toMatchObject({
        status: 500,
        code: 'DEVICE_READ_FAILED',
      });
    });
  });

  // --- publish ---
  describe('publish', () => {
    it('throws 404 when device not found', async () => {
      await expect(publish('x', 1)).rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 when device is DISABLED', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow({ status: 'DISABLED' }));
      await expect(publish('dev-1', 7)).rejects.toMatchObject({ status: 409 });
    });

    it('throws 409 when no active destinations', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      q('destination').findMany.mockResolvedValueOnce([]);
      await expect(publish('dev-1', 7)).rejects.toMatchObject({ status: 409 });
    });

    it('sets status to PUBLISHED on success', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow()) // ownership check
        .mockResolvedValueOnce(deviceRow({ status: 'PUBLISHED' })); // readDeviceOrFail
      q('destination').findMany.mockResolvedValueOnce([destRow()]);
      const result = await publish('dev-1', 7);
      expect(result.status).toBe('PUBLISHED');
    });
  });

  // --- unpublish ---
  describe('unpublish', () => {
    it('throws 404 when device not found', async () => {
      await expect(unpublish('x', 1)).rejects.toMatchObject({ status: 404 });
    });

    it('returns device as-is when not PUBLISHED (no DB update)', async () => {
      const row = deviceRow({ status: 'CLAIMED' });
      q('device').findFirst.mockResolvedValueOnce(row);
      const result = await unpublish('dev-1', 7);
      expect(result.status).toBe('CLAIMED');
    });

    it('sets status to UNPUBLISHED on success', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow({ status: 'PUBLISHED' })) // ownership check
        .mockResolvedValueOnce(deviceRow({ status: 'UNPUBLISHED' })); // readDeviceOrFail
      const result = await unpublish('dev-1', 7);
      expect(result.status).toBe('UNPUBLISHED');
    });
  });

  // --- transfer ---
  describe('transfer', () => {
    it('throws ZodError on invalid input', async () => {
      await expect(transfer('x', 1, {})).rejects.toThrow();
    });

    it('throws 404 when device not found', async () => {
      await expect(transfer('x', 1, { toMerchantId: 99 })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('throws 404 when target merchant not found', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      q('merchantProfile').findFirst.mockResolvedValueOnce(null);
      await expect(transfer('dev-1', 7, { toMerchantId: 99 })).rejects.toMatchObject({
        status: 404,
      });
    });

    it('updates owner and returns summary on success', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow()) // ownership check
        .mockResolvedValueOnce(deviceRow({ ownerId: 99 })); // readDeviceOrFail
      q('merchantProfile').findFirst.mockResolvedValueOnce({ id: 99 });
      const result = await transfer('dev-1', 7, { toMerchantId: 99 });
      expect(result).toMatchObject({ id: 'dev-1' });
    });
  });

  // --- adminCreate ---
  describe('adminCreate', () => {
    it('throws ZodError on invalid input', async () => {
      await expect(adminCreate({})).rejects.toThrow();
    });

    it('returns device + nonempty claimCode', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(null) // ensureUniqueSlug: no collision
        .mockResolvedValueOnce(deviceRow({ status: 'UNCLAIMED' })); // readDeviceOrFail
      const result = await adminCreate({ name: 'New Device' });
      expect(result.claimCode.length).toBeGreaterThan(0);
      expect(result.device).toMatchObject({ name: 'Device 1', status: 'UNCLAIMED' });
    });

    it('throws SLUG_EXHAUSTED after 5 slug collisions', async () => {
      q('device').findFirst.mockResolvedValue(deviceRow()); // every attempt collides
      await expect(adminCreate({ name: 'New Device' })).rejects.toMatchObject({
        status: 500,
        code: 'SLUG_EXHAUSTED',
      });
    });
  });

  // --- adminList ---
  describe('adminList', () => {
    it('returns mapped summaries', async () => {
      q('device').findMany.mockResolvedValueOnce([deviceRow()]);
      const result = await adminList();
      expect(result).toHaveLength(1);
    });

    it('returns empty when no devices', async () => {
      const result = await adminList();
      expect(result).toEqual([]);
    });
  });

  // --- adminSetDisabled ---
  describe('adminSetDisabled', () => {
    it('throws 404 when device not found', async () => {
      await expect(adminSetDisabled('x', true)).rejects.toMatchObject({ status: 404 });
    });

    it('sets DISABLED when disabled=true', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow())
        .mockResolvedValueOnce(deviceRow({ status: 'DISABLED' }));
      const result = await adminSetDisabled('dev-1', true);
      expect(result.status).toBe('DISABLED');
    });

    it('sets CLAIMED when disabled=false', async () => {
      q('device')
        .findFirst.mockResolvedValueOnce(deviceRow({ status: 'DISABLED' }))
        .mockResolvedValueOnce(deviceRow({ status: 'CLAIMED' }));
      const result = await adminSetDisabled('dev-1', false);
      expect(result.status).toBe('CLAIMED');
    });
  });

  // --- adminDeviceScanCount ---
  describe('adminDeviceScanCount', () => {
    it('returns 0 when no scan events', async () => {
      expect(await adminDeviceScanCount('dev-1')).toBe(0);
    });

    it('returns count of scan events', async () => {
      q('scanEvent').findMany.mockResolvedValueOnce([{ id: '1' }, { id: '2' }]);
      expect(await adminDeviceScanCount('dev-1')).toBe(2);
    });
  });

  // --- isPublishable ---
  describe('isPublishable', () => {
    it.each<DeviceStatus>(['CLAIMED', 'UNPUBLISHED'])('returns true for %s', (status) => {
      expect(isPublishable(status)).toBe(true);
    });

    it.each<DeviceStatus>(['UNCLAIMED', 'PUBLISHED', 'DISABLED'])(
      'returns false for %s',
      (status) => {
        expect(isPublishable(status)).toBe(false);
      },
    );
  });
});
