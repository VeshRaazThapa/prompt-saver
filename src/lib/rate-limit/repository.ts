import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { rateLimits } from '../db/drizzle/schema';

/** Fixed window length for MCP token rate limiting, in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Requests a single API token may make within one window before it is
 * refused. Generous on purpose: an MCP client (e.g. a Claude Code session)
 * bursts on connect (initialize, tools/list, prompts/list) and then goes
 * quiet, so the ceiling only needs to stop sustained abuse, not a normal
 * connect burst.
 */
export const RATE_LIMIT_MAX_REQUESTS = 120;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window ends. 0 when `allowed` is true. */
  retryAfterSeconds: number;
}

/**
 * Fixed-window rate limit check for one API token, with the bookkeeping
 * that keeps `rate_limits` from growing without bound.
 *
 * The window boundary is derived from `now` by flooring to the nearest
 * `RATE_LIMIT_WINDOW_MS` multiple, so every call within the same 60s
 * wall-clock window maps to the same `windowStart` row.
 *
 * Atomically increments (or creates) that row via an UPSERT with a
 * returning count: the increment and the read of the post-increment count
 * happen as one statement, so concurrent requests for the same token
 * serialize on the row instead of racing a separate check-then-write
 * (which could let two simultaneous requests both read "119" and both
 * proceed, overshooting the limit). It then deletes this token's rows from
 * windows strictly older than the current one -- a second statement,
 * bounded to this token only via the `tokenId` filter, so one token's
 * traffic can never touch another token's rows and the table holds at most
 * one row per active token.
 *
 * `now` defaults to `new Date()` but can be injected so tests can assert
 * exact window-boundary and rollover behavior without sleeping.
 */
export async function checkRateLimit(
  tokenId: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const db = getDb();
  const windowStart = new Date(
    Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS
  );

  const [row] = await db
    .insert(rateLimits)
    .values({ tokenId, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.tokenId, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  await db
    .delete(rateLimits)
    .where(and(eq(rateLimits.tokenId, tokenId), lt(rateLimits.windowStart, windowStart)));

  const count = row?.count ?? 1;
  if (count <= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const windowEndMs = windowStart.getTime() + RATE_LIMIT_WINDOW_MS;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - now.getTime()) / 1000));
  return { allowed: false, retryAfterSeconds };
}
