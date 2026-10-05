import { describe, it, expect, vi } from 'vitest';
import { createApi, ApiError } from './api';

function res(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
const P = { id: 'p1', title: 'T', description: null, tags: [], updated_at: '2026-10-05', content: 'C', is_favorite: false };

describe('api client', () => {
  it('lists prompts with bearer auth and q', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, { prompts: [P] }));
    const api = createApi('ps_tok', fetchImpl);
    expect(await api.list('email')).toEqual([P]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/v1\/prompts\?q=email$/);
    expect(init.headers.Authorization).toBe('Bearer ps_tok');
  });

  it('creates with POST and returns the prompt', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(201, { prompt: P }));
    expect(await createApi('t', fetchImpl).create({ title: 'T', content: 'C' })).toEqual(P);
    expect(fetchImpl.mock.calls[0][1].method).toBe('POST');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'limit_reached'],
    [404, 'not_found'],
    [400, 'validation'],
    [500, 'internal'],
  ])('maps %i to ApiError code from the body', async (status, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(res(status, { error: { code, message: 'm' } }));
    await expect(createApi('t', fetchImpl).list()).rejects.toMatchObject({ code, message: 'm' });
  });

  it('reads Retry-After on 429', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(429, { error: { code: 'rate_limited', message: 'slow' } }, { 'Retry-After': '42' }));
    await expect(createApi('t', fetchImpl).list()).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 42 });
  });

  it('maps a thrown fetch and a non-JSON body to network / internal', async () => {
    await expect(createApi('t', vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))).list()).rejects.toMatchObject({ code: 'network' });
    const html = vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(createApi('t', html).list()).rejects.toBeInstanceOf(ApiError);
  });
});
