'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { deviceKeys, deviceQueries } from '@/domains/device/api/queries';
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

  return (
    <div className="space-y-6">
      <div>
        <Link href="/members" className="text-sm text-muted-foreground hover:underline">
          ← Members
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {member.name}{' '}
          <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>{member.role}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">{member.email}</p>
      </div>

      <section className="rounded-md border">
        <h2 className="border-b px-4 py-2 text-sm font-medium">Assigned devices</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {assigned.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No devices assigned yet.
                </TableCell>
              </TableRow>
            )}
            {assigned.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.name}</TableCell>
                <TableCell className="text-muted-foreground">{d.status}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unassign.isPending}
                    onClick={() => unassign.mutate(d.id)}
                  >
                    Unassign
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-md border">
        <h2 className="border-b px-4 py-2 text-sm font-medium">Assign a device</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pool.length === 0 && (
              <TableRow>
                <TableCell className="text-muted-foreground">All devices are assigned.</TableCell>
              </TableRow>
            )}
            {pool.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{d.name}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    disabled={assign.isPending}
                    onClick={() => assign.mutate({ deviceId: d.id, memberId: member.id })}
                  >
                    Assign
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
