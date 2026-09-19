import { notFound, redirect } from 'next/navigation';
import { getBySlug } from '@/domains/device/server/service';
import { getSession } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';
import { OptionClient } from './option-client';

export const dynamic = 'force-dynamic';

export default async function DeviceOptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const device = await getBySlug(slug);
  if (!device) notFound();

  if (device.organizationId !== null) {
    redirect('/dashboard');
  }

  const token = t;
  if (typeof token !== 'string' || resolveSetupToken(token) !== device.id) {
    redirect(`/s/${slug}/setup`);
  }

  const session = await getSession();
  if (!session) {
    redirect(`/login?d=${token}`);
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">{device.name}</h1>
        <p className="text-sm text-muted-foreground">
          This device isn't linked to a merchant yet. What would you like to do?
        </p>
      </div>
      <OptionClient deviceId={device.id} token={token} />
    </div>
  );
}
