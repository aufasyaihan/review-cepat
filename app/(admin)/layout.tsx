import { AppShell } from '@/components/layout/app-shell';
import { requireRole } from '@/lib/session';
import { ThemeWrap } from '@/providers/theme-wrap';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/devices', label: 'Devices' },
  { href: '/admin/devices/new', label: 'New device' },
  { href: '/admin/merchants', label: 'Merchants' },
  { href: '/admin/organizations', label: 'Organizations' },
];

/** Admin group layout — ADMIN guard + sidebar shell. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('ADMIN');

  return (
    <ThemeWrap>
      <AppShell nav={NAV} userName={user.name} accessRole="admin">
        {children}
      </AppShell>
    </ThemeWrap>
  );
}
