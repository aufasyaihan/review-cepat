import { AppSidebar } from '@/components/layout/dashboard/app-sidebar';
import { DashboardBreadcrumb } from '@/components/layout/dashboard/dashboard-breadcrumb';
import { ThemeToggle } from '@/components/layout/dashboard/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ThemeWrap } from '@/providers/theme-wrap';

/**
 * Static shell — NO data fetching. Authentication/route access is enforced by
 * proxy.ts (constitution II, FR-043); nav data is fetched client-side by
 * AppSidebar via GET /api/permissions with a phantom-ui skeleton. `dynamic` is
 * never set (FR-036 direction: layouts are synchronously rendered shells).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeWrap>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-primary/10 bg-background/80 backdrop-blur-lg">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
              <DashboardBreadcrumb />
            </div>
            <div className="ml-auto flex items-center gap-2 px-4">
              <ThemeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeWrap>
  );
}
