import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived token proving a user passed claim-code validation for a device,
 * carried from `/{slug}/setup` to `/{slug}/setup/redirect` so the destination
 * editor cannot be used without first proving knowledge of the claim code.
 *
 * Format: base64url("{deviceId}.{issuedAtMs}")."{hex hmac of that payload}"
 * The HMAC key comes from SETUP_TOKEN_SECRET (falling back to BETTER_AUTH_SECRET).
 */

const TTL_MS = 10 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 60_000;

function secret(): string {
  const key = process.env.SETUP_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!key) throw new Error('SETUP_TOKEN_SECRET (or BETTER_AUTH_SECRET) is required');
  return key;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex');
}

export function issueSetupToken(
  deviceId: string,
  now: number = Date.now(),
  key: string = secret(),
): string {
  const payload = `${deviceId}.${now}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload, key)}`;
}

export function verifySetupToken(
  token: string,
  deviceId: string,
  now: number = Date.now(),
  key: string = secret(),
): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const [id, issuedAtRaw] = payload.split('.');
    if (id !== deviceId) return false;
    const issuedAt = Number(issuedAtRaw);
    if (!Number.isFinite(issuedAt)) return false;
    if (now - issuedAt > TTL_MS || issuedAt > now + MAX_CLOCK_SKEW_MS) return false;
    const expected = sign(payload, key);
    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
