import { EllipsisVertical } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ActionItem = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
};

export function createActionsColumn<T>(
  getActions: (row: T) => ActionItem[],
): ColumnDef<T> {
  return {
    id: 'actions',
    header: '',
    enableHiding: false,
    size: 48,
    meta: { sticky: true },
    cell: ({ row }) => {
      const actions = getActions(row.original);
      if (!actions.length) return null;
      return (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Open actions"
                  {...props}
                >
                  <EllipsisVertical className="h-4 w-4" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end">
              {actions.map((action, i) => (
                <DropdownMenuItem
                  key={i}
                  variant={action.variant}
                  onClick={action.onClick}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  };
}
