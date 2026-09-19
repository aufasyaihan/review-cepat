'use server';

import { setupClaimCodeSchema } from '@/domains/device/schemas';
import { resolvePostClaim } from '@/domains/merchant/server/service';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { getSession } from '@/lib/session';
import { issueSetupToken } from '@/lib/setup-token';
import { claimAccountless } from './service';

/**
 * Public (no auth) step 1 of accountless setup (FR-004).
 * Validates the claim code for a slug, marks the device CLAIMED. With no
 * session, returns a short-lived setup token so step 2
 * (/s/{slug}/setup/redirect) can save destinations without an account. With
 * a session already present, skips straight to resolvePostClaim's branch
 * (direct org bind, or the owner's /option decision).
 */
export async function setupClaimCodeAction(
  slug: string,
  input: unknown,
): Promise<ActionResult<{ redirectUrl: string }>> {
  try {
    const parsed = setupClaimCodeSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? 'Invalid claim code');
    }
    const device = await claimAccountless(slug, parsed.data.claimCode);

    const token = issueSetupToken(device.id);
    const session = await getSession();
    if (session) {
      return ok(await resolvePostClaim(device.id, session.id, token));
    }

    return ok({ redirectUrl: `/s/${device.slug}/setup/redirect?t=${token}` });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Setup failed');
  }
}
