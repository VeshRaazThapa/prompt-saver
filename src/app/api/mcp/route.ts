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

// AsyncLocalStorage and the postgres driver both need the Node runtime.
export const runtime = 'nodejs';

interface McpExtra {
  userId: string;
  workspaceId: string;
}

function workspaceFrom(ctx: { http?: { authInfo?: AuthInfo } }): string {
  const extra = ctx.http?.authInfo?.extra as McpExtra | undefined;
  if (extra === undefined) {
    throw new Error('Unauthenticated');
  }
  return extra.workspaceId;
}

const handler = createMcpHandler((server) => {
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

export { authHandler as GET, authHandler as POST };
