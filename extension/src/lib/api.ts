import { API_BASE } from './config';
import type { ExtPrompt } from './types';

export type ApiErrorCode =
  | 'unauthorized' | 'not_found' | 'validation' | 'rate_limited' | 'limit_reached' | 'internal' | 'network';

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const FALLBACK: Record<number, ApiErrorCode> = { 400: 'validation', 401: 'unauthorized', 403: 'limit_reached', 404: 'not_found', 429: 'rate_limited' };

async function toError(r: Response): Promise<ApiError> {
  const body = (await r.json().catch(() => null)) as { error?: { code?: ApiErrorCode; message?: string } } | null;
  const code = body?.error?.code ?? FALLBACK[r.status] ?? 'internal';
  const retry = Number(r.headers.get('Retry-After'));
  return new ApiError(code, body?.error?.message ?? 'Something went wrong. Please try again.', Number.isFinite(retry) && retry > 0 ? retry : undefined);
}

export function createApi(token: string, fetchImpl: typeof fetch = fetch) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let r: Response;
    try {
      r = await fetchImpl(`${API_BASE}/api/v1${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    } catch {
      throw new ApiError('network', "Couldn't reach Prompt Saver. Check your connection.");
    }
    if (!r.ok) throw await toError(r);
    try {
      return (await r.json()) as T;
    } catch {
      // A 2xx that isn't JSON is a captive portal or proxy page, not our API: treat it as offline.
      throw new ApiError('network', "Couldn't reach Prompt Saver. Check your connection.");
    }
  }
  return {
    list: async (q = ''): Promise<ExtPrompt[]> =>
      (await call<{ prompts: ExtPrompt[] }>(`/prompts${q !== '' ? `?q=${encodeURIComponent(q)}` : ''}`)).prompts,
    create: async (input: { title: string; content: string; tags?: string[] }): Promise<ExtPrompt> =>
      (await call<{ prompt: ExtPrompt }>('/prompts', { method: 'POST', body: JSON.stringify(input) })).prompt,
    patch: async (id: string, input: { isFavorite?: boolean }): Promise<ExtPrompt> =>
      (await call<{ prompt: ExtPrompt }>(`/prompts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) })).prompt,
  };
}
export type Api = ReturnType<typeof createApi>;
