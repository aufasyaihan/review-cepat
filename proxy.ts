import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { Role } from '@/domains/auth/constants';
import { can } from '@/domains/auth/server/permissions';
import { getActiveOrganization } from '@/domains/merchant/server/permissions';
import { auth } from '@/lib/auth';

/**
 * Next.js 16 proxy (middleware rename). Session handling is delegated to Better
 * Auth: `auth.api.getSession` parses the cookie (custom prefix included),
 * validates the token, and loads the session from the database — so revoked or
 * expired sessions never reach protected pages. Authenticated requests are
 * then checked against the seeded `permission` table via `can(role, path)`.
 */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  const pathname = request.nextUrl.pathname;

  if (pathname === '/login') {
    return session
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Legacy groups stay guarded by their own layouts until Phase 6 removes them;
  // they have no permission rows yet while they still serve live routes.
  if (pathname.startsWith('/admin') || pathname.startsWith('/analytics')) {
    return NextResponse.next();
  }

  const role = ((session.user.role as Role | undefined) ?? 'MERCHANT') as Role;
  const membership = role === 'MERCHANT' ? await getActiveOrganization(session.user.id) : null;
  const orgRole = membership?.role ?? null;

  if (await can(role, orgRole, pathname)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/dashboard', request.url));
}

export const config = {
  matcher: [
    '/login',
    '/dashboard/:path*',
    '/devices/:path*',
    '/analytics/:path*',
    '/admin/:path*',
    '/user-management/:path*',
    '/merchants/:path*',
    '/settings/:path*',
  ],
};
