import { notFound, redirect } from 'next/navigation';
import { getBySlug } from '@/domains/device/server/service';
import { getSession } from '@/lib/session';
import { issueSetupToken } from '@/lib/setup-token';
import { OptionClient } from './option-client';

export const dynamic = 'force-dynamic';

export default async function DeviceOptionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const device = await getBySlug(slug);
  if (!device) notFound();

  const session = await getSession();
  if (!session) {
    redirect(`/login?d=${issueSetupToken(device.id)}`);
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{device.name}</h1>
        <p className="text-sm text-muted-foreground">
          This device isn't linked to a merchant yet. What would you like to do?
        </p>
      </div>
      <OptionClient deviceId={device.id} />
    </div>
  );
}
