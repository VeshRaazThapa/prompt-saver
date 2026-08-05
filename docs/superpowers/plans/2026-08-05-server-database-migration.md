# Server Database Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser-local IndexedDB with Neon Postgres so the deployed app stores prompts server-side, private per user, reachable from any device.

**Architecture:** Drizzle ORM talks to Neon Postgres from server-only code. Client hooks call Next.js Server Actions instead of repositories directly. Every action resolves the signed-in user server-side through one `getCurrentContext()` helper and scopes all queries to that user's workspace — the client never supplies a trusted id.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Drizzle ORM, postgres.js driver, Neon Postgres, NextAuth (Google), Jest.

**Spec:** `docs/superpowers/specs/2026-08-05-server-database-migration-design.md`

## Global Constraints

- TypeScript strict mode. No `any` without written justification. Every function typed.
- `npm run lint` must pass with `--max-warnings 0`. Cyclomatic complexity ceiling: 10.
- `npm run format:check` must pass (Prettier).
- Install with `npm install --legacy-peer-deps`. Node 18.17+ or 20.x.
- Jest global coverage floor is 70% (branches, functions, lines, statements). New modules need tests.
- **Never trust a client-supplied `user_id` or `workspace_id`.** Both come from `getCurrentContext()`, server-side, always.
- Domain types in `src/types/*.ts` are the contract with the UI. Repositories map DB rows to them; the UI shape does not change.
- The DB client must be created lazily inside a function — never at module top level — or `next build` fails on Vercel.

## Two Deliberate Deviations From the Spec

Both are behind the repository boundary and leave `src/types/*.ts` untouched:

1. **`prompts.version_count` is a real integer column**, not a nested `metadata` JSON field. Atomic increments and indexing need a column. The repository maps it back into `Prompt.metadata.version_count`, so the UI sees exactly the shape it sees today.
2. **`createVersionAtomic()` recomputes `version_number` and `previous_version_id` inside the transaction**, ignoring whatever the caller passed. This is what makes concurrent version creation safe; a caller cannot pick a colliding number.

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `drizzle.config.ts` | Drizzle Kit config; points migrations at the unpooled URL |
| `src/lib/db/drizzle/schema.ts` | Postgres table definitions |
| `src/lib/db/drizzle/client.ts` | Lazy singleton DB connection |
| `src/lib/db/drizzle/mappers.ts` | DB row ↔ domain type conversion |
| `src/lib/db/drizzle/prompt-repository.ts` | `IPromptRepository` over Postgres |
| `src/lib/db/drizzle/prompt-version-repository.ts` | `IPromptVersionRepository` over Postgres |
| `src/lib/auth/allowlist.ts` | `ALLOWED_EMAILS` check (pure, testable) |
| `src/lib/auth/context.ts` | `getCurrentContext()` — user + workspace bootstrap |
| `src/lib/actions/result.ts` | `ActionResult<T>` type + `run()` wrapper (NOT a `'use server'` file) |
| `src/lib/actions/prompts.ts` | Server Actions for the library and editor |
| `src/lib/actions/versions.ts` | Server Actions for version history |
| `tests/db/helpers.ts` | Test DB reset + fixture builders |

**Deleted in Task 9:** `src/lib/db/client.ts`, `src/lib/db/schema.ts`, `src/lib/db/migrations.ts`, `src/lib/db/repositories/indexeddb-*.ts` (4 files), `src/lib/db/repositories/factory.ts`, `src/lib/constants.ts`.

**Kept unchanged:** `src/lib/db/repositories/types.ts` (the interfaces are already right), `src/types/*.ts`, `src/lib/errors.ts`.

**Intentionally left unimplemented:** `IUserRepository` and `IWorkspaceRepository` in `types.ts` keep no implementation after this migration. `getCurrentContext()` is the only code touching those two tables, and it does so directly — a repository class wrapping two queries would be indirection for its own sake. Leave the interfaces in place for when a settings or workspace-switching UI needs them.

---

### Task 1: Database schema, connection, and test infrastructure

**Files:**
- Create: `drizzle.config.ts`, `src/lib/db/drizzle/schema.ts`, `src/lib/db/drizzle/client.ts`, `tests/db/helpers.ts`, `.env.test`
- Create: `tests/db/schema.db.test.ts`
- Modify: `package.json` (deps + scripts), `.env.example`, `.gitignore`

**Interfaces:**
- Produces: `getDb(): PostgresJsDatabase<typeof schema>` from `client.ts`; tables `users`, `workspaces`, `prompts`, `promptVersions` from `schema.ts`; `resetDb(): Promise<void>` from `tests/db/helpers.ts`

**Background the implementer needs:** Neon issues two connection strings. The pooled one (hostname contains `-pooler`) is what the app uses, because each serverless invocation opens its own connection. The direct one is required for migrations, because pooled connections don't support the session-level locks migrations take. We use the `postgres` (postgres.js) driver rather than Neon's HTTP driver for one decisive reason: **the HTTP driver cannot do transactions**, and `createVersionAtomic` needs one. postgres.js also works unchanged against a plain Postgres container in CI.

- [ ] **Step 1: Install dependencies**

```bash
npm install --legacy-peer-deps drizzle-orm postgres
npm install --legacy-peer-deps --save-dev drizzle-kit dotenv
```

- [ ] **Step 2: Create a free Neon project (manual, no credit card)**

Go to neon.com, sign up with GitHub or Google, create a project named `prompt-saver`. From the dashboard connection widget copy **both** strings:
- Pooled (host contains `-pooler`) → this is `DATABASE_URL`
- Direct (no `-pooler`) → this is `DATABASE_URL_UNPOOLED`

Do **not** install the Neon integration from the Vercel Marketplace — that links it to Vercel billing and can ask for a payment method.

- [ ] **Step 3: Write env files**

`.env.local` (never committed — confirm `.gitignore` covers `.env*.local`):

```
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
ALLOWED_EMAILS=brthapa@maitriservices.com
```

`.env.test` (committed — points at local/CI Postgres, no secrets):

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/prompt_saver_test
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/prompt_saver_test
```

Append to `.env.example`:

```
# Neon Postgres — pooled URL for the app, direct URL for migrations
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Comma-separated sign-in allowlist. LEAVE UNSET AND THE APP IS OPEN TO ANYONE.
ALLOWED_EMAILS=
```

- [ ] **Step 4: Write the schema**

Create `src/lib/db/drizzle/schema.ts`:

```ts
import { pgTable, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Google OAuth `sub`
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp('last_login', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    settings: jsonb('settings')
      .$type<{ defaultProvider?: string; theme?: 'light' | 'dark' }>()
      .notNull()
      .default({}),
    metadata: jsonb('metadata')
      .$type<{ promptCount: number; lastActivity: string }>()
      .notNull()
      .default({ promptCount: 0, lastActivity: '' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ userIdx: index('workspaces_user_id_idx').on(t.userId) })
);

export const prompts = pgTable(
  'prompts',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    content: text('content').notNull().default(''),
    currentVersionId: text('current_version_id'),
    tags: text('tags').array().notNull().default([]),
    isFavorite: boolean('is_favorite').notNull().default(false),
    status: text('status', { enum: ['draft', 'active', 'archived'] })
      .notNull()
      .default('active'),
    versionCount: integer('version_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index('prompts_workspace_id_idx').on(t.workspaceId),
    workspaceUpdatedIdx: index('prompts_workspace_updated_idx').on(t.workspaceId, t.updatedAt),
  })
);

export const promptVersions = pgTable(
  'prompt_versions',
  {
    id: text('id').primaryKey(),
    promptId: text('prompt_id')
      .notNull()
      .references(() => prompts.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    content: text('content').notNull(),
    result: text('result'),
    changeSummary: text('change_summary'),
    previousVersionId: text('previous_version_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    promptIdx: index('prompt_versions_prompt_id_idx').on(t.promptId),
    promptVersionUniq: uniqueIndex('prompt_versions_prompt_version_uniq').on(t.promptId, t.versionNumber),
  })
);
```

- [ ] **Step 5: Write the lazy client**

Create `src/lib/db/drizzle/client.ts`:

```ts
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let db: PostgresJsDatabase<typeof schema> | undefined;

/**
 * Lazily creates the Drizzle client.
 * MUST stay lazy — connecting at module scope breaks `next build`.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (db === undefined) {
    const url = process.env['DATABASE_URL'];
    if (url === undefined || url === '') {
      throw new Error('DATABASE_URL is not set');
    }
    // `prepare: false` is REQUIRED behind Neon's transaction-mode pooler.
    const client = postgres(url, { max: 1, prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}
```

- [ ] **Step 6: Write the Drizzle Kit config**

Create `drizzle.config.ts`:

```ts
import { config } from 'dotenv';
import type { Config } from 'drizzle-kit';

config({ path: '.env.local' });

export default {
  schema: './src/lib/db/drizzle/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations need the DIRECT url — pooled connections can't hold migration locks.
    url: process.env['DATABASE_URL_UNPOOLED'] ?? '',
  },
} satisfies Config;
```

Add to `package.json` scripts:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:studio": "drizzle-kit studio"
```

- [ ] **Step 7: Generate the migration and add the trigram indexes**

```bash
npm run db:generate
```

Then create a second migration file by hand at `drizzle/0001_search_indexes.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS prompts_title_trgm_idx ON prompts USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prompts_description_trgm_idx ON prompts USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prompts_content_trgm_idx ON prompts USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prompts_tags_idx ON prompts USING GIN (tags);
```

Register it by appending an entry to `drizzle/meta/_journal.json` matching the existing entry's shape (increment `idx`, set `tag` to `0001_search_indexes`).

- [ ] **Step 8: Write the test helper**

Create `tests/db/helpers.ts`:

```ts
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { users, workspaces } from '@/lib/db/drizzle/schema';

/** Truncates every table. Call in beforeEach so tests never share state. */
export async function resetDb(): Promise<void> {
  const db = getDb();
  await db.execute(
    sql`TRUNCATE TABLE prompt_versions, prompts, workspaces, users RESTART IDENTITY CASCADE`
  );
}

export async function seedUser(
  id = 'user-1',
  email = 'user1@example.com'
): Promise<{ userId: string; workspaceId: string }> {
  const db = getDb();
  await db.insert(users).values({ id, email, name: `Test ${id}` });
  const workspaceId = `ws-${id}`;
  await db.insert(workspaces).values({ id: workspaceId, userId: id, name: 'My Workspace' });
  return { userId: id, workspaceId };
}
```

- [ ] **Step 9: Write the failing schema test**

Create `tests/db/schema.db.test.ts`. The docblock is what switches this file to the `node` environment — jsdom cannot hold a socket.

```ts
/**
 * @jest-environment node
 */
import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { prompts, promptVersions } from '@/lib/db/drizzle/schema';
import { resetDb, seedUser } from './helpers';

describe('postgres schema', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('has all four tables', async () => {
    const rows = await getDb().execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toEqual(expect.arrayContaining(['users', 'workspaces', 'prompts', 'prompt_versions']));
  });

  it('cascades version deletion when a prompt is deleted', async () => {
    const db = getDb();
    const { workspaceId } = await seedUser();

    await db.insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'C' });
    await db.insert(promptVersions).values({ id: 'v1', promptId: 'p1', versionNumber: 1, content: 'C' });
    await db.delete(prompts).where(eq(prompts.id, 'p1'));

    const remaining = await db.select().from(promptVersions);
    expect(remaining).toHaveLength(0);
  });
});
```

- [ ] **Step 10: Start local Postgres and run migrations**

```bash
docker run --name prompt-saver-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=prompt_saver_test -p 5432:5432 -d postgres:16
DATABASE_URL_UNPOOLED=postgresql://postgres:postgres@localhost:5432/prompt_saver_test npm run db:migrate
```

If Docker isn't available, point `.env.test` at a second free Neon project instead.

- [ ] **Step 11: Run the test to verify it passes**

Run: `npx jest tests/db/schema.db.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 12: Apply migrations to Neon and commit**

```bash
npm run db:migrate   # reads DATABASE_URL_UNPOOLED from .env.local → your Neon project
git add drizzle drizzle.config.ts src/lib/db/drizzle tests/db package.json package-lock.json .env.example .env.test
git commit -m "feat(db): add postgres schema, drizzle client, and db test harness"
```

---

### Task 2: Session identity and the sign-in allowlist

**Files:**
- Create: `src/lib/auth/allowlist.ts`, `__tests__/lib/auth/allowlist.test.ts`
- Modify: `src/lib/auth/config.ts`

**Interfaces:**
- Produces: `isEmailAllowed(email: string | null | undefined): boolean`; `session.user.id` populated with the Google `sub`

**Why this is first-class work:** `src/lib/auth/session.ts` already has `getCurrentUserId()` returning `session.user.id` — but `config.ts`'s session callback never sets `id`. That function returns `undefined` today. Every scoping decision downstream depends on fixing it.

- [ ] **Step 1: Write the failing allowlist test**

Create `__tests__/lib/auth/allowlist.test.ts`:

```ts
import { isEmailAllowed } from '@/lib/auth/allowlist';

describe('isEmailAllowed', () => {
  const original = process.env['ALLOWED_EMAILS'];
  afterEach(() => {
    if (original === undefined) delete process.env['ALLOWED_EMAILS'];
    else process.env['ALLOWED_EMAILS'] = original;
  });

  it('allows anyone when unset (the public switch)', () => {
    delete process.env['ALLOWED_EMAILS'];
    expect(isEmailAllowed('stranger@example.com')).toBe(true);
  });

  it('allows anyone when set to an empty string', () => {
    process.env['ALLOWED_EMAILS'] = '   ';
    expect(isEmailAllowed('stranger@example.com')).toBe(true);
  });

  it('allows a listed email', () => {
    process.env['ALLOWED_EMAILS'] = 'a@x.com,b@y.com';
    expect(isEmailAllowed('b@y.com')).toBe(true);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    process.env['ALLOWED_EMAILS'] = ' A@X.com , b@y.com ';
    expect(isEmailAllowed('a@x.COM')).toBe(true);
  });

  it('rejects an unlisted email', () => {
    process.env['ALLOWED_EMAILS'] = 'a@x.com';
    expect(isEmailAllowed('intruder@evil.com')).toBe(false);
  });

  it('rejects null or undefined when a list is configured', () => {
    process.env['ALLOWED_EMAILS'] = 'a@x.com';
    expect(isEmailAllowed(null)).toBe(false);
    expect(isEmailAllowed(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest __tests__/lib/auth/allowlist.test.ts`
Expected: FAIL — "Cannot find module '@/lib/auth/allowlist'".

- [ ] **Step 3: Implement the allowlist**

Create `src/lib/auth/allowlist.ts`:

```ts
/**
 * Checks an email against the ALLOWED_EMAILS allowlist.
 * When ALLOWED_EMAILS is unset or blank, everyone is allowed — this is the
 * deliberate switch for going public. See the design spec, section 6.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  const raw = process.env['ALLOWED_EMAILS'];
  if (raw === undefined || raw.trim() === '') {
    return true;
  }
  const allowed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  if (allowed.length === 0) {
    return true;
  }
  if (typeof email !== 'string') {
    return false;
  }
  return allowed.includes(email.toLowerCase());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/lib/auth/allowlist.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Wire the callbacks**

In `src/lib/auth/config.ts`, add the import and replace the `signIn`, `jwt`, and `session` callbacks:

```ts
import { isEmailAllowed } from './allowlist';
```

```ts
    // Gate sign-in on the allowlist. Google has already verified this email.
    async signIn({ user }) {
      return isEmailAllowed(user.email);
    },

    // `token.sub` is Google's stable subject id — our users.id primary key.
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      if (typeof token.sub === 'string') {
        token.userId = token.sub;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
```

- [ ] **Step 6: Verify type-check and lint pass**

Run: `npm run type-check && npm run lint`
Expected: both clean. `session.user.id` and `token.userId` are already declared in `src/lib/auth/types.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth/allowlist.ts src/lib/auth/config.ts __tests__/lib/auth/allowlist.test.ts
git commit -m "feat(auth): populate session.user.id and gate sign-in on ALLOWED_EMAILS"
```

---

### Task 3: `getCurrentContext()` — user and workspace bootstrap

**Files:**
- Create: `src/lib/auth/context.ts`, `tests/db/context.db.test.ts`

**Interfaces:**
- Consumes: `requireAuth()` from `src/lib/auth/session.ts`; `getDb()` and tables from Task 1
- Produces: `getCurrentContext(): Promise<UserContext>`, `interface UserContext { userId: string; workspaceId: string }`

**Decided before execution:** the design spec said to wrap this in React's `cache()`. This project runs React 18.3.1, which has no `cache` export (verified: `typeof require('react').cache === 'undefined'`). We are **not** using `cache()` and **not** upgrading React as part of this migration. It costs nothing: each Server Action is its own request and calls this once, so there is no repeat call to memoize. Do not import `cache`.

**This is the security chokepoint.** Every action calls it. It is the only place a workspace id originates.

- [ ] **Step 1: Write the failing test**

Create `tests/db/context.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { users, workspaces } from '@/lib/db/drizzle/schema';
import { resetDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  requireAuth: () => mockSession(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getCurrentContext } = require('@/lib/auth/context') as typeof import('@/lib/auth/context');

function sessionFor(id: string, email: string) {
  return { user: { id, email, name: 'Test User', image: null } };
}

describe('getCurrentContext', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  it('creates the user and a workspace on first call', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));

    const ctx = await getCurrentContext();

    expect(ctx.userId).toBe('google-1');
    expect(ctx.workspaceId).toBeTruthy();

    const rows = await getDb().select().from(workspaces).where(eq(workspaces.userId, 'google-1'));
    expect(rows).toHaveLength(1);
  });

  it('reuses the existing workspace on later calls', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));

    const first = await getCurrentContext();
    const second = await getCurrentContext();

    expect(second.workspaceId).toBe(first.workspaceId);
    const rows = await getDb().select().from(workspaces).where(eq(workspaces.userId, 'google-1'));
    expect(rows).toHaveLength(1);
  });

  it('gives two different users two different workspaces', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));
    const a = await getCurrentContext();

    mockSession.mockResolvedValue(sessionFor('google-2', 'two@example.com'));
    const b = await getCurrentContext();

    expect(a.workspaceId).not.toBe(b.workspaceId);
    expect(a.userId).not.toBe(b.userId);
  });

  it('refreshes last_login and profile fields on repeat sign-in', async () => {
    mockSession.mockResolvedValue(sessionFor('google-1', 'one@example.com'));
    await getCurrentContext();

    mockSession.mockResolvedValue({ user: { id: 'google-1', email: 'renamed@example.com', name: 'Renamed', image: null } });
    await getCurrentContext();

    const [row] = await getDb().select().from(users).where(eq(users.id, 'google-1'));
    expect(row?.email).toBe('renamed@example.com');
    expect(row?.name).toBe('Renamed');
  });
});
```

> **Note for the implementer:** `getCurrentContext` is wrapped in React's `cache()`, which memoizes per request. Under Jest there is no request scope, so each call re-executes — which is exactly what these tests need. Do not add your own module-level caching.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/db/context.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/auth/context'".

- [ ] **Step 3: Implement the context helper**

Create `src/lib/auth/context.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/drizzle/client';
import { users, workspaces } from '../db/drizzle/schema';
import { requireAuth } from './session';
import { generateId } from '../utils/id-generator';

export interface UserContext {
  userId: string;
  workspaceId: string;
}

/**
 * Resolves the signed-in user, ensuring their row and their single private
 * workspace both exist.
 *
 * Every Server Action starts here. The workspaceId it returns is the ONLY
 * legitimate source of workspace scoping — never accept one from the client.
 */
export async function getCurrentContext(): Promise<UserContext> {
  const session = await requireAuth();
  const { id: userId, email, name, image } = session.user;
  const db = getDb();

  await db
    .insert(users)
    .values({ id: userId, email, name, avatar: image, lastLogin: new Date() })
    .onConflictDoUpdate({
      target: users.id,
      set: { email, name, avatar: image, lastLogin: new Date() },
    });

  // Oldest-first so that if a race ever created two, every request converges
  // on the same one. See the spec: no UNIQUE constraint, by choice.
  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  const found = existing[0];
  if (found !== undefined) {
    return { userId, workspaceId: found.id };
  }

  const workspaceId = generateId();
  await db.insert(workspaces).values({ id: workspaceId, userId, name: 'My Workspace' });
  return { userId, workspaceId };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/db/context.db.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/context.ts tests/db/context.db.test.ts
git commit -m "feat(auth): add getCurrentContext with lazy user and workspace bootstrap"
```

---

### Task 4: Prompt repository over Postgres

**Files:**
- Create: `src/lib/db/drizzle/mappers.ts`, `src/lib/db/drizzle/prompt-repository.ts`, `tests/db/prompt-repository.db.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `prompts` table, `NotFoundError` from `src/lib/errors.ts`
- Produces: `class DrizzlePromptRepository implements IPromptRepository`; `toPrompt(row)` and `toPromptVersion(row)` from `mappers.ts`

**Interface note:** `IPromptRepository` in `src/lib/db/repositories/types.ts` is unchanged. `findByWorkspaceId` and `search` already take `workspaceId` as their first argument — callers will pass the value from `getCurrentContext()`.

- [ ] **Step 1: Write the mappers**

Create `src/lib/db/drizzle/mappers.ts`:

```ts
import type { Prompt, PromptVersion } from '@/types';
import type { prompts, promptVersions } from './schema';

type PromptRow = typeof prompts.$inferSelect;
type PromptVersionRow = typeof promptVersions.$inferSelect;

/** Maps a DB row to the domain Prompt the UI expects (ISO strings, nested metadata). */
export function toPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    content: row.content,
    current_version_id: row.currentVersionId ?? '',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    tags: row.tags,
    is_favorite: row.isFavorite,
    status: row.status,
    metadata: { version_count: row.versionCount },
  };
}

export function toPromptVersion(row: PromptVersionRow): PromptVersion {
  return {
    id: row.id,
    prompt_id: row.promptId,
    version_number: row.versionNumber,
    content: row.content,
    ...(row.result !== null ? { result: row.result } : {}),
    ...(row.changeSummary !== null ? { change_summary: row.changeSummary } : {}),
    created_at: row.createdAt.toISOString(),
    ...(row.previousVersionId !== null ? { previous_version_id: row.previousVersionId } : {}),
  };
}

/** Escapes LIKE wildcards so a user searching for "50%" doesn't match everything. */
export function escapeLike(input: string): string {
  return input.replace(/([\\%_])/g, '\\$1');
}
```

- [ ] **Step 2: Write the failing repository test**

Create `tests/db/prompt-repository.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { DrizzlePromptRepository } from '@/lib/db/drizzle/prompt-repository';
import type { Prompt } from '@/types';
import { resetDb, seedUser } from './helpers';

const repo = new DrizzlePromptRepository();

function makePrompt(overrides: Partial<Prompt> & { id: string; workspace_id: string }): Prompt {
  return {
    title: 'Untitled',
    content: '',
    current_version_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    is_favorite: false,
    status: 'active',
    metadata: { version_count: 0 },
    ...overrides,
  };
}

describe('DrizzlePromptRepository', () => {
  let workspaceA: string;
  let workspaceB: string;

  beforeEach(async () => {
    await resetDb();
    workspaceA = (await seedUser('user-a', 'a@example.com')).workspaceId;
    workspaceB = (await seedUser('user-b', 'b@example.com')).workspaceId;
  });

  it('creates and reads back a prompt with domain-shaped fields', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Hello', tags: ['x'] }));

    const found = await repo.findById('p1');
    expect(found?.title).toBe('Hello');
    expect(found?.tags).toEqual(['x']);
    expect(found?.metadata.version_count).toBe(0);
    expect(typeof found?.created_at).toBe('string');
  });

  it('returns null for a missing prompt', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  // THE ISOLATION GUARD — see spec section 2.
  it('never returns another workspace prompt', async () => {
    await repo.create(makePrompt({ id: 'secret', workspace_id: workspaceB, title: 'Private' }));

    const listed = await repo.findByWorkspaceId(workspaceA);
    expect(listed).toHaveLength(0);

    const searched = await repo.search(workspaceA, 'Private');
    expect(searched).toHaveLength(0);

    expect(await repo.countByWorkspaceId(workspaceA)).toBe(0);
  });

  it('finds by substring, matching current IndexedDB behavior', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Prompt Engineering' }));

    expect(await repo.search(workspaceA, 'prom')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'ENGINE')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'zzz')).toHaveLength(0);
  });

  it('searches description, content, and tags too', async () => {
    await repo.create(
      makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'A', description: 'about llamas', content: 'body text', tags: ['research'] })
    );

    expect(await repo.search(workspaceA, 'llamas')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'body')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'research')).toHaveLength(1);
  });

  it('treats % as a literal character, not a wildcard', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'plain title' }));
    expect(await repo.search(workspaceA, '%')).toHaveLength(0);
  });

  it('filters favorites and archived', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Fav', is_favorite: true }));
    await repo.create(makePrompt({ id: 'p2', workspace_id: workspaceA, title: 'Arch', status: 'archived' }));

    expect(await repo.findByWorkspaceId(workspaceA, { favoritesOnly: true })).toHaveLength(1);
    expect(await repo.findByWorkspaceId(workspaceA, { status: 'archived' })).toHaveLength(1);
  });

  it('sorts by title ascending', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Beta' }));
    await repo.create(makePrompt({ id: 'p2', workspace_id: workspaceA, title: 'Alpha' }));

    const sorted = await repo.findByWorkspaceId(workspaceA, { sortBy: 'title', sortOrder: 'asc' });
    expect(sorted.map((p) => p.title)).toEqual(['Alpha', 'Beta']);
  });

  it('updates and deletes', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Old' }));

    const updated = await repo.update('p1', { title: 'New', is_favorite: true });
    expect(updated.title).toBe('New');
    expect(updated.is_favorite).toBe(true);

    expect(await repo.delete('p1')).toBe(true);
    expect(await repo.delete('p1')).toBe(false);
  });

  it('throws NotFoundError when updating a missing prompt', async () => {
    await expect(repo.update('ghost', { title: 'x' })).rejects.toThrow('Prompt with id ghost not found');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest tests/db/prompt-repository.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/db/drizzle/prompt-repository'".

- [ ] **Step 4: Implement the repository**

Create `src/lib/db/drizzle/prompt-repository.ts`:

```ts
import { and, asc, desc, eq, ilike, or, sql, count } from 'drizzle-orm';
import type { Prompt } from '@/types';
import type { IPromptRepository } from '../repositories/types';
import { NotFoundError } from '../../errors';
import { getDb } from './client';
import { prompts } from './schema';
import { escapeLike, toPrompt } from './mappers';

type FindOptions = Parameters<IPromptRepository['findByWorkspaceId']>[1];

export class DrizzlePromptRepository implements IPromptRepository {
  async findById(id: string): Promise<Prompt | null> {
    const rows = await getDb().select().from(prompts).where(eq(prompts.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toPrompt(row);
  }

  async create(entity: Prompt): Promise<Prompt> {
    const [row] = await getDb()
      .insert(prompts)
      .values({
        id: entity.id,
        workspaceId: entity.workspace_id,
        title: entity.title,
        description: entity.description ?? null,
        content: entity.content,
        currentVersionId: entity.current_version_id === '' ? null : entity.current_version_id,
        tags: entity.tags,
        isFavorite: entity.is_favorite,
        status: entity.status,
        versionCount: entity.metadata.version_count,
      })
      .returning();
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return toPrompt(row);
  }

  async update(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) patch['title'] = updates.title;
    // An empty string is an explicit "clear this field"; absent means "leave unchanged".
    if (updates.description !== undefined) patch['description'] = updates.description === '' ? null : updates.description;
    if (updates.content !== undefined) patch['content'] = updates.content;
    if (updates.tags !== undefined) patch['tags'] = updates.tags;
    if (updates.is_favorite !== undefined) patch['isFavorite'] = updates.is_favorite;
    if (updates.status !== undefined) patch['status'] = updates.status;
    if (updates.current_version_id !== undefined) patch['currentVersionId'] = updates.current_version_id;

    const [row] = await getDb().update(prompts).set(patch).where(eq(prompts.id, id)).returning();
    if (row === undefined) {
      throw new NotFoundError('Prompt', id);
    }
    return toPrompt(row);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await getDb().delete(prompts).where(eq(prompts.id, id)).returning({ id: prompts.id });
    return deleted.length > 0;
  }

  async findByWorkspaceId(workspaceId: string, options?: FindOptions): Promise<Prompt[]> {
    const filters = [eq(prompts.workspaceId, workspaceId)];
    if (options?.favoritesOnly === true) filters.push(eq(prompts.isFavorite, true));
    if (options?.status !== undefined) filters.push(eq(prompts.status, options.status));

    const column =
      options?.sortBy === 'title' ? prompts.title : options?.sortBy === 'created_at' ? prompts.createdAt : prompts.updatedAt;
    const direction = options?.sortOrder === 'asc' ? asc : desc;

    let query = getDb().select().from(prompts).where(and(...filters)).orderBy(direction(column)).$dynamic();
    if (options?.limit !== undefined) query = query.limit(options.limit);
    if (options?.offset !== undefined) query = query.offset(options.offset);

    return (await query).map(toPrompt);
  }

  async search(
    workspaceId: string,
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Prompt[]> {
    const pattern = `%${escapeLike(query)}%`;
    let statement = getDb()
      .select()
      .from(prompts)
      .where(
        and(
          eq(prompts.workspaceId, workspaceId),
          or(
            ilike(prompts.title, pattern),
            ilike(prompts.description, pattern),
            ilike(prompts.content, pattern),
            sql`EXISTS (SELECT 1 FROM unnest(${prompts.tags}) AS tag WHERE tag ILIKE ${pattern})`
          )
        )
      )
      .orderBy(desc(prompts.updatedAt))
      .$dynamic();

    if (options?.limit !== undefined) statement = statement.limit(options.limit);
    if (options?.offset !== undefined) statement = statement.offset(options.offset);

    return (await statement).map(toPrompt);
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    const [row] = await getDb()
      .select({ value: count() })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId));
    return row?.value ?? 0;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/db/prompt-repository.db.test.ts`
Expected: PASS, 11 tests. If the `%` literal test fails, `escapeLike` is not being applied.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/drizzle/mappers.ts src/lib/db/drizzle/prompt-repository.ts tests/db/prompt-repository.db.test.ts
git commit -m "feat(db): add Drizzle prompt repository with substring search and workspace scoping"
```

---

### Task 5: Prompt version repository with a real atomic transaction

**Files:**
- Create: `src/lib/db/drizzle/prompt-version-repository.ts`, `tests/db/prompt-version-repository.db.test.ts`

**Interfaces:**
- Consumes: `getDb()`, `prompts`, `promptVersions`, `toPromptVersion()`
- Produces: `class DrizzlePromptVersionRepository implements IPromptVersionRepository`

**Behavioral contract for `createVersionAtomic(version, promptId)`:** it inserts the version, sets the prompt's `current_version_id`, increments `version_count`, and touches `updated_at` — all in one transaction. It **recomputes** `version_number` and `previous_version_id` inside that transaction and ignores whatever the caller passed, taking `SELECT ... FOR UPDATE` on the parent prompt row so concurrent calls serialize instead of colliding on the unique index. It returns the version as actually written.

- [ ] **Step 1: Write the failing test**

Create `tests/db/prompt-version-repository.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { DrizzlePromptVersionRepository } from '@/lib/db/drizzle/prompt-version-repository';
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import type { PromptVersion } from '@/types';
import { resetDb, seedUser } from './helpers';

const repo = new DrizzlePromptVersionRepository();

function makeVersion(id: string, promptId: string, content: string): PromptVersion {
  return {
    id,
    prompt_id: promptId,
    version_number: 1, // deliberately wrong — the repo must recompute it
    content,
    created_at: new Date().toISOString(),
  };
}

describe('DrizzlePromptVersionRepository', () => {
  beforeEach(async () => {
    await resetDb();
    const { workspaceId } = await seedUser();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'draft' });
  });

  it('assigns sequential version numbers, ignoring the caller value', async () => {
    const first = await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    const second = await repo.createVersionAtomic(makeVersion('v2', 'p1', 'two'), 'p1');

    expect(first.version_number).toBe(1);
    expect(second.version_number).toBe(2);
    expect(second.previous_version_id).toBe('v1');
  });

  it('updates the parent prompt in the same transaction', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');

    const [row] = await getDb().select().from(prompts).where(eq(prompts.id, 'p1'));
    expect(row?.currentVersionId).toBe('v1');
    expect(row?.versionCount).toBe(1);
  });

  it('rolls back completely when the prompt does not exist', async () => {
    await expect(repo.createVersionAtomic(makeVersion('v9', 'ghost', 'x'), 'ghost')).rejects.toThrow(
      'Prompt with id ghost not found'
    );
    expect(await repo.findByPromptId('ghost')).toHaveLength(0);
  });

  it('serializes concurrent version creation without collisions', async () => {
    const results = await Promise.all([
      repo.createVersionAtomic(makeVersion('a', 'p1', 'a'), 'p1'),
      repo.createVersionAtomic(makeVersion('b', 'p1', 'b'), 'p1'),
      repo.createVersionAtomic(makeVersion('c', 'p1', 'c'), 'p1'),
    ]);

    const numbers = results.map((v) => v.version_number).sort();
    expect(numbers).toEqual([1, 2, 3]);

    const [row] = await getDb().select().from(prompts).where(eq(prompts.id, 'p1'));
    expect(row?.versionCount).toBe(3);
  });

  it('lists versions newest first', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    await repo.createVersionAtomic(makeVersion('v2', 'p1', 'two'), 'p1');

    const all = await repo.findByPromptId('p1');
    expect(all.map((v) => v.version_number)).toEqual([2, 1]);
  });

  it('finds a specific version and the latest', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    await repo.createVersionAtomic(makeVersion('v2', 'p1', 'two'), 'p1');

    expect((await repo.findByVersion('p1', 1))?.content).toBe('one');
    expect((await repo.getLatestVersion('p1'))?.id).toBe('v2');
    expect(await repo.findByVersion('p1', 99)).toBeNull();
  });

  it('updates a version result', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    const updated = await repo.update('v1', { result: 'model output' });
    expect(updated.result).toBe('model output');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/db/prompt-version-repository.db.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the repository**

Create `src/lib/db/drizzle/prompt-version-repository.ts`:

```ts
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PromptVersion } from '@/types';
import type { IPromptVersionRepository } from '../repositories/types';
import { NotFoundError } from '../../errors';
import { getDb } from './client';
import { prompts, promptVersions } from './schema';
import { toPromptVersion } from './mappers';

export class DrizzlePromptVersionRepository implements IPromptVersionRepository {
  async findById(id: string): Promise<PromptVersion | null> {
    const rows = await getDb().select().from(promptVersions).where(eq(promptVersions.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toPromptVersion(row);
  }

  async create(entity: PromptVersion): Promise<PromptVersion> {
    const [row] = await getDb()
      .insert(promptVersions)
      .values({
        id: entity.id,
        promptId: entity.prompt_id,
        versionNumber: entity.version_number,
        content: entity.content,
        result: entity.result ?? null,
        changeSummary: entity.change_summary ?? null,
        previousVersionId: entity.previous_version_id ?? null,
      })
      .returning();
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return toPromptVersion(row);
  }

  async update(id: string, updates: Partial<PromptVersion>): Promise<PromptVersion> {
    const patch: Record<string, unknown> = {};
    if (updates.result !== undefined) patch['result'] = updates.result;
    if (updates.change_summary !== undefined) patch['changeSummary'] = updates.change_summary;
    if (updates.content !== undefined) patch['content'] = updates.content;

    const [row] = await getDb().update(promptVersions).set(patch).where(eq(promptVersions.id, id)).returning();
    if (row === undefined) {
      throw new NotFoundError('PromptVersion', id);
    }
    return toPromptVersion(row);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await getDb()
      .delete(promptVersions)
      .where(eq(promptVersions.id, id))
      .returning({ id: promptVersions.id });
    return deleted.length > 0;
  }

  async findByPromptId(
    promptId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PromptVersion[]> {
    let query = getDb()
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptId))
      .orderBy(desc(promptVersions.versionNumber))
      .$dynamic();

    if (options?.limit !== undefined) query = query.limit(options.limit);
    if (options?.offset !== undefined) query = query.offset(options.offset);

    return (await query).map(toPromptVersion);
  }

  async findByVersion(promptId: string, versionNumber: number): Promise<PromptVersion | null> {
    const rows = await getDb()
      .select()
      .from(promptVersions)
      .where(and(eq(promptVersions.promptId, promptId), eq(promptVersions.versionNumber, versionNumber)))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPromptVersion(row);
  }

  async getLatestVersion(promptId: string): Promise<PromptVersion | null> {
    const rows = await getDb()
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptId))
      .orderBy(desc(promptVersions.versionNumber))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPromptVersion(row);
  }

  /**
   * Inserts a version and updates its parent prompt atomically.
   *
   * version_number and previous_version_id are RECOMPUTED here and the caller's
   * values ignored. SELECT ... FOR UPDATE on the parent row serializes concurrent
   * calls, so two browser tabs cannot collide on the unique (prompt_id, version_number).
   */
  async createVersionAtomic(version: PromptVersion, promptId: string): Promise<PromptVersion> {
    return getDb().transaction(async (tx) => {
      const parents = await tx.select().from(prompts).where(eq(prompts.id, promptId)).for('update');
      const parent = parents[0];
      if (parent === undefined) {
        throw new NotFoundError('Prompt', promptId);
      }

      const latest = await tx
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.promptId, promptId))
        .orderBy(desc(promptVersions.versionNumber))
        .limit(1);
      const previous = latest[0];

      const [inserted] = await tx
        .insert(promptVersions)
        .values({
          id: version.id,
          promptId,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          content: version.content,
          result: version.result ?? null,
          changeSummary: version.change_summary ?? null,
          previousVersionId: previous?.id ?? null,
        })
        .returning();

      if (inserted === undefined) {
        throw new Error('Version insert returned no row');
      }

      await tx
        .update(prompts)
        .set({
          currentVersionId: inserted.id,
          versionCount: sql`${prompts.versionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(prompts.id, promptId));

      return toPromptVersion(inserted);
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/db/prompt-version-repository.db.test.ts`
Expected: PASS, 7 tests.

If the concurrency test fails with a unique-constraint error, `.for('update')` is missing or the reads are happening outside the transaction callback.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/drizzle/prompt-version-repository.ts tests/db/prompt-version-repository.db.test.ts
git commit -m "feat(db): add Drizzle version repository with row-locked atomic version creation"
```

---

### Task 6: Server Actions for the prompt library

**Files:**
- Create: `src/lib/actions/result.ts`, `src/lib/actions/prompts.ts`, `tests/db/prompt-actions.db.test.ts`

**Interfaces:**
- Consumes: `getCurrentContext()`, `DrizzlePromptRepository`, `DrizzlePromptVersionRepository`
- Produces (all return `Promise<ActionResult<T>>`):
  - `listPrompts(input: ListPromptsInput): Promise<ActionResult<{ prompts: Prompt[]; allTags: TagCount[] }>>`
  - `getPromptAction(id: string): Promise<ActionResult<{ prompt: Prompt; currentVersionResult: string }>>`
  - `createPromptAction(input: DraftInput): Promise<ActionResult<{ id: string }>>`
  - `updateDraftAction(id: string, input: DraftInput): Promise<ActionResult<Prompt>>`
  - `toggleFavoriteAction(id: string): Promise<ActionResult<null>>`
  - `duplicatePromptAction(id: string): Promise<ActionResult<null>>`
  - `archivePromptAction(id: string): Promise<ActionResult<null>>`
  - `deletePromptAction(id: string): Promise<ActionResult<null>>`
  - Types: `ActionResult<T>`, `DraftInput`, `ListPromptsInput`, `TagCount`

**Critical Next.js constraint:** a file with the `'use server'` directive may export **only async functions**. Types and the `run()` helper therefore live in `result.ts`, which has no directive.

- [ ] **Step 1: Write the result wrapper**

Create `src/lib/actions/result.ts`:

```ts
import { AppError } from '../errors';
import { logger } from '../logging';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface DraftInput {
  title: string;
  description?: string;
  content: string;
  tags: string[];
}

export interface ListPromptsInput {
  searchQuery?: string;
  filter?: 'all' | 'favorites' | 'archived';
  sortBy?: 'created_at' | 'updated_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Runs an action body, converting throws into a serializable result.
 * Next.js strips error messages in production, so we never throw across
 * the Server Action boundary — the user would only see "an error occurred".
 */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Server action failed', err);
    // AppError messages are written for users; anything else could leak internals.
    return { ok: false, error: err instanceof AppError ? err.message : 'Something went wrong. Please try again.' };
  }
}
```

- [ ] **Step 2: Write the failing action test**

Create `tests/db/prompt-actions.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { resetDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({ requireAuth: () => mockSession() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const actions = require('@/lib/actions/prompts') as typeof import('@/lib/actions/prompts');

function signInAs(id: string, email: string) {
  mockSession.mockResolvedValue({ user: { id, email, name: id, image: null } });
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error}`);
  return result.data;
}

describe('prompt actions', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  it('creates a prompt with its first version', async () => {
    signInAs('user-a', 'a@example.com');

    const { id } = unwrap(
      await actions.createPromptAction({ title: 'First', content: 'hello', tags: ['x'] })
    );
    const { prompt } = unwrap(await actions.getPromptAction(id));

    expect(prompt.title).toBe('First');
    expect(prompt.metadata.version_count).toBe(1);
    expect(prompt.current_version_id).not.toBe('');
  });

  // THE ISOLATION GUARD — user A must not reach user B's prompt.
  it('refuses to read another user prompt', async () => {
    signInAs('user-b', 'b@example.com');
    const { id } = unwrap(await actions.createPromptAction({ title: 'Secret', content: 's', tags: [] }));

    signInAs('user-a', 'a@example.com');
    const result = await actions.getPromptAction(id);

    expect(result.ok).toBe(false);
  });

  it('refuses to delete another user prompt', async () => {
    signInAs('user-b', 'b@example.com');
    const { id } = unwrap(await actions.createPromptAction({ title: 'Secret', content: 's', tags: [] }));

    signInAs('user-a', 'a@example.com');
    expect((await actions.deletePromptAction(id)).ok).toBe(false);

    signInAs('user-b', 'b@example.com');
    expect((await actions.getPromptAction(id)).ok).toBe(true);
  });

  it('lists only the signed-in user prompts, with tag counts', async () => {
    signInAs('user-b', 'b@example.com');
    await actions.createPromptAction({ title: 'B prompt', content: '', tags: ['shared'] });

    signInAs('user-a', 'a@example.com');
    await actions.createPromptAction({ title: 'A prompt', content: '', tags: ['shared', 'mine'] });

    const { prompts, allTags } = unwrap(await actions.listPrompts({}));
    expect(prompts).toHaveLength(1);
    expect(allTags).toEqual([
      { tag: 'mine', count: 1 },
      { tag: 'shared', count: 1 },
    ]);
  });

  it('hides archived prompts from the default view', async () => {
    signInAs('user-a', 'a@example.com');
    const { id } = unwrap(await actions.createPromptAction({ title: 'Old', content: '', tags: [] }));
    await actions.archivePromptAction(id);

    expect(unwrap(await actions.listPrompts({})).prompts).toHaveLength(0);
    expect(unwrap(await actions.listPrompts({ filter: 'archived' })).prompts).toHaveLength(1);
  });

  it('toggles favorite and filters by it', async () => {
    signInAs('user-a', 'a@example.com');
    const { id } = unwrap(await actions.createPromptAction({ title: 'Fav', content: '', tags: [] }));

    await actions.toggleFavoriteAction(id);
    expect(unwrap(await actions.listPrompts({ filter: 'favorites' })).prompts).toHaveLength(1);

    await actions.toggleFavoriteAction(id);
    expect(unwrap(await actions.listPrompts({ filter: 'favorites' })).prompts).toHaveLength(0);
  });

  it('duplicates a prompt into the same workspace', async () => {
    signInAs('user-a', 'a@example.com');
    await actions.createPromptAction({ title: 'Original', content: 'body', tags: [] });

    const [first] = unwrap(await actions.listPrompts({})).prompts;
    await actions.duplicatePromptAction(first!.id);

    const titles = unwrap(await actions.listPrompts({})).prompts.map((p) => p.title);
    expect(titles).toContain('Copy of Original');
  });

  it('searches by substring', async () => {
    signInAs('user-a', 'a@example.com');
    await actions.createPromptAction({ title: 'Engineering notes', content: '', tags: [] });

    expect(unwrap(await actions.listPrompts({ searchQuery: 'engine' })).prompts).toHaveLength(1);
    expect(unwrap(await actions.listPrompts({ searchQuery: 'zzz' })).prompts).toHaveLength(0);
  });

  it('fails cleanly when not signed in', async () => {
    mockSession.mockRejectedValue(new Error('Authentication required'));
    const result = await actions.listPrompts({});
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx jest tests/db/prompt-actions.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/actions/prompts'".

- [ ] **Step 4: Implement the actions**

Create `src/lib/actions/prompts.ts`:

```ts
'use server';

import type { Prompt } from '@/types';
import { getCurrentContext } from '../auth/context';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { NotFoundError } from '../errors';
import { generateId } from '../utils/id-generator';
import { now } from '../utils/datetime';
import { run, type ActionResult, type DraftInput, type ListPromptsInput, type TagCount } from './result';

const promptRepo = new DrizzlePromptRepository();
const versionRepo = new DrizzlePromptVersionRepository();

/**
 * Loads a prompt and proves it belongs to the caller's workspace.
 * Throws NotFoundError — never AuthorizationError — so the response cannot be
 * used to probe whether an id exists in someone else's workspace.
 */
async function requireOwnedPrompt(id: string, workspaceId: string): Promise<Prompt> {
  const prompt = await promptRepo.findById(id);
  if (prompt === null || prompt.workspace_id !== workspaceId) {
    throw new NotFoundError('Prompt', id);
  }
  return prompt;
}

export async function listPrompts(
  input: ListPromptsInput
): Promise<ActionResult<{ prompts: Prompt[]; allTags: TagCount[] }>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const { searchQuery = '', filter = 'all', sortBy = 'updated_at', sortOrder = 'desc' } = input;

    const all = await promptRepo.findByWorkspaceId(workspaceId);
    const tagCounts = new Map<string, number>();
    all.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
    const allTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));

    let results: Prompt[];
    if (searchQuery !== '') {
      results = await promptRepo.search(workspaceId, searchQuery);
      results.sort((a, b) => {
        const cmp = String(a[sortBy]).localeCompare(String(b[sortBy]));
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else {
      results = await promptRepo.findByWorkspaceId(workspaceId, {
        favoritesOnly: filter === 'favorites',
        ...(filter === 'archived' ? { status: 'archived' as const } : {}),
        sortBy,
        sortOrder,
      });
    }

    // Matches the existing IndexedDB behavior exactly: only the default view hides archived.
    if (filter === 'all') {
      results = results.filter((p) => p.status !== 'archived');
    }

    return { prompts: results, allTags };
  });
}

export async function getPromptAction(
  id: string
): Promise<ActionResult<{ prompt: Prompt; currentVersionResult: string }>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(id, workspaceId);

    let currentVersionResult = '';
    if (prompt.current_version_id !== '') {
      const version = await versionRepo.findById(prompt.current_version_id);
      currentVersionResult = version?.result ?? '';
    }
    return { prompt, currentVersionResult };
  });
}

export async function createPromptAction(input: DraftInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const id = generateId();
    const timestamp = now();

    await promptRepo.create({
      id,
      workspace_id: workspaceId,
      title: input.title,
      ...(input.description !== undefined && input.description !== '' ? { description: input.description } : {}),
      content: input.content,
      tags: input.tags,
      status: 'active',
      is_favorite: false,
      current_version_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { version_count: 0 },
    });

    await versionRepo.createVersionAtomic(
      {
        id: generateId(),
        prompt_id: id,
        version_number: 1,
        content: input.content,
        change_summary: 'Initial version',
        created_at: timestamp,
      },
      id
    );

    return { id };
  });
}

export async function updateDraftAction(id: string, input: DraftInput): Promise<ActionResult<Prompt>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    await requireOwnedPrompt(id, workspaceId);
    return promptRepo.update(id, {
      title: input.title,
      description: input.description ?? '', // '' clears it; undefined would mean "leave unchanged"
      content: input.content,
      tags: input.tags,
    });
  });
}

export async function toggleFavoriteAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(id, workspaceId);
    await promptRepo.update(id, { is_favorite: !prompt.is_favorite });
    return null;
  });
}

export async function archivePromptAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(id, workspaceId);
    await promptRepo.update(id, { status: prompt.status === 'archived' ? 'active' : 'archived' });
    return null;
  });
}

export async function deletePromptAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    await requireOwnedPrompt(id, workspaceId);
    await promptRepo.delete(id);
    return null;
  });
}

export async function duplicatePromptAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const source = await requireOwnedPrompt(id, workspaceId);
    const newId = generateId();
    const timestamp = now();

    await promptRepo.create({
      ...source,
      id: newId,
      title: `Copy of ${source.title}`,
      current_version_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { version_count: 0 },
    });

    await versionRepo.createVersionAtomic(
      {
        id: generateId(),
        prompt_id: newId,
        version_number: 1,
        content: source.content,
        change_summary: 'Duplicated',
        created_at: timestamp,
      },
      newId
    );

    return null;
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest tests/db/prompt-actions.db.test.ts`
Expected: PASS, 10 tests. The two isolation tests are the ones that matter most — if either fails, stop and fix before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/result.ts src/lib/actions/prompts.ts tests/db/prompt-actions.db.test.ts
git commit -m "feat(actions): add workspace-scoped prompt server actions"
```

---

### Task 7: Server Actions for version history

**Files:**
- Create: `src/lib/actions/versions.ts`, `tests/db/version-actions.db.test.ts`

**Interfaces:**
- Produces:
  - `listVersionsAction(promptId: string): Promise<ActionResult<PromptVersion[]>>`
  - `saveVersionAction(promptId: string, input: DraftInput & { changeSummary?: string; result?: string }): Promise<ActionResult<PromptVersion>>`
  - `saveCurrentAction(promptId: string, input: DraftInput & { result?: string }): Promise<ActionResult<null>>`
  - `updateVersionResultAction(promptId: string, versionId: string, result: string): Promise<ActionResult<null>>`
  - `restoreVersionAction(promptId: string, versionId: string): Promise<ActionResult<PromptVersion>>`

**Note on signatures:** every version action takes `promptId` as its first argument even when a `versionId` alone would identify the row. This is deliberate — ownership is checked on the parent prompt, so a caller cannot mutate a version by guessing its id.

- [ ] **Step 1: Write the failing test**

Create `tests/db/version-actions.db.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { resetDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({ requireAuth: () => mockSession() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const prompts = require('@/lib/actions/prompts') as typeof import('@/lib/actions/prompts');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const versions = require('@/lib/actions/versions') as typeof import('@/lib/actions/versions');

function signInAs(id: string, email: string) {
  mockSession.mockResolvedValue({ user: { id, email, name: id, image: null } });
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error}`);
  return result.data;
}

async function newPrompt(title = 'P', content = 'v1 body'): Promise<string> {
  return unwrap(await prompts.createPromptAction({ title, content, tags: [] })).id;
}

describe('version actions', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  it('saves a new version and bumps the prompt', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt();

    const version = unwrap(
      await versions.saveVersionAction(id, {
        title: 'P',
        content: 'v2 body',
        tags: [],
        changeSummary: 'second pass',
      })
    );

    expect(version.version_number).toBe(2);

    const { prompt } = unwrap(await prompts.getPromptAction(id));
    expect(prompt.metadata.version_count).toBe(2);
    expect(prompt.current_version_id).toBe(version.id);
  });

  it('lists versions newest first', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt();
    await versions.saveVersionAction(id, { title: 'P', content: 'v2', tags: [] });

    const list = unwrap(await versions.listVersionsAction(id));
    expect(list.map((v) => v.version_number)).toEqual([2, 1]);
  });

  it('saveCurrent updates the draft and the current version result without adding a version', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt();

    await versions.saveCurrentAction(id, { title: 'Renamed', content: 'edited', tags: ['t'], result: 'output' });

    const { prompt, currentVersionResult } = unwrap(await prompts.getPromptAction(id));
    expect(prompt.title).toBe('Renamed');
    expect(prompt.metadata.version_count).toBe(1);
    expect(currentVersionResult).toBe('output');
  });

  it('restores an old version as a new version', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt('P', 'original');
    await versions.saveVersionAction(id, { title: 'P', content: 'changed', tags: [] });

    const list = unwrap(await versions.listVersionsAction(id));
    const first = list.find((v) => v.version_number === 1);

    const restored = unwrap(await versions.restoreVersionAction(id, first!.id));
    expect(restored.version_number).toBe(3);
    expect(restored.content).toBe('original');
    expect(restored.change_summary).toBe('Restored from version 1');

    const { prompt } = unwrap(await prompts.getPromptAction(id));
    expect(prompt.content).toBe('original');
  });

  // THE ISOLATION GUARD.
  it('refuses to list or mutate versions of another user prompt', async () => {
    signInAs('user-b', 'b@example.com');
    const id = await newPrompt('Secret', 'private');
    const list = unwrap(await versions.listVersionsAction(id));
    const versionId = list[0]!.id;

    signInAs('user-a', 'a@example.com');
    expect((await versions.listVersionsAction(id)).ok).toBe(false);
    expect((await versions.saveVersionAction(id, { title: 'x', content: 'x', tags: [] })).ok).toBe(false);
    expect((await versions.updateVersionResultAction(id, versionId, 'hacked')).ok).toBe(false);
    expect((await versions.restoreVersionAction(id, versionId)).ok).toBe(false);
  });

  it('refuses a version that belongs to a different prompt', async () => {
    signInAs('user-a', 'a@example.com');
    const first = await newPrompt('One', 'a');
    const second = await newPrompt('Two', 'b');
    const otherVersion = unwrap(await versions.listVersionsAction(second))[0]!.id;

    expect((await versions.updateVersionResultAction(first, otherVersion, 'x')).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest tests/db/version-actions.db.test.ts`
Expected: FAIL — "Cannot find module '@/lib/actions/versions'".

- [ ] **Step 3: Implement the actions**

Create `src/lib/actions/versions.ts`:

```ts
'use server';

import type { Prompt, PromptVersion } from '@/types';
import { getCurrentContext } from '../auth/context';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { NotFoundError } from '../errors';
import { generateId } from '../utils/id-generator';
import { run, type ActionResult, type DraftInput } from './result';

const promptRepo = new DrizzlePromptRepository();
const versionRepo = new DrizzlePromptVersionRepository();

async function requireOwnedPrompt(id: string): Promise<Prompt> {
  const { workspaceId } = await getCurrentContext();
  const prompt = await promptRepo.findById(id);
  if (prompt === null || prompt.workspace_id !== workspaceId) {
    throw new NotFoundError('Prompt', id);
  }
  return prompt;
}

/** Ownership is proven via the parent prompt, never the version id alone. */
async function requireOwnedVersion(promptId: string, versionId: string): Promise<PromptVersion> {
  await requireOwnedPrompt(promptId);
  const version = await versionRepo.findById(versionId);
  if (version === null || version.prompt_id !== promptId) {
    throw new NotFoundError('PromptVersion', versionId);
  }
  return version;
}

export async function listVersionsAction(promptId: string): Promise<ActionResult<PromptVersion[]>> {
  return run(async () => {
    await requireOwnedPrompt(promptId);
    return versionRepo.findByPromptId(promptId);
  });
}

export async function saveVersionAction(
  promptId: string,
  input: DraftInput & { changeSummary?: string; result?: string }
): Promise<ActionResult<PromptVersion>> {
  return run(async () => {
    await requireOwnedPrompt(promptId);

    const version = await versionRepo.createVersionAtomic(
      {
        id: generateId(),
        prompt_id: promptId,
        version_number: 0, // recomputed inside the transaction
        content: input.content,
        ...(input.result !== undefined ? { result: input.result } : {}),
        ...(input.changeSummary !== undefined ? { change_summary: input.changeSummary } : {}),
        created_at: new Date().toISOString(),
      },
      promptId
    );

    await promptRepo.update(promptId, {
      title: input.title,
      description: input.description ?? '', // '' clears it; undefined would mean "leave unchanged"
      content: input.content,
      tags: input.tags,
    });

    return version;
  });
}

export async function saveCurrentAction(
  promptId: string,
  input: DraftInput & { result?: string }
): Promise<ActionResult<null>> {
  return run(async () => {
    const prompt = await requireOwnedPrompt(promptId);

    await promptRepo.update(promptId, {
      title: input.title,
      description: input.description ?? '', // '' clears it; undefined would mean "leave unchanged"
      content: input.content,
      tags: input.tags,
    });

    if (prompt.current_version_id !== '') {
      await versionRepo.update(prompt.current_version_id, {
        content: input.content,
        ...(input.result !== undefined ? { result: input.result } : {}),
      });
    }
    return null;
  });
}

export async function updateVersionResultAction(
  promptId: string,
  versionId: string,
  result: string
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireOwnedVersion(promptId, versionId);
    await versionRepo.update(versionId, { result });
    return null;
  });
}

export async function restoreVersionAction(
  promptId: string,
  versionId: string
): Promise<ActionResult<PromptVersion>> {
  return run(async () => {
    const source = await requireOwnedVersion(promptId, versionId);

    const restored = await versionRepo.createVersionAtomic(
      {
        id: generateId(),
        prompt_id: promptId,
        version_number: 0, // recomputed inside the transaction
        content: source.content,
        change_summary: `Restored from version ${source.version_number}`,
        created_at: new Date().toISOString(),
      },
      promptId
    );

    await promptRepo.update(promptId, { content: source.content });
    return restored;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest tests/db/version-actions.db.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/versions.ts tests/db/version-actions.db.test.ts
git commit -m "feat(actions): add version history server actions with parent-prompt ownership checks"
```

---

### Task 8: Rewire the hooks to call Server Actions

**Files:**
- Modify: `src/hooks/usePrompts.ts`, `src/hooks/usePrompt.ts`, `src/hooks/useVersions.ts`

**Interfaces:**
- Consumes: every action from Tasks 6 and 7
- Produces: **unchanged public hook APIs.** Components must not need edits. `usePrompts` additionally returns `error: string | null`; the others gain `error` too. Adding a return field is backward-compatible.

**Approach:** replace repository calls with action calls, unwrap `ActionResult`, and delete the local `generateId`/`now`/`DEFAULT_WORKSPACE_ID` bookkeeping the server now owns. Auto-save debounce goes from 5s to 1.5s — the risk it guarded against (blocking the UI thread) no longer applies, and a network save should feel prompt.

- [ ] **Step 1: Rewrite `usePrompts.ts`**

```ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '@/types';
import type { TagCount } from '@/lib/actions/result';
import {
  listPrompts,
  toggleFavoriteAction,
  duplicatePromptAction,
  archivePromptAction,
  deletePromptAction,
} from '@/lib/actions/prompts';
import { useDebounce } from './useDebounce';

interface UsePromptsOptions {
  searchQuery?: string;
  filter?: 'all' | 'favorites' | 'archived';
  sortBy?: 'updated_at' | 'created_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export function usePrompts(options: UsePromptsOptions = {}) {
  const { searchQuery = '', filter = 'all', sortBy = 'updated_at', sortOrder = 'desc' } = options;
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [allTags, setAllTags] = useState<TagCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listPrompts({ searchQuery: debouncedQuery, filter, sortBy, sortOrder });
    if (result.ok) {
      setPrompts(result.data.prompts);
      setAllTags(result.data.allTags);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [debouncedQuery, filter, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const runThenReload = useCallback(
    async (action: (id: string) => Promise<{ ok: boolean; error?: string }>, id: string) => {
      const result = await action(id);
      if (!result.ok) {
        setError(result.error ?? 'Action failed');
        return;
      }
      await load();
    },
    [load]
  );

  const toggleFavorite = useCallback((id: string) => runThenReload(toggleFavoriteAction, id), [runThenReload]);
  const duplicatePrompt = useCallback((id: string) => runThenReload(duplicatePromptAction, id), [runThenReload]);
  const archivePrompt = useCallback((id: string) => runThenReload(archivePromptAction, id), [runThenReload]);
  const deletePrompt = useCallback((id: string) => runThenReload(deletePromptAction, id), [runThenReload]);

  return { prompts, loading, error, allTags, toggleFavorite, duplicatePrompt, archivePrompt, deletePrompt, reload: load };
}
```

- [ ] **Step 2: Rewrite the data paths in `usePrompt.ts`**

Replace the imports:

```ts
import { getPromptAction, createPromptAction, updateDraftAction } from '@/lib/actions/prompts';
import { saveVersionAction, saveCurrentAction } from '@/lib/actions/versions';
```

Delete the `getPromptRepository`, `getPromptVersionRepository`, `DEFAULT_WORKSPACE_ID`, and `generateId` imports. Keep `now` (still used for `lastSaved` display).

Replace the load effect body:

```ts
    const loadPrompt = async () => {
      setLoading(true);
      const result = await getPromptAction(promptId);
      if (result.ok) {
        const { prompt: existing, currentVersionResult: result_ } = result.data;
        setPrompt(existing);
        setDraft({
          title: existing.title,
          description: existing.description ?? '',
          content: existing.content,
          tags: existing.tags,
        });
        setCurrentVersionResult(result_);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
```

Add `const [error, setError] = useState<string | null>(null);` alongside the other state, and return `error` from the hook.

Replace the auto-save timer body (and change `5000` to `1500`):

```ts
    autoSaveTimer.current = setTimeout(async () => {
      const result = await updateDraftAction(prompt.id, {
        title: draft.title,
        description: draft.description,
        content: draft.content,
        tags: draft.tags,
      });
      if (result.ok) {
        setLastSaved(now());
        setHasUnsavedChanges(false);
      } else {
        setError(result.error);
      }
    }, 1500);
```

Replace `createPrompt`:

```ts
  const createPrompt = useCallback(async (): Promise<string> => {
    setSaving(true);
    const result = await createPromptAction({
      title: draft.title,
      description: draft.description,
      content: draft.content,
      tags: draft.tags,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      throw new Error(result.error);
    }
    setLastSaved(now());
    setHasUnsavedChanges(false);
    return result.data.id;
  }, [draft]);
```

Replace `saveVersion`:

```ts
  const saveVersion = useCallback(
    async (changeSummary?: string, result?: string) => {
      if (!prompt) return;
      setSaving(true);

      const saved = await saveVersionAction(prompt.id, {
        title: draft.title,
        description: draft.description,
        content: draft.content,
        tags: draft.tags,
        ...(changeSummary !== undefined ? { changeSummary } : {}),
        ...(result !== undefined ? { result } : {}),
      });
      setSaving(false);

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      const refreshed = await getPromptAction(prompt.id);
      if (refreshed.ok) {
        setPrompt(refreshed.data.prompt);
        setCurrentVersionResult(refreshed.data.currentVersionResult);
      }
      setLastSaved(now());
      setHasUnsavedChanges(false);
    },
    [draft, prompt]
  );
```

Replace `saveCurrent`:

```ts
  const saveCurrent = useCallback(
    async (result?: string) => {
      if (!prompt) return;
      setSaving(true);

      const saved = await saveCurrentAction(prompt.id, {
        title: draft.title,
        description: draft.description,
        content: draft.content,
        tags: draft.tags,
        ...(result !== undefined ? { result } : {}),
      });
      setSaving(false);

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      const refreshed = await getPromptAction(prompt.id);
      if (refreshed.ok) {
        setPrompt(refreshed.data.prompt);
        setCurrentVersionResult(refreshed.data.currentVersionResult);
      }
      setLastSaved(now());
      setHasUnsavedChanges(false);
      setDirty(false);
    },
    [draft, prompt]
  );
```

- [ ] **Step 3: Rewrite `useVersions.ts`**

Replace the repository imports with:

```ts
import { listVersionsAction, updateVersionResultAction, restoreVersionAction } from '@/lib/actions/versions';
```

Delete the `generateId` and `now` imports. Replace `load`, `updateResult`, and `restoreVersion`:

```ts
  const load = useCallback(async () => {
    setLoading(true);
    const result = await listVersionsAction(promptId);
    if (result.ok) {
      setVersions(result.data);
      setSelected((prev) => prev ?? result.data[0] ?? null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [promptId]);

  const updateResult = useCallback(
    async (versionId: string, result: string) => {
      const saved = await updateVersionResultAction(promptId, versionId, result);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      setVersions((prev) => prev.map((v) => (v.id === versionId ? { ...v, result } : v)));
      setSelected((prev) => (prev && prev.id === versionId ? { ...prev, result } : prev));
    },
    [promptId]
  );

  const restoreVersion = useCallback(
    async (version: PromptVersion) => {
      const restored = await restoreVersionAction(promptId, version.id);
      if (!restored.ok) {
        setError(restored.error);
        return;
      }
      await load();
      setSelected(restored.data);
    },
    [promptId, load]
  );
```

Add `const [error, setError] = useState<string | null>(null);` and include `error` in the returned object.

- [ ] **Step 4: Verify the whole suite, types, and lint**

Run: `npm run type-check && npm run lint && npx jest`
Expected: all pass. If a component breaks on types, a hook's public shape changed — fix the hook, not the component.

- [ ] **Step 5: Manual smoke test against Neon**

```bash
npm run dev
```

Sign in with Google. Create a prompt, edit it, save a version, restore an older version, favorite it, search for it, delete it. Then open a private window, sign in with a **different** Google account, and confirm the library is empty.

- [ ] **Step 6: Commit**

```bash
git add src/hooks
git commit -m "feat(hooks): call server actions instead of IndexedDB repositories"
```

---

### Task 9: Remove IndexedDB, update CI and docs

**Files:**
- Delete: `src/lib/db/client.ts`, `src/lib/db/schema.ts`, `src/lib/db/migrations.ts`, `src/lib/db/repositories/indexeddb-user.ts`, `indexeddb-workspace.ts`, `indexeddb-prompt.ts`, `indexeddb-prompt-version.ts`, `src/lib/db/repositories/factory.ts`, `src/lib/constants.ts`
- Keep: `src/lib/db/repositories/types.ts`
- Modify: `.github/workflows/test.yml`, `README.md`

- [ ] **Step 1: Confirm nothing still imports the old layer**

```bash
grep -rn "indexeddb\|DEFAULT_WORKSPACE_ID\|repositories/factory\|db/client\|db/migrations" src/ __tests__/ tests/
```

Expected: no matches. Any hit must be fixed before deleting.

- [ ] **Step 2: Delete the IndexedDB layer**

```bash
git rm src/lib/db/client.ts src/lib/db/schema.ts src/lib/db/migrations.ts \
       src/lib/db/repositories/indexeddb-user.ts \
       src/lib/db/repositories/indexeddb-workspace.ts \
       src/lib/db/repositories/indexeddb-prompt.ts \
       src/lib/db/repositories/indexeddb-prompt-version.ts \
       src/lib/db/repositories/factory.ts \
       src/lib/constants.ts
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run type-check && npm run lint && npx jest`
Expected: all pass.

- [ ] **Step 4: Add Postgres to CI**

In `.github/workflows/test.yml`, add a `services` block to the `test` job (a sibling of `runs-on`) and a migration step before `Test`:

```yaml
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: prompt_saver_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
```

```yaml
      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL_UNPOOLED: postgresql://postgres:postgres@localhost:5432/prompt_saver_test
```

Add an `env` block to both the `Test` and `Build` steps:

```yaml
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/prompt_saver_test
          DATABASE_URL_UNPOOLED: postgresql://postgres:postgres@localhost:5432/prompt_saver_test
          NEXTAUTH_SECRET: ci-placeholder-secret
          NEXTAUTH_URL: http://localhost:3000
```

Also add the branch `server-database-migration` to the `on.push.branches` and `on.pull_request.branches` lists so CI runs before merge.

- [ ] **Step 5: Update the README**

Three claims are now false. In the Features/Technology sections replace the storage line:

```
- **Storage**: Neon Postgres via Drizzle ORM (server-side, per-user isolated)
```

Replace the opening description "A local-first prompt management tool" with "A prompt management tool". In **Architecture Decisions**, replace the Repository Pattern paragraph:

```
### Repository Pattern

Database access is confined to repository classes implementing the interfaces in
`src/lib/db/repositories/types.ts`. Server Actions are the only callers; client
components never touch the database.

### Workspace Isolation

Every user gets one private workspace, created on first sign-in. All queries are
scoped to the workspace id returned by `getCurrentContext()` — never to a value
supplied by the client.
```

In the Roadmap, delete "Firestore (Future)" wherever it appears. Add to Setup, after the existing env vars:

```env
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
ALLOWED_EMAILS=you@example.com
```

with the note: **leaving `ALLOWED_EMAILS` unset lets anyone with a Google account sign in.**

- [ ] **Step 6: Set the production environment variables**

In the Vercel dashboard → Project → Settings → Environment Variables, add to **Production, Preview, and Development**:

- `DATABASE_URL` — the Neon **pooled** string
- `DATABASE_URL_UNPOOLED` — the Neon **direct** string
- `ALLOWED_EMAILS` — your email, plus any invited ones, comma-separated

**Do not skip `ALLOWED_EMAILS`.** Unset means anyone with a Google account can sign in and get a workspace.

- [ ] **Step 7: Commit and deploy**

```bash
git add -A
git commit -m "refactor: remove IndexedDB layer, add postgres to CI, update docs"
git push origin server-database-migration
```

Then, per `CLAUDE.md`:

```bash
git checkout main && git merge server-database-migration && git push origin main
git checkout server-database-migration
```

- [ ] **Step 8: Verify production**

Open https://prompt-saver-two.vercel.app/, sign in, create a prompt. Open it on a second device, sign in with the same account, and confirm the prompt is there. Sign in with an address absent from `ALLOWED_EMAILS` and confirm rejection.

---

## Verification Checklist

Maps to the spec's section 10 success criteria:

- [ ] Same account on two devices shows the same prompts (Task 9, Step 8)
- [ ] A second allowlisted account sees an empty library (Task 6 isolation tests; Task 8, Step 5)
- [ ] An unlisted email is refused at sign-in (Task 2; Task 9, Step 8)
- [ ] Version creation is atomic; failures leave neither row (Task 5)
- [ ] Search still matches substrings (Task 4)
- [ ] No IndexedDB code remains in `src/` (Task 9, Step 1)
- [ ] `npm run type-check && npm run lint && npm run format:check && npx jest && npm run build` all pass
