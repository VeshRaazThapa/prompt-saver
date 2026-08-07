import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { apiTokens, workspaces } from '../db/drizzle/schema';
import { hashToken } from '../tokens/generate';
import type { UserContext } from './context';

const LAST_USED_THROTTLE_MS = 60 * 60 * 1000;

/**
 * The MCP entrance to user identity.
 *
 * Returns the SAME shape as getCurrentContext() so both authentication paths
 * converge immediately and everything downstream — requireOwnedPrompt, the
 * repositories, workspace scoping — is reused unchanged.
 *
 * Returns null for every failure (unknown, malformed, revoked) so callers
 * cannot distinguish them. See the design spec, section 6.
 */
export async function resolveTokenContext(token: string): Promise<UserContext | null> {
  if (!token.startsWith('ps_')) {
    return null;
  }
  const db = getDb();

  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (row === undefined || row.revokedAt !== null) {
    return null;
  }

  const found = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, row.userId))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  const workspace = found[0];
  if (workspace === undefined) {
    return null;
  }

  // Throttled: otherwise every MCP call becomes a write for a field only a
  // human ever reads.
  const threshold = new Date(Date.now() - LAST_USED_THROTTLE_MS);
  if (row.lastUsedAt === null || row.lastUsedAt < threshold) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  }

  return { userId: row.userId, workspaceId: workspace.id };
}
