import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error('REDIRECT:' + path);
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@/domains/merchant/server/service', () => ({
  getProfileByUserId: vi.fn(),
}));
vi.mock('@/domains/merchant/server/permissions', () => ({
  getActiveOrganization: vi.fn(),
}));

import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { getProfileByUserId } from '@/domains/merchant/server/service';
import { auth } from '@/lib/auth';
import {
  getSession,
  requireApiMembership,
  requireApiMerchant,
  requireApiUser,
  requireMembership,
  requireRole,
} from '@/lib/session';

const getSessionMock = vi.mocked(auth.api.getSession);
const getProfileMock = vi.mocked(getProfileByUserId);
const getOrgMock = vi.mocked(getActiveOrganization);

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

const sessionUser = (over: {
  id?: string;
  role?: string;
  email?: string;
  name?: string;
}): SessionResult =>
  ({
    user: { id: 'u1', role: 'MERCHANT', email: 'a@b.com', name: 'A', ...over },
  }) as unknown as SessionResult;

beforeEach(() => {
  vi.clearAllMocks();
  getProfileMock.mockReset();
});

describe('lib/session', () => {
  describe('getSession', () => {
    it('returns null when session has no user', async () => {
      getSessionMock.mockResolvedValueOnce(null);
      expect(await getSession()).toBeNull();
    });

    it('maps user fields with role defaulting to MERCHANT', async () => {
      getSessionMock.mockResolvedValueOnce({
        user: { id: 'u1', email: 'a@b.com', name: 'Alice' },
      } as unknown as SessionResult);
      const user = await getSession();
      expect(user).toEqual({
        id: 'u1',
        role: 'MERCHANT',
        email: 'a@b.com',
        name: 'Alice',
      });
    });

    it('uses role from session when present', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({ role: 'ADMIN' }));
      const user = await getSession();
      expect(user!.role).toBe('ADMIN');
    });
  });

  describe('requireRole', () => {
    it('redirects to /login when no session', async () => {
      getSessionMock.mockResolvedValueOnce(null);
      await expect(requireRole('MERCHANT')).rejects.toThrow('REDIRECT:/login');
    });

    it('returns user when role matches', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      const user = await requireRole('MERCHANT');
      expect(user.id).toBe('u1');
    });

    it('redirects to / when role does not match', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      await expect(requireRole('ADMIN')).rejects.toThrow('REDIRECT:/');
    });

    it('accepts an array of roles', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({ role: 'ADMIN' }));
      const user = await requireRole(['MERCHANT', 'ADMIN']);
      expect(user.role).toBe('ADMIN');
    });
  });

  describe('requireApiUser', () => {
    it('throws UnauthorizedError (401) when no session', async () => {
      getSessionMock.mockResolvedValueOnce(null);
      await expect(requireApiUser()).rejects.toMatchObject({ status: 401 });
    });

    it('throws ForbiddenError (403) when role not in list', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      await expect(requireApiUser(['ADMIN'])).rejects.toMatchObject({ status: 403 });
    });

    it('returns user on success', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({ role: 'ADMIN' }));
      const user = await requireApiUser(['ADMIN']);
      expect(user.id).toBe('u1');
    });
  });

  describe('requireApiMerchant', () => {
    it('throws 403 when non-MERCHANT calls it', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({ role: 'ADMIN' }));
      await expect(requireApiMerchant()).rejects.toMatchObject({ status: 403 });
    });

    it('throws ForbiddenError when no profile', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      getProfileMock.mockResolvedValueOnce(null);
      await expect(requireApiMerchant()).rejects.toMatchObject({
        status: 403,
        code: 'NO_PROFILE',
      });
    });

    it('returns user and merchantId on success', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      getProfileMock.mockResolvedValueOnce({ id: 42 } as never);
      const result = await requireApiMerchant();
      expect(result.user.id).toBe('u1');
      expect(result.merchantId).toBe(42);
    });
  });

  describe('requireApiMembership', () => {
    it('throws ForbiddenError when the user has no organization', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      getOrgMock.mockResolvedValueOnce(null);
      await expect(requireApiMembership()).rejects.toMatchObject({
        status: 403,
        code: 'NO_ORG',
      });
    });

    it('returns the active membership on success', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      getOrgMock.mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', role: 'owner' });
      const membership = await requireApiMembership();
      expect(membership.organizationId).toBe('org-1');
    });
  });

  describe('requireMembership', () => {
    it('redirects to /register when the merchant has no organization', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      getOrgMock.mockResolvedValueOnce(null);
      await expect(requireMembership()).rejects.toThrow('REDIRECT:/register');
    });

    it('returns the user plus membership', async () => {
      getSessionMock.mockResolvedValueOnce(sessionUser({}));
      getOrgMock.mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', role: 'member' });
      const result = await requireMembership();
      expect(result.id).toBe('u1');
      expect(result.membership.role).toBe('member');
    });
  });
});
