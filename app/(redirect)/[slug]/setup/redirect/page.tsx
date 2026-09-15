import { notFound, redirect } from 'next/navigation';
import { getBySlug } from '@/domains/device/server/service';
import { verifySetupToken } from '@/lib/setup-token';
import { SetupRedirectClient } from './setup-redirect-client';

export const dynamic = 'force-dynamic';

export default async function SetupRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  const device = await getBySlug(slug);
  if (!device) notFound();

  const token = typeof t === 'string' ? t : '';
  if (!token || !verifySetupToken(token, device.id)) {
    redirect(`/${slug}/setup`);
  }

  return <SetupRedirectClient deviceId={device.id} token={token} deviceName={device.name} />;
}
