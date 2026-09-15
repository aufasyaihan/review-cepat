'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
import type { DeviceSummary } from '@/domains/device/types';
import { assignDeviceAction, unassignDeviceAction } from '@/domains/merchant/server/member-actions';
import type { MemberWithUser } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

export function MemberDetailClient({ member }: { member: MemberWithUser; organizationId: string }) {
  const { data: devices } = useSuspenseQuery(deviceQueries.list());

  const assign = useAction(
    (args: { deviceId: string; memberId: string }) =>
      assignDeviceAction(args.deviceId, args.memberId),
    {
      successMsg: 'Device assigned',
      keys: [deviceKeys.lists()],
    },
  );
  const unassign = useAction(unassignDeviceAction, {
    successMsg: 'Device unassigned',
    keys: [deviceKeys.lists()],
  });

  const assigned = devices.filter((d) => d.memberId === member.id);
  const pool = devices.filter((d) => !d.memberId);

  const assignedColumns: ColumnDef<DeviceSummary>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.status}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="outline"
            size="sm"
            disabled={unassign.isPending}
            onClick={() => unassign.mutate(row.original.id)}
          >
            Unassign
          </Button>
        </div>
      ),
    },
  ];

  const poolColumns: ColumnDef<DeviceSummary>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Device" />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            size="sm"
            disabled={assign.isPending}
            onClick={() => assign.mutate({ deviceId: row.original.id, memberId: member.id })}
          >
            Assign
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/user-management" className="text-sm text-muted-foreground hover:underline">
          ← User management
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {member.name}{' '}
          <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{member.role}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">{member.email}</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium">Assigned devices</h2>
        {assigned.length === 0 ? (
          <p className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
            No devices assigned yet.
          </p>
        ) : (
          <DataTable columns={assignedColumns} data={assigned} showRowSelected={false} />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Assign a device</h2>
        {pool.length === 0 ? (
          <p className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
            All devices are assigned.
          </p>
        ) : (
          <DataTable columns={poolColumns} data={pool} showRowSelected={false} />
        )}
      </section>
    </div>
  );
}
