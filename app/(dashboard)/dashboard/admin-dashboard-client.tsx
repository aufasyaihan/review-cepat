import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const AREAS = [
  {
    title: 'Devices',
    description: 'Inventory, create, reset and disable devices.',
    href: '/devices',
  },
  {
    title: 'Merchants',
    description: 'Manage merchant organizations and their devices.',
    href: '/merchants',
  },
  {
    title: 'User management',
    description: 'Members and roles within merchant organizations.',
    href: '/user-management',
  },
  {
    title: 'Settings',
    description: 'Account and workspace settings.',
    href: '/settings',
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
              <CardHeader>
                <CardTitle>{area.title}</CardTitle>
                <CardDescription>{area.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">
                Open {area.title} →
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
