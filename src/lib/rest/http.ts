import { ZodError } from 'zod';
import { resolveTokenContext } from '../auth/token-context';
import {
  AppError,
  LimitReachedError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  AuthenticationError,
} from '../errors';
import { logger } from '../logging';
import { checkRateLimit, RATE_LIMIT_WINDOW_MS } from '../rate-limit/repository';
import { isAllowedExtensionOrigin } from '../extension/ids';

type Code =
  | 'unauthorized'
  | 'not_found'
  | 'validation'
  | 'rate_limited'
  | 'limit_reached'
  | 'internal';

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (origin === null || !isAllowedExtensionOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(
  req: Request,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...extra },
  });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function fail(
  req: Request,
  status: number,
  code: Code,
  message: string,
  extra: Record<string, string> = {}
): Response {
  return json(req, { error: { code, message } }, status, extra);
}

/** Maps a thrown error to the API error shape. Non-AppErrors are logged and genericised. */
function toErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof ZodError) {
    return fail(req, 400, 'validation', error.issues[0]?.message ?? 'Invalid request.');
  }
  if (error instanceof ValidationError) return fail(req, 400, 'validation', error.message);
  if (error instanceof NotFoundError) return fail(req, 404, 'not_found', 'Prompt not found.');
  if (error instanceof LimitReachedError) return fail(req, 403, 'limit_reached', error.message);
  if (error instanceof AuthenticationError) return fail(req, 401, 'unauthorized', error.message);
  if (error instanceof RateLimitError) return fail(req, 429, 'rate_limited', error.message);
  if (error instanceof AppError && error.statusCode < 500)
    return fail(req, 400, 'validation', error.message);
  logger.error('REST v1 handler failed', error instanceof Error ? error : new Error(String(error)));
  return fail(req, 500, 'internal', 'Something went wrong. Please try again.');
}

/**
 * Bearer auth, per-token rate limit (fails closed, as on /api/mcp), then the handler.
 * The workspace comes only from the token.
 */
export async function withApi(
  req: Request,
  fn: (ctx: { workspaceId: string; userId: string }) => Promise<Response>
): Promise<Response> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const ctx = bearer === '' ? null : await resolveTokenContext(bearer);
  if (ctx === null || ctx.tokenId === undefined) {
    return fail(req, 401, 'unauthorized', 'Sign in again to reconnect the extension.');
  }
  const limit = await checkRateLimit(ctx.tokenId).catch((e: unknown) => {
    logger.error(
      'Rate limit check failed; refusing request (fail closed)',
      e instanceof Error ? e : new Error(String(e))
    );
    return null;
  });
  if (limit === null || !limit.allowed) {
    const retry = limit === null ? Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) : limit.retryAfterSeconds;
    return fail(req, 429, 'rate_limited', `Too many requests. Try again in ${retry}s.`, {
      'Retry-After': String(retry),
    });
  }
  try {
    return await fn({ workspaceId: ctx.workspaceId, userId: ctx.userId });
  } catch (error) {
    return toErrorResponse(req, error);
  }
}
