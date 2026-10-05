import { withApi, json, preflight } from '@/lib/rest/http';
import { createPromptBody } from '@/lib/rest/schemas';
import {
  createPromptHandler,
  getPromptHandler,
  listPromptsWithContentHandler,
} from '@/lib/mcp/tools';
import { MAX_EXTENSION_LIST } from '@/lib/limits';

export const runtime = 'nodejs';

/** Integer limit only: a fractional or NaN value must never reach SQL LIMIT. */
function parseLimit(raw: string | null): number {
  const n = Math.floor(Number(raw ?? MAX_EXTENSION_LIST));
  return Number.isFinite(n) ? n : MAX_EXTENSION_LIST;
}

export async function GET(req: Request): Promise<Response> {
  return withApi(req, async ({ workspaceId }) => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const list = await listPromptsWithContentHandler(
      workspaceId,
      q,
      parseLimit(url.searchParams.get('limit'))
    );
    return json(req, { prompts: list });
  });
}

export async function POST(req: Request): Promise<Response> {
  return withApi(req, async ({ workspaceId }) => {
    const body = createPromptBody.parse(await req.json().catch(() => ({})));
    const { id } = await createPromptHandler(workspaceId, body);
    return json(req, { prompt: await getPromptHandler(workspaceId, id) }, 201);
  });
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
