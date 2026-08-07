# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a user's saved prompts to Claude Code sessions through a remote HTTP MCP server — favourites as slash commands, the whole library as searchable read/write tools.

**Architecture:** A Next.js route at `/api/mcp` built on Vercel's `mcp-handler`, authenticated by API token. `resolveTokenContext()` turns a bearer token into the same `{ userId, workspaceId }` shape `getCurrentContext()` produces, so the new entrance converges immediately on the existing ownership helper and Drizzle repositories. No new database logic.

**Tech Stack:** Next.js 16 App Router, `mcp-handler` v2, `@modelcontextprotocol/server` v2, zod v4, Drizzle, Neon Postgres, Jest.

**Spec:** `docs/superpowers/specs/2026-08-07-mcp-server-design.md`

## Global Constraints

- TypeScript strict. No `any` without written justification. Every function typed.
- `npm run lint` clean at `--max-warnings 0`. Cyclomatic complexity ceiling 10.
- `npm run format:check` must pass. `npm run build` must pass.
- Install with `--legacy-peer-deps`.
- **Never trust a client-supplied `user_id` or `workspace_id`.** Both derive from the resolved token only.
- Domain types in `src/types/*.ts` are the UI contract — do not change them.
- `src/lib/db/repositories/types.ts` stays frozen.
- The DB client is created lazily inside a function, never at module top level.
- **Tokens are never logged, never returned after creation, and only ever stored hashed.**
- DB tests: `@jest-environment node` docblock, `closeDb()` in `afterAll`. `maxWorkers: 1` is already set globally.
- The repo currently has **no zod**; it is added in Task 1.

## Two Facts Established Before Planning

**1. `initializeServer` receives only the server.** From `mcp-handler`'s dist:

```js
async () => { const server = new McpServer(serverInfo, opts); await initializeServer(server); return server; }
```

No `Request`, no auth. So `registerPrompt` cannot know whose favourites to register. Task 4 opens with a spike proving `AsyncLocalStorage` can carry the context in, and carries a documented fallback if it can't. **Do not build Task 4 on the assumption that it works.**

**2. `mcp-handler` v2 requires Node 20+.** `package.json` `engines` currently says `^18.17 || ^20`. Task 1 raises the floor.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `src/lib/tokens/generate.ts` | Token minting + SHA-256 hashing (pure, no DB) |
| `src/lib/tokens/repository.ts` | `api_tokens` CRUD over Drizzle |
| `src/lib/auth/token-context.ts` | `resolveTokenContext()` — the second entrance |
| `src/lib/actions/tokens.ts` | Server Actions for the settings UI |
| `src/app/app/settings/tokens/page.tsx` | Token management UI |
| `src/app/api/mcp/route.ts` | The MCP server |
| `src/lib/mcp/tools.ts` | Tool definitions + handlers |
| `src/lib/mcp/prompts.ts` | Favourites → MCP prompts, slug logic |

**Modified:** `src/lib/db/drizzle/schema.ts` (new table), `package.json`, `README.md`.

**Unchanged and reused:** `src/lib/actions/ownership.ts` (`requireOwnedPrompt`), both Drizzle repositories, `src/lib/errors.ts`.

---

### Task 1: `api_tokens` table, generation, and `resolveTokenContext`

**Files:**
- Create: `src/lib/tokens/generate.ts`, `src/lib/tokens/repository.ts`, `src/lib/auth/token-context.ts`
- Modify: `src/lib/db/drizzle/schema.ts`, `package.json`
- Test: `__tests__/lib/tokens/generate.test.ts`, `tests/db/token-context.db.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `users`, `workspaces` from `src/lib/db/drizzle/schema.ts`; `UserContext` from `src/lib/auth/context.ts`
- Produces:
  - `generateToken(): { token: string; hash: string; prefix: string }`
  - `hashToken(token: string): string`
  - `resolveTokenContext(token: string): Promise<UserContext | null>`
  - `createToken(userId: string, name: string): Promise<{ token: string; id: string }>`
  - `listTokens(userId: string): Promise<TokenSummary[]>`
  - `revokeToken(id: string, userId: string): Promise<boolean>`
  - `interface TokenSummary { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; revokedAt: string | null }`

- [ ] **Step 1: Install dependencies and raise the Node floor**

```bash
npm install --legacy-peer-deps mcp-handler@^2 @modelcontextprotocol/server@^2 zod@^4
```

In `package.json`, change `"node": "^18.17 || ^20"` to `"node": "^20 || ^22 || ^24"`. `mcp-handler` v2 requires Node 20+; Vercel already runs 24.x for this project.

- [ ] **Step 2: Add the table to the schema**

Append to `src/lib/db/drizzle/schema.ts`:

```ts
export const apiTokens = pgTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => ({ userIdx: index('api_tokens_user_id_idx').on(t.userId) })
);
```

- [ ] **Step 3: Generate and apply the migration**

```bash
npm run db:generate
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/prompt_saver_test npx drizzle-kit migrate
```

Confirm with:
```bash
docker exec prompt-saver-pg psql -U postgres -d prompt_saver_test -c "\d api_tokens"
```
Expected: the table exists with a unique index on `token_hash`.

- [ ] **Step 4: Write the failing generation test**

Create `__tests__/lib/tokens/generate.test.ts`:

```ts
import { generateToken, hashToken } from '@/lib/tokens/generate';

describe('generateToken', () => {
  it('produces a ps_-prefixed token', () => {
    expect(generateToken().token.startsWith('ps_')).toBe(true);
  });

  it('produces a different token every call', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateToken().token));
    expect(seen.size).toBe(50);
  });

  it('returns a hash matching hashToken of the token', () => {
    const { token, hash } = generateToken();
    expect(hash).toBe(hashToken(token));
  });

  it('never returns the raw token inside the hash', () => {
    const { token, hash } = generateToken();
    expect(hash).not.toContain(token.slice(3));
    expect(hash).toHaveLength(64); // sha256 hex
  });

  it('returns a prefix that is a leading slice of the token and too short to be usable', () => {
    const { token, prefix } = generateToken();
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength(11); // "ps_" + 8 chars
    expect(prefix.length).toBeLessThan(token.length);
  });

  it('hashToken is deterministic', () => {
    expect(hashToken('ps_abc')).toBe(hashToken('ps_abc'));
    expect(hashToken('ps_abc')).not.toBe(hashToken('ps_abd'));
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx jest __tests__/lib/tokens/generate.test.ts`
Expected: FAIL — "Cannot find module '@/lib/tokens/generate'".

- [ ] **Step 6: Implement generation**

Create `src/lib/tokens/generate.ts`:

```ts
import { createHash, randomBytes } from 'crypto';

/**
 * Hashes an API token for storage and lookup.
 *
 * SHA-256, not bcrypt, deliberately: these are 256-bit random secrets, so
 * brute force is already infeasible and bcrypt's cost function would only add
 * 50-100ms to every MCP request. See the design spec, section 5.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface GeneratedToken {
  token: string;
  hash: string;
  prefix: string;
}

/** Mints a new API token. The raw token is shown once and never stored. */
export function generateToken(): GeneratedToken {
  const token = `ps_${randomBytes(32).toString('base64url')}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 11) };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx jest __tests__/lib/tokens/generate.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 8: Write the failing token-context test**

Create `tests/db/token-context.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { apiTokens } from '@/lib/db/drizzle/schema';
import { createToken, revokeToken, listTokens } from '@/lib/tokens/repository';
import { resolveTokenContext } from '@/lib/auth/token-context';
import { resetDb, seedUser, closeDb } from './helpers';

describe('resolveTokenContext', () => {
  let userA: { userId: string; workspaceId: string };
  let userB: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    userA = await seedUser('user-a', 'a@example.com');
    userB = await seedUser('user-b', 'b@example.com');
  });

  afterAll(async () => {
    await closeDb();
  });

  it('resolves a valid token to its owner workspace', async () => {
    const { token } = await createToken(userA.userId, 'laptop');
    const ctx = await resolveTokenContext(token);

    expect(ctx).not.toBeNull();
    expect(ctx?.userId).toBe(userA.userId);
    expect(ctx?.workspaceId).toBe(userA.workspaceId);
  });

  // THE ISOLATION GUARD — a token must never resolve to another user's workspace.
  it('never resolves one user token to another user workspace', async () => {
    const { token } = await createToken(userA.userId, 'laptop');
    const ctx = await resolveTokenContext(token);

    expect(ctx?.workspaceId).not.toBe(userB.workspaceId);
    expect(ctx?.userId).not.toBe(userB.userId);
  });

  it('rejects an unknown token', async () => {
    expect(await resolveTokenContext('ps_completelymadeup')).toBeNull();
  });

  it('rejects a malformed token', async () => {
    expect(await resolveTokenContext('')).toBeNull();
    expect(await resolveTokenContext('not-a-token')).toBeNull();
  });

  it('rejects a revoked token', async () => {
    const { token, id } = await createToken(userA.userId, 'laptop');
    expect(await resolveTokenContext(token)).not.toBeNull();

    await revokeToken(id, userA.userId);
    expect(await resolveTokenContext(token)).toBeNull();
  });

  it('stores only the hash, never the raw token', async () => {
    const { token } = await createToken(userA.userId, 'laptop');
    const rows = await getDb().select().from(apiTokens);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(JSON.stringify(rows[0])).not.toContain(token.slice(3));
  });

  it('sets last_used_at on first use', async () => {
    const { token, id } = await createToken(userA.userId, 'laptop');
    await resolveTokenContext(token);

    const [row] = await getDb().select().from(apiTokens).where(eq(apiTokens.id, id));
    expect(row?.lastUsedAt).not.toBeNull();
  });

  it('does not rewrite last_used_at on every call', async () => {
    const { token, id } = await createToken(userA.userId, 'laptop');
    await resolveTokenContext(token);
    const [first] = await getDb().select().from(apiTokens).where(eq(apiTokens.id, id));

    await resolveTokenContext(token);
    const [second] = await getDb().select().from(apiTokens).where(eq(apiTokens.id, id));

    expect(second?.lastUsedAt?.getTime()).toBe(first?.lastUsedAt?.getTime());
  });

  // A revoked token stays listed as a record rather than vanishing.
  it('listTokens returns only the caller tokens, including revoked ones', async () => {
    const a = await createToken(userA.userId, 'laptop');
    await createToken(userB.userId, 'other-user-machine');
    await revokeToken(a.id, userA.userId);

    const list = await listTokens(userA.userId);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('laptop');
    expect(list[0]?.revokedAt).not.toBeNull();
  });

  // THE ISOLATION GUARD — revoking is scoped to the owner.
  it('refuses to revoke another user token', async () => {
    const b = await createToken(userB.userId, 'victim');
    expect(await revokeToken(b.id, userA.userId)).toBe(false);
    expect(await resolveTokenContext(b.token)).not.toBeNull();
  });
});
```

- [ ] **Step 9: Run it to verify it fails**

Run: `npx jest tests/db/token-context.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/tokens/repository'".

- [ ] **Step 10: Implement the repository**

Create `src/lib/tokens/repository.ts`:

```ts
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { apiTokens } from '../db/drizzle/schema';
import { generateId } from '../utils/id-generator';
import { generateToken } from './generate';

export interface TokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Mints a token. The raw value is returned ONCE and never persisted. */
export async function createToken(
  userId: string,
  name: string
): Promise<{ token: string; id: string }> {
  const { token, hash, prefix } = generateToken();
  const id = generateId();
  await getDb().insert(apiTokens).values({ id, userId, name, tokenHash: hash, prefix });
  return { token, id };
}

export async function listTokens(userId: string): Promise<TokenSummary[]> {
  const rows = await getDb()
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(asc(apiTokens.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
  }));
}

/** Revokes a token. Scoped by userId so one user cannot revoke another's. */
export async function revokeToken(id: string, userId: string): Promise<boolean> {
  const updated = await getDb()
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });

  return updated.length > 0;
}
```

- [ ] **Step 11: Implement `resolveTokenContext`**

Create `src/lib/auth/token-context.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { apiTokens, workspaces } from '../db/drizzle/schema';
import { hashToken } from '../tokens/generate';
import type { UserContext } from './context';

const LAST_USED_THROTTLE_MS = 60 * 60 * 1000;

/**
 * The MCP entrance to user identity.
 *
 * Returns the SAME shape as getCurrentContext() so both authentication paths
 * converge immediately and everything downstream — requireOwnedPrompt, the
 * repositories, workspace scoping — is reused unchanged.
 *
 * Returns null for every failure (unknown, malformed, revoked) so callers
 * cannot distinguish them. See the design spec, section 6.
 */
export async function resolveTokenContext(token: string): Promise<UserContext | null> {
  if (!token.startsWith('ps_')) {
    return null;
  }
  const db = getDb();

  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (row === undefined || row.revokedAt !== null) {
    return null;
  }

  const found = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, row.userId))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  const workspace = found[0];
  if (workspace === undefined) {
    return null;
  }

  // Throttled: otherwise every MCP call becomes a write for a field only a
  // human ever reads.
  const threshold = new Date(Date.now() - LAST_USED_THROTTLE_MS);
  if (row.lastUsedAt === null || row.lastUsedAt < threshold) {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id));
  }

  return { userId: row.userId, workspaceId: workspace.id };
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx jest tests/db/token-context.db.test.ts __tests__/lib/tokens/generate.test.ts`
Expected: PASS, 16 tests total.

- [ ] **Step 13: Verify gates and commit**

```bash
npm run type-check && npm run lint && npm run format:check && npx jest
git add src/lib/tokens src/lib/auth/token-context.ts src/lib/db/drizzle/schema.ts drizzle package.json package-lock.json __tests__/lib/tokens tests/db/token-context.db.test.ts
git commit -m "feat(tokens): add api_tokens table, generation, and resolveTokenContext"
```

---

### Task 2: Token settings UI

**Files:**
- Create: `src/lib/actions/tokens.ts`, `src/app/app/settings/tokens/page.tsx`
- Test: `tests/db/token-actions.db.test.ts`

**Interfaces:**
- Consumes: `createToken`, `listTokens`, `revokeToken`, `TokenSummary` from Task 1; `getCurrentContext()`; `run` / `ActionResult` from `src/lib/actions/result.ts`
- Produces:
  - `listTokensAction(): Promise<ActionResult<TokenSummary[]>>`
  - `createTokenAction(name: string): Promise<ActionResult<{ token: string }>>`
  - `revokeTokenAction(id: string): Promise<ActionResult<null>>`

- [ ] **Step 1: Write the failing action test**

Create `tests/db/token-actions.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { resetDb, closeDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({ requireAuth: () => mockSession() }));
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import * as actions from '@/lib/actions/tokens';

function signInAs(id: string, email: string) {
  mockSession.mockResolvedValue({ user: { id, email, name: id, image: null } });
}

function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`Expected ok, got: ${r.error}`);
  return r.data;
}

describe('token actions', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates a token and returns the raw value exactly once', async () => {
    signInAs('user-a', 'a@example.com');

    const { token } = unwrap(await actions.createTokenAction('laptop'));
    expect(token.startsWith('ps_')).toBe(true);

    const list = unwrap(await actions.listTokensAction());
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(token.slice(3));
  });

  it('rejects a blank token name', async () => {
    signInAs('user-a', 'a@example.com');
    expect((await actions.createTokenAction('   ')).ok).toBe(false);
  });

  // THE ISOLATION GUARD.
  it('lists only the caller tokens', async () => {
    signInAs('user-b', 'b@example.com');
    await actions.createTokenAction('b-machine');

    signInAs('user-a', 'a@example.com');
    expect(unwrap(await actions.listTokensAction())).toHaveLength(0);
  });

  it('refuses to revoke another user token', async () => {
    signInAs('user-b', 'b@example.com');
    await actions.createTokenAction('victim');
    const bTokens = unwrap(await actions.listTokensAction());

    signInAs('user-a', 'a@example.com');
    expect((await actions.revokeTokenAction(bTokens[0]!.id)).ok).toBe(false);
  });

  it('revokes the caller own token', async () => {
    signInAs('user-a', 'a@example.com');
    await actions.createTokenAction('laptop');
    const [t] = unwrap(await actions.listTokensAction());

    expect((await actions.revokeTokenAction(t!.id)).ok).toBe(true);
    expect(unwrap(await actions.listTokensAction())[0]?.revokedAt).not.toBeNull();
  });

  it('fails cleanly when not signed in', async () => {
    mockSession.mockRejectedValue(new Error('Authentication required'));
    expect((await actions.listTokensAction()).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/db/token-actions.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/actions/tokens'".

- [ ] **Step 3: Implement the actions**

Create `src/lib/actions/tokens.ts`:

```ts
'use server';

import { getCurrentContext } from '../auth/context';
import { ValidationError } from '../errors';
import { createToken, listTokens, revokeToken, type TokenSummary } from '../tokens/repository';
import { run, type ActionResult } from './result';

export async function listTokensAction(): Promise<ActionResult<TokenSummary[]>> {
  return run(async () => {
    const { userId } = await getCurrentContext();
    return listTokens(userId);
  });
}

export async function createTokenAction(name: string): Promise<ActionResult<{ token: string }>> {
  return run(async () => {
    const { userId } = await getCurrentContext();
    const trimmed = name.trim();
    if (trimmed === '') {
      throw new ValidationError('Give the token a name so you can recognise it later.');
    }
    const { token } = await createToken(userId, trimmed);
    return { token };
  });
}

export async function revokeTokenAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { userId } = await getCurrentContext();
    const revoked = await revokeToken(id, userId);
    if (!revoked) {
      throw new ValidationError('Token not found.');
    }
    return null;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/db/token-actions.db.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Build the settings page**

Read `DESIGN.md` first — stone neutrals, `teal-600` primary, `transition-colors duration-150 ease-out`, `focus-visible:ring-2`, 44px minimum touch targets. Read `src/app/app/page.tsx` for the established page shell and error-banner pattern, and reuse `ConfirmModal` for revocation.

Create `src/app/app/settings/tokens/page.tsx` as a client component. The state and handler logic — where the bugs live — is specified here; the markup follows `DESIGN.md` and the existing shell in `src/app/app/page.tsx`.

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TokenSummary } from '@/lib/tokens/repository';
import { listTokensAction, createTokenAction, revokeTokenAction } from '@/lib/actions/tokens';

export default function TokensPage() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  // Held in memory only, cleared on dismiss — never re-fetchable.
  const [newToken, setNewToken] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTokensAction();
      if (result.ok) setTokens(result.data);
      else setError(result.error);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createTokenAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewToken(result.data.token);
      setName('');
      await load();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [name, load]);

  const handleRevoke = useCallback(async () => {
    if (revokeId === null) return;
    setRevokeError(null);
    const result = await revokeTokenAction(revokeId);
    if (!result.ok) {
      setRevokeError(result.error);
      return;
    }
    setRevokeId(null);
    await load();
  }, [revokeId, load]);

  // ... markup below
}
```

The markup must provide:

1. A table: name, `prefix` rendered as `ps_a3f9b2c1…`, created, last used ("Never" when `lastUsedAt` is null), and a "Revoked" badge when `revokedAt` is set.
2. A name input bound to `name` plus a "Create token" button calling `handleCreate`, disabled while `creating`.
3. **When `newToken` is non-null, a highlighted block showing it once**, with a copy button and the warning *"Copy this now — you won't be able to see it again."* Dismissing sets `newToken` back to `null`.
4. Directly beneath it, the ready-to-paste command:
   ```
   claude mcp add --transport http prompt-saver --scope user \
     https://prompt-saver-two.vercel.app/api/mcp \
     --header "Authorization: Bearer <the token>"
   ```
5. An error banner when `error` is non-null, using `border-red-200 bg-red-50 text-red-700` to match the other pages.
6. `ConfirmModal` for revocation, driven by `revokeId`, receiving `revokeError` via its `error` prop — it stays open on failure, matching `handleDelete` in `src/app/app/page.tsx`.

- [ ] **Step 6: Verify gates and commit**

```bash
npm run type-check && npm run lint && npm run format:check && npx jest && npm run build
git add src/lib/actions/tokens.ts src/app/app/settings tests/db/token-actions.db.test.ts
git commit -m "feat(tokens): add token settings page with one-time reveal and revocation"
```

---

### Task 3: MCP server with read-only tools

**Files:**
- Create: `src/app/api/mcp/route.ts`, `src/lib/mcp/tools.ts`
- Test: `tests/db/mcp-tools.db.test.ts`

**Interfaces:**
- Consumes: `resolveTokenContext` (Task 1), `requireOwnedPrompt` from `src/lib/actions/ownership.ts`, `DrizzlePromptRepository`
- Produces:
  - `registerReadTools(server: McpServer): void` from `src/lib/mcp/tools.ts`
  - `searchPromptsHandler(workspaceId: string, query: string, limit: number): Promise<PromptSummary[]>`
  - `getPromptHandler(workspaceId: string, id: string): Promise<Prompt>`
  - `interface PromptSummary { id: string; title: string; description: string | null; tags: string[]; updated_at: string }`
  - Route exports `GET` and `POST`

**Background:** `mcp-handler` v2's API, verified from its docs:
- `createMcpHandler((server) => { … }, options)`
- `server.registerTool(name, { title, description, inputSchema: z.object({…}) }, async (args, ctx) => …)` — `inputSchema` takes a **complete** zod object, not a raw shape.
- `withMcpAuth(handler, verifyToken, { required: true })` where `verifyToken: (req: Request, bearerToken?: string) => Promise<AuthInfo | undefined>`. Returning `undefined` produces a 401.
- Handlers read auth via `ctx.http?.authInfo`.

- [ ] **Step 1: Write the failing tool test**

Create `tests/db/mcp-tools.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { searchPromptsHandler, getPromptHandler } from '@/lib/mcp/tools';
import { resetDb, seedUser, closeDb } from './helpers';

describe('mcp read tools', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');

    await getDb().insert(prompts).values([
      { id: 'a1', workspaceId: a.workspaceId, title: 'Daily Planning', content: 'plan the day', tags: ['routine'] },
      { id: 'b1', workspaceId: b.workspaceId, title: 'Secret Prompt', content: 'private stuff', tags: [] },
    ]);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('searches within the caller workspace', async () => {
    const results = await searchPromptsHandler(a.workspaceId, 'planning', 20);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Daily Planning');
  });

  it('returns summaries only, never prompt bodies', async () => {
    const results = await searchPromptsHandler(a.workspaceId, 'planning', 20);
    expect(JSON.stringify(results)).not.toContain('plan the day');
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('updated_at');
  });

  // THE ISOLATION GUARD.
  it('never surfaces another workspace prompt in search', async () => {
    expect(await searchPromptsHandler(a.workspaceId, 'Secret', 20)).toHaveLength(0);
  });

  it('refuses to fetch another workspace prompt by id', async () => {
    await expect(getPromptHandler(a.workspaceId, 'b1')).rejects.toThrow('not found');
  });

  it('fetches an owned prompt with its full content', async () => {
    const p = await getPromptHandler(a.workspaceId, 'a1');
    expect(p.content).toBe('plan the day');
  });

  it('caps limit at 50 even when asked for more', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `bulk-${i}`,
      workspaceId: a.workspaceId,
      title: `Bulk ${i}`,
      content: 'x',
    }));
    await getDb().insert(prompts).values(rows);

    expect((await searchPromptsHandler(a.workspaceId, 'Bulk', 999)).length).toBeLessThanOrEqual(50);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/db/mcp-tools.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/mcp/tools'".

- [ ] **Step 3: Implement the tool handlers**

Create `src/lib/mcp/tools.ts`:

```ts
import type { Prompt } from '@/types';
import { requireOwnedPrompt } from '../actions/ownership';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';

const repo = new DrizzlePromptRepository();

export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_SEARCH_LIMIT = 20;

export interface PromptSummary {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  updated_at: string;
}

function toSummary(p: Prompt): PromptSummary {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    tags: p.tags,
    updated_at: p.updated_at,
  };
}

/**
 * Summaries only — never bodies. Claude Code warns past 10k tokens of tool
 * output and truncates at 25k; a truncated JSON response gives the model
 * malformed data rather than fewer results.
 */
export async function searchPromptsHandler(
  workspaceId: string,
  query: string,
  limit: number
): Promise<PromptSummary[]> {
  const capped = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT);
  const found =
    query.trim() === ''
      ? await repo.findByWorkspaceId(workspaceId, { limit: capped })
      : await repo.search(workspaceId, query, { limit: capped });

  return found.map(toSummary);
}

export async function getPromptHandler(workspaceId: string, id: string): Promise<Prompt> {
  return requireOwnedPrompt(id, workspaceId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/db/mcp-tools.db.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement the MCP route**

Create `src/app/api/mcp/route.ts`:

```ts
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
const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
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
```

- [ ] **Step 6: Verify the route rejects unauthenticated requests**

Run:
```bash
npm run build && npm run dev &
sleep 8
curl -s -o /dev/null -w "no token -> %{http_code}\n" -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
curl -s -o /dev/null -w "bad token -> %{http_code}\n" -X POST http://localhost:3000/api/mcp \
  -H 'content-type: application/json' -H 'Authorization: Bearer ps_bogus' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
kill %1
```
Expected: both `401`.

- [ ] **Step 7: Verify gates and commit**

```bash
npm run type-check && npm run lint && npm run format:check && npx jest && npm run build
git add src/app/api/mcp src/lib/mcp tests/db/mcp-tools.db.test.ts
git commit -m "feat(mcp): add MCP server with token auth and read-only tools"
```

---

### Task 4: Favourites as slash commands

**Files:**
- Create: `src/lib/mcp/prompts.ts`
- Modify: `src/app/api/mcp/route.ts`
- Test: `__tests__/lib/mcp/slug.test.ts`, `tests/db/mcp-prompts.db.test.ts`

**Interfaces:**
- Produces:
  - `slugify(title: string, id: string, taken: Set<string>): string`
  - `favouritePromptsFor(workspaceId: string): Promise<Prompt[]>`
  - `buildPromptBody(prompt: Prompt, context?: string): string`

**READ THIS FIRST — this task rests on an unverified assumption.**

`mcp-handler` calls `initializeServer(server)` with **only the server**. No `Request`, no auth. So registering per-user prompts requires `AsyncLocalStorage` carrying the resolved context into `initialize`, and that only works if the server factory runs **per request**. Inspecting the dist shows the factory passed to the SDK with `legacy: "stateless"`, which suggests per-request construction, but this is not documented.

**Step 1 proves or disproves it before anything is built on it.**

- [ ] **Step 1: Spike — does `initialize` run per request?**

Temporarily add to `src/app/api/mcp/route.ts`, inside `createMcpHandler`'s callback, as the first line:

```ts
console.warn(`[spike] initialize ran at ${Date.now()}`);
```

Then:
```bash
npm run dev &
sleep 8
for i in 1 2 3; do
  curl -s -o /dev/null -X POST http://localhost:3000/api/mcp \
    -H 'content-type: application/json' -H 'Authorization: Bearer <a real token>' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
done
kill %1
```

Count the `[spike]` lines in the dev-server output.

- **Three lines → per request.** Proceed to Step 2.
- **One line → cached.** STOP and report to the controller. Do not proceed. Use the fallback in Step 8 instead, which requires a decision.

Remove the `console.warn` before continuing either way.

- [ ] **Step 2: Write the failing slug test**

Create `__tests__/lib/mcp/slug.test.ts`:

```ts
import { slugify } from '@/lib/mcp/prompts';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Daily Planning', 'id1', new Set())).toBe('daily-planning');
  });

  it('strips characters that are not slash-command safe', () => {
    expect(slugify('Code Review (v2)!', 'id1', new Set())).toBe('code-review-v2');
  });

  it('collapses repeated separators and trims them', () => {
    expect(slugify('  Hello --- World  ', 'id1', new Set())).toBe('hello-world');
  });

  it('falls back to the id when a title has no usable characters', () => {
    expect(slugify('!!!', 'abc12345', new Set())).toBe('prompt-abc12345');
  });

  it('disambiguates a collision deterministically using the id', () => {
    const taken = new Set(['daily-planning']);
    const first = slugify('Daily Planning', 'abc12345', taken);
    const second = slugify('Daily Planning', 'abc12345', taken);

    expect(first).not.toBe('daily-planning');
    expect(first).toContain('daily-planning');
    expect(second).toBe(first); // stable across calls — commands must not shuffle
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest __tests__/lib/mcp/slug.test.ts`
Expected: FAIL — "Cannot find module '@/lib/mcp/prompts'".

- [ ] **Step 4: Implement slug and favourite lookup**

Create `src/lib/mcp/prompts.ts`:

```ts
import type { Prompt } from '@/types';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';

const repo = new DrizzlePromptRepository();

/**
 * Derives a slash-command name from a prompt title.
 *
 * Collisions are disambiguated with a slice of the prompt id rather than a
 * counter, so a command keeps the same name between sessions even if the set
 * of prompts changes.
 */
export function slugify(title: string, id: string, taken: Set<string>): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const name = base === '' ? `prompt-${id.slice(0, 8)}` : base;
  return taken.has(name) ? `${name}-${id.slice(0, 6)}` : name;
}

/** Favourited, non-archived prompts become slash commands. */
export async function favouritePromptsFor(workspaceId: string): Promise<Prompt[]> {
  const found = await repo.findByWorkspaceId(workspaceId, { favoritesOnly: true });
  return found.filter((p) => p.status !== 'archived');
}

export function buildPromptBody(prompt: Prompt, context?: string): string {
  if (context === undefined || context.trim() === '') {
    return prompt.content;
  }
  return `${prompt.content}\n\nAdditional context: ${context}`;
}
```

- [ ] **Step 5: Run the slug test to verify it passes**

Run: `npx jest __tests__/lib/mcp/slug.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the failing favourites test**

Create `tests/db/mcp-prompts.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { favouritePromptsFor, buildPromptBody } from '@/lib/mcp/prompts';
import { resetDb, seedUser, closeDb } from './helpers';

describe('mcp prompts', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');

    await getDb().insert(prompts).values([
      { id: 'fav', workspaceId: a.workspaceId, title: 'Fav', content: 'body', isFavorite: true },
      { id: 'plain', workspaceId: a.workspaceId, title: 'Plain', content: 'body', isFavorite: false },
      { id: 'arch', workspaceId: a.workspaceId, title: 'Old', content: 'body', isFavorite: true, status: 'archived' },
      { id: 'bfav', workspaceId: b.workspaceId, title: 'B Fav', content: 'body', isFavorite: true },
    ]);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('returns only favourited, non-archived prompts', async () => {
    const found = await favouritePromptsFor(a.workspaceId);
    expect(found.map((p) => p.id)).toEqual(['fav']);
  });

  // THE ISOLATION GUARD.
  it('never returns another workspace favourites', async () => {
    const found = await favouritePromptsFor(a.workspaceId);
    expect(found.map((p) => p.id)).not.toContain('bfav');
  });

  it('appends context when given, and does not when not', async () => {
    const [p] = await favouritePromptsFor(a.workspaceId);
    expect(buildPromptBody(p!)).toBe('body');
    expect(buildPromptBody(p!, '  ')).toBe('body');
    expect(buildPromptBody(p!, 'auth work')).toBe('body\n\nAdditional context: auth work');
  });
});
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npx jest tests/db/mcp-prompts.db.test.ts`
Expected: PASS, 3 tests. (Implementation already exists from Step 4 — this test verifies it against real Postgres.)

- [ ] **Step 8: Register favourites as MCP prompts**

In `src/app/api/mcp/route.ts`, add `AsyncLocalStorage` carrying the resolved context, and register a prompt per favourite inside `initialize`.

```ts
import { AsyncLocalStorage } from 'async_hooks';
import { favouritePromptsFor, slugify, buildPromptBody } from '@/lib/mcp/prompts';

const contextStore = new AsyncLocalStorage<{ userId: string; workspaceId: string }>();
```

Change `createMcpHandler`'s callback to `async (server) => { … }` and append, after the two `registerTool` calls:

```ts
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
              role: 'user',
              content: { type: 'text', text: buildPromptBody(prompt, context) },
            },
          ],
        })
      );
    }
  }
```

Then wrap the exported handlers so the store is populated before the handler runs:

```ts
async function withContext(req: Request): Promise<Response> {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const ctx = bearer === undefined ? null : await resolveTokenContext(bearer);
  if (ctx === null) {
    return authHandler(req); // let withMcpAuth produce the RFC-compliant 401
  }
  return contextStore.run(ctx, () => authHandler(req));
}

export { withContext as GET, withContext as POST };
```

**Fallback if Step 1 showed `initialize` is cached:** do not use `AsyncLocalStorage`. Instead register a single prompt named `use` taking a required `name` argument, which looks up the favourite by slug at call time — giving `/mcp__prompt-saver__use daily-planning`. Less ergonomic, but correct. Report to the controller before taking this path; it changes the spec's §4.

- [ ] **Step 9: Verify gates and commit**

```bash
npm run type-check && npm run lint && npm run format:check && npx jest && npm run build
git add src/lib/mcp/prompts.ts src/app/api/mcp/route.ts __tests__/lib/mcp tests/db/mcp-prompts.db.test.ts
git commit -m "feat(mcp): expose favourited prompts as slash commands"
```

---

### Task 5: Write tools

**Files:**
- Modify: `src/lib/mcp/tools.ts`, `src/app/api/mcp/route.ts`
- Test: `tests/db/mcp-write-tools.db.test.ts`

**Interfaces:**
- Produces:
  - `createPromptHandler(workspaceId, input): Promise<{ id: string }>` where `input: { title: string; content: string; description?: string; tags?: string[] }`
  - `updatePromptHandler(workspaceId, id, input): Promise<Prompt>` where `input: { title?: string; content?: string; description?: string; tags?: string[] }`
  - `saveVersionHandler(workspaceId, id, content, changeSummary?): Promise<PromptVersion>`

- [ ] **Step 1: Write the failing write-tool test**

Create `tests/db/mcp-write-tools.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import {
  createPromptHandler,
  updatePromptHandler,
  saveVersionHandler,
  getPromptHandler,
} from '@/lib/mcp/tools';
import { resetDb, seedUser, closeDb } from './helpers';

describe('mcp write tools', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');
    await getDb()
      .insert(prompts)
      .values({ id: 'b1', workspaceId: b.workspaceId, title: 'Secret', content: 'private' });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates a prompt with exactly one version and no orphan', async () => {
    const { id } = await createPromptHandler(a.workspaceId, {
      title: 'From Claude',
      content: 'body',
      tags: ['mcp'],
    });

    const p = await getPromptHandler(a.workspaceId, id);
    expect(p.metadata.version_count).toBe(1);
    expect(p.current_version_id).not.toBe('');
    expect(p.tags).toEqual(['mcp']);
  });

  it('updates an owned prompt', async () => {
    const { id } = await createPromptHandler(a.workspaceId, { title: 'X', content: 'old' });
    const updated = await updatePromptHandler(a.workspaceId, id, { content: 'new' });
    expect(updated.content).toBe('new');
  });

  it('saves a new version and bumps the count', async () => {
    const { id } = await createPromptHandler(a.workspaceId, { title: 'X', content: 'v1' });
    const v = await saveVersionHandler(a.workspaceId, id, 'v2', 'second pass');

    expect(v.version_number).toBe(2);
    expect((await getPromptHandler(a.workspaceId, id)).metadata.version_count).toBe(2);
  });

  // THE ISOLATION GUARDS.
  it('refuses to update another workspace prompt', async () => {
    await expect(updatePromptHandler(a.workspaceId, 'b1', { content: 'hacked' })).rejects.toThrow(
      'not found'
    );
    expect((await getPromptHandler(b.workspaceId, 'b1')).content).toBe('private');
  });

  it('refuses to version another workspace prompt', async () => {
    await expect(saveVersionHandler(a.workspaceId, 'b1', 'hacked')).rejects.toThrow('not found');
  });

  it('creates into the caller own workspace, never another', async () => {
    const { id } = await createPromptHandler(a.workspaceId, { title: 'Mine', content: 'x' });
    const p = await getPromptHandler(a.workspaceId, id);
    expect(p.workspace_id).toBe(a.workspaceId);
    expect(p.workspace_id).not.toBe(b.workspaceId);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/db/mcp-write-tools.db.test.ts`
Expected: FAIL — `createPromptHandler` is not exported.

- [ ] **Step 3: Implement the write handlers**

First add these to the **existing import block at the top** of `src/lib/mcp/tools.ts` — do not append imports mid-file:

```ts
import type { Prompt, PromptVersion } from '@/types'; // widen the existing Prompt-only import
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { generateId } from '../utils/id-generator';
import { now } from '../utils/datetime';
```

Then append the rest to the bottom of the file:

```ts
const versionRepo = new DrizzlePromptVersionRepository();

export interface CreatePromptInput {
  title: string;
  content: string;
  description?: string;
  tags?: string[];
}

/** Reuses createWithFirstVersion so prompt and first version land atomically. */
export async function createPromptHandler(
  workspaceId: string,
  input: CreatePromptInput
): Promise<{ id: string }> {
  const id = generateId();
  const timestamp = now();

  await repo.createWithFirstVersion(
    {
      id,
      workspace_id: workspaceId,
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      content: input.content,
      tags: input.tags ?? [],
      status: 'active',
      is_favorite: false,
      current_version_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { version_count: 0 },
    },
    {
      id: generateId(),
      prompt_id: id,
      version_number: 1,
      content: input.content,
      change_summary: 'Created via MCP',
      created_at: timestamp,
    }
  );

  return { id };
}

export interface UpdatePromptInput {
  title?: string;
  content?: string;
  description?: string;
  tags?: string[];
}

export async function updatePromptHandler(
  workspaceId: string,
  id: string,
  input: UpdatePromptInput
): Promise<Prompt> {
  await requireOwnedPrompt(id, workspaceId);
  return repo.update(id, input);
}

/** Reuses createVersionAtomic — row-locked, version number recomputed server-side. */
export async function saveVersionHandler(
  workspaceId: string,
  id: string,
  content: string,
  changeSummary?: string
): Promise<PromptVersion> {
  await requireOwnedPrompt(id, workspaceId);
  return versionRepo.createVersionAtomic(
    {
      id: generateId(),
      prompt_id: id,
      version_number: 0, // recomputed inside the transaction
      content,
      change_summary: changeSummary ?? 'Saved via MCP',
      created_at: now(),
    },
    id
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/db/mcp-write-tools.db.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Register the write tools**

In `src/app/api/mcp/route.ts`, add three `registerTool` calls alongside the existing two:

```ts
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
    async (input, ctx) => {
      const { id } = await createPromptHandler(workspaceFrom(ctx), input);
      return { content: [{ type: 'text', text: `Created prompt ${id}` }] };
    }
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
    async ({ id, ...rest }, ctx) => {
      const updated = await updatePromptHandler(workspaceFrom(ctx), id, rest);
      return { content: [{ type: 'text', text: `Updated "${updated.title}"` }] };
    }
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
    async ({ id, content, change_summary }, ctx) => {
      const v = await saveVersionHandler(workspaceFrom(ctx), id, content, change_summary);
      return { content: [{ type: 'text', text: `Saved version ${v.version_number}` }] };
    }
  );
```

- [ ] **Step 6: Verify gates and commit**

```bash
npm run type-check && npm run lint && npm run format:check && npx jest && npm run build
git add src/lib/mcp/tools.ts src/app/api/mcp/route.ts tests/db/mcp-write-tools.db.test.ts
git commit -m "feat(mcp): add create, update and save-version tools"
```

---

### Task 6: Documentation and live verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the MCP server in the README**

Add a section covering: what the MCP server is, generating a token at `/app/settings/tokens`, the `claude mcp add` command with `--scope user`, the five tools, that favourites become slash commands, and — stated plainly — that **starring a prompt does not add its command to a running session; a new session or `/mcp` reconnect is required.**

- [ ] **Step 2: Verify gates and commit**

```bash
npm run type-check && npm run lint && npm run format:check && npx jest && npm run build
git add README.md
git commit -m "docs: document the MCP server and token setup"
```

- [ ] **Step 3: Deploy and verify against real Claude Code**

**This step needs the human partner** — it touches production and requires an interactive client.

1. Push the branch; let Vercel build a preview deployment.
2. Sign in to the preview, create a token at `/app/settings/tokens`.
3. Register it:
   ```bash
   claude mcp add --transport http prompt-saver --scope user <preview-url>/api/mcp \
     --header "Authorization: Bearer ps_..."
   ```
4. In a fresh Claude Code session run `/mcp` and confirm the server connects.
5. Type `/` and confirm a favourited prompt appears as `/mcp__prompt-saver__<slug>`.
6. Invoke it, with and without a context argument.
7. Ask Claude to "search my prompt library" and confirm `search_prompts` returns summaries.
8. Ask Claude to save a new prompt; confirm it appears in the web app with one version.
9. Revoke the token in settings, start a new session, confirm the server now fails to connect.

**Record the cold-start timing at step 4.** Claude Code's default MCP connect timeout is 5 seconds, and a cold Vercel function plus a waking Neon compute may approach it. If connection fails on the first attempt but succeeds on retry, that is the cold start — report it rather than treating the server as broken.

---

## Verification Checklist

Maps to the spec's §9:

- [ ] `claude mcp add` succeeds and `/mcp` shows the server connected (Task 6)
- [ ] A favourited prompt appears as `/mcp__prompt-saver__<slug>` and inserts its body (Task 4, Task 6)
- [ ] The optional `context` argument is appended correctly (Task 4)
- [ ] `search_prompts` returns only the caller's prompts, summaries only, respecting `limit` (Task 3)
- [ ] A token for user A gets `NotFoundError` for every one of user B's prompt ids, across all five tools (Tasks 3, 5)
- [ ] `create_prompt` yields exactly one version and zero orphans (Task 5)
- [ ] A revoked token is rejected with the same 401 as an unknown one (Tasks 1, 3)
- [ ] Tokens are never stored or logged in plaintext (Task 1)
- [ ] Existing Server Action isolation tests still pass unchanged (every task's gate)
