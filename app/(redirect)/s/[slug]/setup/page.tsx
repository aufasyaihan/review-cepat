import { notFound } from 'next/navigation';

import { getBySlug } from '@/domains/device/server/service';
import { SetupClaimForm } from './setup-claim-form';

export const dynamic = 'force-dynamic';

export default async function SetupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const device = await getBySlug(slug);
  if (!device) notFound();

  if (device.status === 'DISABLED') {
    return (
      <div className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold">This device is disabled</h1>
        <p className="text-sm text-muted-foreground">
          It cannot be set up right now. Contact the seller for help.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <SetupClaimForm slug={slug} />
    </div>
  );
}
