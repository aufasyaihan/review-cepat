import { describe, expect, it } from 'vitest';

import { destinationInputSchema, setDestinationsSchema } from '@/domains/destination/schemas';

describe('destination schemas (data-model constraints)', () => {
  it('accepts a WEBSITE destination with a valid absolute URL', () => {
    const result = setDestinationsSchema.safeParse({
      destinations: [{ type: 'WEBSITE', url: 'https://example.com', position: 0, active: true }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a WEBSITE destination without a URL', () => {
    const result = destinationInputSchema.safeParse({ type: 'WEBSITE', position: 0, active: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('url'))).toBe(true);
    }
  });

  it('rejects an invalid URL', () => {
    const result = destinationInputSchema.safeParse({
      type: 'WEBSITE',
      url: 'not-a-url',
      position: 0,
    });
    expect(result.success).toBe(false);
  });

  it('GOOGLE_REVIEW requires a placeId (url is derived server-side)', () => {
    const withoutPlace = destinationInputSchema.safeParse({ type: 'GOOGLE_REVIEW', position: 0 });
    expect(withoutPlace.success).toBe(false);
    const withPlace = destinationInputSchema.safeParse({
      type: 'GOOGLE_REVIEW',
      placeId: 'ChIJ0000',
      position: 0,
    });
    expect(withPlace.success).toBe(true);
  });

  it('rejects duplicate positions (must be unique and contiguous from 0)', () => {
    const result = setDestinationsSchema.safeParse({
      destinations: [
        { type: 'WEBSITE', url: 'https://a.com', position: 0, active: true },
        { type: 'WEBSITE', url: 'https://b.com', position: 0, active: true },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('caps destinations at MAX (12)', () => {
    const destinations = Array.from({ length: 13 }, (_, i) => ({
      type: 'WEBSITE',
      url: `https://x${i}.com`,
      position: i,
    }));
    const result = setDestinationsSchema.safeParse({ destinations });
    expect(result.success).toBe(false);
  });
});
