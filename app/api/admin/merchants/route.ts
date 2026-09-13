import { listMerchants } from '@/domains/merchant/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/admin/merchants', async () => {
  await requireApiUser(['ADMIN']);
  return listMerchants();
});
