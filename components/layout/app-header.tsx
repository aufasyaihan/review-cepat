import { AuthNav } from '@/components/layout/auth-nav';

/** Phantom UI = layout only. Global header shell shown on every page. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4">
      <a href="/" className="text-lg font-semibold text-primary">
        NFC Platform
      </a>
      <div className="ml-auto">
        <AuthNav />
      </div>
    </header>
  );
}
