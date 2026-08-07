import { AsyncLocalStorage } from 'async_hooks';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { resolveTokenContext } from '@/lib/auth/token-context';
import {
  searchPromptsHandler,
  getPromptHandler,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
} from '@/lib/mcp/tools';
import { favouritePromptsFor, slugify, buildPromptBody } from '@/lib/mcp/prompts';

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
        limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional(),
      }),
    },
    async ({ query, limit }, ctx) => {
      const results = await searchPromptsHandler(
        workspaceFrom(ctx),
        query,
        limit ?? DEFAULT_SEARCH_LIMIT
      );
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.registerTool(
    'get_prompt',
    {
      title: 'Get prompt',
      description: 'Fetch the full text of one saved prompt by its id.',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }, ctx) => {
      const prompt = await getPromptHandler(workspaceFrom(ctx), id);
      return { content: [{ type: 'text', text: prompt.content }] };
    }
  );

  const ctx = contextStore.getStore();
  if (ctx !== undefined) {
    const taken = new Set<string>();
    for (const prompt of await favouritePromptsFor(ctx.workspaceId)) {
      const name = slugify(prompt.title, prompt.id, taken);
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
  }
});

/**
 * Returning undefined produces a 401. Every failure mode — malformed, unknown,
 * revoked — returns the same undefined so responses cannot be used to work out
 * which tokens were once real.
 */
const verifyToken = async (_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (bearerToken === undefined) {
    return undefined;
  }
  const ctx = await resolveTokenContext(bearerToken);
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
  if (ctx === null) {
    return authHandler(req);
  }
  return contextStore.run(ctx, () => authHandler(req));
}

export { withContext as GET, withContext as POST };
