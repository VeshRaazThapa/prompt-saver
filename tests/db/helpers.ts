import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { users, workspaces } from '@/lib/db/drizzle/schema';

export { closeDb } from '@/lib/db/drizzle/client';

/**
 * True only for URLs that are unambiguously a test database: localhost /
 * 127.0.0.1 hosts, or a database name ending in `_test` (for a remote test
 * database, e.g. a scratch Neon branch). Anything else — including a
 * malformed or unparseable URL — is treated as NOT a test database, so the
 * caller refuses rather than guesses.
 *
 * A pure function so the decision logic can be unit tested without a live
 * connection. See resetDb() below for why this guard exists at all.
 */
export function isTestDatabaseUrl(url: string): boolean {
  if (url === '') return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return true;
  const databaseName = parsed.pathname.replace(/^\//, '');
  return databaseName.endsWith('_test');
}

/** Best-effort host description for error messages, safe for malformed/missing URLs. */
function describeHost(url: string): string {
  if (url === '') return '(DATABASE_URL is not set)';
  try {
    return new URL(url).hostname || '(URL has no host)';
  } catch {
    return `(DATABASE_URL is malformed: "${url}")`;
  }
}

/**
 * Truncates every table. Call in beforeEach so tests never share state.
 *
 * GUARDED: .env.test does NOT protect against a shell-exported DATABASE_URL
 * winning over it (Next's env loader only assigns a key when it is absent
 * from process.env, so `vercel env pull && source .env` before `npm test`
 * would otherwise point this straight at production). Refuses to run unless
 * the target is unmistakably a test database.
 */
export async function resetDb(): Promise<void> {
  const url = process.env['DATABASE_URL'] ?? '';
  if (!isTestDatabaseUrl(url)) {
    throw new Error(
      `resetDb() refused to run: DATABASE_URL does not look like a test database ` +
        `(host: ${describeHost(url)}). This guard exists because .env.test does not ` +
        `override an already-exported shell DATABASE_URL — refusing to TRUNCATE tables ` +
        `against what may be production. Point DATABASE_URL at a localhost/127.0.0.1 ` +
        `database, or one whose name ends in "_test", to run these tests.`
    );
  }

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
