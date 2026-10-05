/**
 * @jest-environment node
 */
import {
  GET as listGET,
  POST as listPOST,
  OPTIONS as listOPTIONS,
} from '@/app/api/v1/prompts/route';
import { GET as oneGET, PATCH as onePATCH } from '@/app/api/v1/prompts/[id]/route';
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { createToken, revokeToken } from '@/lib/tokens/repository';
import { MAX_PROMPTS_PER_WORKSPACE } from '@/lib/limits';
import { RATE_LIMIT_MAX_REQUESTS } from '@/lib/rate-limit/repository';
import { resetDb, seedUser, closeDb } from './helpers';

const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const ORIGIN = `chrome-extension://${EXT_ID}`;
const BASE = 'http://localhost:3000/api/v1/prompts';

beforeAll(() => {
  process.env['NEXT_PUBLIC_EXTENSION_IDS'] = EXT_ID;
});
beforeEach(resetDb);
afterAll(closeDb);

function req(
  url: string,
  init: { method?: string; token?: string; body?: unknown; origin?: string } = {}
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token !== undefined) headers['Authorization'] = `Bearer ${init.token}`;
  if (init.origin !== undefined) headers['Origin'] = init.origin;
  return new Request(url, {
    method: init.method ?? 'GET',
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function userWithToken(id = 'user-1', email = 'user1@example.com') {
  const u = await seedUser(id, email);
  const { token, id: tokenId } = await createToken(u.userId, 'Chrome extension');
  return { ...u, token, tokenId };
}

describe('auth', () => {
  it('401s with no token, a bad token, and a revoked token', async () => {
    const { token, tokenId, userId } = await userWithToken();
    expect((await listGET(req(BASE))).status).toBe(401);
    expect((await listGET(req(BASE, { token: 'ps_nope' }))).status).toBe(401);
    await revokeToken(tokenId, userId);
    const res = await listGET(req(BASE, { token }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: expect.any(String) },
    });
  });
});

describe('GET /api/v1/prompts', () => {
  it('lists own prompts with content', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb()
      .insert(prompts)
      .values({ id: 'p1', workspaceId, title: 'Hello', content: 'Body' });
    const res = await listGET(req(BASE, { token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prompts).toHaveLength(1);
    expect(body.prompts[0]).toMatchObject({
      id: 'p1',
      title: 'Hello',
      content: 'Body',
      is_favorite: false,
    });
  });

  it('honours q', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb()
      .insert(prompts)
      .values([
        { id: 'a', workspaceId, title: 'Email', content: 'x' },
        { id: 'b', workspaceId, title: 'Other', content: 'x' },
      ]);
    const body = await (await listGET(req(`${BASE}?q=email`, { token }))).json();
    expect(body.prompts.map((p: { id: string }) => p.id)).toEqual(['a']);
  });

  it('tolerates fractional and non-numeric limit values', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb()
      .insert(prompts)
      .values([
        { id: 'a', workspaceId, title: 'A', content: 'x' },
        { id: 'b', workspaceId, title: 'B', content: 'x' },
      ]);
    const frac = await listGET(req(`${BASE}?limit=1.5`, { token }));
    expect(frac.status).toBe(200);
    expect((await frac.json()).prompts).toHaveLength(1);
    const junk = await listGET(req(`${BASE}?limit=abc`, { token }));
    expect(junk.status).toBe(200);
    expect((await junk.json()).prompts).toHaveLength(2);
  });
});

describe('POST /api/v1/prompts', () => {
  it('creates and returns 201 with the prompt', async () => {
    const { token } = await userWithToken();
    const res = await listPOST(
      req(BASE, { method: 'POST', token, body: { title: 'New', content: 'Text', tags: ['x'] } })
    );
    expect(res.status).toBe(201);
    expect((await res.json()).prompt).toMatchObject({ title: 'New', content: 'Text', tags: ['x'] });
  });

  it('400s on invalid bodies', async () => {
    const { token } = await userWithToken();
    for (const body of [
      {},
      { title: '', content: 'x' },
      { title: 't' },
      { title: 't', content: 'x', tags: 'nope' },
    ]) {
      const res = await listPOST(req(BASE, { method: 'POST', token, body }));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('validation');
    }
  });

  it('403 limit_reached at the cap', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb()
      .insert(prompts)
      .values(
        Array.from({ length: MAX_PROMPTS_PER_WORKSPACE }, (_, i) => ({
          id: `p${i}`,
          workspaceId,
          title: 't',
          content: 'c',
        }))
      );
    const res = await listPOST(
      req(BASE, { method: 'POST', token, body: { title: 't', content: 'c' } })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('limit_reached');
  });
});

describe('GET/PATCH /api/v1/prompts/:id', () => {
  it('gets and patches own prompt, including isFavorite', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    expect(
      (await (await oneGET(req(`${BASE}/p1`, { token }), params('p1'))).json()).prompt.title
    ).toBe('T');
    const res = await onePATCH(
      req(`${BASE}/p1`, { method: 'PATCH', token, body: { isFavorite: true } }),
      params('p1')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).prompt.is_favorite).toBe(true);
  });

  it("404s on another user's prompt (no existence leak)", async () => {
    const a = await userWithToken();
    const b = await seedUser('user-2', 'u2@example.com');
    await getDb()
      .insert(prompts)
      .values({ id: 'theirs', workspaceId: b.workspaceId, title: 'T', content: 'C' });
    expect((await oneGET(req(`${BASE}/theirs`, { token: a.token }), params('theirs'))).status).toBe(
      404
    );
    const patch = await onePATCH(
      req(`${BASE}/theirs`, { method: 'PATCH', token: a.token, body: { title: 'x' } }),
      params('theirs')
    );
    expect(patch.status).toBe(404);
    expect((await patch.json()).error.code).toBe('not_found');
  });

  it('400s on an empty patch', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    expect(
      (await onePATCH(req(`${BASE}/p1`, { method: 'PATCH', token, body: {} }), params('p1'))).status
    ).toBe(400);
  });

  it('400s when PATCH sets content to an empty string', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    const res = await onePATCH(
      req(`${BASE}/p1`, { method: 'PATCH', token, body: { content: '' } }),
      params('p1')
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('validation');
  });
});

describe('CORS', () => {
  it('echoes an allowed extension origin and answers preflight', async () => {
    const { token } = await userWithToken();
    const res = await listGET(req(BASE, { token, origin: ORIGIN }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    const pre = listOPTIONS(req(BASE, { method: 'OPTIONS', origin: ORIGIN }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
  });

  it('sends no CORS headers for other origins', async () => {
    const { token } = await userWithToken();
    const res = await listGET(req(BASE, { token, origin: 'https://evil.example' }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(
      listOPTIONS(req(BASE, { method: 'OPTIONS', origin: 'https://evil.example' })).headers.get(
        'Access-Control-Allow-Origin'
      )
    ).toBeNull();
  });
});

describe('rate limit', () => {
  it('429s with Retry-After past the per-token limit', async () => {
    const { token } = await userWithToken();
    let last: Response | undefined;
    for (let i = 0; i <= RATE_LIMIT_MAX_REQUESTS; i++) last = await listGET(req(BASE, { token }));
    expect(last?.status).toBe(429);
    expect(last?.headers.get('Retry-After')).toMatch(/^\d+$/);
    expect((await last?.json()).error.code).toBe('rate_limited');
  });
});
