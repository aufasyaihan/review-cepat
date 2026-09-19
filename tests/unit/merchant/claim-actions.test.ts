import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/domains/merchant/server/service', () => ({
  claimWithCode: vi.fn(),
}));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  requireApiUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'MERCHANT' }),
}));

import { revalidatePath } from 'next/cache';
import { claimWithCodeAction } from '@/domains/merchant/server/claim-actions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { claimWithCode } from '@/domains/merchant/server/service';

const summary = { id: 'dev-1', slug: 's', name: 'D', status: 'CLAIMED', createdAt: 'x' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getActiveOrganization).mockResolvedValue({
    id: 'm1',
    organizationId: 'org-1',
    role: 'member',
  });
});

describe('claim actions', () => {
  it('claimWithCodeAction fails when the user has no organization', async () => {
    vi.mocked(getActiveOrganization).mockResolvedValue(null);
    const result = await claimWithCodeAction('ABC12345');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('organization');
  });

  it('claimWithCodeAction claims through the service for a member', async () => {
    vi.mocked(claimWithCode).mockResolvedValue(summary as never);
    const result = await claimWithCodeAction('ABC12345');
    expect(result.ok).toBe(true);
    expect(claimWithCode).toHaveBeenCalledWith(
      'u1',
      { id: 'm1', organizationId: 'org-1', role: 'member' },
      'ABC12345',
    );
    expect(revalidatePath).toHaveBeenCalledWith('/devices');
  });

  it('claimWithCodeAction maps service failures', async () => {
    vi.mocked(claimWithCode).mockRejectedValue('boom');
    const result = await claimWithCodeAction('ABC12345');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not claim this device');
  });

  it('claimWithCodeAction maps thrown Error messages', async () => {
    vi.mocked(claimWithCode).mockRejectedValue(new Error('Already claimed'));
    const result = await claimWithCodeAction('ABC12345');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Already claimed');
  });
});
