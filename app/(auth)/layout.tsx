import { ThemeWrap } from '@/providers/theme-wrap';

/** Auth group layout — centered, minimal. No data fetching (constitution II). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeWrap>
      <div className="flex justify-center items-center h-full min-h-dvh flex-1 mx-auto w-full max-w-md px-4">
        {children}
      </div>
    </ThemeWrap>
  );
}
