import { and, asc, eq, or } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { getDb } from '@/db';
import { masterRole, permission, rolePermission } from '@/db/schema';
import type { Role } from '@/domains/auth/constants';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import type { SessionUser } from '@/lib/session';

export type OrgRole = 'owner' | 'member';

export type Scope = OrgRole | 'both' | null;

export type NavItem = { href: string; label: string; icon: string | null };

/** A permission link resolved to its role + optional org-role scope. */
export type PermissionLink = {
  path: string;
  isMenu: boolean;
  label: string | null;
  icon: string | null;
  sort: number;
  scope: Scope;
};

/**
 * ADMIN is a superuser: every permission check short-circuits to allowed
 * without consulting the permission tables (FR-041).
 */
export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

export function scopeAllows(scope: Scope, orgRole: OrgRole | null): boolean {
  if (scope === null || scope === 'both') return true;
  return scope === orgRole;
}

export function findPermissionForPath<T extends { path: string }>(
  rows: T[],
  path: string,
): T | null {
  const match = rows
    .filter((r) => path === r.path || path.startsWith(`${r.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ?? null;
}

async function linksForRole(role: Role): Promise<PermissionLink[]> {
  const db = getDb();
  const roleRow = await db
    .select({ id: masterRole.id })
    .from(masterRole)
    .where(eq(masterRole.name, role))
    .limit(1);
  if (!roleRow[0]) return [];

  const rows = await db
    .select({
      path: permission.path,
      isMenu: permission.isMenu,
      label: permission.label,
      icon: permission.icon,
      sort: permission.sort,
      scope: rolePermission.scope,
    })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(eq(rolePermission.roleId, roleRow[0].id));

  return rows.map((r) => ({ ...r, scope: r.scope as Scope }));
}

export async function getRole(
  sessionUser: SessionUser,
): Promise<{ userRole: Role; orgRole: OrgRole | null }> {
  const membership = await getActiveOrganization(sessionUser.id);
  return { userRole: sessionUser.role, orgRole: membership?.role ?? null };
}

export async function can(role: Role, orgRole: OrgRole | null, path: string): Promise<boolean> {
  if (isAdmin(role)) return true;
  const links = await linksForRole(role);
  const match = findPermissionForPath(links, path);
  return match !== null && scopeAllows(match.scope, orgRole);
}

/** Menu rows the role may see, ordered by sort. ADMIN returns every menu row. */
export async function listNavForRole(role: Role, orgRole: OrgRole | null): Promise<NavItem[]> {
  const links = await linksForRole(role);
  return links
    .filter((l) => l.isMenu && scopeAllows(l.scope, orgRole))
    .sort((a, b) => a.sort - b.sort)
    .map((l) => ({ href: l.path, label: l.label ?? l.path, icon: l.icon }));
}

/**
 * Full permitted-path list (nav + API) for the role/org-role, for the
 * self-service GET /api/permissions endpoint (FR-042).
 */
export async function listPermissionsForRole(
  role: Role,
  orgRole: OrgRole | null,
): Promise<
  Array<{ path: string; isMenu: boolean; label: string; icon: string | null; sort: number }>
> {
  const links = await linksForRole(role);
  return links
    .filter((l) => scopeAllows(l.scope, orgRole))
    .sort((a, b) => a.sort - b.sort)
    .map((l) => ({
      path: l.path,
      isMenu: l.isMenu,
      label: l.label ?? l.path,
      icon: l.icon,
      sort: l.sort,
    }));
}

/** All permission rows for `roleId` (admin role-permission administration, FR-042). */
export async function listRolePermissions(
  roleId: string,
): Promise<Array<{ path: string; isMenu: boolean; label: string; scope: Scope }>> {
  const db = getDb();
  const rows = await db
    .select({
      path: permission.path,
      isMenu: permission.isMenu,
      label: permission.label,
      scope: rolePermission.scope,
    })
    .from(rolePermission)
    .innerJoin(permission, eq(rolePermission.permissionId, permission.id))
    .where(eq(rolePermission.roleId, roleId));
  return rows.map((r) => ({ ...r, scope: r.scope as Scope }));
}

export function accessDenied(): never {
  redirect('/');
}
