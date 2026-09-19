import { adminCreate, adminList, adminListPaginated } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/admin/devices', async (req) => {
  await requireApiUser(['ADMIN']);
  const url = new URL(req.url);
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');
  if (page === null && limit === null) return adminList();
  return adminListPaginated({
    q: url.searchParams.get('q') ?? undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
});

export const POST = apiRoute('POST', '/api/admin/devices', async (req) => {
  await requireApiUser(['ADMIN']);
  const body = await req.json().catch(() => ({}));
  return adminCreate(body);
});
