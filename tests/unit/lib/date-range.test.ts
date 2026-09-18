import { describe, expect, it } from 'vitest';
import { parseDateRangeQuery } from '@/lib/date-range';

const base = 'http://localhost:3000';

describe('parseDateRangeQuery (FR-044 date validation)', () => {
  it('parses a valid from/to pair into inclusive dates', () => {
    const result = parseDateRangeQuery(
      `${base}/api/analytics/overview?from=2025-06-01&to=2025-06-30`,
    );
    expect(result.from.getTime()).toBe(new Date('2025-06-01').getTime());
    expect(result.to.getTime()).toBe(new Date('2025-06-30').getTime());
  });

  it('accepts full ISO datetime values', () => {
    const result = parseDateRangeQuery(
      `${base}/api/analytics/overview?from=2025-06-01T00:00:00.000Z&to=2025-06-30T23:59:59.999Z`,
    );
    expect(result.from.toISOString()).toBe('2025-06-01T00:00:00.000Z');
  });

  it('rejects when either end is missing', () => {
    expect(() => parseDateRangeQuery(`${base}/api/analytics/overview?from=2025-06-01`)).toThrow(
      /required/,
    );
    expect(() => parseDateRangeQuery(`${base}/api/analytics/overview?to=2025-06-30`)).toThrow(
      /required/,
    );
  });

  it('rejects malformed dates', () => {
    expect(() =>
      parseDateRangeQuery(`${base}/api/analytics/overview?from=not-a-date&to=2025-06-30`),
    ).toThrow(/Invalid date/);
  });

  it('rejects from > to', () => {
    expect(() =>
      parseDateRangeQuery(`${base}/api/analytics/overview?from=2025-08-01&to=2025-06-30`),
    ).toThrow(/must be on or before/);
  });
});
