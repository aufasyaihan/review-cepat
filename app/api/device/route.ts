import { listVisible, listVisiblePaginated } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { ForbiddenError } from '@/lib/errors';
import { requireApiMembership, requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/device', async (req) => {
  const user = await requireApiUser(['ADMIN', 'MERCHANT']);
  const url = new URL(req.url);
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');
  const paginate = page !== null || limit !== null;
  const q = url.searchParams.get('q') ?? undefined;

  const membership =
    user.role === 'ADMIN'
      ? (() => {
          const organizationId = url.searchParams.get('organizationId');
          if (!organizationId) throw new ForbiddenError('NO_ORG', 'organizationId is required');
          return { id: '', organizationId, role: 'owner' as const };
        })()
      : await requireApiMembership();

  if (!paginate) return listVisible(membership);
  return listVisiblePaginated(membership, {
    q,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
});
