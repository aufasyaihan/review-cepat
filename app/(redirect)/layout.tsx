import { GridBackground } from '@/components/layout/grid-background';

/**
 * Public redirect group layout — centered card over an auth-style gradient
 * background. No theme provider here: this is the public device surface
 * (FR-034), shown to anonymous scanners, and always renders in one fixed
 * appearance.
 */
export default function RedirectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-white via-sky-50/40 to-blue-50/60 px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 right-0 -z-10 size-96 rounded-full bg-blue-400/20 blur-3xl"
      />
      <GridBackground />
      {children}
    </div>
  );
}
