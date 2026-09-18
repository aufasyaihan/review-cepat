import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/domains/device/server/service', () => ({
  claimAccountless: vi.fn(),
}));
vi.mock('@/lib/setup-token', () => ({
  issueSetupToken: vi.fn(() => 'tok-123'),
}));

import { claimAccountless } from '@/domains/device/server/service';
import { setupClaimCodeAction } from '@/domains/device/server/setup-actions';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('setupClaimCodeAction (US1 step 1)', () => {
  it('rejects an invalid claim-code format before calling the service', async () => {
    const result = await setupClaimCodeAction('slug-one', { claimCode: 'x!' });
    expect(result.ok).toBe(false);
    expect(claimAccountless).not.toHaveBeenCalled();
  });

  it('returns a redirect URL with the setup token on success', async () => {
    vi.mocked(claimAccountless).mockResolvedValue({
      id: 'dev-1',
      slug: 'slug-one',
      name: 'Device',
    } as never);
    const result = await setupClaimCodeAction('slug-one', { claimCode: 'ABCD1234' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectUrl).toBe('/s/slug-one/setup/redirect?t=tok-123');
  });

  it('maps claim failures to a friendly error', async () => {
    vi.mocked(claimAccountless).mockRejectedValue(new Error('Invalid claim code for this device'));
    const result = await setupClaimCodeAction('slug-one', { claimCode: 'ABCD1234' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Invalid claim code');
  });

  it('maps non-Error throwables to a generic message', async () => {
    vi.mocked(claimAccountless).mockRejectedValue('boom');
    const result = await setupClaimCodeAction('slug-one', { claimCode: 'ABCD1234' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Setup failed');
  });
});
