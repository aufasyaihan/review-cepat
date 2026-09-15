import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { adminKeys } from '@/domains/admin/api/queries';
import { adminList } from '@/domains/device/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { AdminDevicesClient } from './admin-devices-client';

export const dynamic = 'force-dynamic';

export default async function AdminDevicesPage() {
  await requireRole('ADMIN');
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: adminKeys.devices(),
    queryFn: adminList,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminDevicesClient />
    </HydrationBoundary>
  );
}
