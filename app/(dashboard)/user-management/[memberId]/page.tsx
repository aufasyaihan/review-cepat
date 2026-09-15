import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible } from '@/domains/device/server/service';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { listMembers, type MemberWithUser } from '@/domains/merchant/server/service';
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
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) redirect('/user-management');

  const members = await listMembers(membership.organizationId);
  const member = members.find((m) => m.id === memberId) as MemberWithUser | undefined;
  if (!member) notFound();

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
