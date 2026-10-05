import { withApi, json, preflight } from '@/lib/rest/http';
import { patchPromptBody } from '@/lib/rest/schemas';
import { getPromptHandler, updatePromptHandler } from '@/lib/mcp/tools';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withApi(req, async ({ workspaceId }) =>
    json(req, { prompt: await getPromptHandler(workspaceId, id) })
  );
}

export async function PATCH(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withApi(req, async ({ workspaceId }) => {
    const body = patchPromptBody.parse(await req.json().catch(() => ({})));
    return json(req, { prompt: await updatePromptHandler(workspaceId, id, body) });
  });
}

export function OPTIONS(req: Request): Response {
  return preflight(req);
}
