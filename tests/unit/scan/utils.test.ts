import { describe, expect, it } from 'vitest';
import type { DeviceDetail } from '@/domains/device/types';
import { buildLandingPayload, resolveOutcome } from '@/domains/scan/utils';

function device(
  overrides: Partial<DeviceDetail> & { status: DeviceDetail['status'] },
): DeviceDetail {
  return {
    id: 'dev-1',
    slug: 'demo-tag',
    name: 'Demo',
    createdAt: '2026-09-13T00:00:00.000Z',
    organizationId: null,
    destinations: [],
    ...overrides,
  };
}

const singleLink: DeviceDetail['destinations'] = [
  {
    id: 'd1',
    type: 'WEBSITE',
    label: null,
    url: 'https://example.com',
    placeId: null,
    position: 0,
    active: true,
  },
];

const multiLink: DeviceDetail['destinations'] = [
  {
    id: 'd1',
    type: 'INSTAGRAM',
    label: null,
    url: 'https://instagram.com/x',
    placeId: null,
    position: 0,
    active: true,
  },
  {
    id: 'd2',
    type: 'FACEBOOK',
    label: null,
    url: 'https://facebook.com/x',
    placeId: null,
    position: 1,
    active: true,
  },
];

describe('scan resolution (contract public-scan.md)', () => {
  it('PUBLISHED + single active destination → REDIRECTED', () => {
    expect(resolveOutcome(device({ status: 'PUBLISHED', destinations: singleLink }))).toBe(
      'REDIRECTED',
    );
  });

  it('PUBLISHED + multiple active destinations → LANDING_SHOWN', () => {
    expect(resolveOutcome(device({ status: 'PUBLISHED', destinations: multiLink }))).toBe(
      'LANDING_SHOWN',
    );
  });

  it.each(['UNCLAIMED', 'CLAIMED', 'UNPUBLISHED', 'DISABLED'] as const)(
    '%s never forwards → INACTIVE',
    (status) => {
      expect(resolveOutcome(device({ status, destinations: singleLink }))).toBe('INACTIVE');
    },
  );

  it('PUBLISHED with no active destinations → INACTIVE', () => {
    expect(
      resolveOutcome(
        device({
          status: 'PUBLISHED',
          destinations: [
            {
              id: 'd1',
              type: 'WEBSITE',
              label: null,
              url: 'https://example.com',
              placeId: null,
              position: 0,
              active: false,
            },
          ],
        }),
      ),
    ).toBe('INACTIVE');
  });

  it('null device → NOT_FOUND', () => {
    expect(resolveOutcome(null)).toBe('NOT_FOUND');
  });

  it('buildLandingPayload returns only active, url-bearing links in order', () => {
    const payload = buildLandingPayload(device({ status: 'PUBLISHED', destinations: multiLink }));
    expect(payload.links.map((l) => l.type)).toEqual(['INSTAGRAM', 'FACEBOOK']);
  });

  it('buildLandingPayload masks a single-link redirect as REDIRECTED outcome data', () => {
    const payload = buildLandingPayload(device({ status: 'PUBLISHED', destinations: singleLink }));
    expect(payload.outcome).toBe('REDIRECTED');
  });
});
