'use client';

import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useEffect, useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { createActionsColumn } from '@/components/ui/data-table/actions-column';
import DataTable from '@/components/ui/data-table/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table/data-table-header';
import { DataTableSkeleton } from '@/components/ui/data-table/data-table-skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminMerchantListQuery, adminUserListQuery } from '@/domains/merchant/api/queries';
import {
  createOrganizationAction,
  deleteMerchantAction,
  updateOrganizationAction,
} from '@/domains/merchant/server/org-actions';
import type { OrganizationWithDevices } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

const ADMIN_MERCHANT_KEYS = ['merchant', 'admin-merchants'] as const;
const ADMIN_USER_KEYS = ['merchant', 'admin-users'] as const;

export function AdminMerchantsClient() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [addOpen, setAddOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<OrganizationWithDevices | null>(null);
  const [deletingOrg, setDeletingOrg] = useState<OrganizationWithDevices | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isPending } = useQuery(adminMerchantListQuery({ q: debouncedQ, page, limit }));
  const merchants = data?.rows ?? [];
  const total = data?.total ?? 0;

  const columns: ColumnDef<OrganizationWithDevices>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Merchant" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'slug',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Slug" />,
      cell: ({ row }) => <code className="text-xs text-muted-foreground">{row.original.slug}</code>,
    },
    {
      accessorKey: 'deviceCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Devices" className="justify-end" />
      ),
      cell: ({ row }) => <div className="text-right">{row.original.deviceCount}</div>,
    },
    createActionsColumn<OrganizationWithDevices>((org) => [
      { label: 'Edit', onClick: () => setEditingOrg(org) },
      { label: 'Delete', variant: 'destructive', onClick: () => setDeletingOrg(org) },
    ]),
  ];

  if (isPending && !data) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="text-xl font-semibold">Merchants</h1>
        <DataTableSkeleton columnCount={5} rowCount={5} />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={merchants}
        showRowSelected={false}
        manualPagination
        pageCount={Math.max(1, Math.ceil(total / limit))}
        pagination={{ pageIndex: page - 1, pageSize: limit }}
        onPaginationChange={(updater) => {
          const next =
            typeof updater === 'function'
              ? updater({ pageIndex: page - 1, pageSize: limit })
              : updater;
          setPage(next.pageIndex + 1);
          setLimit(next.pageSize);
        }}
        headerContent={<h1 className="text-xl font-semibold">Merchants</h1>}
        actions={<Button onClick={() => setAddOpen(true)}>Add merchant</Button>}
        toolbar={
          <Input
            aria-label="Search merchants…"
            placeholder="Search merchants…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="max-w-56"
          />
        }
      />
      <AddMerchantDialog open={addOpen} onOpenChange={setAddOpen} />
      {editingOrg && (
        <EditMerchantDialog
          key={editingOrg.id}
          org={editingOrg}
          onClose={() => setEditingOrg(null)}
        />
      )}
      {deletingOrg && (
        <DeleteMerchantDialog org={deletingOrg} onClose={() => setDeletingOrg(null)} />
      )}
    </>
  );
}

function AddMerchantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');

  const createOrg = useAction(createOrganizationAction, {
    successMsg: 'Merchant added',
    keys: [ADMIN_MERCHANT_KEYS, ADMIN_USER_KEYS],
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setName('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createOrg.mutate({ name: name.trim() });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add merchant</DialogTitle>
            <DialogDescription>
              Creates the merchant organization shell. The owner is assigned later from the edit
              dialog.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="org-name">Business name</Label>
            <Input id="org-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? 'Adding…' : 'Add merchant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMerchantDialog({
  org,
  onClose,
}: {
  org: OrganizationWithDevices;
  onClose: () => void;
}) {
  const [name, setName] = useState(org.name);
  const [ownerId, setOwnerId] = useState('');
  const { data: users } = useQuery(adminUserListQuery({ page: 1, limit: 100 }));
  const owner = (users?.rows ?? []).find((u) => u.organizationId === org.id && u.role === 'owner');

  useEffect(() => {
    if (owner && !ownerId) setOwnerId(owner.userId);
  }, [owner, ownerId]);

  const updateOrg = useAction(updateOrganizationAction, {
    successMsg: 'Merchant updated',
    keys: [ADMIN_MERCHANT_KEYS, ADMIN_USER_KEYS],
    onSuccess: onClose,
  });

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            updateOrg.mutate({
              organizationId: org.id,
              name: name.trim(),
              ownerId: ownerId || undefined,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {org.name}</DialogTitle>
            <DialogDescription>
              Change the business name or assign an owner from existing accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-org-name">Business name</Label>
            <Input
              id="edit-org-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-org-owner">Owner</Label>
            <Select
              items={[
                { value: '__none', label: 'No owner assigned' },
                ...(users?.rows.map((u) => ({
                  value: u.userId,
                  label: `${u.name} (${u.email})`,
                })) ?? []),
              ]}
              value={ownerId || '__none'}
              onValueChange={(value) => setOwnerId(value && value !== '__none' ? value : '')}
            >
              <SelectTrigger id="edit-org-owner" className="w-full">
                <SelectValue placeholder="Select owner…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No owner assigned</SelectItem>
                {users?.rows.map((u) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={updateOrg.isPending}>
              {updateOrg.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteMerchantDialog({
  org,
  onClose,
}: {
  org: OrganizationWithDevices;
  onClose: () => void;
}) {
  const deleteOrg = useAction(deleteMerchantAction, {
    successMsg: 'Merchant deleted',
    keys: [ADMIN_MERCHANT_KEYS, ADMIN_USER_KEYS],
    onSuccess: onClose,
  });

  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {org.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes the merchant organization and revokes access for its members. Devices assigned
            to it are unbound. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            render={(props) => (
              <Button variant="outline" {...props}>
                Cancel
              </Button>
            )}
          >
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={() => deleteOrg.mutate(org.id)}
            disabled={deleteOrg.isPending}
          >
            {deleteOrg.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
