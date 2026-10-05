# Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Prompt Saver as a public MV3 Chrome extension (side panel, `//` picker, save-from-page) for Claude, ChatGPT/Codex and Gemini, backed by a new REST API and a website connect flow.

**Architecture:** Website side: a token-authenticated REST API at `/api/v1/prompts` that reuses the MCP handlers in `src/lib/mcp/tools.ts`, a `/extension/connect` page that mints an API token and hands it to the extension through `externally_connectable`, per-user caps, and a `/privacy` page. Extension side: a WXT project in `extension/`. The background worker owns the token, API client and cache. Content scripts (one per AI site) host the `//` picker and the insert logic. A React side panel holds the library UI.

**Tech Stack:** Next.js 16, Drizzle, Neon Postgres, zod v4, Jest (website). WXT 0.20 (MV3), React 18, Tailwind v4, Vitest, Playwright (extension).

**Spec:** `docs/superpowers/specs/2026-10-05-chrome-extension-design.md` — read it before your task.

## Global Constraints

- Website: TypeScript strict, no `any` without written justification. `npm run lint` clean at `--max-warnings 0`. Cyclomatic complexity ≤ 10. `npm run format:check`, `npm run type-check` and `npm run build` must pass. Install with `--legacy-peer-deps`.
- **Never trust a client-supplied user or workspace id.** The workspace always comes from the resolved token or session.
- **Tokens are never logged.** A raw token is returned only once, at creation (the connect action is the only new place that returns one).
- `src/lib/db/repositories/types.ts` stays frozen. New queries go on `DrizzlePromptRepository` as extra methods only.
- DB tests: `/** @jest-environment node */` docblock, `resetDb()` in `beforeEach`, `closeDb()` in `afterAll`, files under `tests/db/*.db.test.ts`. They need local Postgres at `postgresql://postgres:postgres@localhost:5432/prompt_saver_test` (see Task 1, Step 1).
- Caps (spec 4.4): **1,000 non-archived prompts per workspace**, **50,000 chars max content**. Defined once in `src/lib/limits.ts`.
- Error JSON shape for `/api/v1/*`: `{ "error": { "code": <code>, "message": <string> } }`, where code is one of `unauthorized | not_found | validation | rate_limited | limit_reached | internal`.
- Allowed extension IDs come from env `NEXT_PUBLIC_EXTENSION_IDS` (comma-separated).
- Production site: `https://prompt-saver-two.vercel.app`. Token name minted for the extension: exactly `Chrome extension`.
- Website UI follows `DESIGN.md`: stone neutrals, teal accent (`teal-600`), DM Sans body, JetBrains Mono for prompt text, `transition-colors duration-150 ease-out`, `focus-visible:ring-2`, 44px minimum touch targets.
- Extension: no `<all_urls>` permission. Permissions are exactly `storage`, `sidePanel`, `contextMenus`. Host permissions: the 3 AI sites plus the API base.
- Insert never submits the chat message.
- Do not touch the uncommitted changes to `.gitignore` / `next-env.d.ts` already in the working tree. Stage only files your task names.

## Review Focus

1. **`//` inside normal text** (URLs like `https://x`, code comments like `a // b` mid-line after a non-space) — must not open the picker. `https://` is covered by Task 7 tests. Task 7 also adds `foo//bar` → no trigger.
2. **Revoked or expired token while the panel is open** — every API call returning 401 must clear token + cache and show Reconnect, never loop retries. Task 5 (client) and Task 6 (background) both test this.
3. **User has 0 prompts / not signed in when typing `//`** — the picker shows exactly one guidance row and Enter does nothing destructive. Task 7 test.
4. **A visit to `/extension/connect` without a click, or with an unknown `ext` id** — must not mint a token. Task 3 tests.
5. **Unicode / multi-line prompt content** (emoji, CJK, newlines) inserted into a contenteditable — content arrives intact, newlines preserved. Task 7 insert test uses `"Line 1\nLine 2 ✅ 日本"`.

---

## File Structure

**Website (modify/create under repo root)**

| File | Responsibility |
|---|---|
| `src/lib/limits.ts` (new) | Cap constants + `assertContentLength` |
| `src/lib/errors.ts` (modify) | Add `LimitReachedError` (403) |
| `src/lib/db/drizzle/prompt-repository.ts` (modify) | Add `countNonArchived`, `listForExtension` methods |
| `src/lib/mcp/tools.ts` (modify) | Enforce caps; `isFavorite` on update; `listPromptsWithContentHandler` |
| `src/lib/rest/http.ts` (new) | Bearer auth + rate limit + CORS + error→JSON for `/api/v1` |
| `src/lib/rest/schemas.ts` (new) | zod bodies for create/patch |
| `src/lib/extension/ids.ts` (new) | Parse/validate allowed extension IDs |
| `src/app/api/v1/prompts/route.ts` (new) | GET list, POST create, OPTIONS |
| `src/app/api/v1/prompts/[id]/route.ts` (new) | GET one, PATCH, OPTIONS |
| `src/lib/actions/extension.ts` (new) | `connectExtensionAction` |
| `src/app/extension/connect/page.tsx` + `ConnectPanel.tsx` (new) | Connect UI |
| `src/app/privacy/page.tsx` (new) | Privacy policy |

**Extension (new, `extension/`)**

| File | Responsibility |
|---|---|
| `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts` | Project + manifest |
| `src/lib/config.ts` | `API_BASE`, `SITE_BASE` |
| `src/lib/types.ts` | `ExtPrompt`, message types |
| `src/lib/api.ts` | Typed REST client + `ApiError` |
| `src/lib/cache.ts` | Token + prompt cache in `chrome.storage` |
| `src/lib/messages.ts` | Background message router (pure, testable) |
| `src/entrypoints/background.ts` | Wires router, external token, context menu |
| `src/sites/types.ts`, `claude.ts`, `chatgpt.ts`, `gemini.ts` | Site adapters |
| `src/lib/insert.ts` | Insert strategy chain |
| `src/picker/trigger.ts`, `filter.ts`, `picker.ts`, `picker.css` | `//` picker |
| `src/lib/content-main.ts` | Shared content-script bootstrap |
| `src/entrypoints/{claude,chatgpt,gemini}.content.ts` | Per-site content scripts |
| `src/entrypoints/sidepanel/*` | React side panel |
| `e2e/*` | Playwright fixtures + specs |
| `docs/smoke-checklist.md`, `docs/store-listing.md` | Release docs |

---

### Task 1: Caps, favorite toggle and list-with-content in the handler layer

**Files:**
- Create: `src/lib/limits.ts`
- Modify: `src/lib/errors.ts` (append class)
- Modify: `src/lib/db/drizzle/prompt-repository.ts` (add 2 methods at end of class)
- Modify: `src/lib/mcp/tools.ts`
- Test: `tests/db/extension-handlers.db.test.ts`

**Interfaces:**
- Produces:
  - `MAX_PROMPTS_PER_WORKSPACE = 1000`, `MAX_CONTENT_LENGTH = 50_000`, `MAX_EXTENSION_LIST = 200`, `assertContentLength(content: string): void` (throws `ValidationError`) — from `src/lib/limits.ts`
  - `class LimitReachedError extends AppError` (statusCode 403) — from `src/lib/errors.ts`
  - `DrizzlePromptRepository.countNonArchived(workspaceId: string): Promise<number>`
  - `DrizzlePromptRepository.listForExtension(workspaceId: string, query: string, limit: number): Promise<Prompt[]>` — excludes archived, ordered `is_favorite DESC, updated_at DESC`
  - `interface PromptWithContent extends PromptSummary { content: string; is_favorite: boolean }`
  - `listPromptsWithContentHandler(workspaceId: string, query: string, limit: number): Promise<PromptWithContent[]>`
  - `UpdatePromptInput` gains `isFavorite?: boolean`
  - `createPromptHandler` throws `LimitReachedError` at the cap, and `ValidationError` for content over the limit. `updatePromptHandler` and `saveVersionHandler` throw `ValidationError` for content over the limit.

- [ ] **Step 1: Branch and local test database**

```bash
cd ~/brainstorming/experiments/prompt-saver
git checkout -b feat/chrome-extension
open -a Docker   # wait until `docker info` succeeds
docker run -d --name ps-test-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=prompt_saver_test -p 5432:5432 postgres:16
sleep 5
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/prompt_saver_test npm run db:migrate
npx jest --runInBand 2>&1 | tail -5
```
Expected: the existing suite passes (baseline). If a container named `ps-test-pg` already exists, run `docker start ps-test-pg` instead.

- [ ] **Step 2: Write the failing test** — `tests/db/extension-handlers.db.test.ts`

```ts
/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  createPromptHandler,
  updatePromptHandler,
  saveVersionHandler,
  listPromptsWithContentHandler,
} from '@/lib/mcp/tools';
import { LimitReachedError, ValidationError } from '@/lib/errors';
import { MAX_CONTENT_LENGTH, MAX_PROMPTS_PER_WORKSPACE } from '@/lib/limits';
import { resetDb, seedUser, closeDb } from './helpers';

beforeEach(resetDb);
afterAll(closeDb);

describe('caps', () => {
  it('rejects content over the max length on create, update and save_version', async () => {
    const { workspaceId } = await seedUser();
    const tooLong = 'x'.repeat(MAX_CONTENT_LENGTH + 1);
    await expect(createPromptHandler(workspaceId, { title: 't', content: tooLong })).rejects.toBeInstanceOf(ValidationError);
    const { id } = await createPromptHandler(workspaceId, { title: 't', content: 'ok' });
    await expect(updatePromptHandler(workspaceId, id, { content: tooLong })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveVersionHandler(workspaceId, id, tooLong)).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts content exactly at the max length', async () => {
    const { workspaceId } = await seedUser();
    await expect(
      createPromptHandler(workspaceId, { title: 't', content: 'x'.repeat(MAX_CONTENT_LENGTH) })
    ).resolves.toHaveProperty('id');
  });

  it('throws LimitReachedError at the prompt cap, ignoring archived prompts', async () => {
    const { workspaceId } = await seedUser();
    const db = getDb();
    const rows = Array.from({ length: MAX_PROMPTS_PER_WORKSPACE }, (_, i) => ({
      id: `p${i}`, workspaceId, title: `p${i}`, content: 'c',
    }));
    await db.insert(prompts).values(rows);
    await expect(createPromptHandler(workspaceId, { title: 'over', content: 'c' })).rejects.toBeInstanceOf(LimitReachedError);
    await db.update(prompts).set({ status: 'archived' }).where(eq(prompts.id, 'p0'));
    await expect(createPromptHandler(workspaceId, { title: 'fits', content: 'c' })).resolves.toHaveProperty('id');
  });
});

describe('updatePromptHandler isFavorite', () => {
  it('toggles the favorite flag', async () => {
    const { workspaceId } = await seedUser();
    const { id } = await createPromptHandler(workspaceId, { title: 't', content: 'c' });
    const updated = await updatePromptHandler(workspaceId, id, { isFavorite: true });
    expect(updated.is_favorite).toBe(true);
  });
});

describe('listPromptsWithContentHandler', () => {
  it('returns content, excludes archived, favorites first then newest, scoped to workspace', async () => {
    const { workspaceId } = await seedUser();
    const other = await seedUser('user-2', 'u2@example.com');
    const db = getDb();
    await db.insert(prompts).values([
      { id: 'old', workspaceId, title: 'Old', content: 'old body', updatedAt: new Date('2026-01-01') },
      { id: 'new', workspaceId, title: 'New', content: 'new body', updatedAt: new Date('2026-06-01') },
      { id: 'fav', workspaceId, title: 'Fav', content: 'fav body', isFavorite: true, updatedAt: new Date('2025-01-01') },
      { id: 'arch', workspaceId, title: 'Arch', content: 'a', status: 'archived' },
      { id: 'theirs', workspaceId: other.workspaceId, title: 'Theirs', content: 't' },
    ]);
    const list = await listPromptsWithContentHandler(workspaceId, '', 200);
    expect(list.map((p) => p.id)).toEqual(['fav', 'new', 'old']);
    expect(list[0]).toMatchObject({ content: 'fav body', is_favorite: true, title: 'Fav' });
  });

  it('filters by query across title, content and tags', async () => {
    const { workspaceId } = await seedUser();
    await getDb().insert(prompts).values([
      { id: 'a', workspaceId, title: 'Email reply', content: 'x' },
      { id: 'b', workspaceId, title: 'Other', content: 'x', tags: ['email'] },
      { id: 'c', workspaceId, title: 'Nope', content: 'x' },
    ]);
    const ids = (await listPromptsWithContentHandler(workspaceId, 'email', 200)).map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('caps the limit at MAX_EXTENSION_LIST', async () => {
    const { workspaceId } = await seedUser();
    await getDb().insert(prompts).values(
      Array.from({ length: 205 }, (_, i) => ({ id: `q${i}`, workspaceId, title: `q${i}`, content: 'c' }))
    );
    expect(await listPromptsWithContentHandler(workspaceId, '', 9999)).toHaveLength(200);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest tests/db/extension-handlers.db.test.ts --runInBand`
Expected: FAIL — `Cannot find module '@/lib/limits'`.

- [ ] **Step 4: Implement**

`src/lib/limits.ts`:
```ts
import { ValidationError } from './errors';

/** Per-workspace caps. A future paid tier raises these in one place. See spec 4.4. */
export const MAX_PROMPTS_PER_WORKSPACE = 1000;
export const MAX_CONTENT_LENGTH = 50_000;
/** Max prompts the extension list endpoint returns in one call. */
export const MAX_EXTENSION_LIST = 200;

export function assertContentLength(content: string): void {
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ValidationError(
      `Prompt content is limited to ${MAX_CONTENT_LENGTH.toLocaleString('en-US')} characters.`,
      'content'
    );
  }
}
```

Append to `src/lib/errors.ts`:
```ts
/**
 * A per-user cap was reached (403). See src/lib/limits.ts.
 */
export class LimitReachedError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'LimitReachedError';
  }
}
```

Add to `DrizzlePromptRepository` (end of class; add `ne` to the `drizzle-orm` import):
```ts
  /** Non-archived prompts in a workspace — the number the prompt cap counts. */
  async countNonArchived(workspaceId: string): Promise<number> {
    const [row] = await getDb()
      .select({ value: count() })
      .from(prompts)
      .where(and(eq(prompts.workspaceId, workspaceId), ne(prompts.status, 'archived')));
    return row?.value ?? 0;
  }

  /** The extension's cached library: non-archived, favourites first, then newest. */
  async listForExtension(workspaceId: string, query: string, limit: number): Promise<Prompt[]> {
    const filters = [eq(prompts.workspaceId, workspaceId), ne(prompts.status, 'archived')];
    if (query.trim() !== '') {
      const pattern = `%${escapeLike(query.trim())}%`;
      const match = or(
        ilike(prompts.title, pattern),
        ilike(prompts.description, pattern),
        ilike(prompts.content, pattern),
        sql`EXISTS (SELECT 1 FROM unnest(${prompts.tags}) AS tag WHERE tag ILIKE ${pattern})`
      );
      if (match !== undefined) filters.push(match);
    }
    const rows = await getDb()
      .select()
      .from(prompts)
      .where(and(...filters))
      .orderBy(desc(prompts.isFavorite), desc(prompts.updatedAt))
      .limit(limit);
    return rows.map(toPrompt);
  }
```

In `src/lib/mcp/tools.ts`:
- import `{ assertContentLength, MAX_PROMPTS_PER_WORKSPACE, MAX_EXTENSION_LIST } from '../limits'` and `{ LimitReachedError } from '../errors'`.
- At the top of `createPromptHandler`:
```ts
  assertContentLength(input.content);
  if ((await repo.countNonArchived(workspaceId)) >= MAX_PROMPTS_PER_WORKSPACE) {
    throw new LimitReachedError(
      `You've reached ${MAX_PROMPTS_PER_WORKSPACE.toLocaleString('en-US')} prompts. Archive some on the website to add more.`
    );
  }
```
- Replace `UpdatePromptInput` and `updatePromptHandler`:
```ts
export interface UpdatePromptInput {
  title?: string;
  content?: string;
  description?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export async function updatePromptHandler(
  workspaceId: string,
  id: string,
  input: UpdatePromptInput
): Promise<Prompt> {
  if (input.content !== undefined) assertContentLength(input.content);
  await requireOwnedPrompt(id, workspaceId);
  const { isFavorite, ...rest } = input;
  return repo.update(id, { ...rest, ...(isFavorite !== undefined ? { is_favorite: isFavorite } : {}) });
}
```
  Check that `repo.update` maps `is_favorite` (read `prompt-repository.ts` `update`). If it doesn't, add `if (updates.is_favorite !== undefined) patch['isFavorite'] = updates.is_favorite;` there, beside the existing `status` line.
- First line of `saveVersionHandler`: `assertContentLength(content);`
- Add:
```ts
export interface PromptWithContent extends PromptSummary {
  content: string;
  is_favorite: boolean;
}

/** Full bodies for the extension's local cache. Capped at MAX_EXTENSION_LIST. */
export async function listPromptsWithContentHandler(
  workspaceId: string,
  query: string,
  limit: number
): Promise<PromptWithContent[]> {
  const capped = Math.min(Math.max(1, limit), MAX_EXTENSION_LIST);
  const found = await repo.listForExtension(workspaceId, query, capped);
  return found.map((p) => ({ ...toSummary(p), content: p.content, is_favorite: p.is_favorite }));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/db/extension-handlers.db.test.ts tests/db/mcp-write-tools.db.test.ts tests/db/mcp-tools.db.test.ts --runInBand`
Expected: PASS (the existing MCP suites stay green).

- [ ] **Step 6: Lint, type-check, commit**

```bash
npm run type-check && npm run lint && npm run format:check
git add src/lib/limits.ts src/lib/errors.ts src/lib/db/drizzle/prompt-repository.ts src/lib/mcp/tools.ts tests/db/extension-handlers.db.test.ts
git commit -m "feat(limits): per-workspace prompt cap, content length cap, favourite toggle, list-with-content handler"
```

---

### Task 2: REST API `/api/v1/prompts`

**Files:**
- Create: `src/lib/extension/ids.ts`, `src/lib/rest/http.ts`, `src/lib/rest/schemas.ts`
- Create: `src/app/api/v1/prompts/route.ts`, `src/app/api/v1/prompts/[id]/route.ts`
- Test: `__tests__/lib/extension/ids.test.ts`, `tests/db/rest-v1.db.test.ts`

**Interfaces:**
- Consumes (Task 1): `listPromptsWithContentHandler`, `createPromptHandler`, `getPromptHandler`, `updatePromptHandler`, `LimitReachedError`, `MAX_CONTENT_LENGTH`. Existing: `resolveTokenContext(token) → UserContext | null` (has `tokenId`), `checkRateLimit(tokenId) → { allowed, retryAfterSeconds }`, `RATE_LIMIT_WINDOW_MS`, `AppError` subclasses, `logger`.
- Produces:
  - `allowedExtensionIds(): string[]`, `isAllowedExtensionId(id: string | null | undefined): boolean`, `isAllowedExtensionOrigin(origin: string | null): boolean` — from `src/lib/extension/ids.ts`
  - `withApi(req: Request, fn: (ctx: { workspaceId: string; userId: string }) => Promise<Response>): Promise<Response>` and `preflight(req: Request): Response`, `json(req: Request, body: unknown, status?: number): Response` — from `src/lib/rest/http.ts`
  - HTTP contract exactly as in spec 4.3. GET list → `{ prompts: PromptWithContent[] }`. POST → `201 { prompt: Prompt }`. GET id / PATCH → `{ prompt: Prompt }`.

- [ ] **Step 1: Failing unit test for ids** — `__tests__/lib/extension/ids.test.ts`

```ts
import { allowedExtensionIds, isAllowedExtensionId, isAllowedExtensionOrigin } from '@/lib/extension/ids';

const ORIGINAL = process.env['NEXT_PUBLIC_EXTENSION_IDS'];
afterEach(() => {
  process.env['NEXT_PUBLIC_EXTENSION_IDS'] = ORIGINAL;
});

describe('extension ids', () => {
  it('parses a comma list, trimming blanks', () => {
    process.env['NEXT_PUBLIC_EXTENSION_IDS'] = ' abcdefghijklmnopabcdefghijklmnop , ,ponmlkjihgfedcbaponmlkjihgfedcba';
    expect(allowedExtensionIds()).toEqual(['abcdefghijklmnopabcdefghijklmnop', 'ponmlkjihgfedcbaponmlkjihgfedcba']);
  });
  it('allows nothing when unset', () => {
    delete process.env['NEXT_PUBLIC_EXTENSION_IDS'];
    expect(isAllowedExtensionId('abcdefghijklmnopabcdefghijklmnop')).toBe(false);
  });
  it('matches ids and chrome-extension origins exactly', () => {
    process.env['NEXT_PUBLIC_EXTENSION_IDS'] = 'abcdefghijklmnopabcdefghijklmnop';
    expect(isAllowedExtensionId('abcdefghijklmnopabcdefghijklmnop')).toBe(true);
    expect(isAllowedExtensionId(null)).toBe(false);
    expect(isAllowedExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnop')).toBe(true);
    expect(isAllowedExtensionOrigin('https://evil.example')).toBe(false);
    expect(isAllowedExtensionOrigin('chrome-extension://abcdefghijklmnopabcdefghijklmnopX')).toBe(false);
    expect(isAllowedExtensionOrigin(null)).toBe(false);
  });
});
```

Run: `npx jest __tests__/lib/extension/ids.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/extension/ids.ts`**

```ts
/**
 * Chrome extension IDs allowed to call /api/v1 (CORS) and receive tokens from
 * /extension/connect. Read at call time so tests and deploys can change it.
 * Holds the Web Store ID plus any dev (unpacked) ID.
 */
export function allowedExtensionIds(): string[] {
  return (process.env['NEXT_PUBLIC_EXTENSION_IDS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isAllowedExtensionId(id: string | null | undefined): boolean {
  return typeof id === 'string' && allowedExtensionIds().includes(id);
}

export function isAllowedExtensionOrigin(origin: string | null): boolean {
  const prefix = 'chrome-extension://';
  if (origin === null || !origin.startsWith(prefix)) return false;
  return isAllowedExtensionId(origin.slice(prefix.length));
}
```

Run the test again → PASS.

- [ ] **Step 3: Failing contract tests** — `tests/db/rest-v1.db.test.ts`

```ts
/**
 * @jest-environment node
 */
import { GET as listGET, POST as listPOST, OPTIONS as listOPTIONS } from '@/app/api/v1/prompts/route';
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

function req(url: string, init: { method?: string; token?: string; body?: unknown; origin?: string } = {}): Request {
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
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: expect.any(String) } });
  });
});

describe('GET /api/v1/prompts', () => {
  it('lists own prompts with content', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'Hello', content: 'Body' });
    const res = await listGET(req(BASE, { token }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prompts).toHaveLength(1);
    expect(body.prompts[0]).toMatchObject({ id: 'p1', title: 'Hello', content: 'Body', is_favorite: false });
  });

  it('honours q', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values([
      { id: 'a', workspaceId, title: 'Email', content: 'x' },
      { id: 'b', workspaceId, title: 'Other', content: 'x' },
    ]);
    const body = await (await listGET(req(`${BASE}?q=email`, { token }))).json();
    expect(body.prompts.map((p: { id: string }) => p.id)).toEqual(['a']);
  });
});

describe('POST /api/v1/prompts', () => {
  it('creates and returns 201 with the prompt', async () => {
    const { token } = await userWithToken();
    const res = await listPOST(req(BASE, { method: 'POST', token, body: { title: 'New', content: 'Text', tags: ['x'] } }));
    expect(res.status).toBe(201);
    expect((await res.json()).prompt).toMatchObject({ title: 'New', content: 'Text', tags: ['x'] });
  });

  it('400s on invalid bodies', async () => {
    const { token } = await userWithToken();
    for (const body of [{}, { title: '', content: 'x' }, { title: 't' }, { title: 't', content: 'x', tags: 'nope' }]) {
      const res = await listPOST(req(BASE, { method: 'POST', token, body }));
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('validation');
    }
  });

  it('403 limit_reached at the cap', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values(
      Array.from({ length: MAX_PROMPTS_PER_WORKSPACE }, (_, i) => ({ id: `p${i}`, workspaceId, title: 't', content: 'c' }))
    );
    const res = await listPOST(req(BASE, { method: 'POST', token, body: { title: 't', content: 'c' } }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('limit_reached');
  });
});

describe('GET/PATCH /api/v1/prompts/:id', () => {
  it('gets and patches own prompt, including isFavorite', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    expect((await (await oneGET(req(`${BASE}/p1`, { token }), params('p1'))).json()).prompt.title).toBe('T');
    const res = await onePATCH(req(`${BASE}/p1`, { method: 'PATCH', token, body: { isFavorite: true } }), params('p1'));
    expect(res.status).toBe(200);
    expect((await res.json()).prompt.is_favorite).toBe(true);
  });

  it("404s on another user's prompt (no existence leak)", async () => {
    const a = await userWithToken();
    const b = await seedUser('user-2', 'u2@example.com');
    await getDb().insert(prompts).values({ id: 'theirs', workspaceId: b.workspaceId, title: 'T', content: 'C' });
    expect((await oneGET(req(`${BASE}/theirs`, { token: a.token }), params('theirs'))).status).toBe(404);
    const patch = await onePATCH(req(`${BASE}/theirs`, { method: 'PATCH', token: a.token, body: { title: 'x' } }), params('theirs'));
    expect(patch.status).toBe(404);
    expect((await patch.json()).error.code).toBe('not_found');
  });

  it('400s on an empty patch', async () => {
    const { token, workspaceId } = await userWithToken();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    expect((await onePATCH(req(`${BASE}/p1`, { method: 'PATCH', token, body: {} }), params('p1'))).status).toBe(400);
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
    expect(listOPTIONS(req(BASE, { method: 'OPTIONS', origin: 'https://evil.example' })).headers.get('Access-Control-Allow-Origin')).toBeNull();
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
```

Run: `npx jest tests/db/rest-v1.db.test.ts --runInBand` → FAIL (modules missing).

- [ ] **Step 4: Implement `src/lib/rest/schemas.ts`**

```ts
import { z } from 'zod';
import { MAX_CONTENT_LENGTH } from '../limits';

const tags = z.array(z.string().trim().min(1).max(50)).max(20);

export const createPromptBody = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  description: z.string().max(2000).optional(),
  tags: tags.optional(),
});

export const patchPromptBody = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(MAX_CONTENT_LENGTH).optional(),
    description: z.string().max(2000).optional(),
    tags: tags.optional(),
    isFavorite: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });
```

- [ ] **Step 5: Implement `src/lib/rest/http.ts`**

```ts
import { ZodError } from 'zod';
import { resolveTokenContext } from '../auth/token-context';
import { AppError, LimitReachedError, NotFoundError, RateLimitError, ValidationError, AuthenticationError } from '../errors';
import { logger } from '../logging';
import { checkRateLimit, RATE_LIMIT_WINDOW_MS } from '../rate-limit/repository';
import { isAllowedExtensionOrigin } from '../extension/ids';

type Code = 'unauthorized' | 'not_found' | 'validation' | 'rate_limited' | 'limit_reached' | 'internal';

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  if (!isAllowedExtensionOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req), ...extra },
  });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

function fail(req: Request, status: number, code: Code, message: string, extra: Record<string, string> = {}): Response {
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
  if (error instanceof AppError && error.statusCode < 500) return fail(req, 400, 'validation', error.message);
  logger.error('REST v1 handler failed', error instanceof Error ? error : new Error(String(error)));
  return fail(req, 500, 'internal', 'Something went wrong. Please try again.');
}

/**
 * Bearer auth → per-token rate limit (fails closed, as on /api/mcp) → handler.
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
    logger.error('Rate limit check failed; refusing request (fail closed)', e instanceof Error ? e : new Error(String(e)));
    return null;
  });
  if (limit === null || !limit.allowed) {
    const retry = limit === null ? Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) : limit.retryAfterSeconds;
    return fail(req, 429, 'rate_limited', `Too many requests. Try again in ${retry}s.`, { 'Retry-After': String(retry) });
  }
  try {
    return await fn({ workspaceId: ctx.workspaceId, userId: ctx.userId });
  } catch (error) {
    return toErrorResponse(req, error);
  }
}
```
If `toErrorResponse` trips the complexity-10 lint rule, split it into a lookup table of `[ErrorClass, status, code]` tuples walked by a loop. Keep the behaviour identical.

- [ ] **Step 6: Implement the routes**

`src/app/api/v1/prompts/route.ts`:
```ts
import { withApi, json, preflight } from '@/lib/rest/http';
import { createPromptBody } from '@/lib/rest/schemas';
import { createPromptHandler, getPromptHandler, listPromptsWithContentHandler } from '@/lib/mcp/tools';
import { MAX_EXTENSION_LIST } from '@/lib/limits';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  return withApi(req, async ({ workspaceId }) => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? MAX_EXTENSION_LIST);
    const list = await listPromptsWithContentHandler(workspaceId, q, Number.isFinite(limit) ? limit : MAX_EXTENSION_LIST);
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
```

`src/app/api/v1/prompts/[id]/route.ts`:
```ts
import { withApi, json, preflight } from '@/lib/rest/http';
import { patchPromptBody } from '@/lib/rest/schemas';
import { getPromptHandler, updatePromptHandler } from '@/lib/mcp/tools';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  return withApi(req, async ({ workspaceId }) => json(req, { prompt: await getPromptHandler(workspaceId, id) }));
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
```
Note: `createPromptHandler` records the change summary as "Created via MCP". Leave it; it's cosmetic.

- [ ] **Step 7: Run tests**

Run: `npx jest tests/db/rest-v1.db.test.ts __tests__/lib/extension/ids.test.ts --runInBand`
Expected: PASS.

- [ ] **Step 8: Lint, build, commit**

```bash
npm run type-check && npm run lint && npm run format:check && npm run build
git add src/lib/extension/ids.ts src/lib/rest src/app/api/v1 __tests__/lib/extension/ids.test.ts tests/db/rest-v1.db.test.ts
git commit -m "feat(api): token-authenticated REST v1 prompts API with CORS for the extension"
```

---

### Task 3: `/extension/connect` page and connect action

**Files:**
- Create: `src/lib/actions/extension.ts`
- Create: `src/app/extension/connect/page.tsx`, `src/app/extension/connect/ConnectPanel.tsx`
- Test: `tests/db/extension-connect.db.test.ts`

**Interfaces:**
- Consumes: `isAllowedExtensionId` (Task 2), `createToken`, `listTokens`, `revokeToken` (`src/lib/tokens/repository.ts`), `getCurrentContext`, `run`/`ActionResult`, existing `revokeTokenAction(id)`.
- Produces:
  - `EXTENSION_TOKEN_NAME = 'Chrome extension'` (exported from `src/lib/extension/ids.ts`)
  - `connectExtensionAction(extId: string): Promise<ActionResult<{ token: string; tokenId: string }>>`
  - Page message to the extension: `chrome.runtime.sendMessage(extId, { type: 'ps-token', token })`. The extension replies `{ ok: true }` (Task 6 implements the receiver).

- [ ] **Step 1: Failing test** — `tests/db/extension-connect.db.test.ts`

```ts
/**
 * @jest-environment node
 */
import { listTokens } from '@/lib/tokens/repository';
import { resetDb, seedUser, closeDb } from './helpers';

const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const mockContext = jest.fn();
jest.mock('@/lib/auth/context', () => ({ getCurrentContext: () => mockContext() }));

import { connectExtensionAction } from '@/lib/actions/extension';
import { EXTENSION_TOKEN_NAME } from '@/lib/extension/ids';

beforeAll(() => {
  process.env['NEXT_PUBLIC_EXTENSION_IDS'] = EXT_ID;
});
beforeEach(async () => {
  await resetDb();
  mockContext.mockReset();
});
afterAll(closeDb);

describe('connectExtensionAction', () => {
  it('mints a ps_ token named "Chrome extension"', async () => {
    const u = await seedUser();
    mockContext.mockResolvedValue(u);
    const res = await connectExtensionAction(EXT_ID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.token).toMatch(/^ps_/);
    const tokens = await listTokens(u.userId);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.name).toBe(EXTENSION_TOKEN_NAME);
  });

  it('revokes the previous active extension token but leaves other tokens alone', async () => {
    const u = await seedUser();
    mockContext.mockResolvedValue(u);
    const { createToken } = await import('@/lib/tokens/repository');
    await createToken(u.userId, 'Claude Code laptop');
    await connectExtensionAction(EXT_ID);
    await connectExtensionAction(EXT_ID);
    const tokens = await listTokens(u.userId);
    const ext = tokens.filter((t) => t.name === EXTENSION_TOKEN_NAME);
    expect(ext).toHaveLength(2);
    expect(ext.filter((t) => t.revokedAt === null)).toHaveLength(1);
    expect(tokens.find((t) => t.name === 'Claude Code laptop')?.revokedAt).toBeNull();
  });

  it('rejects an unknown extension id without minting', async () => {
    const u = await seedUser();
    mockContext.mockResolvedValue(u);
    const res = await connectExtensionAction('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');
    expect(res.ok).toBe(false);
    expect(await listTokens(u.userId)).toHaveLength(0);
  });
});
```

Run: `npx jest tests/db/extension-connect.db.test.ts --runInBand` → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/actions/extension.ts`**

```ts
'use server';

import { getCurrentContext } from '../auth/context';
import { ValidationError } from '../errors';
import { EXTENSION_TOKEN_NAME, isAllowedExtensionId } from '../extension/ids';
import { createToken, listTokens, revokeToken } from '../tokens/repository';
import { run, type ActionResult } from './result';

/**
 * Mints the extension's API token. Called only from the Connect button click,
 * never on page load, so visiting the page alone can't create tokens.
 * At most one active extension token per user: earlier ones are revoked.
 */
export async function connectExtensionAction(
  extId: string
): Promise<ActionResult<{ token: string; tokenId: string }>> {
  return run(async () => {
    if (!isAllowedExtensionId(extId)) {
      throw new ValidationError('Unknown extension. Reinstall Prompt Saver from the Chrome Web Store.');
    }
    const { userId } = await getCurrentContext();
    const existing = await listTokens(userId);
    for (const t of existing) {
      if (t.name === EXTENSION_TOKEN_NAME && t.revokedAt === null) await revokeToken(t.id, userId);
    }
    const { token, id } = await createToken(userId, EXTENSION_TOKEN_NAME);
    return { token, tokenId: id };
  });
}
```
Also add `export const EXTENSION_TOKEN_NAME = 'Chrome extension';` to `src/lib/extension/ids.ts`. A `'use server'` file may only export async functions, so the constant lives there.

Run the test → PASS.

- [ ] **Step 3: Implement the page**

`src/app/extension/connect/page.tsx` (server component):
```tsx
import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { isAllowedExtensionId } from '@/lib/extension/ids';
import { ConnectPanel } from './ConnectPanel';

export const metadata = { title: 'Connect extension — Prompt Saver' };

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ ext?: string }>;
}): Promise<React.ReactElement> {
  const { ext } = await searchParams;
  const session = await getServerSession(authOptions);
  if (session === null) {
    const back = `/extension/connect${ext !== undefined ? `?ext=${encodeURIComponent(ext)}` : ''}`;
    redirect(`/app/auth/signin?callbackUrl=${encodeURIComponent(back)}`);
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 font-body">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="font-display text-3xl text-stone-900">Connect Chrome extension</h1>
        {isAllowedExtensionId(ext) ? (
          <ConnectPanel extId={ext as string} email={session.user?.email ?? ''} />
        ) : (
          <p className="mt-4 text-stone-600">
            This link didn&apos;t come from the Prompt Saver extension. Open the extension and click
            <strong> Connect account</strong> again.
          </p>
        )}
      </div>
    </main>
  );
}
```

`src/app/extension/connect/ConnectPanel.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { connectExtensionAction } from '@/lib/actions/extension';
import { revokeTokenAction } from '@/lib/actions/tokens';
import { Button } from '@/components/ui/Button';

type ChromeRuntime = {
  sendMessage: (id: string, msg: unknown, cb: (resp: unknown) => void) => void;
  lastError?: { message?: string };
};
type State = 'idle' | 'working' | 'done' | 'no-extension' | 'error';

/** Present only when an installed extension lists this origin in externally_connectable. */
function runtime(): ChromeRuntime | undefined {
  return (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
}

function sendToken(rt: ChromeRuntime, extId: string, token: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      rt.sendMessage(extId, { type: 'ps-token', token }, (resp) => {
        resolve(rt.lastError === undefined && (resp as { ok?: boolean } | undefined)?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}

export function ConnectPanel({ extId, email }: { extId: string; email: string }): React.ReactElement {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  async function connect(): Promise<void> {
    setState('working');
    const res = await connectExtensionAction(extId);
    if (!res.ok) {
      setError(res.error);
      setState('error');
      return;
    }
    const rt = runtime();
    const delivered = rt !== undefined && (await sendToken(rt, extId, res.data.token));
    if (!delivered) {
      await revokeTokenAction(res.data.tokenId);
      setState('no-extension');
      return;
    }
    setState('done');
  }

  if (state === 'done') {
    return <p className="mt-4 text-teal-700">Connected — you can close this tab.</p>;
  }
  if (state === 'no-extension') {
    return (
      <p className="mt-4 text-stone-600">
        We couldn&apos;t reach the extension. Make sure Prompt Saver is installed and enabled in Chrome, then try
        again from the extension.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-4">
      <p className="text-stone-600">
        Allow the Prompt Saver extension to read and save prompts in <strong>{email}</strong>&apos;s library. You
        can disconnect any time from Settings.
      </p>
      {state === 'error' && <p className="text-red-700">{error}</p>}
      <Button onClick={() => void connect()} disabled={state === 'working'}>
        {state === 'working' ? 'Connecting…' : 'Connect'}
      </Button>
    </div>
  );
}
```
Read `src/components/ui/Button.tsx` first and match its actual props. If it has no `disabled` or `onClick` pass-through, use a native `<button>` with the DESIGN.md classes from the Global Constraints.

- [ ] **Step 4: Manual check**

```bash
NEXT_PUBLIC_EXTENSION_IDS=abcdefghijklmnopabcdefghijklmnop npm run dev
```
Open `http://localhost:3000/extension/connect?ext=abcdefghijklmnopabcdefghijklmnop` in a signed-out browser. Expected: redirect to sign-in, and after sign-in you land back on the connect page. Clicking Connect without the extension shows the "couldn't reach the extension" message, and Settings shows the token as revoked. Open `?ext=bogus`: the "didn't come from the extension" message, with no button.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run type-check && npm run lint && npm run format:check && npm run build
git add src/lib/actions/extension.ts src/lib/extension/ids.ts src/app/extension tests/db/extension-connect.db.test.ts
git commit -m "feat(extension): connect page mints a single revocable extension token"
```

---

### Task 4: Privacy page and env docs

**Files:**
- Create: `src/app/privacy/page.tsx`
- Modify: `.env.example` (append), `README.md` (append a "Chrome extension" section)
- Test: `__tests__/app/privacy.test.tsx`

**Interfaces:** none consumed. Produces the public URL `/privacy`, which the store listing (Task 10) links to.

- [ ] **Step 1: Failing render test** — `__tests__/app/privacy.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';

describe('privacy page', () => {
  it('covers what is stored, when chat text is read, no selling, and deletion', () => {
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy Policy');
    expect(screen.getByText(/Neon Postgres/)).toBeInTheDocument();
    expect(screen.getByText(/only when you/i)).toBeInTheDocument();
    expect(screen.getByText(/do not sell/i)).toBeInTheDocument();
    expect(screen.getByText(/delete your account/i)).toBeInTheDocument();
  });
});
```
Run: `npx jest __tests__/app/privacy.test.tsx` → FAIL.

- [ ] **Step 2: Implement `src/app/privacy/page.tsx`**

```tsx
import React from 'react';

export const metadata = { title: 'Privacy Policy — Prompt Saver' };

const CONTACT = 'brthapa@maitriservices.com';

export default function PrivacyPage(): React.ReactElement {
  return (
    <main className="mx-auto max-w-2xl bg-stone-50 px-4 py-12 font-body text-stone-800">
      <h1 className="font-display text-4xl text-stone-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated: 5 October 2026</p>

      <h2 className="mt-8 text-xl font-semibold">What we store</h2>
      <p className="mt-2">
        Your Google account name, email address and profile picture, and the prompts you save (title, text, tags,
        version history). Data is stored in Neon Postgres and served from Vercel.
      </p>

      <h2 className="mt-8 text-xl font-semibold">The Chrome extension</h2>
      <p className="mt-2">
        The extension reads the text in an AI chat box only when you insert a prompt, open the prompt picker by
        typing &quot;//&quot;, or choose &quot;Save current draft&quot;. It reads text you select on a page only when
        you choose &quot;Save to Prompt Saver&quot;. It does not read or send your conversations otherwise. Your
        prompt library is cached in the extension&apos;s local storage so the picker opens instantly.
      </p>

      <h2 className="mt-8 text-xl font-semibold">What we don&apos;t do</h2>
      <p className="mt-2">We do not sell your data, show ads, or share your prompts with anyone.</p>

      <h2 className="mt-8 text-xl font-semibold">Deleting your data</h2>
      <p className="mt-2">
        To delete your account and every prompt, email <a className="text-teal-700 underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        We delete it within 30 days. You can revoke the extension&apos;s access any time from Settings.
      </p>
    </main>
  );
}
```
Before committing, ask the human partner whether `brthapa@maitriservices.com` is the right public contact. If they say no, use the address they give.

- [ ] **Step 3: Docs**

Append to `.env.example`:
```
# Chrome extension IDs allowed to call /api/v1 and receive tokens from /extension/connect.
# Comma-separated: Web Store ID, plus your unpacked dev ID.
NEXT_PUBLIC_EXTENSION_IDS=
```
Append a `## Chrome extension` section to `README.md`. It should say: the extension lives in `extension/`; give the dev commands (`cd extension && npm install && npm run dev`); say that `NEXT_PUBLIC_EXTENSION_IDS` must contain the extension ID; list the `/api/v1/prompts` endpoints in one table; and link `/privacy`.

- [ ] **Step 4: Test, lint, commit**

```bash
npx jest __tests__/app/privacy.test.tsx && npm run lint && npm run format:check
git add src/app/privacy __tests__/app/privacy.test.tsx .env.example README.md
git commit -m "feat: privacy policy page and extension env docs"
```

---

### Task 5: Extension scaffold + typed API client

**Files:**
- Create: `extension/package.json`, `extension/wxt.config.ts`, `extension/tsconfig.json`, `extension/vitest.config.ts`, `extension/.gitignore`
- Create: `extension/src/lib/config.ts`, `extension/src/lib/types.ts`, `extension/src/lib/api.ts`
- Create: `extension/src/entrypoints/background.ts` (stub, filled in Task 6)
- Create: `extension/src/assets/tailwind.css`
- Test: `extension/src/lib/api.test.ts`

**Interfaces:**
- Produces:
  - `API_BASE: string` (from `import.meta.env.WXT_API_BASE`, default `https://prompt-saver-two.vercel.app`), `SITE_BASE = API_BASE`
  - `interface ExtPrompt { id: string; title: string; description: string | null; tags: string[]; updated_at: string; content: string; is_favorite: boolean }`
  - `type ApiErrorCode = 'unauthorized' | 'not_found' | 'validation' | 'rate_limited' | 'limit_reached' | 'internal' | 'network'`
  - `class ApiError extends Error { code: ApiErrorCode; retryAfter?: number }`
  - `createApi(token: string, fetchImpl?: typeof fetch)` returns `{ list(q?: string): Promise<ExtPrompt[]>; create(input: { title: string; content: string; tags?: string[] }): Promise<ExtPrompt>; patch(id: string, input: { isFavorite?: boolean }): Promise<ExtPrompt> }`

- [ ] **Step 1: Scaffold**

`extension/package.json`:
```json
{
  "name": "prompt-saver-extension",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "postinstall": "wxt prepare",
    "test": "vitest run",
    "e2e": "playwright test",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@fontsource/dm-sans": "^5.0.0",
    "@fontsource/jetbrains-mono": "^5.0.0"
  },
  "devDependencies": {
    "wxt": "^0.20.0",
    "@wxt-dev/module-react": "^1.1.0",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^16.0.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "@playwright/test": "^1.48.0",
    "esbuild": "^0.24.0",
    "prosemirror-state": "^1.4.3",
    "prosemirror-view": "^1.33.0",
    "prosemirror-model": "^1.21.0",
    "prosemirror-schema-basic": "^1.2.2",
    "quill": "^2.0.2"
  }
}
```

`extension/wxt.config.ts`:
```ts
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const API_BASE = process.env.WXT_API_BASE ?? 'https://prompt-saver-two.vercel.app';
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Prompt Saver — AI Prompt Manager for Claude, ChatGPT, Gemini & Codex',
    short_name: 'Prompt Saver',
    description: 'Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini. Type // to insert.',
    permissions: ['storage', 'sidePanel', 'contextMenus'],
    host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      `${API_BASE}/*`,
    ],
    externally_connectable: {
      matches: [`${API_BASE}/*`, ...(isDev ? ['http://localhost:3000/*'] : [])],
    },
    action: { default_title: 'Prompt Saver' },
  },
});
```

`extension/tsconfig.json`:
```json
{ "extends": "./.wxt/tsconfig.json", "compilerOptions": { "strict": true, "jsx": "react-jsx" } }
```

`extension/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: { environment: 'jsdom', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
```
If the installed WXT exports the plugin from `wxt/testing/vitest-plugin` instead, use that path. Check `node_modules/wxt/package.json` `exports`.

`extension/.gitignore`:
```
node_modules
.output
.wxt
e2e/fixtures/dist
test-results
playwright-report
```

`extension/src/assets/tailwind.css`:
```css
@import 'tailwindcss';
@import '@fontsource/dm-sans/400.css';
@import '@fontsource/dm-sans/600.css';
@import '@fontsource/jetbrains-mono/400.css';
@theme {
  --font-body: 'DM Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

`extension/src/entrypoints/background.ts` (stub):
```ts
export default defineBackground(() => {});
```

`extension/src/lib/config.ts`:
```ts
export const API_BASE: string = import.meta.env.WXT_API_BASE ?? 'https://prompt-saver-two.vercel.app';
export const SITE_BASE = API_BASE;
```

`extension/src/lib/types.ts`:
```ts
export interface ExtPrompt {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  updated_at: string;
  content: string;
  is_favorite: boolean;
}
```

Run:
```bash
cd ~/brainstorming/experiments/prompt-saver/extension && npm install && npm run build
```
Expected: `.output/chrome-mv3/manifest.json` exists. Its permissions are exactly `storage`, `sidePanel`, `contextMenus` (WXT may add nothing else; if it adds anything, investigate).

- [ ] **Step 2: Failing test** — `extension/src/lib/api.test.ts`

```ts
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
```
Run: `npx vitest run src/lib/api.test.ts` → FAIL.

- [ ] **Step 3: Implement `extension/src/lib/api.ts`**

```ts
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
    return (await r.json()) as T;
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
```
Note: `create`/`patch` return the website's full `Prompt` shape, which is a superset of `ExtPrompt`'s fields. That's fine.

- [ ] **Step 4: Run tests, type-check, commit**

```bash
npx vitest run && npm run type-check
cd .. && git add extension/package.json extension/package-lock.json extension/wxt.config.ts extension/tsconfig.json extension/vitest.config.ts extension/.gitignore extension/src
git commit -m "feat(extension): WXT scaffold, manifest and typed REST client"
```

---

### Task 6: Cache, message router and background worker

**Files:**
- Create: `extension/src/lib/cache.ts`, `extension/src/lib/messages.ts`
- Modify: `extension/src/entrypoints/background.ts`
- Test: `extension/src/lib/cache.test.ts`, `extension/src/lib/messages.test.ts`

**Interfaces:**
- Consumes: `createApi`, `ApiError`, `ExtPrompt` (Task 5).
- Produces:
  - `cache.ts`: `getToken(): Promise<string | null>`, `setToken(t: string): Promise<void>`, `clearAuth(): Promise<void>` (removes token, prompts, syncedAt), `getPrompts(): Promise<{ prompts: ExtPrompt[]; syncedAt: number }>`, `setPrompts(p: ExtPrompt[]): Promise<void>`, `setPendingSave(p: PendingSave | null): Promise<void>`, `takePendingSave(): Promise<PendingSave | null>`, `STALE_MS = 300_000`. Storage keys: `psToken`, `psPrompts`, `psSyncedAt` in `storage.local`; `psPendingSave` in `storage.session`.
  - `types.ts` additions: `interface PendingSave { title: string; content: string }` and
    ```ts
    type Msg =
      | { type: 'getPrompts'; refresh?: boolean }
      | { type: 'createPrompt'; title: string; content: string; tags?: string[] }
      | { type: 'toggleFavorite'; id: string; isFavorite: boolean }
      | { type: 'openSavePanel'; prefill: PendingSave }
      | { type: 'insertIntoTab'; tabId: number; text: string }
      | { type: 'getStatus' }
      | { type: 'disconnect' };
    type MsgResult<T = unknown> = { ok: true; data: T } | { ok: false; code: ApiErrorCode | 'signed_out' | 'no_editor'; message: string; retryAfter?: number };
    ```
  - `messages.ts`: `createRouter(deps: { apiFor: (token: string) => Api; openPanel: (tabId?: number) => Promise<boolean>; sendToTab: (tabId: number, msg: unknown) => Promise<unknown>; now?: () => number })` returns `(msg: Msg, sender?: { tab?: { id?: number } }) => Promise<MsgResult>`.
  - `getPrompts` returns `{ prompts: ExtPrompt[]; signedIn: boolean }` and refreshes when `refresh` is set or the cache is older than `STALE_MS`. If a refresh fails with a non-401 error, it serves the cache.
  - `getStatus` returns `{ signedIn: boolean }`.
  - `openSavePanel` returns `{ opened: boolean }`. When `opened` is false, the caller shows "Click the Prompt Saver icon to finish saving".
  - Any 401 → `clearAuth()` and `{ ok: false, code: 'unauthorized' }`.
  - Content-script message the background sends for insert: `{ type: 'ps-insert', text }`. The content script replies `{ ok: boolean }`.

- [ ] **Step 1: Failing tests**

`extension/src/lib/cache.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { getToken, setToken, clearAuth, getPrompts, setPrompts, setPendingSave, takePendingSave } from './cache';

const P = { id: 'p1', title: 'T', description: null, tags: [], updated_at: 'x', content: 'C', is_favorite: false };
beforeEach(() => fakeBrowser.reset());

describe('cache', () => {
  it('stores and clears auth with prompts', async () => {
    await setToken('ps_a');
    await setPrompts([P]);
    expect(await getToken()).toBe('ps_a');
    expect((await getPrompts()).prompts).toEqual([P]);
    await clearAuth();
    expect(await getToken()).toBeNull();
    expect(await getPrompts()).toEqual({ prompts: [], syncedAt: 0 });
  });
  it('pending save is taken once', async () => {
    await setPendingSave({ title: 't', content: 'c' });
    expect(await takePendingSave()).toEqual({ title: 't', content: 'c' });
    expect(await takePendingSave()).toBeNull();
  });
});
```

`extension/src/lib/messages.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { createRouter } from './messages';
import { setToken, setPrompts, getToken, getPrompts, takePendingSave } from './cache';
import { ApiError } from './api';

const P = (id: string) => ({ id, title: id, description: null, tags: [], updated_at: 'x', content: 'c', is_favorite: false });

function setup(api: Partial<Record<'list' | 'create' | 'patch', ReturnType<typeof vi.fn>>> = {}, now = 1_000_000) {
  const full = { list: vi.fn().mockResolvedValue([P('fresh')]), create: vi.fn(), patch: vi.fn(), ...api };
  const openPanel = vi.fn().mockResolvedValue(true);
  const sendToTab = vi.fn().mockResolvedValue({ ok: true });
  const route = createRouter({ apiFor: () => full as never, openPanel, sendToTab, now: () => now });
  return { route, api: full, openPanel, sendToTab };
}
beforeEach(() => fakeBrowser.reset());

describe('router', () => {
  it('signed out: getPrompts returns empty and signedIn false without calling the API', async () => {
    const { route, api } = setup();
    expect(await route({ type: 'getPrompts' })).toEqual({ ok: true, data: { prompts: [], signedIn: false } });
    expect(api.list).not.toHaveBeenCalled();
  });

  it('serves fresh cache without refetching, refetches when stale or forced', async () => {
    await setToken('ps_a');
    await setPrompts([P('cached')]);
    const { syncedAt } = await getPrompts();
    const fresh = setup({}, syncedAt + 1000);
    expect((await fresh.route({ type: 'getPrompts' })) ).toMatchObject({ data: { prompts: [P('cached')] } });
    expect(fresh.api.list).not.toHaveBeenCalled();
    const stale = setup({}, syncedAt + 301_000);
    expect(await stale.route({ type: 'getPrompts' })).toMatchObject({ data: { prompts: [P('fresh')] } });
    const forced = setup({}, syncedAt + 1000);
    await forced.route({ type: 'getPrompts', refresh: true });
    expect(forced.api.list).toHaveBeenCalled();
  });

  it('401 clears token and cache and reports unauthorized (no retry loop)', async () => {
    await setToken('ps_a');
    await setPrompts([P('cached')]);
    const { route, api } = setup({ list: vi.fn().mockRejectedValue(new ApiError('unauthorized', 'x')) });
    expect(await route({ type: 'getPrompts', refresh: true })).toMatchObject({ ok: false, code: 'unauthorized' });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(await getToken()).toBeNull();
    expect((await getPrompts()).prompts).toEqual([]);
  });

  it('network failure on refresh serves the cache', async () => {
    await setToken('ps_a');
    await setPrompts([P('cached')]);
    const { route } = setup({ list: vi.fn().mockRejectedValue(new ApiError('network', 'x')) });
    expect(await route({ type: 'getPrompts', refresh: true })).toMatchObject({ ok: true, data: { prompts: [P('cached')] } });
  });

  it('createPrompt posts then refreshes the cache', async () => {
    await setToken('ps_a');
    const { route, api } = setup({ create: vi.fn().mockResolvedValue(P('new')), list: vi.fn().mockResolvedValue([P('new')]) });
    expect(await route({ type: 'createPrompt', title: 'new', content: 'c' })).toMatchObject({ ok: true });
    expect(api.create).toHaveBeenCalledWith({ title: 'new', content: 'c' });
    expect((await getPrompts()).prompts).toEqual([P('new')]);
  });

  it('createPrompt surfaces limit_reached with its message', async () => {
    await setToken('ps_a');
    const { route } = setup({ create: vi.fn().mockRejectedValue(new ApiError('limit_reached', 'You have reached 1,000 prompts')) });
    expect(await route({ type: 'createPrompt', title: 't', content: 'c' })).toEqual({ ok: false, code: 'limit_reached', message: 'You have reached 1,000 prompts' });
  });

  it('openSavePanel stores the prefill and reports whether the panel opened', async () => {
    const { route, openPanel } = setup();
    openPanel.mockResolvedValueOnce(false);
    expect(await route({ type: 'openSavePanel', prefill: { title: 't', content: 'c' } }, { tab: { id: 7 } })).toEqual({ ok: true, data: { opened: false } });
    expect(openPanel).toHaveBeenCalledWith(7);
    expect(await takePendingSave()).toEqual({ title: 't', content: 'c' });
  });

  it('insertIntoTab forwards ps-insert and maps a failed insert to no_editor', async () => {
    const { route, sendToTab } = setup();
    expect(await route({ type: 'insertIntoTab', tabId: 3, text: 'hi' })).toEqual({ ok: true, data: null });
    expect(sendToTab).toHaveBeenCalledWith(3, { type: 'ps-insert', text: 'hi' });
    sendToTab.mockResolvedValueOnce({ ok: false });
    expect(await route({ type: 'insertIntoTab', tabId: 3, text: 'hi' })).toMatchObject({ ok: false, code: 'no_editor' });
  });
});
```
Run: `npx vitest run src/lib/cache.test.ts src/lib/messages.test.ts` → FAIL.

- [ ] **Step 2: Implement `cache.ts`** (`storage` is WXT's auto-imported wrapper)

```ts
import type { ExtPrompt, PendingSave } from './types';

export const STALE_MS = 300_000;
const token = storage.defineItem<string | null>('local:psToken', { fallback: null });
const prompts = storage.defineItem<ExtPrompt[]>('local:psPrompts', { fallback: [] });
const syncedAt = storage.defineItem<number>('local:psSyncedAt', { fallback: 0 });
const pending = storage.defineItem<PendingSave | null>('session:psPendingSave', { fallback: null });

export const getToken = (): Promise<string | null> => token.getValue();
export const setToken = (t: string): Promise<void> => token.setValue(t);
export async function clearAuth(): Promise<void> {
  await Promise.all([token.removeValue(), prompts.removeValue(), syncedAt.removeValue()]);
}
export async function getPrompts(): Promise<{ prompts: ExtPrompt[]; syncedAt: number }> {
  return { prompts: await prompts.getValue(), syncedAt: await syncedAt.getValue() };
}
export async function setPrompts(p: ExtPrompt[], at: number = Date.now()): Promise<void> {
  await Promise.all([prompts.setValue(p), syncedAt.setValue(at)]);
}
export const setPendingSave = (p: PendingSave | null): Promise<void> => pending.setValue(p);
export async function takePendingSave(): Promise<PendingSave | null> {
  const v = await pending.getValue();
  await pending.removeValue();
  return v;
}
/** Panel and content scripts subscribe to cache changes. */
export const watchPrompts = (cb: (p: ExtPrompt[]) => void): (() => void) => prompts.watch((v) => cb(v ?? []));
export const watchToken = (cb: (t: string | null) => void): (() => void) => token.watch((v) => cb(v ?? null));
export const watchPendingSave = (cb: (p: PendingSave | null) => void): (() => void) => pending.watch((v) => cb(v ?? null));
```
Add `PendingSave`, `Msg` and `MsgResult` (exactly as in Interfaces) to `types.ts`, importing `ApiErrorCode` with `import type` from `./api`.

- [ ] **Step 3: Implement `messages.ts`**

```ts
import { ApiError, type Api } from './api';
import { clearAuth, getPrompts, getToken, setPendingSave, setPrompts, STALE_MS } from './cache';
import type { ExtPrompt, Msg, MsgResult } from './types';

interface Deps {
  apiFor: (token: string) => Api;
  openPanel: (tabId?: number) => Promise<boolean>;
  sendToTab: (tabId: number, msg: unknown) => Promise<unknown>;
  now?: () => number;
}

const ok = <T>(data: T): MsgResult<T> => ({ ok: true, data });
const signedOut: MsgResult<never> = { ok: false, code: 'signed_out', message: 'Connect your Prompt Saver account first.' };

async function fromError(e: unknown): Promise<MsgResult<never>> {
  if (e instanceof ApiError) {
    if (e.code === 'unauthorized') await clearAuth();
    return { ok: false, code: e.code, message: e.message, ...(e.retryAfter !== undefined ? { retryAfter: e.retryAfter } : {}) };
  }
  return { ok: false, code: 'internal', message: 'Something went wrong. Please try again.' };
}

export function createRouter(deps: Deps) {
  const now = deps.now ?? Date.now;

  async function refresh(token: string): Promise<ExtPrompt[]> {
    const list = await deps.apiFor(token).list();
    await setPrompts(list, now());
    return list;
  }

  async function getPromptsMsg(force: boolean): Promise<MsgResult> {
    const token = await getToken();
    if (token === null) return ok({ prompts: [], signedIn: false });
    const cached = await getPrompts();
    if (!force && now() - cached.syncedAt < STALE_MS) return ok({ prompts: cached.prompts, signedIn: true });
    try {
      return ok({ prompts: await refresh(token), signedIn: true });
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'unauthorized') return ok({ prompts: cached.prompts, signedIn: true });
      return fromError(e);
    }
  }

  async function withToken(fn: (token: string) => Promise<MsgResult>): Promise<MsgResult> {
    const token = await getToken();
    if (token === null) return signedOut;
    try {
      return await fn(token);
    } catch (e) {
      return fromError(e);
    }
  }

  return async function route(msg: Msg, sender?: { tab?: { id?: number } }): Promise<MsgResult> {
    switch (msg.type) {
      case 'getPrompts':
        return getPromptsMsg(msg.refresh === true);
      case 'getStatus':
        return ok({ signedIn: (await getToken()) !== null });
      case 'createPrompt':
        return withToken(async (t) => {
          const { type: _type, ...input } = msg;
          const created = await deps.apiFor(t).create(input);
          await refresh(t).catch(() => undefined);
          return ok(created);
        });
      case 'toggleFavorite':
        return withToken(async (t) => {
          const updated = await deps.apiFor(t).patch(msg.id, { isFavorite: msg.isFavorite });
          await refresh(t).catch(() => undefined);
          return ok(updated);
        });
      case 'openSavePanel':
        await setPendingSave(msg.prefill);
        return ok({ opened: await deps.openPanel(sender?.tab?.id) });
      case 'insertIntoTab': {
        const resp = (await deps.sendToTab(msg.tabId, { type: 'ps-insert', text: msg.text }).catch(() => null)) as { ok?: boolean } | null;
        return resp?.ok === true ? ok(null) : { ok: false, code: 'no_editor', message: "Couldn't find the chat box on this page." };
      }
      case 'disconnect':
        await clearAuth();
        return ok(null);
    }
  };
}
```
The `createPrompt` test expects `create` to be called with `{ title, content }` only, so strip `type` as shown. `tags` passes through only when present. If lint flags `_type` as unused, destructure via a helper instead.

- [ ] **Step 4: Wire `background.ts`**

```ts
import { createApi } from '@/lib/api';
import { setToken } from '@/lib/cache';
import { createRouter } from '@/lib/messages';
import { SITE_BASE } from '@/lib/config';
import type { Msg } from '@/lib/types';

export default defineBackground(() => {
  const route = createRouter({
    apiFor: (t) => createApi(t),
    openPanel: async (tabId) => {
      try {
        if (tabId !== undefined) await browser.sidePanel.open({ tabId });
        else await browser.sidePanel.open({ windowId: (await browser.windows.getCurrent()).id! });
        return true;
      } catch {
        return false; // no user gesture available: caller shows "click the icon"
      }
    },
    sendToTab: (tabId, msg) => browser.tabs.sendMessage(tabId, msg),
  });

  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onMessage.addListener((msg: Msg, sender) => route(msg, sender));

  // Token hand-off from /extension/connect. Only our site can reach this
  // (manifest externally_connectable); the origin check is defence in depth.
  browser.runtime.onMessageExternal.addListener(async (msg: { type?: string; token?: string }, sender) => {
    if (sender.origin !== new URL(SITE_BASE).origin && !sender.origin?.startsWith('http://localhost:3000')) return { ok: false };
    if (msg.type !== 'ps-token' || typeof msg.token !== 'string' || !msg.token.startsWith('ps_')) return { ok: false };
    await setToken(msg.token);
    void route({ type: 'getPrompts', refresh: true });
    return { ok: true };
  });

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({ id: 'ps-save-selection', title: 'Save to Prompt Saver', contexts: ['selection'] });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'ps-save-selection' || info.selectionText === undefined) return;
    const content = info.selectionText;
    // sidePanel.open must run synchronously inside the user gesture: open first, then store.
    if (tab?.id !== undefined) void browser.sidePanel.open({ tabId: tab.id });
    void route({ type: 'openSavePanel', prefill: { title: content.split('\n')[0]!.slice(0, 80), content } }, { tab });
  });
});
```
Gesture note: in `contextMenus.onClicked`, `sidePanel.open` is called before any `await`, so the click's user gesture is preserved. The router's own `openPanel` call that follows may fail harmlessly, because the panel is already open.

- [ ] **Step 5: Run tests, build, commit**

```bash
npx vitest run && npm run type-check && npm run build
cd .. && git add extension/src
git commit -m "feat(extension): token/prompt cache, message router, background worker"
```

---

### Task 7: Site adapters, insert chain and `//` picker logic

**Files:**
- Create: `extension/src/sites/types.ts`, `extension/src/sites/claude.ts`, `extension/src/sites/chatgpt.ts`, `extension/src/sites/gemini.ts`
- Create: `extension/src/lib/insert.ts`
- Create: `extension/src/picker/trigger.ts`, `extension/src/picker/filter.ts`
- Test: `extension/src/lib/insert.test.ts`, `extension/src/picker/trigger.test.ts`, `extension/src/picker/filter.test.ts`, `extension/src/sites/adapters.test.ts`

**Interfaces:**
- Consumes: `ExtPrompt` (Task 5).
- Produces:
  - `interface SiteAdapter { id: 'claude' | 'chatgpt' | 'gemini'; findEditor(doc?: Document): HTMLElement | null; readDraft(doc?: Document): string }`
  - `claudeAdapter`, `chatgptAdapter`, `geminiAdapter` (exported consts)
  - `type InsertResult = 'inserted' | 'pasted' | 'copied' | 'failed'`
  - `insertText(editor: HTMLElement, text: string, replaceChars?: number): Promise<InsertResult>`. `replaceChars` deletes that many characters before the caret first (used to remove `//query`).
  - `detectTrigger(textBeforeCaret: string): { query: string; length: number } | null`
  - `filterPrompts(prompts: ExtPrompt[], query: string, max?: number): ExtPrompt[]` (default max 8)
  - `textBeforeCaret(editor: HTMLElement): string`

- [ ] **Step 1: Failing tests**

`extension/src/picker/trigger.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectTrigger } from './trigger';

describe('detectTrigger', () => {
  it.each([
    ['//', { query: '', length: 2 }],
    ['hello //em', { query: 'em', length: 4 }],
    ['line\n//code', { query: 'code', length: 6 }],
  ])('triggers for %j', (input, expected) => expect(detectTrigger(input)).toEqual(expected));

  it.each(['https://', 'see https://exa', 'foo//bar', 'a / /b', '// two words', '///'])('does not trigger for %j', (input) =>
    expect(detectTrigger(input)).toBeNull()
  );
});
```

`extension/src/picker/filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { filterPrompts } from './filter';

const p = (id: string, title: string, extra: Partial<{ tags: string[]; content: string; is_favorite: boolean }> = {}) => ({
  id, title, description: null, tags: extra.tags ?? [], updated_at: 'x', content: extra.content ?? '', is_favorite: extra.is_favorite ?? false,
});

describe('filterPrompts', () => {
  const list = [
    p('1', 'Code review'),
    p('2', 'Email reply', { tags: ['writing'] }),
    p('3', 'Summarise', { content: 'review this doc' }),
    p('4', 'Fav review', { is_favorite: true }),
  ];
  it('empty query returns favorites first, max 8', () => {
    expect(filterPrompts(list, '').map((x) => x.id)).toEqual(['4', '1', '2', '3']);
    expect(filterPrompts(Array.from({ length: 20 }, (_, i) => p(String(i), `t${i}`)), '')).toHaveLength(8);
  });
  it('ranks title matches over tag over content, favorites first within a rank, case-insensitive', () => {
    expect(filterPrompts(list, 'REVIEW').map((x) => x.id)).toEqual(['4', '1', '3']);
    expect(filterPrompts(list, 'writ').map((x) => x.id)).toEqual(['2']);
  });
  it('returns [] for no match', () => expect(filterPrompts(list, 'zzz')).toEqual([]));
});
```

`extension/src/lib/insert.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertText } from './insert';

function editable(text = ''): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.textContent = text;
  document.body.replaceChildren(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(range);
  return el;
}

/** jsdom has no execCommand; emulate a working editor by inserting at the selection. */
function workingExecCommand() {
  return vi.fn((cmd: string, _ui: boolean, value?: string) => {
    if (cmd !== 'insertText') return false;
    const sel = getSelection()!;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    r.insertNode(document.createTextNode(value ?? ''));
    return true;
  });
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('insertText', () => {
  it('uses execCommand insertText and preserves unicode + newlines', async () => {
    document.execCommand = workingExecCommand() as never;
    const el = editable();
    expect(await insertText(el, 'Line 1\nLine 2 ✅ 日本')).toBe('inserted');
    expect(el.textContent).toBe('Line 1\nLine 2 ✅ 日本');
  });

  it('replaces the //query before the caret', async () => {
    document.execCommand = workingExecCommand() as never;
    const el = editable('hi //em');
    expect(await insertText(el, 'PROMPT', 4)).toBe('inserted');
    expect(el.textContent).toBe('hi PROMPT');
  });

  it('works for textarea via setRangeText when execCommand does nothing', async () => {
    document.execCommand = vi.fn(() => false) as never;
    const ta = document.createElement('textarea');
    document.body.replaceChildren(ta);
    ta.value = 'x //q';
    ta.setSelectionRange(5, 5);
    expect(await insertText(ta, 'P', 3)).toBe('inserted');
    expect(ta.value).toBe('x P');
  });

  it('falls back to paste event, then clipboard', async () => {
    document.execCommand = vi.fn(() => false) as never;
    const el = editable();
    const onPaste = vi.fn((e: Event) => {
      el.textContent = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
    });
    el.addEventListener('paste', onPaste);
    expect(await insertText(el, 'pasted')).toBe('pasted');
    el.removeEventListener('paste', onPaste);
    el.textContent = '';
    expect(await insertText(el, 'clip')).toBe('copied');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('clip');
  });

  it('reports failed when even the clipboard rejects', async () => {
    document.execCommand = vi.fn(() => false) as never;
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'));
    expect(await insertText(editable(), 'x')).toBe('failed');
  });
});
```
Note: jsdom's `DataTransfer`/`ClipboardEvent` support is partial. If `new DataTransfer()` throws in jsdom, `insert.ts` must catch it and move to the clipboard step. In that case, change the paste assertion so it accepts `'pasted'` only when `typeof DataTransfer !== 'undefined'`, and keep the clipboard assertion unconditional.

`extension/src/sites/adapters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { claudeAdapter } from './claude';
import { chatgptAdapter } from './chatgpt';
import { geminiAdapter } from './gemini';

function page(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

describe('adapters', () => {
  it('claude finds the ProseMirror editor and reads its draft', () => {
    const d = page('<div contenteditable="true" class="ProseMirror">draft text</div>');
    expect(claudeAdapter.findEditor(d)?.className).toBe('ProseMirror');
    expect(claudeAdapter.readDraft(d)).toBe('draft text');
  });
  it('chatgpt prefers #prompt-textarea', () => {
    const d = page('<div id="prompt-textarea" contenteditable="true">hi</div>');
    expect(chatgptAdapter.findEditor(d)?.id).toBe('prompt-textarea');
    expect(chatgptAdapter.readDraft(d)).toBe('hi');
  });
  it('chatgpt falls back to a textarea (Codex task input)', () => {
    const d = page('<textarea placeholder="Describe a task">task</textarea>');
    expect(chatgptAdapter.findEditor(d)?.tagName).toBe('TEXTAREA');
    expect(chatgptAdapter.readDraft(d)).toBe('task');
  });
  it('gemini finds the Quill editor', () => {
    const d = page('<rich-textarea><div class="ql-editor" contenteditable="true">g</div></rich-textarea>');
    expect(geminiAdapter.findEditor(d)?.classList.contains('ql-editor')).toBe(true);
  });
  it('returns null / empty when no editor exists', () => {
    expect(claudeAdapter.findEditor(page('<p>x</p>'))).toBeNull();
    expect(geminiAdapter.readDraft(page('<p>x</p>'))).toBe('');
  });
});
```
Run: `npx vitest run src/picker src/lib/insert.test.ts src/sites` → FAIL.

- [ ] **Step 2: Implement**

`extension/src/picker/trigger.ts`:
```ts
/**
 * "//" at line start or after whitespace, followed by a query with no spaces
 * or slashes, ending at the caret. "https://" never triggers: ':' precedes it.
 */
const TRIGGER = /(?:^|\s)\/\/([^\s/]*)$/;

export function detectTrigger(textBeforeCaret: string): { query: string; length: number } | null {
  const m = TRIGGER.exec(textBeforeCaret);
  if (m === null) return null;
  const query = m[1] ?? '';
  return { query, length: query.length + 2 };
}

/** Text from the start of the caret's line (block) up to the caret. */
export function textBeforeCaret(editor: HTMLElement): string {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return editor.value.slice(0, editor.selectionStart ?? editor.value.length);
  }
  const sel = editor.ownerDocument.getSelection();
  if (sel === null || sel.rangeCount === 0) return '';
  const r = sel.getRangeAt(0);
  if (!editor.contains(r.startContainer)) return '';
  const pre = editor.ownerDocument.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString();
}
```
`detectTrigger` must reject `'///'`. With the regex above, `'///'` matches `//` + `/`? No: `[^\s/]*` can't take `/`, and the `$` anchor fails after the first `//`. And for `'// two words'`, the query part cannot contain spaces, so it fails. Run the tests to confirm both.

`extension/src/picker/filter.ts`:
```ts
import type { ExtPrompt } from '../lib/types';

function rank(p: ExtPrompt, q: string): number {
  if (q === '') return 0;
  if (p.title.toLowerCase().includes(q)) return 0;
  if (p.tags.some((t) => t.toLowerCase().includes(q))) return 1;
  if (p.content.toLowerCase().includes(q)) return 2;
  return -1;
}

export function filterPrompts(prompts: ExtPrompt[], query: string, max = 8): ExtPrompt[] {
  const q = query.trim().toLowerCase();
  return prompts
    .map((p, i) => ({ p, i, r: rank(p, q) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || Number(b.p.is_favorite) - Number(a.p.is_favorite) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.p);
}
```

`extension/src/lib/insert.ts`:
```ts
export type InsertResult = 'inserted' | 'pasted' | 'copied' | 'failed';

function isField(el: HTMLElement): el is HTMLTextAreaElement | HTMLInputElement {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}
const read = (el: HTMLElement): string => (isField(el) ? el.value : (el.textContent ?? ''));

/** Extends the current selection backward by n characters so the next insert replaces them. */
function selectBack(el: HTMLElement, n: number): void {
  if (n <= 0) return;
  if (isField(el)) {
    const end = el.selectionStart ?? el.value.length;
    el.setSelectionRange(Math.max(0, end - n), end);
    return;
  }
  const sel = el.ownerDocument.getSelection();
  if (sel === null || sel.rangeCount === 0) return;
  for (let i = 0; i < n; i++) sel.modify?.('extend', 'backward', 'character');
  if (typeof sel.modify !== 'function') {
    const r = sel.getRangeAt(0);
    if (r.startContainer.nodeType === Node.TEXT_NODE) r.setStart(r.startContainer, Math.max(0, r.startOffset - n));
  }
}

function tryExec(el: HTMLElement, text: string): boolean {
  const before = read(el);
  try {
    el.ownerDocument.execCommand('insertText', false, text);
  } catch {
    return false;
  }
  if (read(el) !== before) return true;
  if (isField(el)) {
    // React-controlled textareas: setRangeText + input event.
    el.setRangeText(text, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return read(el) !== before;
  }
  return false;
}

function tryPaste(el: HTMLElement, text: string): boolean {
  const before = read(el);
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  } catch {
    return false;
  }
  return read(el) !== before;
}

/** Insert strategy chain (spec 5.4). Never submits the message. */
export async function insertText(editor: HTMLElement, text: string, replaceChars = 0): Promise<InsertResult> {
  editor.focus();
  selectBack(editor, replaceChars);
  if (tryExec(editor, text)) return 'inserted';
  if (tryPaste(editor, text)) return 'pasted';
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
```

`extension/src/sites/types.ts`:
```ts
export interface SiteAdapter {
  id: 'claude' | 'chatgpt' | 'gemini';
  findEditor(doc?: Document): HTMLElement | null;
  readDraft(doc?: Document): string;
}

/** First visible match wins; selectors are tried in order. */
export function makeAdapter(id: SiteAdapter['id'], selectors: string[]): SiteAdapter {
  const findEditor = (doc: Document = document): HTMLElement | null => {
    for (const s of selectors) {
      const el = doc.querySelector<HTMLElement>(s);
      if (el !== null) return el;
    }
    return null;
  };
  return {
    id,
    findEditor,
    readDraft: (doc: Document = document) => {
      const el = findEditor(doc);
      if (el === null) return '';
      return (el instanceof HTMLTextAreaElement ? el.value : (el.innerText ?? el.textContent ?? '')).trim();
    },
  };
}
```
jsdom has no `innerText` (it returns undefined), so the `?? textContent` fallback is what the tests exercise.

`extension/src/sites/claude.ts`:
```ts
import { makeAdapter } from './types';
// Selectors verified against claude.ai on 2026-10-05; update here only when the site changes.
export const claudeAdapter = makeAdapter('claude', ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"]']);
```
`extension/src/sites/chatgpt.ts`:
```ts
import { makeAdapter } from './types';
// Chat uses #prompt-textarea (ProseMirror). Codex (/codex) task input is tried via the textarea fallback.
export const chatgptAdapter = makeAdapter('chatgpt', ['#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'textarea']);
```
`extension/src/sites/gemini.ts`:
```ts
import { makeAdapter } from './types';
export const geminiAdapter = makeAdapter('gemini', ['rich-textarea .ql-editor[contenteditable="true"]', '.ql-editor[contenteditable="true"]']);
```
Live selectors: when Task 10 runs the manual smoke check, confirm each selector against the real site and fix it in that adapter file if needed. The tests pin the fallback order, not live markup.

- [ ] **Step 3: Run tests, commit**

```bash
npx vitest run && npm run type-check
cd .. && git add extension/src/sites extension/src/lib/insert.ts extension/src/lib/insert.test.ts extension/src/picker
git commit -m "feat(extension): site adapters, insert strategy chain, // trigger and filter"
```

---

### Task 8: Picker UI and content scripts

**Files:**
- Create: `extension/src/picker/picker.ts`, `extension/src/picker/picker.css`, `extension/src/lib/content-main.ts`
- Create: `extension/src/entrypoints/claude.content.ts`, `chatgpt.content.ts`, `gemini.content.ts`
- Test: `extension/src/picker/picker.test.ts`

**Interfaces:**
- Consumes: `detectTrigger`, `textBeforeCaret`, `filterPrompts` (Task 7); `insertText` (Task 7); `SiteAdapter` adapters (Task 7); `Msg`/`MsgResult` (Task 6); `watchPrompts`, `watchToken` (Task 6).
- Produces:
  - `createPicker(opts: { getState: () => { prompts: ExtPrompt[]; signedIn: boolean }; onPick: (p: ExtPrompt) => void; onSaveDraft: () => void; onSignIn: () => void; root?: HTMLElement })` returns `{ open(anchor: DOMRect, query: string): void; update(query: string): void; close(): void; isOpen(): boolean; handleKey(e: KeyboardEvent): boolean }`. `handleKey` returns true when it consumed the key.
  - `runContentScript(adapter: SiteAdapter): void` — installs listeners on `document`, handles `ps-insert` messages.
  - Row semantics: up to 8 prompt rows, then the always-last "Save current draft…" row. When signed out: a single row, "Sign in to Prompt Saver". When signed in with 0 prompts: "No prompts yet — open panel" plus the save-draft row.

- [ ] **Step 1: Failing test** — `extension/src/picker/picker.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import { createPicker } from './picker';

const p = (id: string, fav = false) => ({ id, title: `Title ${id}`, description: null, tags: [], updated_at: 'x', content: `body ${id}`, is_favorite: fav });
const RECT = { top: 500, left: 100, bottom: 520, right: 110, width: 10, height: 20, x: 100, y: 500, toJSON: () => ({}) } as DOMRect;
const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

function make(state: { prompts: ReturnType<typeof p>[]; signedIn: boolean }) {
  const onPick = vi.fn(), onSaveDraft = vi.fn(), onSignIn = vi.fn();
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const picker = createPicker({ getState: () => state, onPick, onSaveDraft, onSignIn, root });
  return { picker, onPick, onSaveDraft, onSignIn, root };
}
const rows = (root: HTMLElement) => Array.from(root.shadowRoot?.querySelectorAll('[role="option"]') ?? root.querySelectorAll('[role="option"]')).map((r) => r.textContent);

describe('picker', () => {
  it('lists filtered prompts then the save-draft row; Enter picks the active row', () => {
    const { picker, onPick, root } = make({ prompts: [p('a'), p('b', true)], signedIn: true });
    picker.open(RECT, '');
    expect(rows(root)).toEqual(['Title b', 'Title a', 'Save current draft…']);
    expect(picker.handleKey(key('ArrowDown'))).toBe(true);
    expect(picker.handleKey(key('Enter'))).toBe(true);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(picker.isOpen()).toBe(false);
  });

  it('update(query) refilters; Esc closes without picking', () => {
    const { picker, onPick, root } = make({ prompts: [p('a'), p('b')], signedIn: true });
    picker.open(RECT, '');
    picker.update('b');
    expect(rows(root)).toEqual(['Title b', 'Save current draft…']);
    expect(picker.handleKey(key('Escape'))).toBe(true);
    expect(picker.isOpen()).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('save-draft row calls onSaveDraft', () => {
    const { picker, onSaveDraft } = make({ prompts: [], signedIn: true });
    picker.open(RECT, '');
    picker.handleKey(key('ArrowDown'));
    picker.handleKey(key('Enter'));
    expect(onSaveDraft).toHaveBeenCalled();
  });

  it('signed out shows exactly one sign-in row; Enter calls onSignIn and nothing else', () => {
    const { picker, onPick, onSaveDraft, onSignIn, root } = make({ prompts: [], signedIn: false });
    picker.open(RECT, '');
    expect(rows(root)).toEqual(['Sign in to Prompt Saver']);
    picker.handleKey(key('Enter'));
    expect(onSignIn).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('signed in with zero prompts shows guidance + save-draft', () => {
    const { picker, root } = make({ prompts: [], signedIn: true });
    picker.open(RECT, '');
    expect(rows(root)).toEqual(['No prompts yet — open panel', 'Save current draft…']);
  });

  it('ignores keys while closed', () => {
    const { picker } = make({ prompts: [p('a')], signedIn: true });
    expect(picker.handleKey(key('Enter'))).toBe(false);
  });
});
```
For testability, `createPicker` attaches its shadow root in **open** mode when `root` is passed (tests). In production it creates its own host with a **closed** shadow root. The `rows` helper handles both.

Run: `npx vitest run src/picker/picker.test.ts` → FAIL.

- [ ] **Step 2: Implement `picker.css` and `picker.ts`**

`extension/src/picker/picker.css`:
```css
:host { all: initial; }
.ps-list { position: fixed; z-index: 2147483647; width: 360px; max-height: 360px; overflow-y: auto;
  background: #fff; border: 1px solid #e7e5e4; border-radius: 10px; box-shadow: 0 8px 24px rgba(28,25,23,.15);
  font: 14px/1.4 'DM Sans', system-ui, sans-serif; color: #1c1917; padding: 4px; }
.ps-row { padding: 8px 10px; border-radius: 6px; cursor: pointer; min-height: 28px; }
.ps-row[aria-selected="true"] { background: #f0fdfa; color: #0f766e; }
.ps-row .ps-sub { display: block; color: #78716c; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ps-action { color: #0d9488; border-top: 1px solid #f5f5f4; }
@media (prefers-color-scheme: dark) {
  .ps-list { background: #1c1917; border-color: #44403c; color: #fafaf9; }
  .ps-row[aria-selected="true"] { background: #134e4a; color: #5eead4; }
  .ps-row .ps-sub { color: #a8a29e; }
  .ps-action { color: #2dd4bf; border-top-color: #292524; }
}
```

`extension/src/picker/picker.ts`:
```ts
import css from './picker.css?inline';
import { filterPrompts } from './filter';
import type { ExtPrompt } from '../lib/types';

type Row = { kind: 'prompt'; prompt: ExtPrompt } | { kind: 'save' } | { kind: 'signin' } | { kind: 'empty' };

interface Opts {
  getState: () => { prompts: ExtPrompt[]; signedIn: boolean };
  onPick: (p: ExtPrompt) => void;
  onSaveDraft: () => void;
  onSignIn: () => void;
  root?: HTMLElement;
}

function rowsFor(state: { prompts: ExtPrompt[]; signedIn: boolean }, query: string): Row[] {
  if (!state.signedIn) return [{ kind: 'signin' }];
  if (state.prompts.length === 0) return [{ kind: 'empty' }, { kind: 'save' }];
  return [...filterPrompts(state.prompts, query).map((prompt) => ({ kind: 'prompt' as const, prompt })), { kind: 'save' }];
}

const LABEL = { save: 'Save current draft…', signin: 'Sign in to Prompt Saver', empty: 'No prompts yet — open panel' };

export function createPicker(opts: Opts) {
  const host = opts.root ?? document.createElement('div');
  const shadow = host.attachShadow({ mode: opts.root !== undefined ? 'open' : 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  const list = document.createElement('div');
  list.className = 'ps-list';
  list.setAttribute('role', 'listbox');
  shadow.append(style, list);
  let rows: Row[] = [];
  let active = 0;
  let open = false;

  function activate(row: Row): void {
    close();
    if (row.kind === 'prompt') opts.onPick(row.prompt);
    else if (row.kind === 'save' || row.kind === 'empty') opts.onSaveDraft();
    else opts.onSignIn();
  }

  function render(): void {
    list.replaceChildren(
      ...rows.map((row, i) => {
        const el = document.createElement('div');
        el.className = `ps-row${row.kind === 'prompt' ? '' : ' ps-action'}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(i === active));
        el.textContent = row.kind === 'prompt' ? row.prompt.title : LABEL[row.kind];
        el.addEventListener('mousedown', (e) => {
          e.preventDefault(); // keep editor focus and selection
          activate(row);
        });
        return el;
      })
    );
  }

  function place(anchor: DOMRect): void {
    // Chat boxes sit at the bottom of the screen, so open above the caret.
    list.style.left = `${Math.min(anchor.left, window.innerWidth - 370)}px`;
    list.style.bottom = `${Math.max(8, window.innerHeight - anchor.top + 6)}px`;
  }

  function update(query: string): void {
    rows = rowsFor(opts.getState(), query);
    active = Math.min(active, rows.length - 1);
    render();
  }

  function close(): void {
    open = false;
    host.remove();
  }

  return {
    open(anchor: DOMRect, query: string): void {
      if (host.isConnected === false) document.body.append(host);
      open = true;
      active = 0;
      place(anchor);
      update(query);
    },
    update,
    close,
    isOpen: () => open,
    handleKey(e: KeyboardEvent): boolean {
      if (!open) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        active = (active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
        render();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const row = rows[active];
        if (row !== undefined) activate(row);
      } else if (e.key === 'Escape') {
        close();
      } else {
        return false;
      }
      e.preventDefault();
      e.stopPropagation();
      return true;
    },
  };
}
```
Vitest's `?inline` CSS import works through Vite. If it doesn't, add `css: true` to the vitest config `test` block.

In the test, `host.remove()` detaches the provided `root`. That's acceptable because `isOpen()` is the source of truth. If the `rows(root)` assertions after reopening fail because of this, have `close()` hide the list (`list.replaceChildren()`) instead of removing the host when `opts.root` was provided.

- [ ] **Step 3: Implement `content-main.ts` and entrypoints**

`extension/src/lib/content-main.ts`:
```ts
import { createPicker } from '../picker/picker';
import { detectTrigger, textBeforeCaret } from '../picker/trigger';
import { insertText, type InsertResult } from './insert';
import { watchPrompts, watchToken } from './cache';
import type { SiteAdapter } from '../sites/types';
import type { ExtPrompt, Msg, MsgResult } from './types';
import { SITE_BASE } from './config';

const send = <T>(msg: Msg): Promise<MsgResult<T>> => browser.runtime.sendMessage(msg);

function toast(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1c1917;color:#fafaf9;padding:10px 16px;border-radius:8px;font:14px system-ui';
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

function reportInsert(r: InsertResult): void {
  if (r === 'copied') toast('Copied — press ⌘V / Ctrl+V to paste');
  if (r === 'failed') toast("Couldn't insert. Open the Prompt Saver panel and use Copy.");
}

function caretRect(editor: HTMLElement): DOMRect {
  const sel = document.getSelection();
  const r = sel !== null && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
  return r !== null && (r.width > 0 || r.height > 0 || r.top > 0) ? r : editor.getBoundingClientRect();
}

export function runContentScript(adapter: SiteAdapter): void {
  const state = { prompts: [] as ExtPrompt[], signedIn: false };
  void send<{ prompts: ExtPrompt[]; signedIn: boolean }>({ type: 'getPrompts' }).then((r) => {
    if (r.ok) Object.assign(state, r.data);
  });
  watchPrompts((p) => (state.prompts = p));
  watchToken((t) => {
    state.signedIn = t !== null;
    if (t === null) state.prompts = [];
  });

  let triggerLength = 0;
  const picker = createPicker({
    getState: () => state,
    onPick: (p) => {
      const editor = adapter.findEditor();
      if (editor === null) return reportInsert('failed');
      void insertText(editor, p.content, triggerLength).then(reportInsert);
    },
    onSaveDraft: () => {
      const draft = adapter.readDraft().replace(/(?:^|\s)\/\/[^\s/]*$/, '').trim();
      void send<{ opened: boolean }>({ type: 'openSavePanel', prefill: { title: draft.split('\n')[0]?.slice(0, 80) ?? '', content: draft } }).then((r) => {
        if (r.ok && !r.data.opened) toast('Click the Prompt Saver icon to finish saving');
      });
    },
    onSignIn: () => window.open(`${SITE_BASE}/extension/connect?ext=${browser.runtime.id}`, '_blank'),
  });

  document.addEventListener(
    'input',
    (e) => {
      const editor = adapter.findEditor();
      if (editor === null || !(e.target instanceof Node) || !editor.contains(e.target)) return;
      const trig = detectTrigger(textBeforeCaret(editor));
      if (trig === null) return picker.close();
      triggerLength = trig.length;
      if (picker.isOpen()) picker.update(trig.query);
      else {
        picker.open(caretRect(editor), trig.query);
        void send({ type: 'getPrompts' }); // refreshes in background if stale
      }
    },
    true
  );
  document.addEventListener('keydown', (e) => picker.handleKey(e), true);
  document.addEventListener('mousedown', () => picker.close());

  browser.runtime.onMessage.addListener((msg: { type?: string; text?: string }) => {
    if (msg.type !== 'ps-insert' || typeof msg.text !== 'string') return undefined;
    const editor = adapter.findEditor();
    if (editor === null) return Promise.resolve({ ok: false });
    return insertText(editor, msg.text).then((r) => {
      reportInsert(r);
      return { ok: r !== 'failed' };
    });
  });
}
```
Note: `mousedown` on the document closes the picker. Picker rows call `preventDefault` + `activate` in their own `mousedown`, which fires first because the event originates inside the shadow host. If the order causes a premature close, check `e.composedPath().includes(host)` before closing, which needs `createPicker` to expose `contains(node)`.

`extension/src/entrypoints/claude.content.ts`:
```ts
import { runContentScript } from '@/lib/content-main';
import { claudeAdapter } from '@/sites/claude';

export default defineContentScript({
  matches: ['https://claude.ai/*'],
  main() {
    runContentScript(claudeAdapter);
  },
});
```
`chatgpt.content.ts`: the same, with `matches: ['https://chatgpt.com/*']` and `chatgptAdapter`. `gemini.content.ts`: the same, with `matches: ['https://gemini.google.com/*']` and `geminiAdapter`.

- [ ] **Step 4: Run tests, build, commit**

```bash
npx vitest run && npm run type-check && npm run build
cd .. && git add extension/src
git commit -m "feat(extension): // picker UI and per-site content scripts"
```

---

### Task 9: Side panel

**Files:**
- Create: `extension/src/entrypoints/sidepanel/index.html`, `main.tsx`, `App.tsx`, `PromptCard.tsx`, `SaveForm.tsx`, `useActiveTab.ts`
- Test: `extension/src/entrypoints/sidepanel/App.test.tsx`

**Interfaces:**
- Consumes: `Msg`/`MsgResult` (Task 6), `watchPrompts`, `watchToken`, `watchPendingSave`, `takePendingSave` (Task 6), `filterPrompts` (Task 7; use `max = Infinity` in the panel), `SITE_BASE`.
- Produces: the side panel UI per spec 5.6. `isSupportedUrl(url?: string): boolean` from `useActiveTab.ts` (claude.ai, chatgpt.com, gemini.google.com).

- [ ] **Step 1: Failing test** — `App.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { fakeBrowser } from 'wxt/testing';
import { App } from './App';
import { isSupportedUrl } from './useActiveTab';

const P = (id: string, fav = false) => ({ id, title: `Title ${id}`, description: null, tags: [], updated_at: 'x', content: `body ${id}`, is_favorite: fav });

let sendMessage: ReturnType<typeof vi.fn>;
function mockBackground(handlers: Record<string, (m: any) => unknown>) {
  sendMessage = vi.fn(async (m: { type: string }) => handlers[m.type]?.(m) ?? { ok: true, data: null });
  fakeBrowser.runtime.sendMessage = sendMessage as never;
}

beforeEach(() => {
  fakeBrowser.reset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('isSupportedUrl', () => {
  it.each([
    ['https://claude.ai/new', true],
    ['https://chatgpt.com/codex', true],
    ['https://gemini.google.com/app', true],
    ['https://example.com', false],
    [undefined, false],
  ])('%s → %s', (url, expected) => expect(isSupportedUrl(url)).toBe(expected));
});

describe('App', () => {
  it('signed out shows Connect account', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [], signedIn: false } }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByRole('button', { name: /connect account/i })).toBeInTheDocument();
  });

  it('lists prompts favorites first and filters by search', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [P('a'), P('b', true)], signedIn: true } }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    const titles = await screen.findAllByRole('heading', { level: 3 });
    expect(titles.map((h) => h.textContent)).toEqual(['Title b', 'Title a']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Title a']));
  });

  it('Insert is shown only on supported sites and sends insertIntoTab', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [P('a')], signedIn: true } }) });
    const { unmount } = render(<App activeTab={{ id: 9, url: 'https://chatgpt.com/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /insert title a/i }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: 'insertIntoTab', tabId: 9, text: 'body a' }));
    unmount();
    render(<App activeTab={{ id: 9, url: 'https://example.com/' }} />);
    await screen.findByRole('button', { name: /copy title a/i });
    expect(screen.queryByRole('button', { name: /insert title a/i })).toBeNull();
  });

  it('Copy writes the content to the clipboard', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [P('a')], signedIn: true } }) });
    render(<App activeTab={{ id: 1, url: 'https://example.com/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /copy title a/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('body a'));
  });

  it('save form posts createPrompt and shows limit_reached message on failure', async () => {
    mockBackground({
      getPrompts: () => ({ ok: true, data: { prompts: [], signedIn: true } }),
      createPrompt: () => ({ ok: false, code: 'limit_reached', message: "You've reached 1,000 prompts." }),
    });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'C' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/1,000 prompts/)).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'createPrompt', title: 'T', content: 'C', tags: [] });
    expect(screen.getByLabelText(/content/i)).toHaveValue('C'); // form kept on failure
  });

  it('unauthorized from getPrompts shows Reconnect', async () => {
    mockBackground({ getPrompts: () => ({ ok: false, code: 'unauthorized', message: 'x' }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });
});
```
Run: `npx vitest run src/entrypoints/sidepanel` → FAIL.

- [ ] **Step 2: Implement**

`useActiveTab.ts`:
```ts
import { useEffect, useState } from 'react';

const SUPPORTED = [/^https:\/\/claude\.ai\//, /^https:\/\/chatgpt\.com\//, /^https:\/\/gemini\.google\.com\//];
export const isSupportedUrl = (url?: string): boolean => url !== undefined && SUPPORTED.some((r) => r.test(url));

export interface ActiveTab { id?: number; url?: string }

export function useActiveTab(): ActiveTab {
  const [tab, setTab] = useState<ActiveTab>({});
  useEffect(() => {
    const load = () => void browser.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab({ id: t?.id, url: t?.url }));
    load();
    browser.tabs.onActivated.addListener(load);
    browser.tabs.onUpdated.addListener(load);
    return () => {
      browser.tabs.onActivated.removeListener(load);
      browser.tabs.onUpdated.removeListener(load);
    };
  }, []);
  return tab;
}
```

`PromptCard.tsx`:
```tsx
import type { ExtPrompt } from '@/lib/types';

const btn = 'min-h-11 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none';

export function PromptCard(props: { prompt: ExtPrompt; canInsert: boolean; onInsert: () => void; onCopy: () => void; onStar: () => void }) {
  const { prompt: p } = props;
  return (
    <li className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-stone-900 dark:text-stone-50">{p.title}</h3>
        <button aria-label={p.is_favorite ? `Unstar ${p.title}` : `Star ${p.title}`} onClick={props.onStar} className={`${btn} text-teal-600`}>
          {p.is_favorite ? '★' : '☆'}
        </button>
      </div>
      <p className="mt-1 line-clamp-2 font-mono text-xs text-stone-500 dark:text-stone-400">{p.content}</p>
      <div className="mt-2 flex gap-2">
        {props.canInsert && (
          <button aria-label={`Insert ${p.title}`} onClick={props.onInsert} className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}>Insert</button>
        )}
        <button aria-label={`Copy ${p.title}`} onClick={props.onCopy} className={`${btn} border border-stone-300 text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-700`}>Copy</button>
      </div>
    </li>
  );
}
```

`SaveForm.tsx`:
```tsx
import { useState } from 'react';

export function SaveForm(props: {
  initial: { title: string; content: string };
  onSave: (v: { title: string; content: string; tags: string[] }) => Promise<string | null>; // returns error message or null
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(props.initial.title);
  const [content, setContent] = useState(props.initial.content);
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = 'mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm dark:border-stone-600 dark:bg-stone-900 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await props.onSave({ title: title.trim(), content, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
    setBusy(false);
    setError(err);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">Title<input className={field} value={title} maxLength={200} required onChange={(e) => setTitle(e.target.value)} /></label>
      <label className="block text-sm">Content<textarea className={`${field} h-48 font-mono`} value={content} required onChange={(e) => setContent(e.target.value)} /></label>
      <label className="block text-sm">Tags (comma-separated)<input className={field} value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      {error !== null && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-teal-600 px-4 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-teal-700 focus-visible:ring-2">{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={props.onCancel} className="min-h-11 rounded-lg px-4 text-sm text-stone-600 transition-colors duration-150 ease-out hover:bg-stone-100 focus-visible:ring-2">Cancel</button>
      </div>
    </form>
  );
}
```
Note: the test expects `{ type: 'createPrompt', title: 'T', content: 'C', tags: [] }`. Send `tags` always (possibly empty) from the panel.

`App.tsx`:
```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExtPrompt, Msg, MsgResult, PendingSave } from '@/lib/types';
import { takePendingSave, watchPendingSave, watchPrompts, watchToken } from '@/lib/cache';
import { filterPrompts } from '@/picker/filter';
import { SITE_BASE } from '@/lib/config';
import { PromptCard } from './PromptCard';
import { SaveForm } from './SaveForm';
import { isSupportedUrl, type ActiveTab } from './useActiveTab';

const send = <T,>(msg: Msg): Promise<MsgResult<T>> => browser.runtime.sendMessage(msg);
type View = { kind: 'list' } | { kind: 'save'; initial: PendingSave };

const RETRY_MS = 3000;
async function sendWithRetry<T>(msg: Msg): Promise<MsgResult<T>> {
  const first = await send<T>(msg);
  if (first.ok || first.code !== 'network') return first;
  await new Promise((r) => setTimeout(r, RETRY_MS));
  return send<T>(msg);
}

function messageFor(r: Extract<MsgResult, { ok: false }>): string {
  if (r.code === 'rate_limited') return `Too many requests — try again in ${r.retryAfter ?? 60}s`;
  if (r.code === 'network') return "Couldn't save — try again";
  return r.message;
}

export function App({ activeTab }: { activeTab: ActiveTab }) {
  const [prompts, setPrompts] = useState<ExtPrompt[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await send<{ prompts: ExtPrompt[]; signedIn: boolean }>({ type: 'getPrompts', refresh: true });
    if (r.ok) {
      setPrompts(r.data.prompts);
      setSignedIn(r.data.signedIn);
    } else if (r.code === 'unauthorized') {
      setSignedIn(false);
      setNeedsReconnect(true);
    }
  }, []);

  useEffect(() => {
    void load();
    void takePendingSave().then((p) => p !== null && setView({ kind: 'save', initial: p }));
    const offs = [
      watchPrompts(setPrompts),
      watchToken((t) => { setSignedIn(t !== null); if (t !== null) setNeedsReconnect(false); }),
      watchPendingSave((p) => { if (p !== null) void takePendingSave().then((v) => v !== null && setView({ kind: 'save', initial: v })); }),
    ];
    return () => offs.forEach((off) => off());
  }, [load]);

  const visible = useMemo(() => filterPrompts(prompts, query, Infinity), [prompts, query]);
  const connect = () => window.open(`${SITE_BASE}/extension/connect?ext=${browser.runtime.id}`, '_blank');
  const canInsert = isSupportedUrl(activeTab.url) && activeTab.id !== undefined;

  async function insert(p: ExtPrompt) {
    const r = await send({ type: 'insertIntoTab', tabId: activeTab.id!, text: p.content });
    if (!r.ok) setNotice(r.message);
  }
  async function copy(p: ExtPrompt) {
    await navigator.clipboard.writeText(p.content);
    setNotice('Copied');
  }
  async function star(p: ExtPrompt) {
    const r = await send({ type: 'toggleFavorite', id: p.id, isFavorite: !p.is_favorite });
    if (!r.ok) setNotice(messageFor(r));
  }
  async function saveDraftFromTab() {
    // Ask the page for its draft via the content script's adapter.
    const r = await browser.tabs.sendMessage(activeTab.id!, { type: 'ps-read-draft' }).catch(() => null) as { draft?: string } | null;
    const draft = r?.draft ?? '';
    setView({ kind: 'save', initial: { title: draft.split('\n')[0]?.slice(0, 80) ?? '', content: draft } });
  }

  if (signedIn === null) return <p className="p-4 text-sm text-stone-500">Loading…</p>;

  if (!signedIn) {
    return (
      <main className="space-y-4 p-4">
        <h1 className="text-xl font-semibold">Prompt Saver</h1>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {needsReconnect ? 'Your session ended. Reconnect to keep using your prompts.' : 'Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini.'}
        </p>
        <button onClick={connect} className="min-h-11 w-full rounded-lg bg-teal-600 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-teal-700 focus-visible:ring-2">
          {needsReconnect ? 'Reconnect' : 'Connect account'}
        </button>
      </main>
    );
  }

  if (view.kind === 'save') {
    return (
      <main className="p-4">
        <h1 className="mb-3 text-lg font-semibold">Save prompt</h1>
        <SaveForm
          initial={view.initial}
          onCancel={() => setView({ kind: 'list' })}
          onSave={async (v) => {
            const r = await sendWithRetry({ type: 'createPrompt', ...v });
            if (r.ok) { setView({ kind: 'list' }); setNotice('Saved'); return null; }
            return messageFor(r);
          }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Prompt Saver</h1>
        <div className="flex gap-1 text-sm">
          <a className="rounded px-2 py-1 text-teal-700 hover:bg-stone-100" href={`${SITE_BASE}/app`} target="_blank" rel="noreferrer">Open Prompt Saver</a>
          <button className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" onClick={() => void send({ type: 'disconnect' })}>Disconnect</button>
        </div>
      </div>
      <input type="search" aria-label="Search prompts" placeholder="Search prompts" value={query} onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-stone-300 p-2 text-sm dark:border-stone-600 dark:bg-stone-900 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none" />
      <div className="flex gap-2">
        <button onClick={() => setView({ kind: 'save', initial: { title: '', content: '' } })} className="min-h-11 flex-1 rounded-lg bg-teal-600 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-teal-700 focus-visible:ring-2">New prompt</button>
        {canInsert && (
          <button onClick={() => void saveDraftFromTab()} className="min-h-11 flex-1 rounded-lg border border-stone-300 text-sm transition-colors duration-150 ease-out hover:bg-stone-100 focus-visible:ring-2">Save current draft</button>
        )}
      </div>
      {notice !== null && <p role="status" className="text-sm text-teal-700">{notice}</p>}
      {visible.length === 0 ? (
        <p className="text-sm text-stone-500">{prompts.length === 0 ? 'No prompts yet. Click New prompt, or type // in a chat box.' : 'No matches.'}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <PromptCard key={p.id} prompt={p} canInsert={canInsert} onInsert={() => void insert(p)} onCopy={() => void copy(p)} onStar={() => void star(p)} />
          ))}
        </ul>
      )}
    </main>
  );
}
```
"Save current draft" in the panel needs the content script to answer `{ type: 'ps-read-draft' }` with `{ draft: adapter.readDraft() }`. Add that branch to the `onMessage` listener in `content-main.ts` (Task 8 file) as part of this task:
```ts
    if (msg.type === 'ps-read-draft') return Promise.resolve({ draft: adapter.readDraft() });
```
Place it before the `ps-insert` check.

`main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import '@/assets/tailwind.css';
import { App } from './App';
import { useActiveTab } from './useActiveTab';

function Root() {
  return <App activeTab={useActiveTab()} />;
}
createRoot(document.getElementById('root')!).render(<Root />);
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Prompt Saver</title>
  </head>
  <body class="bg-stone-50 font-body text-stone-900 dark:bg-stone-900 dark:text-stone-50">
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Run tests, build, manual load, commit**

```bash
npx vitest run && npm run type-check && npm run build
```
Manual: in Chrome open `chrome://extensions`, enable Developer mode, then Load unpacked → `extension/.output/chrome-mv3`. Clicking the toolbar icon opens the side panel with "Connect account".
```bash
cd .. && git add extension/src
git commit -m "feat(extension): side panel library, insert/copy, star, save form"
```

---

### Task 10: End-to-end tests, smoke checklist, store listing

**Files:**
- Create: `extension/playwright.config.ts`, `extension/e2e/fixtures/pm-entry.ts`, `extension/e2e/fixtures/build.mjs`, `extension/e2e/fixtures/claude.html`, `extension/e2e/fixtures/gemini.html`, `extension/e2e/fixtures/chatgpt-noeditor.html`, `extension/e2e/api-stub.mjs`, `extension/e2e/picker.spec.ts`
- Create: `extension/docs/smoke-checklist.md`, `extension/docs/store-listing.md`

**Interfaces:**
- Consumes: the built extension with `WXT_API_BASE=http://localhost:4599`. Content-script matches for claude.ai, chatgpt.com and gemini.google.com are fulfilled from local fixtures via `context.route`.
- Produces: `npm run e2e` (builds the fixtures and the extension, runs the specs).

- [ ] **Step 1: Fixtures**

`extension/e2e/fixtures/pm-entry.ts` (real ProseMirror, mimicking claude.ai):
```ts
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';

const mount = document.getElementById('editor')!;
new EditorView(mount, { state: EditorState.create({ schema }) });
// prosemirror-view renders <div class="ProseMirror" contenteditable="true"> inside #editor.
```

`extension/e2e/fixtures/build.mjs`:
```js
import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('e2e/fixtures/dist', { recursive: true });
await build({ entryPoints: ['e2e/fixtures/pm-entry.ts'], bundle: true, outfile: 'e2e/fixtures/dist/pm.js', format: 'iife' });
copyFileSync('node_modules/quill/dist/quill.js', 'e2e/fixtures/dist/quill.js');
```

`extension/e2e/fixtures/claude.html`:
```html
<!doctype html><html><body style="height:100vh">
<div style="position:fixed;bottom:20px;left:20px;width:600px"><div id="editor"></div></div>
<script src="https://claude.ai/__fixtures/pm.js"></script>
</body></html>
```
`extension/e2e/fixtures/gemini.html`:
```html
<!doctype html><html><body style="height:100vh">
<rich-textarea style="position:fixed;bottom:20px;left:20px;width:600px;display:block"><div id="q"></div></rich-textarea>
<script src="https://gemini.google.com/__fixtures/quill.js"></script>
<script>new Quill('#q');</script>
</body></html>
```
(Quill renders `.ql-editor[contenteditable="true"]` inside `#q`.)

`extension/e2e/fixtures/chatgpt-noeditor.html`:
```html
<!doctype html><html><body><p>No chat box here.</p></body></html>
```

`extension/e2e/api-stub.mjs`:
```js
import { createServer } from 'node:http';
const prompts = [
  { id: 'p1', title: 'Code review', description: null, tags: [], updated_at: '2026-10-05', content: 'Review this code:\nfocus on bugs ✅', is_favorite: true },
  { id: 'p2', title: 'Email reply', description: null, tags: ['writing'], updated_at: '2026-10-04', content: 'Write a polite reply.', is_favorite: false },
];
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.headers.authorization !== 'Bearer ps_e2e') return res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: { code: 'unauthorized', message: 'x' } }));
  if (req.url?.startsWith('/api/v1/prompts')) return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ prompts }));
  res.writeHead(404).end();
}).listen(4599);
```

- [ ] **Step 2: Playwright config and spec**

`extension/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1,
  webServer: { command: 'node e2e/api-stub.mjs', port: 4599, reuseExistingServer: true },
});
```

Update `extension/package.json` scripts:
```json
"e2e": "node e2e/fixtures/build.mjs && WXT_API_BASE=http://localhost:4599 wxt build -o .output-e2e && playwright test"
```
If `wxt build` does not accept `-o`, set `outDir` from an env var in `wxt.config.ts` instead (`outDir: process.env.WXT_OUT_DIR ?? '.output'`), and use `WXT_OUT_DIR=.output-e2e`. Add `.output-e2e` to `extension/.gitignore`.

`extension/e2e/picker.spec.ts`:
```ts
import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXT = path.resolve('.output-e2e/chrome-mv3');
const fx = (f: string) => readFileSync(path.resolve('e2e/fixtures', f), 'utf8');

const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.route('https://claude.ai/__fixtures/pm.js', (r) => r.fulfill({ path: 'e2e/fixtures/dist/pm.js', contentType: 'text/javascript' }));
    await context.route('https://gemini.google.com/__fixtures/quill.js', (r) => r.fulfill({ path: 'e2e/fixtures/dist/quill.js', contentType: 'text/javascript' }));
    await context.route('https://claude.ai/new', (r) => r.fulfill({ body: fx('claude.html'), contentType: 'text/html' }));
    await context.route('https://gemini.google.com/app', (r) => r.fulfill({ body: fx('gemini.html'), contentType: 'text/html' }));
    await context.route('https://chatgpt.com/', (r) => r.fulfill({ body: fx('chatgpt-noeditor.html'), contentType: 'text/html' }));
    let [sw] = context.serviceWorkers();
    if (sw === undefined) sw = await context.waitForEvent('serviceworker');
    await sw.evaluate(() => chrome.storage.local.set({ psToken: 'ps_e2e' }));
    await use(context);
    await context.close();
  },
});

test('// picker inserts into a real ProseMirror editor, replacing the query', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://claude.ai/new');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type('Please //code');
  await page.keyboard.press('Enter');
  await expect(editor).toContainText('Please Review this code:');
  await expect(editor).toContainText('focus on bugs ✅');
  await expect(editor).not.toContainText('//code');
});

test('// picker works in a real Quill editor (Gemini)', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app');
  const editor = page.locator('.ql-editor');
  await editor.click();
  await page.keyboard.type('//email');
  await page.keyboard.press('Enter');
  await expect(editor).toContainText('Write a polite reply.');
});

test('https:// does not open the picker; Esc leaves text untouched', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://claude.ai/new');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type('see https://x');
  await page.keyboard.press('Enter'); // would pick a prompt if the picker were open
  await expect(editor).not.toContainText('Review this code');
  await page.keyboard.type(' //');
  await page.keyboard.press('Escape');
  await expect(editor).toContainText('//');
});
```

Run:
```bash
cd ~/brainstorming/experiments/prompt-saver/extension && npx playwright install chromium && npm run e2e
```
Expected: 3 passed. If extensions don't load in headless mode, add `headless: false` to `launchPersistentContext`. The `chromium` channel supports extensions headless; the default headless shell does not.

- [ ] **Step 3: Release docs**

`extension/docs/smoke-checklist.md`:
```markdown
# Pre-release smoke checklist (logged-in Chrome, production build)

Build: `npm run zip`. Load `.output/chrome-mv3` unpacked. Connect your account via the panel.

For each site — claude.ai, chatgpt.com, chatgpt.com/codex, gemini.google.com:
- [ ] Type `//` in the chat box → picker opens above the caret with your prompts
- [ ] Type a filter → list narrows; Enter inserts and removes `//query`; message NOT sent
- [ ] Multi-line prompt keeps its line breaks
- [ ] Picker "Save current draft…" opens the panel save form with the draft (or shows "Click the Prompt Saver icon")
- [ ] Panel Insert puts text in the chat box; Copy works
- [ ] Select text → right-click "Save to Prompt Saver" → panel form prefilled → Save → appears in list and on the website
- [ ] If an editor selector failed, fix it in `src/sites/<site>.ts` and re-run `npm test`

Account:
- [ ] Revoke the "Chrome extension" token in website Settings → panel shows Reconnect on next action
- [ ] Reconnect works; only one active "Chrome extension" token exists afterwards
```

`extension/docs/store-listing.md`:
```markdown
# Chrome Web Store listing

**Name (≤75):** Prompt Saver — AI Prompt Manager for Claude, ChatGPT, Gemini & Codex
**Summary (≤132):** Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini. Type // in any chat box to insert.
**Category:** Productivity → Tools
**Privacy policy URL:** https://prompt-saver-two.vercel.app/privacy

**Description:**
Stop rewriting prompts you already perfected.
- Type // in Claude, ChatGPT, Codex or Gemini to search and insert a saved prompt
- Side panel library with search, favorites and one-click copy
- Right-click any text → Save to Prompt Saver
- Every prompt is versioned on prompt-saver-two.vercel.app and available in Claude Code via MCP

**Permission justifications:**
- storage: cache your prompt library so the picker opens instantly
- sidePanel: the prompt library panel
- contextMenus: "Save to Prompt Saver" on selected text
- Host access (claude.ai, chatgpt.com, gemini.google.com): show the // picker and insert prompts into the chat box
- Host access (prompt-saver-two.vercel.app): sync with your Prompt Saver account

**Single purpose:** Save and insert AI prompts.
**Data use disclosures:** Personally identifiable info (email, via the website account) and website content (only prompt text the user saves). Not sold, not used for unrelated purposes.

**Screenshots (1280×800):** 1) // picker in Claude 2) side panel list 3) right-click save 4) Gemini insert 5) website library
```

- [ ] **Step 4: Commit**

```bash
cd .. && git add extension/playwright.config.ts extension/e2e extension/docs extension/package.json extension/.gitignore extension/wxt.config.ts
git commit -m "test(extension): Playwright e2e on real ProseMirror/Quill fixtures; release docs"
```

---

## After all tasks (human steps, not for subagents)

1. Run `extension/docs/smoke-checklist.md` against the live sites and fix selectors if needed.
2. Get the dev extension ID from `chrome://extensions`. Set `NEXT_PUBLIC_EXTENSION_IDS` in Vercel (Preview + Production), then deploy the website.
3. Pay the Web Store developer fee and submit `npm run zip` output with `docs/store-listing.md`.
4. After approval: add the store ID to `NEXT_PUBLIC_EXTENSION_IDS`, redeploy, then **remove `ALLOWED_EMAILS`** in Vercel to open sign-ups (spec 4.1 and 8).
