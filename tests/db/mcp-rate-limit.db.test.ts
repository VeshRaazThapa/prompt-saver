/**
 * @jest-environment node
 */
import { POST } from '@/app/api/mcp/route';
import { getDb } from '@/lib/db/drizzle/client';
import { rateLimits } from '@/lib/db/drizzle/schema';
import { createToken } from '@/lib/tokens/repository';
import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from '@/lib/rate-limit/repository';
import { resetDb, seedUser, closeDb } from './helpers';

const MCP_URL = 'http://localhost:3000/api/mcp';

// Mirrors tests/db/mcp-route.db.test.ts's fixtures for the same reasons
// documented there: the 2026-07-28 MCP spec requires both media types on
// every POST.
const ACCEPT = 'application/json, text/event-stream';

function initializeRequest(token: string): Request {
  return new Request(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: ACCEPT,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'mcp-rate-limit.db.test', version: '0.0.0' },
      },
    }),
  });
}

/**
 * Seeds a token as already having made `count` requests in the CURRENT
 * fixed window, computed the same way `checkRateLimit` does. This drives
 * these route-wiring tests to the limit boundary with a single real HTTP
 * call instead of looping ~120 real requests through the route -- looping
 * would tie correctness to wall-clock time (a loop that happens to straddle
 * a real minute boundary would silently reset the counter mid-test, an
 * intermittent failure this repo's testing conventions explicitly rule out
 * -- see tests/db/rate-limit.db.test.ts, which covers exact boundary and
 * rollover behavior deterministically via an injected `now`). This file
 * only needs to prove the ROUTE WIRES the (already unit-tested) rate
 * limiter in correctly -- 429 status, Retry-After header, scoped by token,
 * short-circuits before the MCP handler -- not re-prove the counting logic.
 */
async function seedTokenAtCount(tokenId: string, count: number): Promise<void> {
  const windowStart = new Date(Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS);
  await getDb().insert(rateLimits).values({ tokenId, windowStart, count });
}

describe('MCP route rate limiting (src/app/api/mcp/route.ts)', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');
  });

  afterAll(async () => {
    await closeDb();
  });

  it('allows a request from a token still under its limit', async () => {
    const { token, id } = await createToken(a.userId, 'laptop');
    await seedTokenAtCount(id, RATE_LIMIT_MAX_REQUESTS - 1);

    const res = await POST(initializeRequest(token));
    expect(res.status).toBe(200);
  });

  it(
    'returns 429 with a Retry-After header once a token is already at its limit, ' +
      'and the over-limit response never reaches the MCP handler',
    async () => {
      const { token, id } = await createToken(a.userId, 'laptop');
      await seedTokenAtCount(id, RATE_LIMIT_MAX_REQUESTS);

      const res = await POST(initializeRequest(token));
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).not.toBeNull();
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);

      // A plain JSON error, not an MCP JSON-RPC envelope -- proof the
      // request was turned away before it ever reached the MCP handler.
      const body = (await res.json()) as { error?: string; message?: string };
      expect(body.error).toBeDefined();
      expect(body).not.toHaveProperty('jsonrpc');
    }
  );

  // Scope is per API token, not per user and not per IP: exhausting one
  // token must never deny a different token -- including another token
  // belonging to the SAME user.
  it("does not let one token's exhausted limit deny a different token, including another token of the same user", async () => {
    const { token: exhausted, id: exhaustedId } = await createToken(a.userId, 'laptop');
    const { token: sameUserOtherToken } = await createToken(a.userId, 'phone');
    const { token: otherUserToken } = await createToken(b.userId, 'laptop');
    await seedTokenAtCount(exhaustedId, RATE_LIMIT_MAX_REQUESTS);

    const deniedRes = await POST(initializeRequest(exhausted));
    expect(deniedRes.status).toBe(429);

    const sameUserRes = await POST(initializeRequest(sameUserOtherToken));
    expect(sameUserRes.status).toBe(200);

    const otherUserRes = await POST(initializeRequest(otherUserToken));
    expect(otherUserRes.status).toBe(200);
  });
});
