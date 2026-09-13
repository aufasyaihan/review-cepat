import { unpublish } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/[id]/unpublish', async (_req, ctx) => {
  const { merchantId } = await requireApiMerchant();
  const { id } = await ctx.params;
  return unpublish(id, merchantId);
});
