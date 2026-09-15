import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible } from '@/domains/device/server/service';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { getActiveOrganization, isOwner } from '@/domains/merchant/server/permissions';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { UserManagementClient } from './user-management-client';

export const dynamic = 'force-dynamic';

export default async function UserManagementPage() {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  if (!membership || !isOwner(membership)) {
    // Sub-merchants have no member management (SC-008).
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">User management</h1>
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
  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(membership),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UserManagementClient />
    </HydrationBoundary>
  );
}
