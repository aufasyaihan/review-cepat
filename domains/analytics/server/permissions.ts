import type { Role } from '@/domains/auth/constants';
import { ForbiddenError } from '@/lib/errors';

export function requireAnalyticsRole(role: Role): void {
  if (role !== 'MERCHANT') {
    throw new ForbiddenError('ANALYTICS_FORBIDDEN', 'Only merchants can view analytics');
  }
}
