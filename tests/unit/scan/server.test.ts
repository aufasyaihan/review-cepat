import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  insertValues: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/db', () => ({
  getDb: () => ({ insert: () => ({ values: dbMocks.insertValues }) }),
}));

vi.mock('@/domains/device/server/service', () => ({
  getBySlug: vi.fn(),
}));

import { getBySlug } from '@/domains/device/server/service';
import type { DeviceDetail } from '@/domains/device/types';
import { SCAN_OUTCOMES, SCAN_SOURCES } from '@/domains/scan/constants';
import type { RecordScanInput } from '@/domains/scan/server/service';
import { recordScan, resolveForSlug } from '@/domains/scan/server/service';

const getBySlugMock = () => vi.mocked(getBySlug);
const insertValues = () => dbMocks.insertValues;

const baseInput: RecordScanInput = {
  deviceId: 'd1',
  destinationId: null,
  outcome: 'REDIRECTED',
  browser: null,
  deviceType: null,
  country: null,
  city: null,
  referrer: null,
  source: 'nfc',
  userAgent: null,
  ipHash: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordScan', () => {
  it('inserts a scan event with uuid id and now timestamp', async () => {
    await recordScan(baseInput);

    expect(insertValues()).toHaveBeenCalledOnce();
    const values = insertValues().mock.calls[0][0];
    expect(typeof values.id).toBe('string');
    expect(values.id).toHaveLength(36);
    expect(values.createdAt).toBeInstanceOf(Date);
    expect(values.referrer).toBeNull();
    expect(values.userAgent).toBeNull();
    expect(values.source).toBe('nfc');
  });

  it('slices over-long referrer to 300 and userAgent to 1000', async () => {
    await recordScan({
      ...baseInput,
      referrer: 'r'.repeat(500),
      userAgent: 'u'.repeat(1500),
    });

    const values = insertValues().mock.calls[0][0];
    expect(values.referrer).toBe('r'.repeat(300));
    expect(values.userAgent).toBe('u'.repeat(1000));
  });
});

describe('resolveForSlug', () => {
  const device: DeviceDetail = {
    id: 'd1',
    slug: 'abc',
    name: 'Merchant',
    status: 'PUBLISHED',
    createdAt: '2024-01-01',
    destinations: [
      {
        id: 'x',
        type: 'link',
        label: 'X',
        url: 'https://x.com',
        placeId: null,
        position: 0,
        active: true,
      },
    ],
  };

  it('delegates to getBySlug and returns same outcome/payload', async () => {
    getBySlugMock().mockResolvedValueOnce(device);

    const result = await resolveForSlug('abc');

    expect(getBySlugMock()).toHaveBeenCalledWith('abc');
    expect(result.device).toEqual(device);
    expect(result.outcome).toBe('REDIRECTED');
    expect(result.payload).toEqual({
      slug: 'abc',
      name: 'Merchant',
      outcome: 'REDIRECTED',
      links: [{ id: 'x', type: 'link', label: 'X', url: 'https://x.com' }],
    });
  });

  it('returns NOT_FOUND when getBySlug resolves null', async () => {
    getBySlugMock().mockResolvedValueOnce(null);

    const result = await resolveForSlug('nope');

    expect(result.device).toBeNull();
    expect(result.outcome).toBe('NOT_FOUND');
    expect(result.payload).toEqual({ slug: '', name: '', outcome: 'NOT_FOUND', links: [] });
  });
});

describe('scan constants', () => {
  it('exposes scan outcomes and sources', () => {
    expect(SCAN_OUTCOMES).toEqual(['REDIRECTED', 'LANDING_SHOWN', 'INACTIVE', 'NOT_FOUND']);
    expect(SCAN_SOURCES).toEqual(['nfc', 'qr', 'link']);
  });
});
