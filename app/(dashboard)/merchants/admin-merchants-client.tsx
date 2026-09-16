'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';

import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { adminQueries } from '@/domains/admin/api/queries';
import type { MerchantWithDevices } from '@/domains/merchant/server/service';

export function AdminMerchantsClient() {
  const { data: merchants } = useSuspenseQuery(adminQueries.merchants());

  const columns: ColumnDef<MerchantWithDevices>[] = [
    {
      accessorKey: 'businessName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Business name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.businessName}</span>,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'deviceCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Devices" className="justify-end" />
      ),
      cell: ({ row }) => <div className="text-right">{row.original.deviceCount}</div>,
    },
  ];

  if (merchants.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Merchants</h1>
        <div className="mt-8 rounded-xl border border-dashed py-16 text-center">
          <p className="font-medium">No merchants registered</p>
          <p className="mt-1 text-sm text-muted-foreground">
            They will appear here after registering an account and setting up a business profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={merchants}
      showRowSelected={false}
      headerContent={
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Merchants</h1>
        </div>
      }
    />
  );
}
