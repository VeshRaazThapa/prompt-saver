import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { users, workspaces } from '@/lib/db/drizzle/schema';

export { closeDb } from '@/lib/db/drizzle/client';

/** Truncates every table. Call in beforeEach so tests never share state. */
export async function resetDb(): Promise<void> {
  const db = getDb();
  await db.execute(
    sql`TRUNCATE TABLE prompt_versions, prompts, workspaces, users RESTART IDENTITY CASCADE`
  );
}

export async function seedUser(
  id = 'user-1',
  email = 'user1@example.com'
): Promise<{ userId: string; workspaceId: string }> {
  const db = getDb();
  await db.insert(users).values({ id, email, name: `Test ${id}` });
  const workspaceId = `ws-${id}`;
  await db.insert(workspaces).values({ id: workspaceId, userId: id, name: 'My Workspace' });
  return { userId: id, workspaceId };
}
