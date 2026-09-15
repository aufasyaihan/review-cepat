import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';

/**
 * Next.js 16 proxy (middleware rename). Session handling is delegated to Better
 * Auth: `auth.api.getSession` parses the cookie (custom prefix included),
 * validates the token, and loads the session from the database — so revoked or
 * expired sessions never reach protected pages. Role checks stay in the layouts.
 */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/devices/:path*', '/analytics/:path*', '/admin/:path*'],
};
