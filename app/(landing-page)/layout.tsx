import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Public landing-page group layout — structure only, no data fetching. */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full px-4">
      <header className="flex h-16 items-center justify-between sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <nav className="mx-auto w-full max-w-6xl">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <img
              src="/logo_transparent.png"
              alt="ReviewCepat Logo"
              className="h-10 aspect-square"
            />
            <span className="text-lg font-semibold">
              Review<span className="text-primary">Cepat</span>
            </span>
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl">{children}</main>
    </div>
  );
}
