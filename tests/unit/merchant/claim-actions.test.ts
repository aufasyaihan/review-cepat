import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/domains/merchant/server/service', () => ({
  claimWithCode: vi.fn(),
  registerWithClaimCode: vi.fn(),
}));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  requireApiUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'MERCHANT' }),
}));

import { revalidatePath } from 'next/cache';
import {
  claimWithCodeAction,
  signUpWithClaimCodeAction,
} from '@/domains/merchant/server/claim-actions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { claimWithCode, registerWithClaimCode } from '@/domains/merchant/server/service';

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
  it('signUpWithClaimCodeAction rejects invalid registration details', async () => {
    const result = await signUpWithClaimCodeAction({
      name: '',
      email: 'nope',
      password: 'short',
      claimCode: 'AB',
    });
    expect(result.ok).toBe(false);
    expect(registerWithClaimCode).not.toHaveBeenCalled();
  });

  it('signUpWithClaimCodeAction delegates a valid registration', async () => {
    vi.mocked(registerWithClaimCode).mockResolvedValue({
      role: 'MERCHANT',
      deviceId: 'dev-1',
      slug: 's',
    } as never);
    const result = await signUpWithClaimCodeAction({
      name: 'Sub',
      email: 'sub@x.com',
      password: 'password123',
      claimCode: 'ABC12345',
    });
    expect(result.ok).toBe(true);
  });

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

  it('signUpWithClaimCodeAction maps service failures', async () => {
    vi.mocked(registerWithClaimCode).mockRejectedValue(new Error('already linked to an account'));
    const result = await signUpWithClaimCodeAction({
      name: 'Sub',
      email: 'sub@x.com',
      password: 'password123',
      claimCode: 'ABC12345',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already linked');
  });

  it('signUpWithClaimCodeAction maps non-Error throwables to a generic message', async () => {
    vi.mocked(registerWithClaimCode).mockRejectedValue('boom');
    const result = await signUpWithClaimCodeAction({
      name: 'Sub',
      email: 'sub@x.com',
      password: 'password123',
      claimCode: 'ABC12345',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not register with this claim code');
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
