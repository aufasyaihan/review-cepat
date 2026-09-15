import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { analyticsQueries } from '@/domains/analytics/api/queries';
import { deviceKeys } from '@/domains/device/api/queries';
import { listVisible } from '@/domains/device/server/service';
import { isOwner } from '@/domains/merchant/server/permissions';
import { getQueryClient } from '@/lib/query-client';
import { requireMembership } from '@/lib/session';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireMembership();
  const queryClient = getQueryClient();

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
