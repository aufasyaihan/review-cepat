import { requireRole } from '@/lib/session';
import { AdminMerchantsClient } from './admin-merchants-client';

export const dynamic = 'force-dynamic';

export default async function MerchantsPage() {
  await requireRole('ADMIN');
  // The merchant list is server-driven (search/page are client state), so
  // nothing to prefetch — AdminMerchantsClient loads its first page client-side.
  return <AdminMerchantsClient />;
}
