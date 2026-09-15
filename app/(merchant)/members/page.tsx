import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { MembersClient } from './members-client';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    // Sub-merchants have no member management (SC-008).
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          Only organization owners can manage members.
        </p>
      </div>
    );
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: memberKeys.list(),
    queryFn: () => memberQueries.list().queryFn(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MembersClient />
    </HydrationBoundary>
  );
}
