import { describe, expect, it } from 'vitest';

import { generateClaimCode, hashClaimCode, isValidSlug, randomSlug } from '@/lib/codes';

describe('lib/codes', () => {
  it('generates valid public slugs (lowercase alnum, 6–32 chars)', () => {
    for (let i = 0; i < 20; i++) {
      const slug = randomSlug(10);
      expect(slug).toHaveLength(10);
      expect(isValidSlug(slug)).toBe(true);
    }
  });

  it('rejects malformed slugs', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('abc')).toBe(false); // too short
    expect(isValidSlug('ABC-123')).toBe(false); // uppercase
    expect(isValidSlug('has space')).toBe(false);
  });

  it('generates claim codes from an unguessable alphabet', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateClaimCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
      expect(code).not.toContain('O');
      expect(code).not.toContain('I');
    }
  });

  it('hashes claim codes deterministically (only hash is stored)', () => {
    const hash = hashClaimCode('ABC12345');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashClaimCode('ABC12345')).toBe(hash);
    expect(hashClaimCode('XYZ99999')).not.toBe(hash);
  });
});
