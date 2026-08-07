import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { apiTokens } from '../db/drizzle/schema';
import { generateId } from '../utils/id-generator';
import { generateToken } from './generate';

export interface TokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Mints a token. The raw value is returned ONCE and never persisted. */
export async function createToken(
  userId: string,
  name: string
): Promise<{ token: string; id: string }> {
  const { token, hash, prefix } = generateToken();
  const id = generateId();
  await getDb().insert(apiTokens).values({ id, userId, name, tokenHash: hash, prefix });
  return { token, id };
}

/** Lists a user's own tokens, oldest first, including revoked ones. */
export async function listTokens(userId: string): Promise<TokenSummary[]> {
  const rows = await getDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(asc(apiTokens.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
  }));
}

/** Revokes a token. Scoped by userId so one user cannot revoke another's. */
export async function revokeToken(id: string, userId: string): Promise<boolean> {
  const updated = await getDb()
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });

  return updated.length > 0;
}
