import { createUserAction } from '@/domains/merchant/server/member-actions';
import { listUsers } from '@/domains/merchant/server/service';
import { apiRoute, fromActionResult } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/members', async (req) => {
  await requireApiUser(['ADMIN']);
  const url = new URL(req.url);
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');
  return listUsers({
    q: url.searchParams.get('q') ?? undefined,
    organizationId: url.searchParams.get('organizationId') ?? undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
});

export const POST = apiRoute('POST', '/api/members', async (req) => {
  return fromActionResult(await createUserAction(await req.json()));
});
