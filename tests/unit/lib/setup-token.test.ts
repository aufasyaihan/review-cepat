import { describe, expect, it } from 'vitest';

import { issueSetupToken, resolveSetupToken, verifySetupToken } from '@/lib/setup-token';

const KEY = 'test-secret';

describe('setup-token', () => {
  it('verifies a freshly issued token for the same device', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    expect(verifySetupToken(token, 'dev-1', 5_000, KEY)).toBe(true);
  });

  it('rejects a token for a different device id', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    expect(verifySetupToken(token, 'dev-2', 5_000, KEY)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(verifySetupToken(tampered, 'dev-1', 5_000, KEY)).toBe(false);
  });

  it('rejects an expired token beyond the 10-minute window', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    expect(verifySetupToken(token, 'dev-1', 1_000 + 10 * 60 * 1000 + 1, KEY)).toBe(false);
  });

  it('accepts a token within the 10-minute window', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    expect(verifySetupToken(token, 'dev-1', 1_000 + 9 * 60 * 1000, KEY)).toBe(true);
  });

  it('rejects a token signed with a different key', () => {
    const token = issueSetupToken('dev-1', 1_000, 'other-secret');
    expect(verifySetupToken(token, 'dev-1', 5_000, KEY)).toBe(false);
  });

  it('rejects future-dated tokens beyond clock skew', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    expect(verifySetupToken(token, 'dev-1', 1_000 - 60_001, KEY)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    expect(verifySetupToken('', 'dev-1', 5_000, KEY)).toBe(false);
    expect(verifySetupToken('no-dots-here', 'dev-1', 5_000, KEY)).toBe(false);
    expect(verifySetupToken('a.b.c', 'dev-1', 5_000, KEY)).toBe(false);
  });

  it('rejects a signature of a different length (timing-safe guard)', () => {
    const token = issueSetupToken('dev-1', 1_000, KEY);
    const short = token.slice(0, -2);
    expect(verifySetupToken(short, 'dev-1', 5_000, KEY)).toBe(false);
  });

  it('rejects a non-numeric issued-at timestamp', () => {
    const raw = Buffer.from('dev-1.notanumber').toString('base64url');
    const sig = 'x'.repeat(64);
    expect(verifySetupToken(`${raw}.${sig}`, 'dev-1', 5_000, KEY)).toBe(false);
  });

  it('raises when no signing secret is configured', () => {
    const prev = process.env.BETTER_AUTH_SECRET;
    const prevSet = process.env.SETUP_TOKEN_SECRET;
    delete process.env.SETUP_TOKEN_SECRET;
    delete process.env.BETTER_AUTH_SECRET;
    expect(() => issueSetupToken('dev-1', 1_000)).toThrow('required');
    if (prevSet) process.env.SETUP_TOKEN_SECRET = prevSet;
    else delete process.env.SETUP_TOKEN_SECRET;
    if (prev) process.env.BETTER_AUTH_SECRET = prev;
    else delete process.env.BETTER_AUTH_SECRET;
  });

  it('falls back to the configured env secret when no key is passed', () => {
    const prevSet = process.env.SETUP_TOKEN_SECRET;
    process.env.SETUP_TOKEN_SECRET = 'env-secret';
    const token = issueSetupToken('dev-1', 1_000);
    expect(verifySetupToken(token, 'dev-1', 5_000)).toBe(true);
    if (prevSet) process.env.SETUP_TOKEN_SECRET = prevSet;
    else delete process.env.SETUP_TOKEN_SECRET;
  });

  it('rejects a token that is not a string without throwing', () => {
    expect(verifySetupToken(null as never, 'dev-1', 5_000, KEY)).toBe(false);
  });
});

describe('resolveSetupToken', () => {
  const KEY = 'test-secret';
  const NOW = 1_700_000_000_000;

  it('returns the device id for a valid token', () => {
    const token = issueSetupToken('device-1', NOW, KEY);
    expect(resolveSetupToken(token, NOW + 1000, KEY)).toBe('device-1');
  });

  it('returns null once the token expires', () => {
    const token = issueSetupToken('device-1', NOW, KEY);
    expect(resolveSetupToken(token, NOW + 11 * 60 * 1000, KEY)).toBeNull();
  });

  it('returns null when the signature is tampered', () => {
    const token = issueSetupToken('device-1', NOW, KEY);
    const [payload] = token.split('.');
    expect(resolveSetupToken(`${payload}.deadbeef`, NOW + 1000, KEY)).toBeNull();
  });

  it('returns null for a malformed token', () => {
    expect(resolveSetupToken('not-a-token', NOW, KEY)).toBeNull();
    expect(resolveSetupToken('', NOW, KEY)).toBeNull();
  });
});
