'use server';

import { resolvePostClaim } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { getSession } from '@/lib/session';
import { resolveSetupToken } from '@/lib/setup-token';

/**
 * Called client-side right after a successful login/register that carried
 * a `?d=` device token (the onboarding handoff, or a session-first /option
 * round trip through /login). Resolves the token to a device id and runs
 * the same post-claim branch as setupClaimCodeAction.
 */
export async function linkDeviceAfterAuthAction(
  token: string,
): Promise<ActionResult<{ redirectUrl: string }>> {
  const session = await getSession();
  if (!session) return fail('Not signed in');

  const deviceId = resolveSetupToken(token);
  if (!deviceId) return fail('This device link has expired — please scan the device again');

  try {
    return ok(await resolvePostClaim(deviceId, session.id));
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not link this device');
  }
}
