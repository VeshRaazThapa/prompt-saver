import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '../logging';

/**
 * Middleware to protect routes that require authentication
 * Redirects unauthenticated users to sign-in page
 */
export async function authMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth/');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  // Allow auth routes and API routes (they handle their own auth)
  if (isAuthRoute || isApiRoute) {
    return null;
  }

  // Redirect to sign-in if not authenticated
  if (token === null) {
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    logger.info(`Redirecting unauthenticated user to sign-in: ${request.nextUrl.pathname}`);
    return NextResponse.redirect(signInUrl);
  }

  // User is authenticated, allow request
  return null;
}

/**
 * Public routes that don't require authentication
 */
export const PUBLIC_ROUTES = ['/auth/signin', '/auth/error', '/auth/verify-request', '/api/auth'];

/**
 * Check if a path is a public route
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}
