'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { memberKeys, memberQueries } from '@/domains/merchant/api/queries';
import { inviteMemberAction } from '@/domains/merchant/server/member-actions';
import { useAction } from '@/hooks/use-action';

export function MembersClient() {
  const router = useRouter();
  const { data: members } = useSuspenseQuery(memberQueries.list());
  const [email, setEmail] = useState('');

  const invite = useAction(inviteMemberAction, {
    successMsg: 'Invitation sent',
    keys: [memberKeys.list()],
    onSuccess: () => setEmail(''),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Members</h1>

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Devices</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-muted-foreground">{m.email}</TableCell>
                <TableCell>
                  <Badge variant={m.role === 'owner' ? 'default' : 'secondary'}>{m.role}</Badge>
                </TableCell>
                <TableCell className="text-right">{m.deviceCount}</TableCell>
                <TableCell className="text-right">
                  {m.role === 'member' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/members/${m.id}`)}
                    >
                      Assign devices
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
