/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { rateLimits } from '@/lib/db/drizzle/schema';
import { createToken } from '@/lib/tokens/repository';
import {
  checkRateLimit,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
} from '@/lib/rate-limit/repository';
import { resetDb, seedUser, closeDb } from './helpers';

describe('checkRateLimit', () => {
  let userA: { userId: string; workspaceId: string };
  let userB: { userId: string; workspaceId: string };
  let tokenA: string;
  let tokenIdA: string;
  let tokenIdB: string;

  beforeEach(async () => {
    await resetDb();
    userA = await seedUser('user-a', 'a@example.com');
    userB = await seedUser('user-b', 'b@example.com');
    const a = await createToken(userA.userId, 'laptop-a');
    const b = await createToken(userB.userId, 'laptop-b');
    tokenA = a.token;
    tokenIdA = a.id;
    tokenIdB = b.id;
    void tokenA;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('allows requests under the limit', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      const result = await checkRateLimit(tokenIdA, now);
      expect(result.allowed).toBe(true);
    }
  });

  // Boundary: the exact Nth request that first gets refused must be
  // RATE_LIMIT_MAX_REQUESTS + 1 -- not one off in either direction.
  it('refuses exactly the request one past the limit, not before or after', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const results: boolean[] = [];
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS + 2; i++) {
      const result = await checkRateLimit(tokenIdA, now);
      results.push(result.allowed);
    }

    // Requests 1..RATE_LIMIT_MAX_REQUESTS (indices 0..MAX-1) allowed.
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      expect(results[i]).toBe(true);
    }
    // Request RATE_LIMIT_MAX_REQUESTS + 1 (index MAX) is the first refusal.
    expect(results[RATE_LIMIT_MAX_REQUESTS]).toBe(false);
    // And it stays refused afterward within the same window.
    expect(results[RATE_LIMIT_MAX_REQUESTS + 1]).toBe(false);
  });

  it('a refused request reports a positive retryAfterSeconds within the window', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await checkRateLimit(tokenIdA, now);
    }
    const refused = await checkRateLimit(tokenIdA, now);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(RATE_LIMIT_WINDOW_MS / 1000);
  });

  // THE ISOLATION GUARD -- exhausting token A's limit must never affect
  // token B. A shared/global counter bug would deny service to every other
  // user's token, which is the worst possible failure mode for this feature.
  it('exhausting one token limit does not affect another token', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await checkRateLimit(tokenIdA, now);
    }
    const exhaustedA = await checkRateLimit(tokenIdA, now);
    expect(exhaustedA.allowed).toBe(false);

    const freshB = await checkRateLimit(tokenIdB, now);
    expect(freshB.allowed).toBe(true);
  });

  it('allows requests again once the window rolls over', async () => {
    const windowOne = new Date('2026-01-01T00:00:00.000Z');
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      await checkRateLimit(tokenIdA, windowOne);
    }
    const refused = await checkRateLimit(tokenIdA, windowOne);
    expect(refused.allowed).toBe(false);

    const windowTwo = new Date(windowOne.getTime() + RATE_LIMIT_WINDOW_MS);
    const allowedAgain = await checkRateLimit(tokenIdA, windowTwo);
    expect(allowedAgain.allowed).toBe(true);
  });

  it('cleans up rows from earlier windows instead of accumulating them', async () => {
    const windowOne = new Date('2026-01-01T00:00:00.000Z');
    await checkRateLimit(tokenIdA, windowOne);

    const windowTwo = new Date(windowOne.getTime() + RATE_LIMIT_WINDOW_MS);
    await checkRateLimit(tokenIdA, windowTwo);

    const windowThree = new Date(windowOne.getTime() + 2 * RATE_LIMIT_WINDOW_MS);
    await checkRateLimit(tokenIdA, windowThree);

    const rows = await getDb().select().from(rateLimits).where(eq(rateLimits.tokenId, tokenIdA));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.windowStart.getTime()).toBe(windowThree.getTime());
  });
});
