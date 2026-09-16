'use client';

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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { signOutAction } from '@/domains/auth/server/actions';

export type NavItem = { href: string; label: string; icon: string | null };

const ICONS = {
  LayoutDashboard,
  Plus,
  Settings,
  Smartphone,
  Store,
  Tag,
  Users,
} as const;

export function AppSidebar({
  nav,
  user,
}: {
  nav: NavItem[];
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const router = useRouter();

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

  const initials =
    user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'U';

  const settingsItem = nav.find((item) => item.href === '/settings');
  const mainNav = nav.filter((item) => item.href !== '/settings');

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex shrink-0 p-2 items-center justify-center rounded-md bg-primary/10 border border-primary text-xs font-bold text-primary-foreground">
            <Store className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-kg font-semibold">
              Review<span className="text-primary">Cepat</span>
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarMenu>
            {mainNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon
                ? (ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboard)
                : LayoutDashboard;
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} className="py-5" />}
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
                render={<Link href={settingsItem.href} className="py-5" />}
                isActive={
                  pathname === settingsItem.href || pathname.startsWith(`${settingsItem.href}/`)
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
                  <SidebarMenuButton tooltip={user.name} className="py-8 cursor-pointer gap-2" />
                }
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {initials}
                </div>
                <span className="capitalize">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-(--sidebar-width)">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <div className="flex size-8 capitalize shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initials}
                      </div>
                      <div className="grid flex-1 leading-tight">
                        <span className="truncate font-medium">{user.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
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
