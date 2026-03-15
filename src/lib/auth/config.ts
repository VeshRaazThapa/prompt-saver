import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getUserRepository, getWorkspaceRepository } from '@/lib/db/repositories/factory';
import { generateId } from '@/lib/utils/id-generator';
import { toISO8601 } from '@/lib/utils/datetime';
import { logger } from '@/lib/logging';
import type { User, Workspace } from '@/types';

/**
 * NextAuth configuration
 * Handles Google OAuth authentication and user session management
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    }),
  ],

  callbacks: {
    /**
     * Called when a user signs in
     * Creates or updates user record in the database
     */
    async signIn({ user }) {
      try {
        if (!user.email) {
          logger.error('Sign in failed: no email provided');
          return false;
        }

        const userRepo = getUserRepository();
        const existingUser = await userRepo.findByEmail(user.email);
        const now = toISO8601(new Date());

        if (existingUser === null) {
          // Create new user
          const newUser: User = {
            id: generateId(),
            email: user.email,
            name: user.name ?? user.email.split('@')[0],
            avatar: user.image ?? undefined,
            created_at: now,
            last_login: now,
            tier: 'free',
          };

          await userRepo.create(newUser);
          logger.info(`New user created: ${newUser.id}`);

          // Create default workspace for new user
          const workspaceRepo = getWorkspaceRepository();
          const defaultWorkspace: Workspace = {
            id: generateId(),
            user_id: newUser.id,
            name: 'Default Workspace',
            created_at: now,
            updated_at: now,
            settings: {},
            metadata: {
              promptCount: 0,
              lastActivity: now,
            },
          };

          await workspaceRepo.create(defaultWorkspace);
          logger.info(`Default workspace created: ${defaultWorkspace.id}`);
        } else {
          // Update existing user
          await userRepo.update(existingUser.id, {
            name: user.name ?? existingUser.name,
            avatar: user.image ?? existingUser.avatar,
            last_login: now,
          });
          logger.info(`User updated: ${existingUser.id}`);
        }

        return true;
      } catch (error) {
        logger.error('Sign in error', error as Error);
        return false;
      }
    },

    /**
     * Called when a JWT is created or updated
     * Adds user ID to the token
     */
    async jwt({ token, user }) {
      if (user?.email !== undefined && user.email !== null) {
        const userRepo = getUserRepository();
        const dbUser = await userRepo.findByEmail(user.email);
        if (dbUser !== null) {
          token.userId = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.picture = dbUser.avatar ?? null;
        }
      }
      return token;
    },

    /**
     * Called when a session is checked
     * Adds user info to the session
     */
    async session({ session, token }) {
      if (session.user !== undefined) {
        session.user.id = token.userId as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

// Export configured NextAuth instance
export default NextAuth(authOptions);
