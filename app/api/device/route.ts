import { listVisible } from '@/domains/device/server/service';
import { apiRoute } from '@/lib/api';
import { ForbiddenError } from '@/lib/errors';
import { requireApiMembership, requireApiUser } from '@/lib/session';

export const GET = apiRoute('GET', '/api/device', async (req) => {
  const user = await requireApiUser(['ADMIN', 'MERCHANT']);
  if (user.role === 'ADMIN') {
    const organizationId = new URL(req.url).searchParams.get('organizationId');
    if (!organizationId) throw new ForbiddenError('NO_ORG', 'organizationId is required');
    return listVisible({ id: '', organizationId, role: 'owner' });
  }

  const membership = await requireApiMembership();
  return listVisible(membership);
});
