import { adminCreate, adminList } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/admin/devices', async () => {
  await requireApiUser(['ADMIN']);
  return adminList();
});

export const POST = apiRoute('POST', '/api/admin/devices', async (req) => {
  await requireApiUser(['ADMIN']);
  const body = await req.json().catch(() => ({}));
  return adminCreate(body);
});
