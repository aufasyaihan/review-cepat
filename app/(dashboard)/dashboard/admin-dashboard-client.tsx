import { Settings, Smartphone, Store, Users } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AREAS = [
  {
    title: 'Devices',
    description: 'Inventory, create, reset and disable devices.',
    href: '/devices',
    icon: Smartphone,
  },
  {
    title: 'Merchants',
    description: 'Manage merchant organizations and their devices.',
    href: '/merchants',
    icon: Store,
  },
  {
    title: 'User management',
    description: 'Members and roles within merchant organizations.',
    href: '/user-management',
    icon: Users,
  },
  {
    title: 'Settings',
    description: 'Account and workspace settings.',
    href: '/settings',
    icon: Settings,
  },
];

export function AdminDashboardClient({ userName }: { userName: string }) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome, {userName}</h1>
        <p className="mt-1 text-muted-foreground">
          Admin overview. Pick a management area to get started.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((area) => (
          <Link key={area.href} href={area.href}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <area.icon className="size-4 text-primary" />
                </div>
                <div>
                  <CardTitle>{area.title}</CardTitle>
                  <CardDescription>{area.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">
                Manage {area.title.toLowerCase()}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
