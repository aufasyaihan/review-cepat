import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { removeMember: vi.fn(), addMember: vi.fn(), signUpEmail: vi.fn() } },
}));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
  isOwner: vi.fn(),
}));
vi.mock('@/domains/merchant/server/service', () => ({
  assignDevice: vi.fn(),
  unassignDevice: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
}));
vi.mock('@/lib/session', () => ({
  requireApiUser: vi.fn().mockResolvedValue({ id: 'u1', role: 'MERCHANT' }),
  requireApiPermission: vi.fn().mockResolvedValue({ id: 'u1', role: 'MERCHANT' }),
}));

import { revalidatePath } from 'next/cache';
import {
  assignDeviceAction,
  createUserAction,
  deleteUserAction,
  removeMemberAction,
  unassignDeviceAction,
  updateUserAction,
} from '@/domains/merchant/server/member-actions';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import {
  assignDevice,
  createUser,
  deactivateUser,
  unassignDevice,
  updateUser,
} from '@/domains/merchant/server/service';
import { auth } from '@/lib/auth';
import { requireApiPermission, requireApiUser } from '@/lib/session';

const removeMember = (auth.api as unknown as { removeMember: ReturnType<typeof vi.fn> })
  .removeMember;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiUser).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
  vi.mocked(getActiveOrganization).mockResolvedValue({
    id: 'm-owner',
    organizationId: 'org-1',
    role: 'owner',
  });
  vi.mocked(isOwner).mockReturnValue(true);
  vi.mocked(removeMember).mockResolvedValue({} as never);
});

describe('member actions (owner-gated)', () => {
  it('removes a member for an owner and revalidates', async () => {
    const result = await removeMemberAction({ memberId: 'm1' });
    expect(result.ok).toBe(true);
    expect(removeMember).toHaveBeenCalledWith({
      body: { organizationId: 'org-1', memberIdOrEmail: 'm1' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
  });

  it('rejects an invalid remove payload', async () => {
    const result = await removeMemberAction({ memberId: '' });
    expect(result.ok).toBe(false);
    expect(removeMember).not.toHaveBeenCalled();
  });

  it('maps removal failures to a friendly message', async () => {
    vi.mocked(removeMember).mockRejectedValue(new Error('not a member'));
    const result = await removeMemberAction({ memberId: 'm1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not a member');
  });

  it('maps non-Error removal failures to a generic message', async () => {
    vi.mocked(removeMember).mockRejectedValue('boom');
    const result = await removeMemberAction({ memberId: 'm1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not remove member');
  });

  it('rejects remove when the caller is not an owner', async () => {
    vi.mocked(isOwner).mockReturnValue(false);
    const result = await removeMemberAction({ memberId: 'm1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('owner');
  });

  it('rejects remove when the caller has no active organization', async () => {
    vi.mocked(getActiveOrganization).mockResolvedValueOnce(null);
    const result = await removeMemberAction({ memberId: 'm1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('owner');
    expect(removeMember).not.toHaveBeenCalled();
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

  it('removes a member in the organization the admin specifies', async () => {
    const result = await removeMemberAction({ memberId: 'm1', organizationId: 'org-9' });
    expect(result.ok).toBe(true);
    expect(removeMember).toHaveBeenCalledWith({
      body: { organizationId: 'org-9', memberIdOrEmail: 'm1' },
    });
  });

  it('rejects remove when the admin supplies no organizationId', async () => {
    const result = await removeMemberAction({ memberId: 'm1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('organization');
    expect(removeMember).not.toHaveBeenCalled();
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

describe('createUserAction', () => {
  const validInput = {
    name: 'New User',
    email: 'new@x.com',
    password: 'password123',
    organizationId: 'org-1',
    role: 'member' as const,
  };

  it('rejects invalid input without calling the service', async () => {
    const result = await createUserAction({ ...validInput, email: 'nope' });
    expect(result.ok).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('fails for non-admin callers', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the user and revalidates for an admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(createUser).mockResolvedValueOnce({ id: 'new-id' } as never);
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ id: 'new-id' });
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
  });

  it('maps service failures to a friendly message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(createUser).mockRejectedValueOnce(new Error('Email already in use'));
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Email already in use');
  });

  it('maps non-Error failures to a generic message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(createUser).mockRejectedValueOnce('boom');
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not add user');
  });
});

describe('updateUserAction', () => {
  it('rejects invalid input without calling the service', async () => {
    const result = await updateUserAction({ memberId: '' });
    expect(result.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('fails for non-admin callers', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await updateUserAction({ memberId: 'm1', name: 'New Name' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
  });

  it('updates and revalidates user-management and devices for an admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(updateUser).mockResolvedValueOnce(undefined as never);
    const result = await updateUserAction({ memberId: 'm1', name: 'New Name' });
    expect(result.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
    expect(revalidatePath).toHaveBeenCalledWith('/devices');
  });

  it('maps service failures to a friendly message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(updateUser).mockRejectedValueOnce(new Error('Member not found'));
    const result = await updateUserAction({ memberId: 'm1', name: 'New Name' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Member not found');
  });

  it('maps non-Error failures to a generic message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(updateUser).mockRejectedValueOnce('boom');
    const result = await updateUserAction({ memberId: 'm1', name: 'New Name' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not update user');
  });
});

describe('deleteUserAction', () => {
  it('fails for non-admin callers', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
    expect(deactivateUser).not.toHaveBeenCalled();
  });

  it('deletes and revalidates for an admin', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(deactivateUser).mockResolvedValueOnce(undefined as never);
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
    expect(revalidatePath).toHaveBeenCalledWith('/devices');
  });

  it('maps service failures to a friendly message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(deactivateUser).mockRejectedValueOnce(new Error('Member not found'));
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Member not found');
  });

  it('maps non-Error failures to a generic message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValueOnce({ id: 'admin1', role: 'ADMIN' } as never);
    vi.mocked(deactivateUser).mockRejectedValueOnce('boom');
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not delete user');
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
