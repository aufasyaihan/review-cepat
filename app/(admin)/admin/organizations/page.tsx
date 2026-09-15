import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { adminQueries } from '@/domains/admin/api/queries';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { AdminOrganizationsClient } from './admin-organizations-client';

export const dynamic = 'force-dynamic';

export default async function AdminOrganizationsPage() {
  await requireRole('ADMIN');
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(adminQueries.organizations());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminOrganizationsClient />
    </HydrationBoundary>
  );
}
