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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { signOutAction } from '@/domains/auth/server/actions';

export type NavItem = { href: string; label: string; icon: string | null };

const ICONS = { LayoutDashboard, Plus, Settings, Smartphone, Store, Tag, Users } as const;

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

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            NFC
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">NFC QR Platform</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon
              ? (ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboard)
              : LayoutDashboard;
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton tooltip={user.name} />}>
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {initials}
                </div>
                <span>{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-(--sidebar-width)">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
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
