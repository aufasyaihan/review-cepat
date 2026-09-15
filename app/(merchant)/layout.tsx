import { AppHeader } from '@/components/layout/app-header';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Merchant group layout — MERCHANT guard shared by every merchant page. */
export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['MERCHANT']);
  return (
    <div className="space-y-6">
      <AppHeader />
      {children}
    </div>
  );
}
