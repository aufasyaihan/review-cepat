import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/setup-token', () => ({ resolveSetupToken: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));
vi.mock('@/domains/merchant/server/service', () => ({ resolvePostClaim: vi.fn() }));

import { linkDeviceAfterAuthAction } from '@/domains/device/server/link-actions';
import { resolvePostClaim } from '@/domains/merchant/server/service';
import { getSession } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';

beforeEach(() => vi.clearAllMocks());

describe('linkDeviceAfterAuthAction', () => {
  it('fails when there is no session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const result = await linkDeviceAfterAuthAction('tok');
    expect(result.ok).toBe(false);
  });

  it('fails silently-recoverable when the token is invalid or expired', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(resolveSetupToken).mockReturnValue(null);
    const result = await linkDeviceAfterAuthAction('bad-token');
    expect(result.ok).toBe(false);
    expect(resolvePostClaim).not.toHaveBeenCalled();
  });

  it('resolves the device id from the token and delegates to resolvePostClaim', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(resolveSetupToken).mockReturnValue('dev-1');
    vi.mocked(resolvePostClaim).mockResolvedValue({ redirectUrl: '/dashboard' });

    const result = await linkDeviceAfterAuthAction('good-token');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.redirectUrl).toBe('/dashboard');
    expect(resolvePostClaim).toHaveBeenCalledWith('dev-1', 'user-1');
  });
});
