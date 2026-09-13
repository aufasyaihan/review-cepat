import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { deviceKeys } from '@/domains/device/api/queries';
import { getForOwner } from '@/domains/device/server/service';
import { getProfileByUserId } from '@/domains/merchant/server/service';
import { getQueryClient } from '@/lib/query-client';
import { requireRole } from '@/lib/session';
import { DeviceConfigClient } from './device-config-client';

export const dynamic = 'force-dynamic';

export default async function DeviceConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('MERCHANT');
  const { id } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: async () => {
      const profile = await getProfileByUserId(user.id);
      return getForOwner(id, profile?.id ?? -1);
    },
    retry: false,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DeviceConfigClient deviceId={id} />
    </HydrationBoundary>
  );
}
