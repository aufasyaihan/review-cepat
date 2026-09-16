import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { analyticsQueries } from '@/domains/analytics/api/queries';
import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible } from '@/domains/device/server/service';
import { isOwner } from '@/domains/merchant/server/permissions';
import { getQueryClient } from '@/lib/query-client';
import { requireMembership, requireRole } from '@/lib/session';
import { AdminDashboardClient } from './admin-dashboard-client';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireRole(['ADMIN', 'MERCHANT']);
  const queryClient = getQueryClient();

  if (user.role === 'ADMIN') {
    return <AdminDashboardClient userName={user.name} />;
  }

  const session = await requireMembership();
  await queryClient.prefetchQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => listVisible(session.membership),
  });

  if (isOwner(session.membership)) {
    await queryClient.prefetchQuery(analyticsQueries.overview());
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient userName={session.name} isOwner={isOwner(session.membership)} />
    </HydrationBoundary>
  );
}
