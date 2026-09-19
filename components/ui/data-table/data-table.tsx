'use client';

import { type ColumnDef, type ColumnFiltersState, type OnChangeFn, type PaginationState, type Row, type SortingState, type VisibilityState, flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import React from 'react';

import { cn } from 'cn';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import DataTablePagination from './data-table-pagination';
import DataTableViewOptions from './data-table-view-options';

type StickyMeta = { sticky?: boolean };

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  headerContent?: React.ReactNode;
  onRowClick?: (row: Row<TData>) => void;
  pageCount?: number;
  manualPagination?: boolean;
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  showRowSelected?: boolean;
  initialColumnVisibility?: VisibilityState;
  filterColumnId?: string;
  filterPlaceholder?: string;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function DataTable<TData, TValue>({
  columns,
  data,
  headerContent,
  onRowClick,
  pageCount,
  manualPagination,
  pagination,
  onPaginationChange,
  showRowSelected = true,
  initialColumnVisibility = {},
  filterColumnId,
  filterPlaceholder = 'Filter…',
  toolbar,
  actions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(initialColumnVisibility);
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    pageCount,
    manualPagination,
    onPaginationChange,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(pagination !== undefined && { pagination }),
    },
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">{headerContent}</div>
        {actions}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap md:flex-nowrap items-center gap-2">
          {toolbar}
          {filterColumnId && (
            <Input
              aria-label={filterPlaceholder}
              placeholder={filterPlaceholder}
              value={(table.getColumn(filterColumnId)?.getFilterValue() as string) ?? ''}
              onChange={(event) => table.getColumn(filterColumnId)?.setFilterValue(event.target.value)}
              className="max-w-xs"
            />
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>
      <div className="overflow-x-auto rounded-xl border border-primary/10 bg-card/50 shadow-[0_0_15px_-3px] shadow-primary/[0.07] backdrop-blur-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn((header.column.columnDef.meta as StickyMeta | undefined)?.sticky && 'sticky right-0 z-10 w-[1%] bg-card')}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'cursor-pointer' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn((cell.column.columnDef.meta as StickyMeta | undefined)?.sticky && 'sticky right-0 z-10 w-[1%] bg-card')}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} showRowSelected={showRowSelected} />
    </div>
  );
}