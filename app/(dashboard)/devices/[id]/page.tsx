import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { deviceKeys } from '@/domains/device/api/queries';
import { getVisible } from '@/domains/device/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireMembership } from '@/lib/session';
import { DeviceConfigClient } from './device-config-client';

export const dynamic = 'force-dynamic';

export default async function DeviceConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { membership } = await requireMembership();
  const { id } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => getVisible(id, membership),
    retry: false,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DeviceConfigClient deviceId={id} />
    </HydrationBoundary>
  );
}
