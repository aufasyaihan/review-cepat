import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { removeMember: vi.fn() } } }));
vi.mock('@/lib/session', () => ({ requireApiPermission: vi.fn() }));
vi.mock('@/domains/merchant/server/service', () => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deactivateUser: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import {
  createUserAction,
  deleteUserAction,
  updateUserAction,
} from '@/domains/merchant/server/member-actions';
import { createUser, deactivateUser, updateUser } from '@/domains/merchant/server/service';
import { requireApiPermission } from '@/lib/session';

const validInput = {
  name: 'New User',
  email: 'new@acme.io',
  password: 'password123',
  organizationId: 'org-1',
  role: 'member',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createUserAction (admin-only, no email invitation)', () => {
  it('rejects non-admin callers', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('admin');
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    const result = await createUserAction({ ...validInput, email: 'not-an-email' });
    expect(result.ok).toBe(false);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the user, returns the new id, and revalidates', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(createUser).mockResolvedValue({ id: 'm-new' } as never);
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(true);
    expect(createUser).toHaveBeenCalledWith(validInput);
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
    if (result.ok) expect(result.data).toEqual({ id: 'm-new' });
  });

  it('maps service failures to a friendly message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(createUser).mockRejectedValue(new Error('An account with this email already exists'));
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already exists');
  });

  it('maps non-Error service failures to a generic message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(createUser).mockRejectedValue('boom');
    const result = await createUserAction(validInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Could not add user');
  });
});

describe('updateUserAction (admin-only)', () => {
  it('rejects non-admin callers', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await updateUserAction({ memberId: 'm1', name: 'X' });
    expect(result.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    const result = await updateUserAction({ memberId: 'm1', name: '   ' });
    expect(result.ok).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates and revalidates user-management and devices', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(updateUser).mockResolvedValue({} as never);
    const result = await updateUserAction({ memberId: 'm1', name: 'Renamed' });
    expect(result.ok).toBe(true);
    expect(updateUser).toHaveBeenCalledWith({ memberId: 'm1', name: 'Renamed' });
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
    expect(revalidatePath).toHaveBeenCalledWith('/devices');
  });

  it('maps service failures to a friendly message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(updateUser).mockRejectedValue(new Error('This is the only owner'));
    const result = await updateUserAction({ memberId: 'm1', role: 'member' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('only owner');
  });
});

describe('deleteUserAction (admin-only)', () => {
  it('rejects non-admin callers', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'MERCHANT' } as never);
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(false);
    expect(deactivateUser).not.toHaveBeenCalled();
  });

  it('deactivates the account, removing membership and revoking sessions', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(deactivateUser).mockResolvedValue(undefined);
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(true);
    expect(deactivateUser).toHaveBeenCalledWith('m1');
    expect(revalidatePath).toHaveBeenCalledWith('/user-management');
    expect(revalidatePath).toHaveBeenCalledWith('/devices');
  });

  it('maps service failures to a friendly message', async () => {
    vi.mocked(requireApiPermission).mockResolvedValue({ id: 'u1', role: 'ADMIN' } as never);
    vi.mocked(deactivateUser).mockRejectedValue(
      new Error('This is the only owner of the merchant'),
    );
    const result = await deleteUserAction('m1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('only owner');
  });
});
