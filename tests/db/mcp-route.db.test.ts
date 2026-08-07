/**
 * @jest-environment node
 */
import { POST } from '@/app/api/mcp/route';
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { createToken, revokeToken } from '@/lib/tokens/repository';
import { resetDb, seedUser, closeDb } from './helpers';

const MCP_URL = 'http://localhost:3000/api/mcp';

// The 2026-07-28 spec requires clients to accept both media types on every
// POST; a request missing either gets a 406 before the handler even looks
// at the body, per @modelcontextprotocol/server's handlePostRequest.
const ACCEPT = 'application/json, text/event-stream';

function jsonRpcRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: ACCEPT,
  };
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new Request(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function initializeBody(id: number | string = 1): unknown {
  return {
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'mcp-route.db.test', version: '0.0.0' },
    },
  };
}

function toolsCallBody(id: number | string, name: string, args: Record<string, unknown>): unknown {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name, arguments: args },
  };
}

function promptsListBody(id: number | string = 1): unknown {
  return { jsonrpc: '2.0', id, method: 'prompts/list', params: {} };
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/**
 * The stateless legacy fallback (the leg a claim-less JSON-RPC POST — what
 * every non-2026-native client, including Claude Code, actually sends —
 * gets routed to) answers with `text/event-stream` unless the server opts
 * into `enableJsonResponse`, which this app does not. Parses the
 * `event: message\ndata: {...}\n\n` framing and returns the JSON-RPC
 * message(s) carried inside.
 */
async function parseJsonRpcMessages(response: Response): Promise<JsonRpcMessage[]> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (text === '') return [];

  if (contentType.includes('application/json')) {
    return [JSON.parse(text) as JsonRpcMessage];
  }

  return text
    .split('\n\n')
    .map((chunk) => chunk.split('\n').find((line) => line.startsWith('data: ')))
    .filter((line): line is string => line !== undefined)
    .map((line) => JSON.parse(line.slice('data: '.length)) as JsonRpcMessage);
}

async function parseSingleResponse(response: Response): Promise<JsonRpcMessage> {
  const messages = await parseJsonRpcMessages(response);
  const message = messages[messages.length - 1];
  if (message === undefined) {
    throw new Error(`Expected at least one JSON-RPC message in response, got: ${messages.length}`);
  }
  return message;
}

describe('MCP route (src/app/api/mcp/route.ts)', () => {
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

  it('accepts a valid token on initialize', async () => {
    const { token } = await createToken(a.userId, 'laptop');
    const res = await POST(jsonRpcRequest(initializeBody(), token));

    const message = await parseSingleResponse(res);
    expect(res.status).toBe(200);
    expect(message.error).toBeUndefined();
    expect(message.result).toBeDefined();
  });

  it('answers an unknown token and a revoked token with identical 401 responses', async () => {
    const { token: revoked, id } = await createToken(a.userId, 'laptop');
    await revokeToken(id, a.userId);

    const unknownRes = await POST(jsonRpcRequest(initializeBody(), 'ps_totallymadeup'));
    const revokedRes = await POST(jsonRpcRequest(initializeBody(), revoked));

    expect(unknownRes.status).toBe(401);
    expect(revokedRes.status).toBe(401);
    expect(unknownRes.status).toBe(revokedRes.status);

    const [unknownBody, revokedBody] = await Promise.all([unknownRes.text(), revokedRes.text()]);
    expect(unknownBody).toBe(revokedBody);
  });

  it('returns a "not found" error result for tools/call against another user\'s prompt', async () => {
    await getDb()
      .insert(prompts)
      .values({ id: 'b1', workspaceId: b.workspaceId, title: 'Secret', content: 'private' });

    const { token } = await createToken(a.userId, 'laptop');
    const res = await POST(jsonRpcRequest(toolsCallBody(1, 'get_prompt', { id: 'b1' }), token));

    const message = await parseSingleResponse(res);
    const result = message.result as { isError?: boolean; content?: { text?: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content?.[0]?.text?.toLowerCase()).toContain('not found');
  });

  // THE REGRESSION TEST for the ALS wiring: `contextStore` is populated in
  // `withContext` before `authHandler` runs, and read back inside the
  // per-request server factory to register favourite prompts as slash
  // commands. Two different users' requests are fired concurrently and each
  // response is asserted to carry only its own favourites.
  //
  // Verified this fails red before the fix and passes green after by
  // deliberately reverting `contextStore.run(ctx, () => authHandler(req))`
  // to a bare `authHandler(req)` (dropping the ALS wiring): both responses
  // came back with an empty favourites list, and this test failed exactly
  // as expected.
  //
  // What this test does NOT prove: a true microtask-level race between two
  // requests' `contextStore.run` / `getStore()` calls. Verified by fault
  // injection (a shared module-level variable in place of ALS, and
  // `contextStore.enterWith` in place of `contextStore.run`) with up to 12
  // concurrent request pairs — neither ever produced a cross-user leak here.
  // The reason is Node's execution model, not a weak test: this route
  // captures the resolved context into a local variable synchronously,
  // before the first `await` that follows it, and every step between
  // `withContext`'s `await resolveTokenContext(...)` resuming and the
  // factory's `contextStore.getStore()` read is microtask-chained with no
  // further macrotask (timer/socket) yield — Node drains a macrotask's full
  // microtask chain before servicing the next macrotask, so a second
  // request's own resume can never land inside that window. A true ALS leak
  // would need an `await` between reading the store and using its value,
  // which this code doesn't have. See the final fix report for the full
  // investigation.
  it('keeps favourites scoped to their own request under concurrent connections from two users', async () => {
    await getDb()
      .insert(prompts)
      .values([
        {
          id: 'a-fav',
          workspaceId: a.workspaceId,
          title: 'Alpha Favourite',
          content: 'a body',
          isFavorite: true,
        },
        {
          id: 'b-fav',
          workspaceId: b.workspaceId,
          title: 'Bravo Favourite',
          content: 'b body',
          isFavorite: true,
        },
      ]);

    const [{ token: tokenA }, { token: tokenB }] = await Promise.all([
      createToken(a.userId, 'laptop-a'),
      createToken(b.userId, 'laptop-b'),
    ]);

    const [resA, resB] = await Promise.all([
      POST(jsonRpcRequest(promptsListBody('a'), tokenA)),
      POST(jsonRpcRequest(promptsListBody('b'), tokenB)),
    ]);

    const [msgA, msgB] = await Promise.all([parseSingleResponse(resA), parseSingleResponse(resB)]);

    const namesA = (
      (msgA.result as { prompts: { name: string }[] } | undefined)?.prompts ?? []
    ).map((p) => p.name);
    const namesB = (
      (msgB.result as { prompts: { name: string }[] } | undefined)?.prompts ?? []
    ).map((p) => p.name);

    expect(namesA).toContain('alpha-favourite');
    expect(namesA).not.toContain('bravo-favourite');
    expect(namesB).toContain('bravo-favourite');
    expect(namesB).not.toContain('alpha-favourite');
  });
});
