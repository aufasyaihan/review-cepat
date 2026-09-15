import { publish } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/[id]/publish', async (_req, ctx) => {
  const { merchantId } = await requireApiMerchant();
  const { id } = await ctx.params;
  return publish(id, merchantId);
});
