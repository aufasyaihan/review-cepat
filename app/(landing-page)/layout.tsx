import Image from 'next/image';
import Link from 'next/link';
import { ThemeWrap } from '@/providers/theme-wrap';

/** Public landing-page group layout — structure only, no data fetching. */
export default function LandingPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeWrap>
      <div className="w-full px-4">
        <header className="flex h-16 items-center justify-between sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
          <nav className="mx-auto w-full max-w-6xl">
            <Link href="/" className="flex items-center gap-2 w-fit">
              <Image
                src="/logo_transparent.png"
                alt="ReviewCepat Logo"
                width={40}
                height={40}
                className="aspect-square"
              />
              <span className="text-lg font-semibold">
                Review<span className="text-primary">Cepat</span>
              </span>
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl">{children}</main>
      </div>
    </ThemeWrap>
  );
}
