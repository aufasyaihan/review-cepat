'use client';

import { useSuspenseQuery } from '@tanstack/react-query';
import { adminQueries } from '@/domains/admin/api/queries';

export function AdminMerchantsClient() {
  const { data: merchants } = useSuspenseQuery(adminQueries.merchants());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Merchants</h1>
      {merchants.length === 0 ? (
        <Empty />
      ) : (
        <table className="w-full rounded border text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3">Business name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Devices</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{m.businessName}</td>
                <td className="p-3 text-xs text-muted-foreground">{m.email}</td>
                <td className="p-3">{m.deviceCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded border border-dashed p-6 text-center">
      <p className="font-medium">No merchants registered</p>
      <p className="mt-1 text-sm text-muted-foreground">
        They will appear here after registering an account and setting up a business profile.
      </p>
    </div>
  );
}
