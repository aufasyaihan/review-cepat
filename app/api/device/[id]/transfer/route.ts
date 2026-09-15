import { transfer } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/[id]/transfer', async (req, ctx) => {
  const { merchantId } = await requireApiMerchant();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return transfer(id, merchantId, body);
});
