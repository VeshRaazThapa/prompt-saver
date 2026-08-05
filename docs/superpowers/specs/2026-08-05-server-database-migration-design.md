# Server Database Migration — Design Spec

**Date:** 2026-08-05
**Status:** Approved
**Author:** Claude + Bhesh
**Project:** Prompt Saver

---

## 1. Overview

### What

Move all persistence from browser-local IndexedDB to a hosted Postgres database (Neon), so the
Vercel deployment stores data server-side. Prompts follow the user across devices instead of
living in one browser profile.

### Why

Today every browser holds a separate, private copy of the data. Sign in from a phone and the
library is empty; clear site data and the prompts are gone. There is no shared source of truth.

### Scope

- Neon Postgres as the single source of truth
- Drizzle ORM, schema and migrations versioned in the repo
- Next.js Server Actions as the client/server boundary
- Per-user data isolation enforced server-side
- Email allowlist gating sign-in
- Complete removal of the IndexedDB layer

### Out of Scope

- Data migration from existing browsers (confirmed: nothing worth keeping)
- Offline support and two-way sync
- Sharing, collaboration, quotas, billing
- Multi-workspace UI. **Every user gets their own private workspace**, created on first sign-in
  and never shared. The schema permits several workspaces per user; the UI exposes only the one.
  Enforced by `getCurrentContext()` (§6) rather than a DB constraint, so adding real
  multi-workspace support later is additive and needs no migration.

### Constraints

- **No payment method on any service.** Neon free tier and Vercel Hobby both allow signup
  without a credit card.
- Small trusted group initially (owner plus a few invited people), with room to open up later.

---

## 2. Critical Context: The Isolation Bug

`src/lib/constants.ts` hardcodes `DEFAULT_WORKSPACE_ID = 'default'`, and
`src/lib/auth/config.ts` has `signIn()` returning `true` unconditionally.

Today this is harmless — each browser has a private IndexedDB, so "workspace default" means
"this browser's data." **The moment those same queries hit one shared server database, every
signed-in user reads and writes the same rows.**

Per-user scoping is therefore not an enhancement to schedule later. It is a precondition of
this migration, and the design treats it as such.

---

## 3. Architecture

### Current

```
Client component (usePrompts)
  → getPromptRepository()        ← runs in the browser
    → IndexedDB
```

### Target

```
Client component (usePrompts)
  → Server Action                ← session resolved here, server-side only
    → DrizzlePromptRepository    ← server-only
      → Neon Postgres
```

The repository interfaces in `src/lib/db/repositories/types.ts` are unchanged. They were built
for this swap; only the implementations move.

### Why Server Actions over REST API routes

The hooks already call repository methods as plain async functions, so an action is close to a
drop-in replacement: no fetch wrappers, no hand-written JSON serialization, no route boilerplate,
and types flow end-to-end without duplication.

REST routes under `/api/prompts` remain worthwhile only if a non-browser client needs an HTTP API
later. That can be layered on top without redoing this work.

### The isolation rule

**Every action resolves the user from `getServerSession()` on the server. The workspace id is
derived from that user. The client never supplies a `user_id` or `workspace_id` that the server
trusts.**

A hand-crafted request cannot address another user's rows, because the identifiers are never
accepted as input.

Access control lives in the action layer rather than in the database (as Supabase RLS would
provide). This is a deliberate trade to keep the existing NextAuth setup. It is sound as long as
every action performs the session lookup, so that lookup is one shared helper — not logic
re-implemented per action.

---

## 4. Database Choice

**Neon Postgres.** Free tier: 0.5 GB storage per project, 100 CU-hours/month, no credit card,
no expiry, commercial use permitted. Compute scales to zero after ~5 minutes idle and **wakes
automatically** on the next query.

### Why not the alternatives

| Option | Reason rejected |
|---|---|
| **Supabase** | Row Level Security is a genuine safety win, but RLS keys off Supabase Auth's JWT while this app uses NextAuth + Google — bridging means migrating auth or minting custom JWTs. Decisive factor: free projects **pause after 7 days without queries and need manual resume**, which is exactly this app's traffic pattern. |
| **MongoDB Atlas M0** | Types are document-shaped, but the prompt/version relationship is genuinely relational, and M0 is shared-CPU. |
| **Firestore** (the README's stated Phase 2 target) | **No native full-text search**, which `IPromptRepository.search()` requires. Would need Algolia or client-side filtering. The documented roadmap is wrong and this spec supersedes it. |

Three properties of the existing code drove the decision: `search()` needs full-text search,
`createVersionAtomic()` needs real transactions, and `Prompt → PromptVersion` is a foreign-key
relationship with a `previous_version_id` chain.

### Provisioning: direct signup, not the Vercel Marketplace

Neon is provisioned at neon.com and the connection string pasted into Vercel's environment
variables by hand. The Vercel Marketplace path links the integration to Vercel billing and can
prompt for a payment method even when the underlying plan is free. One extra manual step buys an
unambiguously card-free setup.

---

## 5. Schema

```
users            id (Google `sub`, PK) · email · name · avatar · created_at · last_login

workspaces       id · user_id → users(id) · name · settings · metadata
                 created_at · updated_at

prompts          id · workspace_id → workspaces(id) · title · description · content
                 current_version_id · tags (text[]) · is_favorite · status · metadata
                 created_at · updated_at

prompt_versions  id · prompt_id → prompts(id) ON DELETE CASCADE · version_number
                 content · result · change_summary · previous_version_id · created_at
                 UNIQUE (prompt_id, version_number)
```

This mirrors `src/types/*.ts` closely, so the TypeScript types barely change.

### Decisions

- **`tags` stays a Postgres `text[]`**, not a join table. `usePrompts` builds a tag cloud by
  reading tags off every prompt; a native array keeps that one query and GIN-indexes fine. A join
  table would be more relationally correct and buy nothing here.
- **`ON DELETE CASCADE` on versions.** Deleting a prompt removes its history, matching current
  behavior. Irreversible by design; revisit if soft-delete is ever wanted.
- **Drop `tier` and `subscription_id` from `User`.** They reference Stripe billing that does not
  exist. Add them when billing does.

---

## 6. Auth and User Identity

Google's `sub` claim is stable per user forever and already present on the JWT, so it becomes the
`users.id` primary key. No new identity system, no later migration.

### Session carries the id

The `session` callback sets `session.user.id = token.sub`, with types augmented in the existing
`src/lib/auth/types.ts`. All server-side scoping keys off this.

### Allowlist replaces `signIn: () => true`

`ALLOWED_EMAILS`, comma-separated. The callback checks the Google-verified email and returns
`false` otherwise, which NextAuth renders on the existing `/app/auth/error` page.

**When `ALLOWED_EMAILS` is unset, the app is open to anyone.** That is the intended public
switch — going from trusted group to public means deleting an env var, not changing code. It also
keeps local development frictionless.

The risk is the inverse: forgetting to set it in production leaves the app silently open.
Setting it is an explicit, non-optional deploy step in the rollout.

### Lazy bootstrap: `getCurrentContext()`

One helper that reads the session, upserts the user row, ensures exactly one workspace exists,
and returns `{ userId, workspaceId }`. Every Server Action begins with this call and scopes
queries to the returned `workspaceId`.

> **Amended before implementation.** This originally specified wrapping the helper in React's
> `cache()` for per-request memoization. The project runs React 18.3.1, which has no `cache`
> export, and upgrading React mid-migration would entangle UI regressions with database bugs.
> Dropped: each Server Action is its own request and calls the helper once, so there was nothing
> to memoize.

**Why lazy rather than provisioning in the `signIn` callback:** if a bootstrap write fails during
sign-in, the user holds a valid session with no workspace and the app stays broken for them until
someone intervenes. Lazy creation is self-healing — the next request repairs it.

This helper is the chokepoint the whole isolation model rests on: one function to review, one
place to get right.

---

## 7. Repository Implementation Notes

### `search()` — ILIKE with a `pg_trgm` GIN index

Postgres full-text search (`tsvector`) does word stemming but **not substrings**, so typing
"prom" would not match "prompt". The UI searches as you type on a 300ms debounce, so that would
read as broken.

`ILIKE '%query%'` across title/description/content, plus array overlap for tags, backed by a
`pg_trgm` GIN index. This preserves exactly the substring behavior users have now, stays indexed,
and performs well past the realistic prompt count.

If real scale ever arrives, swapping in `tsvector` is contained behind the repository interface.

### `createVersionAtomic()` — a real transaction

The IndexedDB implementation is a nested callback chain where a mid-way failure can leave the
prompt pointing at a version that never finished writing. In Postgres this is one
`db.transaction()`: insert the version, update the prompt's `current_version_id`,
`version_count`, and `updated_at` — all or nothing.

**New hazard:** concurrent requests could compute the same `version_number` and collide on
`UNIQUE (prompt_id, version_number)`. Mitigation is `SELECT ... FOR UPDATE` on the parent prompt
row inside the transaction, serializing version creation per prompt. Nearly impossible to hit
with one user in one tab; trivial to hit with two tabs open.

### Error handling

`NotFoundError` stays. New failure modes are network-shaped: cold-start timeouts, connection
limits, constraint violations.

Actions return a typed result — `{ ok: true, data }` or `{ ok: false, error }` — rather than
throwing across the Server Action boundary, because Next.js strips error messages in production
and users would see only a generic failure. The hooks already track `loading` and gain an `error`
branch.

---

## 8. Testing

| Layer | Environment | Contents |
|---|---|---|
| Unit | jsdom (existing) | Version numbering, query building, tag counting — no DB |
| Repository | node (new Jest project) | Real Postgres via GitHub Actions `services: postgres` |
| Actions | node | Called directly as functions with a stubbed session |

Running repository tests against a Postgres service container in CI is free, needs no Docker
knowledge, and does not burn Neon compute quota on every run.

**Required test:** user A's session must not read or write user B's prompt. This is the
regression guard on the isolation bug in section 2 and ships with the first repository.

---

## 9. Deployment

### Two connection strings — the common failure

Neon issues both a pooled and a direct connection string.

- **`DATABASE_URL` — pooled** (`-pooler` in the host). Required by the app: each serverless
  invocation opens its own connection, and the direct string exhausts Postgres's connection
  limit under any concurrency.
- **`DATABASE_URL_UNPOOLED` — direct.** Required by Drizzle migrations, because pooled
  connections do not support the session-level locks migrations take.

Additionally: the DB client must not connect at module top level in a way that runs during
`next build`, or Vercel builds fail before the env vars are even consulted.

### Vercel free tier

Hobby covers this app's resources comfortably: 100 GB bandwidth, 4 CPU-hours active compute,
6,000 build minutes, 10s max function duration. Operations are single-digit-millisecond CRUD.

**Licensing caveat:** the Hobby plan is **non-commercial, single-developer only**, and Vercel
defines commercial broadly — including a paid freelancer or consultant writing the code, not
merely whether the site charges money. If this project earns money or is built as paid work,
Vercel's terms require Pro at $20/seat/month. Nothing breaks technically. Neon carries no such
restriction; its free tier explicitly permits commercial use.

**Known latency trade:** after ~5 minutes idle, the first query wakes Neon's compute, adding
roughly 0.5–1s to that single request. Acceptable for a personal tool.

### Rollout order

Sequenced so nothing is deleted before its replacement works. No dual-write phase and no
migration script — a clean cutover, since there is no data to preserve.

1. Sign up at neon.com, create the project, collect both connection strings
2. Add `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `ALLOWED_EMAILS` to Vercel (Production, Preview,
   Development) and to `.env.local`; update `.env.example`
3. Add Drizzle, define the schema, generate and run the first migration
4. Build `getCurrentContext()` and the Drizzle repositories, with tests
5. Build the Server Actions
6. Point `usePrompts`, `usePrompt`, and `useVersions` at the actions
7. **Only now** delete `src/lib/db/client.ts`, `schema.ts`, `migrations.ts`, the four
   `indexeddb-*.ts` repositories, and `DEFAULT_WORKSPACE_ID`
8. Update `README.md` — "local-first", the IndexedDB storage claim, and the Firestore roadmap all
   stop being true
9. Deploy per `CLAUDE.md`: push branch → merge to main → Vercel auto-deploys

---

## 10. Success Criteria

- Signing in on two different devices shows the same prompts
- A second allowlisted account sees an empty library, never the first account's prompts
- An email absent from `ALLOWED_EMAILS` is refused at sign-in
- Creating a version updates the prompt and inserts the version atomically; a failure leaves
  neither
- Search returns substring matches, as it does today
- No IndexedDB code remains in `src/`
- CI passes: type-check, lint, tests, build
