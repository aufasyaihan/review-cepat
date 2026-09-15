import Link from 'next/link';

import { requireRole } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requireRole('ADMIN');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <nav className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/devices" className="rounded border p-5 font-medium hover:bg-muted">
          Device inventory
          <span className="block text-sm font-normal text-muted-foreground">
            Create, disable, re-enable devices
          </span>
        </Link>
        <Link href="/admin/devices/new" className="rounded border p-5 font-medium hover:bg-muted">
          New device
          <span className="block text-sm font-normal text-muted-foreground">
            Generate a unique identity and claim code
          </span>
        </Link>
        <Link href="/admin/merchants" className="rounded border p-5 font-medium hover:bg-muted">
          Merchants
          <span className="block text-sm font-normal text-muted-foreground">
            View accounts and device counts
          </span>
        </Link>
      </nav>
    </div>
  );
}
