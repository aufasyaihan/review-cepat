'use server';

import { setupClaimCodeSchema } from '@/domains/device/schemas';
import { type ActionResult, fail, ok } from '@/lib/action-result';
import { issueSetupToken } from '@/lib/setup-token';
import { claimAccountless } from './service';

/**
 * Public (no auth) step 1 of accountless setup (FR-004).
 * Validates the claim code for a slug, marks the device CLAIMED, and returns a
 * short-lived setup token so step 2 (/{slug}/setup/redirect) can save
 * destinations without an account.
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
    return ok({ redirectUrl: `/${device.slug}/setup/redirect?t=${token}` });
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Setup failed');
  }
}
