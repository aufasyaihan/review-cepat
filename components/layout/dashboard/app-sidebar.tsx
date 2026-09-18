'use client';

import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Smartphone,
  Store,
  Tag,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { authQueries } from '@/domains/auth/api/queries';
import { signOutAction } from '@/domains/auth/server/actions';
import { authClient } from '@/lib/auth-client';

const ICONS = {
  LayoutDashboard,
  Plus,
  Settings,
  Smartphone,
  Store,
  Tag,
  Users,
} as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const { data: navItems } = useQuery(authQueries.permissions());
  const nav = navItems ?? [];
  const user = session?.user;

  const signOut = useCallback(async () => {
    const result = await signOutAction();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Signed out');
    router.push('/');
    router.refresh();
  }, [router]);

  const name = user?.name ?? '';
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const settingsItem = nav.find((item) => item.path === '/settings' && item.isMenu);
  const mainNav = nav.filter((item) => item.isMenu && item.path !== '/settings');

  return (
    <Sidebar variant="inset" collapsible="icon">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <img src="/logo_transparent.png" alt="ReviewCepat Logo" className="h-10 aspect-square" />
        <div className="min-w-0">
          <p className="truncate text-kg font-semibold">
            Review<span className="text-primary">Cepat</span>
          </p>
        </div>
      </div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarMenu>
            {!navItems && <SidebarNavSkeleton count={5} />}
            {mainNav.map((item) => {
              const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
              const Icon = item.icon
                ? (ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboard)
                : LayoutDashboard;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    render={<Link href={item.path} className="py-5" />}
                    isActive={active}
                    tooltip={item.label}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {settingsItem && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href={settingsItem.path} className="py-5" />}
                isActive={
                  pathname === settingsItem.path || pathname.startsWith(`${settingsItem.path}/`)
                }
                tooltip={settingsItem.label}
              >
                <Settings />
                <span>{settingsItem.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    tooltip={name || 'Account'}
                    className="py-8 cursor-pointer gap-2"
                  />
                }
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {initials}
                </div>
                <span className="capitalize">{name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-(--sidebar-width)">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <div className="flex size-8 capitalize shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initials}
                      </div>
                      <div className="grid flex-1 leading-tight">
                        <span className="truncate font-medium">{name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.email ?? ''}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarNavSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => `nav-skeleton-${i}`).map((key) => (
        <SidebarMenuItem key={key}>
          <div className="flex items-center gap-2 px-2 py-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </SidebarMenuItem>
      ))}
    </>
  );
}
