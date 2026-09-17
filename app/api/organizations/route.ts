import { createOrganizationAction } from '@/domains/merchant/server/org-actions';
import { searchOrganizations } from '@/domains/merchant/server/service';
import { apiRoute, fromActionResult } from '@/lib/api';
import { requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/organizations', async (req) => {
  await requireApiUser(['ADMIN']);
  const url = new URL(req.url);
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');
  return searchOrganizations({
    q: url.searchParams.get('q') ?? undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
});

export const POST = apiRoute('POST', '/api/organizations', async (req) => {
  return fromActionResult(await createOrganizationAction(await req.json()));
});
