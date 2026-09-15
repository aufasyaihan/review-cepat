import { AppShell } from '@/components/layout/app-shell';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { requireRole } from '@/lib/session';
import { ThemeWrap } from '@/providers/theme-wrap';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/devices', label: 'Devices' },
  { href: '/devices/claim', label: 'Claim a device' },
  { href: '/analytics', label: 'Analytics', accessRole: 'owner' as const },
  { href: '/members', label: 'Members', accessRole: 'owner' as const },
];

/** Merchant group layout — MERCHANT guard + sidebar shell (owner/member aware). */
export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('MERCHANT');
  const membership = await getActiveOrganization(user.id);
  const role = membership?.role === 'owner' ? 'owner' : 'member';

  return (
    <ThemeWrap>
      <AppShell nav={NAV} userName={user.name} accessRole={role}>
        {children}
      </AppShell>
    </ThemeWrap>
  );
}
