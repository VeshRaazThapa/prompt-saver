import { AsyncLocalStorage } from 'async_hooks';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { resolveTokenContext } from '@/lib/auth/token-context';
import type { UserContext } from '@/lib/auth/context';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logging';
import {
  searchPromptsHandler,
  getPromptHandler,
  createPromptHandler,
  updatePromptHandler,
  saveVersionHandler,
  DEFAULT_SEARCH_LIMIT,
} from '@/lib/mcp/tools';
import { favouritePromptsFor, slugify, buildPromptBody } from '@/lib/mcp/prompts';

const GENERIC_TOOL_ERROR = 'Something went wrong. Please try again.';

/**
 * Wraps a tool handler body so a thrown error reaches the MCP client
 * sanitized — the MCP-path equivalent of the Server Action layer's `run()`
 * (src/lib/actions/result.ts). The SDK catches whatever a tool callback
 * throws and puts `error.message` into the tool result verbatim, so without
 * this wrapper a raw driver/DB error (a connection failure, a constraint
 * violation) reaches the model as literal, uninterpretable text — and leaks
 * infrastructure detail. AppError subclasses (NotFoundError, ValidationError,
 * ...) carry messages written for the caller, so those pass through
 * unchanged; everything else is logged server-side, with the original
 * message, and replaced with a fixed generic string.
 */
function withSafeErrors<Args extends unknown[], TResult>(
  fn: (...args: Args) => Promise<TResult>
): (...args: Args) => Promise<TResult> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('MCP tool handler failed', err);
      throw new Error(GENERIC_TOOL_ERROR);
    }
  };
}

// AsyncLocalStorage and the postgres driver both need the Node runtime.
export const runtime = 'nodejs';

interface McpExtra {
  userId: string;
  workspaceId: string;
}

/**
 * Carries the token-resolved identity from `withContext` (which runs before
 * `withMcpAuth`, outside its request/response cycle) into `initializeServer`,
 * which `mcp-handler` calls with only the server object — no `Request`, no
 * auth. Confirmed via a spike that the factory runs fresh per request (see
 * task-4-report.md), so a value stored here for one request can never leak
 * into another request's prompt registration.
 */
const contextStore = new AsyncLocalStorage<{ userId: string; workspaceId: string }>();

/**
 * Caches `withContext`'s token resolution per `Request` object so
 * `verifyToken` doesn't resolve the same bearer token a second time.
 * `withMcpAuth` passes the identical `Request` instance through to
 * `verifyToken` (confirmed by reading its dist — no cloning), so keying on
 * object identity is safe. A `null` entry (token resolved, found invalid) is
 * a real cache hit, distinct from a missing entry (`undefined`, meaning
 * `verifyToken` was reached some other way than `withContext`) — the
 * fallback below re-resolves only in the latter case, so this stays correct
 * even if something ever calls `authHandler` directly.
 */
const resolvedContextByRequest = new WeakMap<Request, UserContext | null>();

function workspaceFrom(ctx: { http?: { authInfo?: AuthInfo } }): string {
  const extra = ctx.http?.authInfo?.extra as McpExtra | undefined;
  if (extra === undefined) {
    throw new Error('Unauthenticated');
  }
  return extra.workspaceId;
}

const handler = createMcpHandler(async (server) => {
  server.registerTool(
    'search_prompts',
    {
      title: 'Search prompts',
      description:
        'Search your saved prompt library by title, description, content or tag. Returns summaries only — call get_prompt for a full body.',
      inputSchema: z.object({
        query: z.string().describe('Search text. Pass an empty string to list recent prompts.'),
        limit: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Max results. Defaults to 20, maximum 50.'),
      }),
    },
    withSafeErrors(async ({ query, limit }, ctx) => {
      const results = await searchPromptsHandler(
        workspaceFrom(ctx),
        query,
        limit ?? DEFAULT_SEARCH_LIMIT
      );
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    })
  );

  server.registerTool(
    'get_prompt',
    {
      title: 'Get prompt',
      description: 'Fetch the full text of one saved prompt by its id.',
      inputSchema: z.object({ id: z.string() }),
    },
    withSafeErrors(async ({ id }, ctx) => {
      const prompt = await getPromptHandler(workspaceFrom(ctx), id);
      return { content: [{ type: 'text', text: prompt.content }] };
    })
  );

  server.registerTool(
    'create_prompt',
    {
      title: 'Create prompt',
      description: 'Save a new prompt to the library.',
      inputSchema: z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    },
    withSafeErrors(async (input, ctx) => {
      const { id } = await createPromptHandler(workspaceFrom(ctx), input);
      return { content: [{ type: 'text', text: `Created prompt ${id}` }] };
    })
  );

  server.registerTool(
    'update_prompt',
    {
      title: 'Update prompt',
      description: 'Update an existing prompt draft without creating a new version.',
      inputSchema: z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    },
    withSafeErrors(async ({ id, ...rest }, ctx) => {
      const updated = await updatePromptHandler(workspaceFrom(ctx), id, rest);
      return { content: [{ type: 'text', text: `Updated "${updated.title}"` }] };
    })
  );

  server.registerTool(
    'save_version',
    {
      title: 'Save version',
      description: 'Save an immutable new version of a prompt.',
      inputSchema: z.object({
        id: z.string(),
        content: z.string().min(1),
        change_summary: z.string().optional(),
      }),
    },
    withSafeErrors(async ({ id, content, change_summary }, ctx) => {
      const v = await saveVersionHandler(workspaceFrom(ctx), id, content, change_summary);
      return { content: [{ type: 'text', text: `Saved version ${v.version_number}` }] };
    })
  );

  const ctx = contextStore.getStore();
  if (ctx !== undefined) {
    // A transient failure here (e.g. a DB hiccup), or a throw from
    // registerPrompt itself, must not take down search_prompts / get_prompt
    // registration above, which already succeeded — degrade to zero slash
    // commands for this session instead of a 500 for the whole connection.
    // The try/catch spans the registration loop as well as the fetch:
    // slugify only disambiguates a base-name collision against the bases
    // seen so far, so a suffixed slug can still coincide with another
    // prompt's plain slug (e.g. "Foo Bar" -> "foo-bar", and a later prompt
    // literally titled "foo bar <id6>" collides with the suffix minted for
    // a second "Foo Bar"). registerPrompt throws on a duplicate name, which
    // would otherwise escape the factory and 500 the entire connection,
    // tools included.
    try {
      const favourites = await favouritePromptsFor(ctx.workspaceId);
      const taken = new Set<string>();
      for (const prompt of favourites) {
        const name = slugify(prompt.title, prompt.id, taken);
        if (taken.has(name)) continue;
        taken.add(name);

        server.registerPrompt(
          name,
          {
            title: prompt.title,
            description: prompt.description ?? `Saved prompt: ${prompt.title}`,
            argsSchema: z.object({
              context: z.string().optional().describe('Extra context appended to the prompt'),
            }),
          },
          ({ context }) => ({
            messages: [
              {
                role: 'user' as const,
                content: { type: 'text' as const, text: buildPromptBody(prompt, context) },
              },
            ],
          })
        );
      }
    } catch (error) {
      console.error('Failed to register favourite prompts as MCP slash commands:', error);
    }
  }
});

/**
 * Returning undefined produces a 401. Every failure mode — malformed, unknown,
 * revoked — returns the same undefined so responses cannot be used to work out
 * which tokens were once real.
 *
 * Reads `resolvedContextByRequest` before resolving again: `withContext`
 * already resolved this exact bearer token for this exact request to
 * populate `contextStore`, so re-resolving here would be a second DB round
 * trip (up to two SELECTs plus a possible `lastUsedAt` UPDATE) on every
 * tool/prompt call in a session. Falls back to a real resolve when the
 * request isn't in the map, so this function is still correct if ever
 * invoked outside `withContext`.
 */
const verifyToken = async (req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (bearerToken === undefined) {
    return undefined;
  }
  const cached = resolvedContextByRequest.get(req);
  const ctx = cached !== undefined ? cached : await resolveTokenContext(bearerToken);
  if (ctx === null) {
    return undefined;
  }
  return {
    token: bearerToken,
    scopes: [],
    clientId: ctx.userId,
    extra: { userId: ctx.userId, workspaceId: ctx.workspaceId },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

/**
 * Populates `contextStore` before `authHandler` runs, so `initializeServer`
 * (invoked deep inside it, per request) can read the resolved identity back
 * out via `contextStore.getStore()`.
 *
 * Resolves the token itself rather than trusting anything client-supplied:
 * an invalid or missing bearer token falls through to `authHandler`
 * unchanged, so `withMcpAuth` still produces the RFC-compliant 401 — this
 * wrapper only ever adds context, never grants it.
 */
async function withContext(req: Request): Promise<Response> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const ctx = bearer === undefined ? null : await resolveTokenContext(bearer);
  resolvedContextByRequest.set(req, ctx);
  if (ctx === null) {
    return authHandler(req);
  }
  return contextStore.run(ctx, () => authHandler(req));
}

export { withContext as GET, withContext as POST };
