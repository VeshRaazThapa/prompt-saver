import { getServerSession } from 'next-auth';
import { authOptions } from './config';
import { AuthenticationError } from '../errors';
import { logger } from '../logging';

/**
 * Get the current session from the server
 * Throws AuthenticationError if not authenticated
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (session === null || session.user === undefined) {
    logger.warn('Unauthorized access attempt');
    throw new AuthenticationError('You must be signed in to access this resource');
  }

  return session;
}

/**
 * Get the current user ID from the session
 * Throws AuthenticationError if not authenticated
 */
export async function getCurrentUserId(): Promise<string> {
  const session = await requireAuth();
  return session.user.id;
}

/**
 * Get the current user from the session
 * Throws AuthenticationError if not authenticated
 */
export async function getCurrentUser() {
  const session = await requireAuth();
  return session.user;
}

/**
 * Check if the user is authenticated without throwing
 * Returns true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return session !== null && session.user !== undefined;
}
