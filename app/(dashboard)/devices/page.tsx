import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { adminKeys } from '@/domains/admin/api/queries';
import { deviceKeys } from '@/domains/device/api/queries';
import { adminList, listVisible } from '@/domains/device/server/service';
import { listOrganizations } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireMembership, requireRole } from '@/lib/session';
import { AdminDevicesClient } from './admin-devices-client';
import { DevicesClient } from './devices-client';

export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  const user = await requireRole(['ADMIN', 'MERCHANT']);
  const queryClient = getQueryClient();

  if (user.role === 'ADMIN') {
    await queryClient.prefetchQuery({
      queryKey: adminKeys.devices(),
      queryFn: adminList,
    });
    const organizations = await listOrganizations();
    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AdminDevicesClient organizations={organizations} />
      </HydrationBoundary>
    );
  }

  const session = await requireMembership();
  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(session.membership),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DevicesClient isOwner={session.membership.role === 'owner'} />
    </HydrationBoundary>
  );
}
