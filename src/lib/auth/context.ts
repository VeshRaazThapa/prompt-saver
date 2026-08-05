import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { users, workspaces } from '../db/drizzle/schema';
import { requireAuth } from './session';
import { generateId } from '../utils/id-generator';

export interface UserContext {
  userId: string;
  workspaceId: string;
}

/**
 * Resolves the signed-in user, ensuring their row and their single private
 * workspace both exist.
 *
 * Every Server Action starts here. The workspaceId it returns is the ONLY
 * legitimate source of workspace scoping — never accept one from the client.
 */
export async function getCurrentContext(): Promise<UserContext> {
  const session = await requireAuth();
  const { id: userId, email, name, image } = session.user;
  const db = getDb();

  await db
    .insert(users)
    .values({ id: userId, email, name, avatar: image, lastLogin: new Date() })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, name, avatar: image, lastLogin: new Date() },
    });

  // Oldest-first so that if a race ever created two, every request converges
  // on the same one. See the spec: no UNIQUE constraint, by choice.
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  const found = existing[0];
  if (found !== undefined) {
    return { userId, workspaceId: found.id };
  }

  const workspaceId = generateId();
  await db.insert(workspaces).values({ id: workspaceId, userId, name: 'My Workspace' });
  return { userId, workspaceId };
}
