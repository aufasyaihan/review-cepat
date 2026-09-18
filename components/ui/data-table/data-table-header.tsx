'use client';

import { type Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from 'cn';

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-7 border-transparent bg-transparent hover:border-primary/20 hover:bg-primary/[0.05] data-[state=open]:border-primary/30 data-[state=open]:bg-primary/[0.08]"
              {...props}
            >
              <span>{title}</span>
              {column.getIsSorted() === 'desc' ? (
                <ArrowDown data-icon="inline-end" />
              ) : column.getIsSorted() === 'asc' ? (
                <ArrowUp data-icon="inline-end" />
              ) : (
                <ChevronsUpDown data-icon="inline-end" />
              )}
            </Button>
          )}
        ></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="border-primary/10">
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown />
            Desc
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff />
            Hide
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}