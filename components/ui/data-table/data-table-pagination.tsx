import { type Table } from '@tanstack/react-table';
import { usePathname, useSearchParams } from 'next/navigation';
import React from 'react';

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  showRowSelected?: boolean;
}

export default function DataTablePagination<TData>({
  table,
  showRowSelected = true,
}: DataTablePaginationProps<TData>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildLink = React.useCallback(
    (pageIndex: number) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('page', (pageIndex + 1).toString());
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  const handlePageChange = (
    e: React.MouseEvent,
    pageIndex: number,
    canNavigate: boolean,
  ) => {
    if (!canNavigate || !table.options.manualPagination) {
      e.preventDefault();
      if (!table.options.manualPagination) table.setPageIndex(pageIndex);
    }
  };

  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount();

  const generatePaginationLinks = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 0) return pages;
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, 'ellipsis', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
    }
    return pages;
  };

  const pageSize = table.getState().pagination.pageSize;
  const from = table.getState().pagination.pageIndex * pageSize + 1;
  const to = Math.min(
    (table.getState().pagination.pageIndex + 1) * pageSize,
    table.getFilteredRowModel().rows.length,
  );
  const total = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-2">
      <div className="text-muted-foreground flex flex-1 gap-4 text-sm">
        <span>
          Showing {from} - {to} of {total} data
        </span>
        {showRowSelected && (
          <span>
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </span>
        )}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 border-primary/10 bg-foreground/5">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top" className="border-primary/10">
              {[10, 20, 25, 30, 40, 50].map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href={buildLink(table.getState().pagination.pageIndex - 1)}
                onClick={(e) =>
                  handlePageChange(
                    e,
                    table.getState().pagination.pageIndex - 1,
                    table.getCanPreviousPage(),
                  )
                }
                className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            {generatePaginationLinks().map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }
              const pageNumber = page as number;
              const pageIndex = pageNumber - 1;
              const isActive = currentPage === pageNumber;
              return (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    href={buildLink(pageIndex)}
                    isActive={isActive}
                    onClick={(e) => handlePageChange(e, pageIndex, true)}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                href={buildLink(table.getState().pagination.pageIndex + 1)}
                onClick={(e) =>
                  handlePageChange(
                    e,
                    table.getState().pagination.pageIndex + 1,
                    table.getCanNextPage(),
                  )
                }
                className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}