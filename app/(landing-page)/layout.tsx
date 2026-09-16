import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Public landing-page group layout — structure only, no data fetching. */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            NFC
          </div>
          <span className="text-sm font-semibold">NFC QR Platform</span>
        </Link>
        <Button render={<Link href="/login" />} nativeButton={false} variant="outline" size="sm">
          Log in
        </Button>
      </header>
      {children}
    </div>
  );
}
