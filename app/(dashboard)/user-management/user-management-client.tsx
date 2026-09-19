'use client';

import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { cn } from 'cn';
import { CheckIcon, ChevronsUpDown } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { adminUserListQuery, memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { useMerchantOptions } from '@/domains/merchant/api/use-merchant-options';
import {
  createUserAction,
  deleteUserAction,
  removeMemberAction,
  updateUserAction,
} from '@/domains/merchant/server/member-actions';
import type { AdminUserRow, MemberWithUser } from '@/domains/merchant/server/service';
import { useAction } from '@/hooks/use-action';

const ADMIN_USER_KEYS = ['merchant', 'admin-users'] as const;

type UserErrors = Partial<
  Record<'name' | 'email' | 'password' | 'role' | 'organizationId', string>
>;

function validateUser(input: {
  name: string;
  email: string;
  password?: string;
  role: string;
  organizationId: string;
}): UserErrors {
  const errors: UserErrors = {};
  if (!input.name.trim()) errors.name = 'Name is required';
  if (!/\S+@\S+\.\S+/.test(input.email.trim())) errors.email = 'Enter a valid email';
  if (input.password !== undefined && input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (!input.role) errors.role = 'Select a role';
  if (!input.organizationId) errors.organizationId = 'Select a merchant';
  return errors;
}

export function UserManagementClient({ isAdmin }: { isAdmin: boolean }) {
  return isAdmin ? <AdminUsersTable /> : <MerchantUsersTable />;
}

// ---------------------------------------------------------------------------
// MERCHANT owner branch (unchanged): org members via /api/merchant/members,
// Edit navigates to the member detail page for device assign/unassign.
// ---------------------------------------------------------------------------

function MerchantUsersTable() {
  const { data: members } = useSuspenseQuery(memberQueries.list());
  const [pendingDeleteMember, setPendingDeleteMember] = useState<MemberWithUser | null>(null);

  const removeMember = useAction(
    (args: { memberId: string; organizationId: string }) => removeMemberAction(args),
    {
      successMsg: 'Member removed',
      keys: [memberKeys.list()],
      onSuccess: () => setPendingDeleteMember(null),
    },
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
    createActionsColumn<MemberWithUser>((row) => [
      { label: 'Delete', variant: 'destructive', onClick: () => setPendingDeleteMember(row) },
    ]),
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={members}
        showRowSelected={false}
        headerContent={<h1 className="text-xl font-semibold">User management</h1>}
      />
      <Dialog
        open={!!pendingDeleteMember}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteMember(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingDeleteMember?.name}?</DialogTitle>
            <DialogDescription>
              They will lose access to this organization's devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={removeMember.isPending}
              onClick={() => {
                if (pendingDeleteMember) {
                  removeMember.mutate({
                    memberId: pendingDeleteMember.id,
                    organizationId: pendingDeleteMember.organizationId,
                  });
                }
                setPendingDeleteMember(null);
              }}
            >
              {removeMember.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// ADMIN branch: server-driven list (FR-055) with debounced search, infinite
// merchant combobox filter (FR-056), and in-place Add/Edit/Delete dialogs.
// ---------------------------------------------------------------------------

function AdminUsersTable() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [addOpen, setAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isPending } = useQuery(
    adminUserListQuery({
      q: debouncedQ,
      organizationId: organizationId || undefined,
      page,
      limit,
    }),
  );
  const users = data?.rows ?? [];
  const total = data?.total ?? 0;

  const columns: ColumnDef<AdminUserRow>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    },
    {
      accessorKey: 'organizationName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Merchant" />,
      cell: ({ row }) => row.original.organizationName ?? '—',
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) =>
        row.original.platformRole === 'ADMIN' ? (
          <Badge variant="secondary">admin</Badge>
        ) : row.original.role ? (
          <Badge variant={row.original.role === 'owner' ? 'default' : 'secondary'}>
            {row.original.role}
          </Badge>
        ) : (
          <Badge variant="secondary">unassigned</Badge>
        ),
    },
    {
      accessorKey: 'deviceCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Devices" className="justify-start" />
      ),
      cell: ({ row }) => <div className="text-start">{row.original.deviceCount}</div>,
    },
    createActionsColumn<AdminUserRow>((row) =>
      row.memberId
        ? [
            { label: 'Edit', onClick: () => setEditingUser(row) },
            { label: 'Delete', variant: 'destructive', onClick: () => setDeletingUser(row) },
          ]
        : [],
    ),
  ];

  if (isPending && !data) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <h1 className="text-xl font-semibold">User management</h1>
        <DataTableSkeleton columnCount={6} rowCount={5} />
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
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
        headerContent={<h1 className="text-xl font-semibold">User management</h1>}
        actions={<Button onClick={() => setAddOpen(true)}>Add user</Button>}
        toolbar={
          <>
            <Input
              aria-label="Search users…"
              placeholder="Search users…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full"
            />
            <MerchantCombobox
              value={organizationId}
              onChange={(value) => {
                setOrganizationId(value);
                setPage(1);
              }}
              placeholder="All merchants…"
              showAllOption
            />
          </>
        }
      />
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
      {editingUser && (
        <EditUserDialog
          key={editingUser.id}
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}
      {deletingUser && (
        <DeleteUserDialog user={deletingUser} onClose={() => setDeletingUser(null)} />
      )}
    </>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState('');
  const [errors, setErrors] = useState<UserErrors>({});

  const createUser = useAction(createUserAction, {
    successMsg: 'User added',
    keys: [ADMIN_USER_KEYS],
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName('');
          setEmail('');
          setPassword('');
          setOrganizationId('');
          setRole('');
          setErrors({});
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const nextErrors = validateUser({ name, email, password, role, organizationId });
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) return;
            createUser.mutate({
              name: name.trim(),
              email: email.trim(),
              password,
              organizationId,
              role,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Create a platform account and assign it to a merchant as owner or member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="user-name">Name</Label>
            <Input
              id="user-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">Password</Label>
            <Input
              id="user-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-org">Merchant</Label>
            <MerchantCombobox
              value={organizationId}
              onChange={setOrganizationId}
              placeholder="Select merchant…"
              className="w-full"
              id="user-org"
            />
            {errors.organizationId && (
              <p className="text-xs text-destructive">{errors.organizationId}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">Role</Label>
            <RoleSelect id="user-role" value={role} onValueChange={setRole} />
            {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Adding…' : 'Add user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [organizationId, setOrganizationId] = useState(user.organizationId ?? '');
  const [role, setRole] = useState(user.role ?? '');
  const [errors, setErrors] = useState<UserErrors>({});

  const updateUser = useAction(updateUserAction, {
    successMsg: 'User updated',
    keys: [ADMIN_USER_KEYS],
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
            const nextErrors = validateUser({ name, email, role, organizationId });
            setErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) return;
            updateUser.mutate({
              memberId: user.id,
              name: name.trim(),
              email: email.trim(),
              role,
              organizationId,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Rename, change email, move the user to another merchant, or change their role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Name</Label>
            <Input
              id="edit-user-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-org">Merchant</Label>
            <MerchantCombobox
              value={organizationId}
              onChange={setOrganizationId}
              placeholder="Select merchant…"
              className="w-full"
              id="edit-user-org"
            />
            {errors.organizationId && (
              <p className="text-xs text-destructive">{errors.organizationId}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-user-role">Role</Label>
            <RoleSelect
              id="edit-user-role"
              value={role}
              onValueChange={(value) => setRole(value as 'owner' | 'member')}
            />
            {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  const deleteUser = useAction(deleteUserAction, {
    successMsg: 'User deleted',
    keys: [ADMIN_USER_KEYS],
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
          <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes the user from {user.organizationName} and deactivates their account. This cannot
            be undone.
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
            onClick={() => deleteUser.mutate(user.id)}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RoleSelect({
  id,
  value,
  onValueChange,
}: {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select
      items={{ __none: 'Select role…', owner: 'Owner', member: 'Member' }}
      value={value || '__none'}
      onValueChange={(next) => onValueChange(next && next !== '__none' ? next : '')}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Select role…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Select role…</SelectItem>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="member">Member</SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Infinite "merchant" combobox (FR-056): pages stream in via useInfiniteQuery as
 * the admin types (debounced) and scrolls — never client-filtered, never
 * prefetched. `value` is an organizationId.
 */
function MerchantCombobox({
  value,
  onChange,
  placeholder = 'Select merchant…',
  showAllOption = false,
  className,
  id,
}: {
  value: string;
  onChange: (organizationId: string) => void;
  placeholder?: string;
  showAllOption?: boolean;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const { options, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMerchantOptions(debouncedQ);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!value) {
      setQ('');
      setDebouncedQ('');
      setSelectedName(null);
    }
  }, [value]);

  const selected = options.find((o) => o.id === value);
  const label = selected?.name ?? selectedName ?? placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <Button
            type="button"
            variant="outline"
            id={id}
            className={cn('justify-between font-normal shrink-0 w-full flex-1', className)}
            {...props}
          >
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        )}
      />
      <PopoverContent align="start" className="p-1">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search merchants…"
          className="mb-1 border-0 focus-visible:ring-0"
        />
        <div
          className="max-h-64 overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
              if (hasNextPage && !isFetchingNextPage) fetchNextPage();
            }
          }}
        >
          {showAllOption && value && (
            <button
              type="button"
              className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              All merchants
            </button>
          )}
          {options.length === 0 && !isFetchingNextPage ? (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">
              No merchants found
            </p>
          ) : (
            options.map((o) => (
              <button
                type="button"
                key={o.id}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted',
                  value === o.id && 'bg-muted',
                )}
                onClick={() => {
                  setSelectedName(o.name);
                  onChange(o.id);
                  setOpen(false);
                }}
              >
                <span className="truncate">{o.name}</span>
                {value === o.id && <CheckIcon className="size-4 shrink-0" />}
              </button>
            ))
          )}
          {hasNextPage && !isFetchingNextPage && (
            <Button variant="ghost" size="xs" className="w-full" onClick={() => fetchNextPage()}>
              Load more
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
