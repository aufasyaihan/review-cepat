import Link from 'next/link';

const SUB_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/devices', label: 'Devices' },
  { href: '/devices/claim', label: 'Claim' },
  { href: '/analytics', label: 'Analytics' },
];

/** Sub-merchant group layout — tabs for the merchant's operational areas. */
export default function SubMerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Merchant sections">
        {SUB_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded border px-3 py-1.5 hover:bg-muted">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
