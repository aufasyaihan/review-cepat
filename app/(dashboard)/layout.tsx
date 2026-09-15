import { AppSidebar } from '@/components/layout/dashboard/app-sidebar';
import { DashboardBreadcrumb } from '@/components/layout/dashboard/dashboard-breadcrumb';
import { ThemeToggle } from '@/components/layout/dashboard/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { getRole, listNavForRole } from '@/domains/auth/server/permissions';
import { requireRole } from '@/lib/session';
import { ThemeWrap } from '@/providers/theme-wrap';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(['ADMIN', 'MERCHANT']);
  const { orgRole } = await getRole(user);
  const nav = await listNavForRole(user.role, orgRole);

  return (
    <ThemeWrap>
      <SidebarProvider>
        <AppSidebar nav={nav} user={{ name: user.name, email: user.email }} />
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
