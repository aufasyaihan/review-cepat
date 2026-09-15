'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { inviteMemberAction } from '@/domains/merchant/server/member-actions';
import type { MemberWithUser } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

export function UserManagementClient() {
  const router = useRouter();
  const { data: members } = useSuspenseQuery(memberQueries.list());
  const [email, setEmail] = useState('');

  const invite = useAction(inviteMemberAction, {
    successMsg: 'Invitation sent',
    keys: [memberKeys.list()],
    onSuccess: () => setEmail(''),
  });

  const columns: ColumnDef<MemberWithUser>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => (
        <Badge variant={row.original.role === 'owner' ? 'default' : 'secondary'}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'deviceCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Devices" className="justify-end" />
      ),
      cell: ({ row }) => <div className="text-right">{row.original.deviceCount}</div>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.role === 'member' ? (
          <div className="text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/user-management/${row.original.id}`)}
            >
              Assign devices
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={members}
      showRowSelected={false}
      headerContent={
        <div className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">User management</h1>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({ email, role: 'member' });
            }}
          >
            <div>
              <Label htmlFor="invite-email">Invite a sub-merchant by email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="sub-merchant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Invite'}
            </Button>
          </form>
        </div>
      }
    />
  );
}
