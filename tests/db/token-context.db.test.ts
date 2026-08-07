/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { apiTokens } from '@/lib/db/drizzle/schema';
import { createToken, revokeToken, listTokens } from '@/lib/tokens/repository';
import { resolveTokenContext } from '@/lib/auth/token-context';
import { resetDb, seedUser, closeDb } from './helpers';

describe('resolveTokenContext', () => {
  let userA: { userId: string; workspaceId: string };
  let userB: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    userA = await seedUser('user-a', 'a@example.com');
    userB = await seedUser('user-b', 'b@example.com');
  });

  afterAll(async () => {
    await closeDb();
  });

  it('resolves a valid token to its owner workspace', async () => {
    const { token } = await createToken(userA.userId, 'laptop');
    const ctx = await resolveTokenContext(token);

    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe(userA.userId);
    expect(ctx?.workspaceId).toBe(userA.workspaceId);
  });

  // THE ISOLATION GUARD — a token must never resolve to another user's workspace.
  it('never resolves one user token to another user workspace', async () => {
    const { token } = await createToken(userA.userId, 'laptop');
    const ctx = await resolveTokenContext(token);

    expect(ctx?.workspaceId).not.toBe(userB.workspaceId);
    expect(ctx?.userId).not.toBe(userB.userId);
  });

  it('rejects an unknown token', async () => {
    expect(await resolveTokenContext('ps_completelymadeup')).toBeNull();
  });

  it('rejects a malformed token', async () => {
    expect(await resolveTokenContext('')).toBeNull();
    expect(await resolveTokenContext('not-a-token')).toBeNull();
  });

  it('rejects a revoked token', async () => {
    const { token, id } = await createToken(userA.userId, 'laptop');
    expect(await resolveTokenContext(token)).not.toBeNull();

    await revokeToken(id, userA.userId);
    expect(await resolveTokenContext(token)).toBeNull();
  });

  it('stores only the hash, never the raw token', async () => {
    const { token } = await createToken(userA.userId, 'laptop');
    const rows = await getDb().select().from(apiTokens);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(JSON.stringify(rows[0])).not.toContain(token.slice(3));
  });

  it('sets last_used_at on first use', async () => {
    const { token, id } = await createToken(userA.userId, 'laptop');
    await resolveTokenContext(token);

    const [row] = await getDb().select().from(apiTokens).where(eq(apiTokens.id, id));
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it('does not rewrite last_used_at on every call', async () => {
    const { token, id } = await createToken(userA.userId, 'laptop');
    await resolveTokenContext(token);
    const [first] = await getDb().select().from(apiTokens).where(eq(apiTokens.id, id));

    await resolveTokenContext(token);
    const [second] = await getDb().select().from(apiTokens).where(eq(apiTokens.id, id));

    expect(second?.lastUsedAt?.getTime()).toBe(first?.lastUsedAt?.getTime());
  });

  // A revoked token stays listed as a record rather than vanishing.
  it('listTokens returns only the caller tokens, including revoked ones', async () => {
    const a = await createToken(userA.userId, 'laptop');
    await createToken(userB.userId, 'other-user-machine');
    await revokeToken(a.id, userA.userId);

    const list = await listTokens(userA.userId);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('laptop');
    expect(list[0]?.revokedAt).not.toBeNull();
  });

  // THE ISOLATION GUARD — revoking is scoped to the owner.
  it('refuses to revoke another user token', async () => {
    const b = await createToken(userB.userId, 'victim');
    expect(await revokeToken(b.id, userA.userId)).toBe(false);
    expect(await resolveTokenContext(b.token)).not.toBeNull();
  });
});
