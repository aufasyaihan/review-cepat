import { GridBackground } from '@/components/layout/grid-background';
import { ThemeWrap } from '@/providers/theme-wrap';

/** Auth group layout — centered, minimal. No data fetching (constitution II). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeWrap>
      <div className="relative flex h-full min-h-dvh flex-1 items-center justify-center overflow-hidden">
        <GridBackground />
        <div className="mx-auto w-full max-w-md px-4">{children}</div>
      </div>
    </ThemeWrap>
  );
}
