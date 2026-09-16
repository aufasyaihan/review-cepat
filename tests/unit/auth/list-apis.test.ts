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

vi.mock('@/domains/auth/server/permissions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domains/auth/server/permissions')>()),
  listPermissionsForRole: vi.fn(),
  listRolePermissions: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logRequest: vi.fn(),
  logError: vi.fn(),
}));

import { listPermissionsForRole, listRolePermissions } from '@/domains/auth/server/permissions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { auth } from '@/lib/auth';

const getSessionMock = vi.mocked(auth.api.getSession);
const getOrgMock = vi.mocked(getActiveOrganization);
const listPermsMock = vi.mocked(listPermissionsForRole);
const listRolePermsMock = vi.mocked(listRolePermissions);

import { GET as permissionsGET } from '@/app/api/permissions/route';
import { GET as rolePermsGET } from '@/app/api/roles/[roleId]/permissions/route';

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

const SESSION_MERCHANT = {
  user: { id: 'u1', role: 'MERCHANT', email: 'a@b.com', name: 'A' },
} as unknown as SessionResult;

const SESSION_ADMIN = {
  user: { id: 'admin', role: 'ADMIN', email: 'x@b.com', name: 'X' },
} as unknown as SessionResult;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/permissions', () => {
  it("returns the caller's own permitted nav + API paths for a merchant", async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_MERCHANT);
    getOrgMock.mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', role: 'owner' });
    listPermsMock.mockResolvedValueOnce([
      { path: '/dashboard', isMenu: true, label: 'Dashboard', icon: 'LayoutDashboard', sort: 100 },
      {
        path: '/api/device/publish',
        isMenu: false,
        label: 'api.publish_device',
        icon: null,
        sort: 0,
      },
    ]);
    const res = await permissionsGET({} as Request, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ isMenu: boolean }>;
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      path: '/dashboard',
      isMenu: true,
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      sort: 100,
    });
    expect(body[1].isMenu).toBe(false);
  });

  it('returns every item for an admin', async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_ADMIN);
    getOrgMock.mockResolvedValueOnce(null);
    listPermsMock.mockResolvedValueOnce([
      { path: '/dashboard', isMenu: true, label: 'Dashboard', icon: null, sort: 100 },
      { path: '/merchants', isMenu: true, label: 'Merchants', icon: null, sort: 600 },
    ]);
    const res = await permissionsGET({} as Request, { params: Promise.resolve({}) });
    const body = (await res.json()) as Array<{ isMenu: boolean }>;
    expect(body).toHaveLength(2);
  });

  it('returns 401 for an unauthenticated caller', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const res = await permissionsGET({} as Request, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/roles/:roleId/permissions', () => {
  it("returns the role's permission mapping for an admin", async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_ADMIN);
    listRolePermsMock.mockResolvedValueOnce([
      { path: '/dashboard', isMenu: true, label: 'Dashboard', scope: null },
      { path: '/api/device/create', isMenu: false, label: 'api.create_device', scope: null },
    ]);
    const res = await rolePermsGET({} as Request, {
      params: Promise.resolve({ roleId: 'role-abc' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(2);
    expect(listRolePermsMock).toHaveBeenCalledWith('role-abc');
  });

  it('returns 403 for a merchant', async () => {
    getSessionMock.mockResolvedValueOnce(SESSION_MERCHANT);
    getOrgMock.mockResolvedValueOnce({ id: 'm1', organizationId: 'org-1', role: 'owner' });
    const res = await rolePermsGET({} as Request, { params: Promise.resolve({ roleId: 'x' }) });
    expect(res.status).toBe(403);
  });
});
