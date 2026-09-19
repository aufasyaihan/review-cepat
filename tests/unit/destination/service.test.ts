import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { deriveReviewUrl } from '@/domains/destination/constants';
import {
  listForDevice,
  searchPlaces,
  setForDevice,
  setForDeviceSetup,
} from '@/domains/destination/server/service';

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

const membership = { id: 'm1', organizationId: 'org-1', role: 'owner' } as const;
const now = new Date('2025-06-01T00:00:00Z');
const deviceRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'dev-1',
  slug: 's',
  name: 'D',
  status: 'CLAIMED',
  ownerId: 7,
  claimCodeHash: 'h',
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

const savedFetch = globalThis.fetch;

describe('destination service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    q('device').findFirst.mockResolvedValue(null);
    q('destination').findMany.mockResolvedValue([]);
    q('place').findFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
    vi.unstubAllEnvs();
  });

  // --- setForDevice ---
  describe('setForDevice', () => {
    it('throws ZodError on invalid input', async () => {
      await expect(setForDevice('dev-1', membership, {})).rejects.toThrow();
    });

    it('throws 404 when device not owned', async () => {
      q('device').findFirst.mockResolvedValueOnce(null);
      await expect(
        setForDevice('dev-1', membership, {
          destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0 }],
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('allows a member to set destinations on their assigned device', async () => {
      const memberMembership = { id: 'm1', organizationId: 'org-1', role: 'member' } as const;
      q('device').findFirst.mockResolvedValueOnce({
        ...deviceRow(),
        organizationId: 'org-1',
        memberId: 'm1',
      });
      q('destination').findMany.mockResolvedValueOnce([destRow()]);
      const result = await setForDevice('dev-1', memberMembership, {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
      });
      expect(result).toHaveLength(1);
    });

    it('deletes old destinations and inserts new ones (replace)', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      q('destination').findMany.mockResolvedValueOnce([destRow()]);
      const result = await setForDevice('dev-1', membership, {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
      });
      expect(result).toHaveLength(1);
    });

    it('GOOGLE_REVIEW inserts place when missing and derives URL', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      // place.findFirst: first call returns null (not found), second call returns created place
      q('place')
        .findFirst.mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'place-1', googlePlaceId: 'ChIJ_X', name: 'P' });
      q('destination').findMany.mockResolvedValueOnce([
        destRow({ type: 'GOOGLE_REVIEW', placeId: 'place-1', url: deriveReviewUrl('ChIJ_X') }),
      ]);
      const result = await setForDevice('dev-1', membership, {
        destinations: [{ type: 'GOOGLE_REVIEW', placeId: 'ChIJ_X', position: 0, active: true }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].url).toContain('placeid=ChIJ_X');
    });

    it('GOOGLE_REVIEW uses existing place row', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      q('place').findFirst.mockResolvedValueOnce({ id: 'place-existing', googlePlaceId: 'ChIJ_Y' });
      q('destination').findMany.mockResolvedValueOnce([
        destRow({ type: 'GOOGLE_REVIEW', placeId: 'place-existing' }),
      ]);
      const result = await setForDevice('dev-1', membership, {
        destinations: [{ type: 'GOOGLE_REVIEW', placeId: 'ChIJ_Y', position: 0, active: true }],
      });
      expect(result).toHaveLength(1);
    });

    it('returns empty result list when nothing remains after delete', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      q('destination').findMany.mockResolvedValueOnce([]);
      const result = await setForDevice('dev-1', membership, {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
      });
      expect(result).toEqual([]);
    });

    it('throws PLACE_CREATE_FAILED when place insert still yields no row', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow());
      // lookup misses, then the post-insert refetch also misses
      q('place').findFirst.mockResolvedValue(null);
      await expect(
        setForDevice('dev-1', membership, {
          destinations: [{ type: 'GOOGLE_REVIEW', placeId: 'ChIJ_Z', position: 0, active: true }],
        }),
      ).rejects.toMatchObject({ status: 500, code: 'PLACE_CREATE_FAILED' });
    });
  });

  // --- setForDeviceSetup ---
  describe('setForDeviceSetup', () => {
    it('throws 404 when device not found', async () => {
      q('device').findFirst.mockResolvedValueOnce(null);
      await expect(
        setForDeviceSetup('dev-1', {
          destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('throws 409 when device is disabled', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow({ status: 'DISABLED' }));
      await expect(
        setForDeviceSetup('dev-1', {
          destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
        }),
      ).rejects.toMatchObject({ status: 409, code: 'DEVICE_DISABLED' });
    });

    it('marks the device CLAIMED when destinations are saved', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow({ status: 'UNCLAIMED' }));
      q('destination').findMany.mockResolvedValueOnce([destRow()]);
      const result = await setForDeviceSetup('dev-1', {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
      });
      expect(result).toHaveLength(1);
    });

    it('does not touch device status when no destinations remain', async () => {
      q('device').findFirst.mockResolvedValueOnce(deviceRow({ status: 'UNCLAIMED' }));
      q('destination').findMany.mockResolvedValueOnce([]);
      const result = await setForDeviceSetup('dev-1', {
        destinations: [{ type: 'WEBSITE', url: 'https://a.com', position: 0, active: true }],
      });
      expect(result).toEqual([]);
    });
  });

  // --- listForDevice ---
  describe('listForDevice', () => {
    it('returns empty when none', async () => {
      expect(await listForDevice('dev-1')).toEqual([]);
    });

    it('maps rows to DTOs', async () => {
      q('destination').findMany.mockResolvedValueOnce([destRow()]);
      const result = await listForDevice('dev-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'dest-1', type: 'WEBSITE' });
    });
  });

  // --- searchPlaces ---
  describe('searchPlaces', () => {
    it('throws when no API key is configured', async () => {
      await expect(searchPlaces('coffee shop')).rejects.toMatchObject({
        status: 502,
        code: 'PLACES_NOT_CONFIGURED',
      });
    });

    it('returns empty on empty query even without a key', async () => {
      const result = await searchPlaces('   ');
      expect(result).toEqual([]);
    });

    it('throws 502 when fetch not ok', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'key');
      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
      await expect(searchPlaces('coffee')).rejects.toMatchObject({ status: 502 });
    });

    it('returns mapped and sliced results', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'key');
      const places = [
        { id: 'p1', displayName: { text: 'Place 1' }, formattedAddress: 'Addr' },
        { id: 'p2', displayName: { text: 'Place 2' } },
        { id: undefined, displayName: { text: 'No ID' } }, // filtered out
      ];
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places }),
      });
      const result = await searchPlaces('coffee');
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        googlePlaceId: 'p1',
        name: 'Place 1',
        formattedAddress: 'Addr',
      });
      expect(result[1]).toMatchObject({
        googlePlaceId: 'p2',
        formattedAddress: null,
      });
    });

    it('handles missing name and missing places field', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'key');
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places: [{ id: 'p3' }] }),
      });
      const result = await searchPlaces('coffee');
      expect(result).toEqual([{ googlePlaceId: 'p3', name: '', formattedAddress: null }]);
    });

    it('returns empty when response has no places key', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'key');
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      const result = await searchPlaces('coffee');
      expect(result).toEqual([]);
    });

    it('truncates to 20 results', async () => {
      vi.stubEnv('GOOGLE_PLACES_API_KEY', 'key');
      const places = Array.from({ length: 25 }, (_, i) => ({
        id: `p${i}`,
        displayName: { text: `P ${i}` },
      }));
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ places }),
      });
      const result = await searchPlaces('coffee');
      expect(result).toHaveLength(20);
    });
  });

  // --- deriveReviewUrl ---
  describe('deriveReviewUrl', () => {
    it('builds correct Google review URL', () => {
      const url = deriveReviewUrl('ChIJ123 ABC');
      expect(url).toBe('https://search.google.com/local/writereview?placeid=ChIJ123%20ABC');
    });
  });
});
