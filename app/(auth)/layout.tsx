import { GridBackground } from '@/components/layout/grid-background';
import { ThemeWrap } from '@/providers/theme-wrap';

/** Auth group layout — centered, minimal. No data fetching (constitution II). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeWrap>
      <div className="relative flex h-full min-h-dvh flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-white via-sky-50/40 to-blue-50/60 dark:from-neutral-950 dark:via-sky-950/10 dark:to-blue-950/20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl dark:bg-sky-500/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 -z-10 size-96 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-500/10"
        />
        <GridBackground />
        <div className="mx-auto w-full max-w-md px-4">{children}</div>
      </div>
    </ThemeWrap>
  );
}
