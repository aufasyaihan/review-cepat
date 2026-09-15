import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { listMembers, type MemberWithUser } from '@/domains/merchant/server/service';
import { apiRoute } from '@/lib/api';
import { ForbiddenError } from '@/lib/errors';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/merchant/members', async (): Promise<MemberWithUser[]> => {
  const user = await requireApiUser(['MERCHANT']);
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    throw new ForbiddenError('MEMBERS_DENIED', 'Only organization owners can list members');
  }
  return listMembers(membership.organizationId);
});
