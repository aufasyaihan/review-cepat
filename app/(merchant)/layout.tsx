import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Merchant group layout — MERCHANT guard shared by every merchant page. */
export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['MERCHANT']);
  return children;
}
