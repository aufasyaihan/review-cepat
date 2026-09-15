import { asc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

import { getDb } from '@/db';
import { permission } from '@/db/schema';
import type { Role } from '@/domains/auth/constants';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import type { SessionUser } from '@/lib/session';

export type OrgRole = 'owner' | 'member';

export type NavItem = { href: string; label: string; icon: string | null };

export type PermissionRow = { path: string; roles: string[] };

export function roleMatches(roles: string[], role: Role, orgRole: OrgRole | null): boolean {
  if (roles.includes(role)) return true;
  return role === 'MERCHANT' && orgRole !== null && roles.includes(`MERCHANT:${orgRole}`);
}

export function findPermissionForPath(rows: PermissionRow[], path: string): PermissionRow | null {
  const match = rows
    .filter((r) => path === r.path || path.startsWith(`${r.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ?? null;
}

export async function getRole(
  sessionUser: SessionUser,
): Promise<{ userRole: Role; orgRole: OrgRole | null }> {
  const membership = await getActiveOrganization(sessionUser.id);
  return { userRole: sessionUser.role, orgRole: membership?.role ?? null };
}

export async function can(role: Role, orgRole: OrgRole | null, path: string): Promise<boolean> {
  const rows = await getDb().select().from(permission);
  const match = findPermissionForPath(rows, path);
  return match !== null && roleMatches(match.roles, role, orgRole);
}

export async function listNavForRole(role: Role, orgRole: OrgRole | null): Promise<NavItem[]> {
  const rows = await getDb()
    .select()
    .from(permission)
    .where(eq(permission.isMenu, true))
    .orderBy(asc(permission.sort));
  return rows
    .filter((r) => roleMatches(r.roles, role, orgRole))
    .map((r) => ({ href: r.path, label: r.label, icon: r.icon ?? null }));
}

export function accessDenied(): never {
  redirect('/');
}
