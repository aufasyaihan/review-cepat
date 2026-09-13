import { adminList } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/admin/devices', async () => {
  await requireApiUser(['ADMIN']);
  return adminList();
});
