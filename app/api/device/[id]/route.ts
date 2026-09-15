import { getForOwner } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const GET = apiRoute('GET', '/api/device/[id]', async (_req, ctx) => {
  const { merchantId } = await requireApiMerchant();
  const { id } = await ctx.params;
  return getForOwner(id, merchantId);
});
