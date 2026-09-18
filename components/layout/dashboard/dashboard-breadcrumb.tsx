'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  devices: 'Devices',
  claim: 'Claim a device',
  new: 'New device',
  'user-management': 'User management',
  merchants: 'Merchants',
  settings: 'Settings',
};

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = [
    { href: '/dashboard', label: 'Dashboard' },
    ...segments
      .filter((s) => s !== 'dashboard')
      .map((s, i) => ({
        href: `/${segments.slice(0, i + 1).join('/')}`,
        label: LABELS[s] ?? decodeURIComponent(s),
      })),
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      {crumbs.map((crumb, i) => (
        <Fragment key={crumb.href}>
          {i > 0 && <ChevronRight className="size-3.5 shrink-0" />}
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
