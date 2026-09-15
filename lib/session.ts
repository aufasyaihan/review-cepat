import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { can } from '@/domains/auth/server/permissions';
import { getActiveOrganization, type Membership } from '@/domains/merchant/server/permissions';
import { getProfileByUserId } from '@/domains/merchant/server/service';
import { auth, type Role } from '@/lib/auth';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';

export type SessionUser = {
  id: string;
  role: Role;
  email: string;
  name: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    role: (session.user.role as Role) ?? 'MERCHANT',
    email: session.user.email,
    name: session.user.name,
  };
}

/** Guards a page/route handler; redirects unauthenticated or wrong-role users. */
export async function requireRole(role: Role | Role[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect('/login');
  const allowed = Array.isArray(role) ? role : [role];
  if (!allowed.includes(user.role)) redirect('/');
  return user;
}

/** API variant: throws JSON-able errors instead of redirecting. */
export async function requireApiUser(roles: Role[] = ['ADMIN', 'MERCHANT']): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

/** Merchant-role API guard plus the merchant's profile id (device owner id). */
export async function requireApiMerchant(): Promise<{ user: SessionUser; merchantId: number }> {
  const user = await requireApiUser(['MERCHANT']);
  const profile = await getProfileByUserId(user.id);
  if (!profile) throw new ForbiddenError('NO_PROFILE', 'Merchant profile not set up');
  return { user, merchantId: profile.id };
}

/** Merchant-role API guard resolved to the active organization membership. */
export async function requireApiMembership(): Promise<Membership> {
  const user = await requireApiUser(['MERCHANT']);
  const membership = await getActiveOrganization(user.id);
  if (!membership) throw new ForbiddenError('NO_ORG', 'Not part of an organization');
  return membership;
}

/** API guard: grants access only when the caller's role matches the permission
 * row for `path` (API-endpoint rows, is_menu=false). Resolves owner/member
 * org-role scoping (FR-037, Clarification 2026-09-16). */
export async function requireApiPermission(path: string): Promise<SessionUser> {
  const user = await requireApiUser(['ADMIN', 'MERCHANT']);
  const membership = await getActiveOrganization(user.id);
  const orgRole = membership?.role ?? null;
  if (!(await can(user.role, orgRole, path)))
    throw new ForbiddenError('NO_PERMISSION', `No permission for ${path}`);
  return user;
}

/** Page guard the resolves a merchant's membership or redirects to registration. */
export async function requireMembership(): Promise<SessionUser & { membership: Membership }> {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership) redirect('/register');
  return { ...user, membership };
}
