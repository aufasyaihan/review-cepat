import { eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { member } from '@/db/schema';

export type Membership = {
  id: string;
  organizationId: string;
  role: 'owner' | 'member';
};

export function isOwner(membership: Membership): boolean {
  return membership.role === 'owner';
}

export async function getMemberships(userId: string): Promise<Membership[]> {
  const rows = await getDb().query.member.findMany({
    where: eq(member.userId, userId),
  });
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    role: r.role as Membership['role'],
  }));
}

/**
 * Active organization for a user. MVP treats the first membership as active;
 * switch to the Better Auth "active organization" session value when multi-org
 * UI lands.
 * (ponytail: first membership, upgrade when the org switcher ships)
 */
export async function getActiveOrganization(userId: string): Promise<Membership | null> {
  const memberships = await getMemberships(userId);
  return memberships[0] ?? null;
}

/**
 * Device visibility (data-model.md Authorization Visibility):
 * - owner sees every device in their organization;
 * - member sees only devices assigned to them (device.memberId = member.id).
 */
export function canAccessDevice(
  membership: Membership,
  device: { organizationId: string | null; memberId: string | null },
): boolean {
  if (!device.organizationId) return false;
  if (device.organizationId !== membership.organizationId) return false;
  if (isOwner(membership)) return true;
  return device.memberId === membership.id;
}
