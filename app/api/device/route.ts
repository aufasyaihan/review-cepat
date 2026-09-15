import { listOwned } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiMerchant } from '@/lib/session';

export const GET = apiRoute('GET', '/api/device', async () => {
  const { merchantId } = await requireApiMerchant();
  return listOwned(merchantId);
});
