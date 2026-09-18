import type { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </div>
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
