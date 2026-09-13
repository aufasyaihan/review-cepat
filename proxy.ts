import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Next.js 16 proxy (middleware rename). Edge-level session guard for Better Auth:
 * unauthenticated users are redirected to /login before any protected area renders.
 * Pages still enforce role-level checks server-side via lib/session.ts (RBAC).
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/devices/:path*', '/analytics/:path*', '/admin/:path*'],
};
