import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { claimWithCode } from '@/domains/merchant/server/service';
import { apiRoute } from '@/lib/api';
import { ForbiddenError } from '@/lib/errors';
import { requireApiUser } from '@/lib/session';

export const POST = apiRoute('POST', '/api/device/claim', async (req) => {
  const user = await requireApiUser(['MERCHANT']);
  const membership = await getActiveOrganization(user.id);
  if (!membership) throw new ForbiddenError('NO_ORG', 'Not part of an organization');
  const body = (await req.json().catch(() => ({}))) as { claimCode?: string };
  return claimWithCode(user.id, membership, body.claimCode ?? '');
});
