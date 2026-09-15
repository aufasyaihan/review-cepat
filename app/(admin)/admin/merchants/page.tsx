import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { adminKeys } from '@/domains/admin/api/queries';
import { listMerchants } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { AdminMerchantsClient } from './admin-merchants-client';

export const dynamic = 'force-dynamic';

export default async function AdminMerchantsPage() {
  await requireRole('ADMIN');
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: adminKeys.merchants(),
    queryFn: listMerchants,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminMerchantsClient />
    </HydrationBoundary>
  );
}
