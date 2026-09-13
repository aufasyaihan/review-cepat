import { describe, expect, it } from 'vitest';

import { generateClaimCode, hashClaimCode, hashIp, isValidSlug, randomSlug } from '@/lib/codes';

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

  it('hashIp produces a stable 64-hex sha256', () => {
    const h1 = hashIp('1.2.3.4');
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('1.2.3.4')).toBe(h1);
    expect(hashIp('5.6.7.8')).not.toBe(h1);
  });

  it('generateClaimCode only uses the CODE_CHARS alphabet', () => {
    expect(generateClaimCode()).toHaveLength(8);
    for (let i = 0; i < 50; i++) {
      const code = generateClaimCode();
      expect(code).toMatch(/^[A-Z2-9]+$/);
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('randomSlug produces lowercase alnum of requested length', () => {
    for (let i = 0; i < 20; i++) {
      const slug = randomSlug(10);
      expect(slug).toHaveLength(10);
      expect(slug).toMatch(/^[a-z0-9]+$/);
    }
  });
});
