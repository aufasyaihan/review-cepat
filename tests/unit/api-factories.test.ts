import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
});

function okJson(data: unknown) {
  return { ok: true, status: 200, json: async () => data };
}

import { adminMutations, adminQueries } from '@/domains/admin/api/queries';
import { analyticsQueries } from '@/domains/analytics/api/queries';
import { authQueries } from '@/domains/auth/api/queries';
import { destinationMutations, destinationQueries } from '@/domains/destination/api/mutations';
import { deviceMutations } from '@/domains/device/api/mutations';
import { deviceQueries } from '@/domains/device/api/queries';
import { merchantMutations } from '@/domains/merchant/api/mutations';
import {
  adminMerchantListQuery,
  adminUserListQuery,
  memberQueries,
  merchantQueries,
} from '@/domains/merchant/api/queries';
import { scanQueries } from '@/domains/scan/api/queries';

type Call = [string, RequestInit];

describe('api factories', () => {
  describe('merchantQueries.profile', () => {
    it('issues GET /api/merchant/profile', async () => {
      const { queryFn } = merchantQueries.profile();
      fetchMock.mockResolvedValueOnce(okJson(null));
      const result = await queryFn();
      expect(result).toBeNull();
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/merchant/profile');
      expect(init.method).toBe('GET');
    });
  });

  describe('merchantMutations.profile', () => {
    it('issues POST with body', async () => {
      const { mutationFn } = merchantMutations.profile();
      fetchMock.mockResolvedValueOnce(okJson({ id: 1 }));
      await mutationFn({ businessName: 'X' } as never);
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/merchant/profile');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ businessName: 'X' }));
    });
  });

  describe('adminQueries', () => {
    it('devices: GET /api/admin/devices', async () => {
      const { queryFn } = adminQueries.devices();
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/admin/devices');
    });

    it('merchants: GET /api/admin/merchants', async () => {
      const { queryFn } = adminQueries.merchants();
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/admin/merchants');
    });
  });

  describe('adminMutations', () => {
    it('create: POST /api/admin/devices with name', async () => {
      const { mutationFn } = adminMutations.create();
      fetchMock.mockResolvedValueOnce(okJson({ device: {}, claimCode: 'X' }));
      await mutationFn('Widget');
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/admin/devices');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ name: 'Widget' }));
    });

    it('disable: POST /api/admin/devices/:id/disable', async () => {
      const { mutationFn } = adminMutations.disable('d1');
      fetchMock.mockResolvedValueOnce(okJson({}));
      await mutationFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/admin/devices/d1/disable');
    });

    it('enable: POST /api/admin/devices/:id/enable', async () => {
      const { mutationFn } = adminMutations.enable('d1');
      fetchMock.mockResolvedValueOnce(okJson({}));
      await mutationFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/admin/devices/d1/enable');
    });
  });

  describe('analyticsQueries.overview', () => {
    it('issues GET /api/analytics/overview', async () => {
      const { queryFn } = analyticsQueries.overview();
      fetchMock.mockResolvedValueOnce(okJson({ totalScans: 0 }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/analytics/overview');
    });

    it('encodes a from/to range into the query key and query string', async () => {
      const range = {
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-02-01T00:00:00.000Z'),
      };
      const { queryKey, queryFn } = analyticsQueries.overview(range);
      expect(queryKey).toEqual([
        'analytics',
        'overview',
        `${range.from.toISOString()}-${range.to.toISOString()}`,
      ]);
      fetchMock.mockResolvedValueOnce(okJson({ totalScans: 0 }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toContain('from=');
      expect(url).toContain('to=');
    });

    it('uses queryKey "all" when the range is only partially set', () => {
      const { queryKey } = analyticsQueries.overview({ from: new Date() });
      expect(queryKey).toEqual(['analytics', 'overview', 'all']);
    });
  });

  describe('analyticsQueries.adminOverview', () => {
    it('issues GET /api/analytics/admin-overview', async () => {
      const { queryKey, queryFn } = analyticsQueries.adminOverview();
      expect(queryKey).toEqual(['analytics', 'admin-overview', 'all']);
      fetchMock.mockResolvedValueOnce(okJson({ totalScans: 0 }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/analytics/admin-overview');
    });
  });

  describe('analyticsQueries.breakdown', () => {
    it('issues GET /api/analytics/breakdown with deviceId + dimension', async () => {
      const { queryKey, queryFn } = analyticsQueries.breakdown('dev-1', 'referrer');
      expect(queryKey).toEqual(['analytics', 'breakdown', 'dev-1', 'referrer']);
      fetchMock.mockResolvedValueOnce(okJson({ rows: [] }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/analytics/breakdown?deviceId=dev-1&dimension=referrer');
    });
  });

  describe('authQueries', () => {
    it('permissions: GET /api/permissions', async () => {
      const { queryKey, queryFn } = authQueries.permissions();
      expect(queryKey).toEqual(['auth', 'permissions']);
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/permissions');
    });

    it('rolePermissions: GET /api/roles/:roleId/permissions', async () => {
      const { queryKey, queryFn } = authQueries.rolePermissions('role-1');
      expect(queryKey).toEqual(['auth', 'permissions', 'role-1']);
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/roles/role-1/permissions');
    });
  });

  describe('memberQueries.list', () => {
    it('issues GET /api/merchant/members', async () => {
      const { queryFn } = memberQueries.list();
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/merchant/members');
    });
  });

  describe('adminUserListQuery', () => {
    it('issues GET /api/members with query params', async () => {
      const { queryFn } = adminUserListQuery({ q: 'a', page: 2, limit: 10 });
      fetchMock.mockResolvedValueOnce(okJson({ rows: [], total: 0, page: 2, limit: 10 }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/members?q=a&page=2&limit=10');
    });
  });

  describe('adminMerchantListQuery', () => {
    it('issues GET /api/organizations with query params', async () => {
      const { queryFn } = adminMerchantListQuery({ q: 'b', page: 1, limit: 5 });
      fetchMock.mockResolvedValueOnce(okJson({ rows: [], total: 0, page: 1, limit: 5 }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/organizations?q=b&page=1&limit=5');
    });
  });

  describe('scanQueries.landing', () => {
    it('issues GET /api/scan/:slug', async () => {
      const { queryFn } = scanQueries.landing('abc');
      fetchMock.mockResolvedValueOnce(okJson({ slug: 'abc' }));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/scan/abc');
    });
  });

  describe('destinationQueries.places', () => {
    it('issues GET with setQuery({query})', async () => {
      const { queryFn } = destinationQueries.places('cafe');
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/destination/places?query=cafe');
    });
  });

  describe('destinationMutations.setForDevice', () => {
    it('issues POST /api/device/:id/destinations', async () => {
      const { mutationFn } = destinationMutations.setForDevice('dev1');
      fetchMock.mockResolvedValueOnce(okJson([]));
      await mutationFn([{ destinationId: 1 }] as never);
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/dev1/destinations');
      expect(init.method).toBe('POST');
    });
  });

  describe('deviceQueries', () => {
    it('list: GET /api/device', async () => {
      const { queryFn } = deviceQueries.list();
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device');
    });

    it('detail: GET /api/device/:id', async () => {
      const { queryFn } = deviceQueries.detail('d1');
      fetchMock.mockResolvedValueOnce(okJson({}));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/d1');
    });

    it('list: forwards organizationId as a query param when provided', async () => {
      const { queryKey, queryFn } = deviceQueries.list('org-1');
      expect(queryKey).toEqual(['device', 'list', 'org-1']);
      fetchMock.mockResolvedValueOnce(okJson([]));
      await queryFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device?organizationId=org-1');
    });
  });

  describe('deviceMutations', () => {
    it('claim: POST /api/device/claim', async () => {
      const { mutationFn } = deviceMutations.claim();
      fetchMock.mockResolvedValueOnce(okJson({}));
      await mutationFn('CODE1');
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/claim');
      expect(init.body).toBe(JSON.stringify({ claimCode: 'CODE1' }));
    });

    it('publish: POST /api/device/:id/publish', async () => {
      const { mutationFn } = deviceMutations.publish('d1');
      fetchMock.mockResolvedValueOnce(okJson({}));
      await mutationFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/d1/publish');
    });

    it('unpublish: POST /api/device/:id/unpublish', async () => {
      const { mutationFn } = deviceMutations.unpublish('d1');
      fetchMock.mockResolvedValueOnce(okJson({}));
      await mutationFn();
      const [url] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/d1/unpublish');
    });

    it('setDestinations: POST /api/device/:id/destinations', async () => {
      const { mutationFn } = deviceMutations.setDestinations('d1');
      fetchMock.mockResolvedValueOnce(okJson([]));
      await mutationFn([{ destinationId: 1 }] as never);
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/d1/destinations');
      expect(init.method).toBe('POST');
    });

    it('transfer: POST /api/device/:id/transfer', async () => {
      const { mutationFn } = deviceMutations.transfer('d1');
      fetchMock.mockResolvedValueOnce(okJson({}));
      await mutationFn(99);
      const [url, init] = fetchMock.mock.calls[0] as Call;
      expect(url).toBe('/api/device/d1/transfer');
      expect(init.body).toBe(JSON.stringify({ toMerchantId: 99 }));
    });
  });
});
