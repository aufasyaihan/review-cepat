import { createHash, randomBytes } from 'node:crypto';

/**
 * Resource identity + one-time claim code helpers.
 * - slug: public URL path segment, lowercase alphanumeric + hyphen, 6–32 chars (data-model).
 * - claimCode: unguessable single-use code; only its SHA-256 hash is stored (data-model).
 */

const SLUG_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomSlug(length = 10): string {
  const bytes = randomBytes(length);
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += SLUG_CHARS[bytes[i] % SLUG_CHARS.length];
  }
  return slug;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{5,31}$/.test(slug);
}

export function generateClaimCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

export function hashClaimCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}
