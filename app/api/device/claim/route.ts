import { claim } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/claim', async (req) => {
  const { merchantId } = await requireApiMerchant();
  const body = await req.json().catch(() => ({}));
  return claim(merchantId, body);
});
