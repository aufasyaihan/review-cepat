import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { inviteMember: vi.fn(), addMember: vi.fn(), signUpEmail: vi.fn() } },
}));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: vi.fn(),
}));
vi.mock('@/domains/merchant/server/service', () => ({
  assignDevice: vi.fn(),
  unassignDevice: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  requireApiUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'MERCHANT' }),
  requireApiPermission: vi.fn().mockResolvedValue({ id: 'u1', role: 'MERCHANT' }),
}));

import { revalidatePath } from 'next/cache';
import {
  assignDeviceAction,
  inviteMemberAction,
  unassignDeviceAction,
} from '@/domains/merchant/server/member-actions';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { assignDevice, unassignDevice } from '@/domains/merchant/server/service';
import { auth } from '@/lib/auth';
import { requireApiPermission, requireApiUser } from '@/lib/session';

const inviteMember = (auth.api as unknown as { inviteMember: ReturnType<typeof vi.fn> })
  .inviteMember;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiUser).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
  vi.mocked(getActiveOrganization).mockResolvedValue({
    id: 'm-owner',
    organizationId: 'org-1',
    role: 'owner',
  });
  vi.mocked(isOwner).mockReturnValue(true);
  vi.mocked(inviteMember).mockResolvedValue({} as never);
});

describe('member actions (owner-gated)', () => {
  it('invites a sub-merchant for an owner and revalidates', async () => {
    const result = await inviteMemberAction({ email: 'new@x.com', role: 'member' });
    expect(result.ok).toBe(true);
    expect(inviteMember).toHaveBeenCalledWith({
      body: { email: 'new@x.com', role: 'member', organizationId: 'org-1' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
  });

  it('rejects an invalid invite payload', async () => {
    const result = await inviteMemberAction({ email: 'not-an-email', role: 'admin' });
    expect(result.ok).toBe(false);
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it('maps invitation failures to a friendly message', async () => {
    vi.mocked(inviteMember).mockRejectedValue(new Error('already invited'));
    const result = await inviteMemberAction({ email: 'new@x.com', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already invited');
  });

  it('maps non-Error invitation failures to a generic message', async () => {
    vi.mocked(inviteMember).mockRejectedValue('boom');
    const result = await inviteMemberAction({ email: 'new@x.com', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not send invitation');
  });

  it('rejects invite when the caller is not an owner', async () => {
    vi.mocked(isOwner).mockReturnValue(false);
    const result = await inviteMemberAction({ email: 'x@y.com', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('owner');
  });

  it('rejects invite when the caller has no active organization', async () => {
    vi.mocked(getActiveOrganization).mockResolvedValueOnce(null);
    const result = await inviteMemberAction({ email: 'x@y.com', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('owner');
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it('rejects assign when the caller is not an owner', async () => {
    vi.mocked(isOwner).mockReturnValue(false);
    const result = await assignDeviceAction('d1', 'm1');
    expect(result.ok).toBe(false);
  });

  it('assigns a device to a member for an owner', async () => {
    vi.mocked(assignDevice).mockResolvedValue(undefined as never);
    const result = await assignDeviceAction('d1', 'm1');
    expect(result.ok).toBe(true);
    expect(assignDevice).toHaveBeenCalledWith('d1', 'm1', 'org-1');
  });

  it('maps assign service errors', async () => {
    vi.mocked(assignDevice).mockRejectedValue(new Error('not found'));
    const result = await assignDeviceAction('d1', 'm1');
    expect(result.ok).toBe(false);
  });

  it('maps non-Error assign failures to a generic message', async () => {
    vi.mocked(assignDevice).mockRejectedValue('boom');
    const result = await assignDeviceAction('d1', 'm1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not assign device');
  });

  it('unassigns a device for an owner and revalidates', async () => {
    vi.mocked(unassignDevice).mockResolvedValue(undefined as never);
    const result = await unassignDeviceAction('d1');
    expect(result.ok).toBe(true);
  });

  it('rejects unassign when the caller is not an owner', async () => {
    vi.mocked(isOwner).mockReturnValue(false);
    const result = await unassignDeviceAction('d1');
    expect(result.ok).toBe(false);
    expect(unassignDevice).not.toHaveBeenCalled();
  });

  it('maps service errors to a friendly message on unassign', async () => {
    vi.mocked(unassignDevice).mockRejectedValue(new Error('Device not found in this organization'));
    const result = await unassignDeviceAction('d1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not found in this organization');
  });

  it('maps non-Error unassign failures to a generic message', async () => {
    vi.mocked(unassignDevice).mockRejectedValue('boom');
    const result = await unassignDeviceAction('d1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not unassign device');
  });
});

describe('member actions (admin)', () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'admin1', role: 'ADMIN' } as never);
  });

  it('invites into the organization the admin specifies', async () => {
    const result = await inviteMemberAction({
      email: 'new@x.com',
      role: 'member',
      organizationId: 'org-9',
    });
    expect(result.ok).toBe(true);
    expect(inviteMember).toHaveBeenCalledWith({
      body: { email: 'new@x.com', role: 'member', organizationId: 'org-9' },
    });
  });

  it('rejects invite when the admin supplies no organizationId', async () => {
    const result = await inviteMemberAction({ email: 'new@x.com', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('organization');
    expect(inviteMember).not.toHaveBeenCalled();
  });

  it('assigns a device in the organization the admin specifies', async () => {
    vi.mocked(assignDevice).mockResolvedValue(undefined as never);
    const result = await assignDeviceAction('d1', 'm1', 'org-9');
    expect(result.ok).toBe(true);
    expect(assignDevice).toHaveBeenCalledWith('d1', 'm1', 'org-9');
  });

  it('rejects assign when the admin supplies no organizationId', async () => {
    const result = await assignDeviceAction('d1', 'm1');
    expect(result.ok).toBe(false);
    expect(assignDevice).not.toHaveBeenCalled();
  });

  it('unassigns a device in the organization the admin specifies', async () => {
    vi.mocked(unassignDevice).mockResolvedValue(undefined as never);
    const result = await unassignDeviceAction('d1', 'org-9');
    expect(result.ok).toBe(true);
    expect(unassignDevice).toHaveBeenCalledWith('d1', 'org-9');
  });

  it('rejects unassign when the admin supplies no organizationId', async () => {
    const result = await unassignDeviceAction('d1');
    expect(result.ok).toBe(false);
    expect(unassignDevice).not.toHaveBeenCalled();
  });
});

describe('member actions (owner cannot spoof another org)', () => {
  beforeEach(() => {
    // The admin describe block above overrides requireApiPermission's
    // resolved value, and vi.clearAllMocks() (in the top-level beforeEach)
    // clears call history, not that implementation — so it must be reset
    // back to the MERCHANT owner here or this test would flakily inherit
    // whatever role ran last.
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
  });

  it("ignores a client-supplied organizationId and uses the caller's own org", async () => {
    vi.mocked(assignDevice).mockResolvedValue(undefined as never);
    const result = await assignDeviceAction('d1', 'm1', 'someone-elses-org');
    expect(result.ok).toBe(true);
    expect(assignDevice).toHaveBeenCalledWith('d1', 'm1', 'org-1');
  });
});
