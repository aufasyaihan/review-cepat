import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => {
  const deviceFindFirst = vi.fn().mockResolvedValue(null);
  const deviceFindMany = vi.fn().mockResolvedValue([]);
  const db = {
    query: {
      merchantProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 7, userId: 'user-1' }),
      },
      device: { findMany: deviceFindMany, findFirst: deviceFindFirst },
    },
  };
  return { getDb: () => db };
});

import { getDb } from '@/db';
import { breakdown, overview } from '@/domains/analytics/server/service';

type MockFn = ReturnType<typeof vi.fn>;
const dbQuery = {
  get device() {
    return (
      getDb() as ReturnType<typeof getDb> & {
        query: { device: { findFirst: MockFn; findMany: MockFn } };
      }
    ).query.device;
  },
  get merchantProfile() {
    return (
      getDb() as ReturnType<typeof getDb> & {
        query: { merchantProfile: { findFirst: MockFn } };
      }
    ).query.merchantProfile;
  },
};

describe('analytics domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbQuery.device.findFirst.mockResolvedValue(null);
    dbQuery.device.findMany.mockResolvedValue([]);
  });

  it('merchant with NO owned devices → zeroed overview', async () => {
    const result = await overview('user-1');
    expect(result).toEqual({ totalScans: 0, deviceScans: [], dailyScans: [] });
  });

  it('flags an unsupported breakdown dimension as 400', async () => {
    dbQuery.device.findFirst.mockResolvedValueOnce({ id: 'd1' });
    await expect(breakdown('user-1', 'd1', 'nope' as never)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects breakdown for a device the merchant does not own (404)', async () => {
    await expect(breakdown('user-1', 'foreign-device', 'browser')).rejects.toMatchObject({
      status: 404,
    });
  });
});
