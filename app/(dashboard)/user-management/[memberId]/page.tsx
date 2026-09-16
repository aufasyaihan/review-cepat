import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible, type MembershipLike } from '@/domains/device/server/service';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { getMemberById, listMembers, type MemberWithUser } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { MemberDetailClient } from './member-detail-client';

export const dynamic = 'force-dynamic';

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const user = await requireRole(['ADMIN', 'MERCHANT']);

  let member: MemberWithUser;
  let membership: MembershipLike;

  if (user.role === 'ADMIN') {
    const found = await getMemberById(memberId);
    if (!found) notFound();
    member = found;
    membership = { id: '', organizationId: found.organizationId, role: 'owner' };
  } else {
    const ownMembership = await getActiveOrganization(user.id);
    if (!ownMembership || !isOwner(ownMembership)) redirect('/user-management');
    membership = ownMembership;

    const members = await listMembers(ownMembership.organizationId);
    const found = members.find((m) => m.id === memberId);
    if (!found) notFound();
    member = found;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(membership),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MemberDetailClient member={member} organizationId={membership.organizationId} />
    </HydrationBoundary>
  );
}
