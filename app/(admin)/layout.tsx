import Link from 'next/link';

import { AppHeader } from '@/components/layout/app-header';
import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ADMIN_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/devices', label: 'Devices' },
  { href: '/admin/devices/new', label: 'New device' },
  { href: '/admin/merchants', label: 'Merchants' },
];

/** Admin group layout — ADMIN guard + admin navigation. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(['ADMIN']);

  return (
    <div className="space-y-6">
      <AppHeader />
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Admin sections">
        {ADMIN_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded border px-3 py-1.5 hover:bg-muted">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
