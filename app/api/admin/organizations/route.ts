import { listOrganizations } from '@/domains/merchant/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/admin/organizations', async () => {
  await requireApiUser(['ADMIN']);
  return listOrganizations();
});
