'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { inviteMemberAction } from '@/domains/merchant/server/member-actions';
import type { MemberWithUser, OrganizationWithDevices } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

export function UserManagementClient({
  isAdmin,
  organizations,
}: {
  isAdmin: boolean;
  organizations: OrganizationWithDevices[];
}) {
  const router = useRouter();
  const { data: members } = useSuspenseQuery(memberQueries.list());
  const [email, setEmail] = useState('');
  const [viewOrgId, setViewOrgId] = useState('');
  const [inviteOrgId, setInviteOrgId] = useState('');

  const invite = useAction(
    (args: { email: string; role: 'owner' | 'member'; organizationId?: string }) =>
      inviteMemberAction(args),
    {
      successMsg: 'Invitation sent',
      keys: [memberKeys.list()],
      onSuccess: () => setEmail(''),
    },
  );

  const visibleMembers = useMemo(
    () => (isAdmin && viewOrgId ? members.filter((m) => m.organizationId === viewOrgId) : members),
    [members, isAdmin, viewOrgId],
  );

  const columns: ColumnDef<MemberWithUser>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    ...(isAdmin
      ? ([
          {
            accessorKey: 'organizationName',
            header: ({ column }) => <DataTableColumnHeader column={column} title="Organization" />,
          },
        ] as ColumnDef<MemberWithUser>[])
      : []),
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
      data={visibleMembers}
      showRowSelected={false}
      headerContent={
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">User management</h1>
            {isAdmin && (
              <div className="w-56">
                <Label htmlFor="view-org">Filter by organization</Label>
                <Select
                  value={viewOrgId || 'all'}
                  onValueChange={(value: string | null) =>
                    setViewOrgId(value && value !== 'all' ? value : '')
                  }
                >
                  <SelectTrigger id="view-org" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate({
                email,
                role: 'member',
                organizationId: isAdmin ? inviteOrgId : undefined,
              });
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
            {isAdmin && (
              <div className="w-56">
                <Label htmlFor="invite-org">Into organization</Label>
                <Select
                  value={inviteOrgId}
                  onValueChange={(value: string | null) => setInviteOrgId(value ?? '')}
                >
                  <SelectTrigger id="invite-org" className="mt-1">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={invite.isPending || (isAdmin && !inviteOrgId)}>
              {invite.isPending ? 'Sending…' : 'Invite'}
            </Button>
          </form>
        </div>
      }
    />
  );
}
