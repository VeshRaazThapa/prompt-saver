# MCP Server — Design Spec

**Date:** 2026-08-07
**Status:** Approved
**Author:** Claude + Bhesh
**Project:** Prompt Saver

---

## 1. Overview

### What

A remote MCP server at `/api/mcp`, hosted alongside the app on Vercel, exposing a user's saved
prompts to Claude Code sessions — favourites as slash commands, the whole library as searchable
tools, with full read/write.

### Why

The workflow this serves: plan the day, write a prompt for each task, then feed those prompts
into different Claude Code sessions without retyping or tab-switching. Today the prompts live in
a web app the terminal cannot reach.

### Scope

- Remote HTTP MCP server, stateless, via Vercel's `mcp-handler`
- API-token authentication with a settings UI to mint and revoke
- MCP **prompts**: favourited prompts become `/mcp__prompt-saver__<slug>`
- MCP **tools**: search, get, create, update, save-version
- A parallel isolation test suite covering the new authentication path

### Out of Scope

- `{{variable}}` templating (deferred — needs web-app UI support to be discoverable; inventing
  syntax only the MCP path understands would make the two surfaces disagree about what a prompt is)
- OAuth 2.0 (implementing an authorization server is a larger project than this one)
- Rate limiting (accepted risk, see §6)
- Deleting prompts via MCP

### Constraints

- The app has **no API today**. Every existing entry point is a `'use server'` Server Action,
  callable only from its own client bundle via encrypted action IDs. This build creates the first
  externally reachable data path.

---

## 2. Critical Context: A Second Door

The entire cross-user isolation guarantee currently funnels through one function.
`getCurrentContext()` calls `requireAuth()` → NextAuth session → `session.user.id`. Every Server
Action begins there, and that is what makes it safe.

**An MCP request has no NextAuth session.** So this build necessarily opens a second entrance to
the same data, and getting it wrong reintroduces exactly the bug the Postgres migration existed
to fix (see `2026-08-05-server-database-migration-design.md` §2).

The mitigation is convergence: `resolveTokenContext(token)` returns the **same
`{ userId, workspaceId }` shape** as `getCurrentContext()`. Both entrances produce one type
immediately, and everything downstream — `requireOwnedPrompt`, the Drizzle repositories, the
workspace scoping — is reused unchanged rather than reimplemented.

```
Claude Code  --HTTP + Bearer token-->  /api/mcp  (mcp-handler)
                                          |
                                  resolveTokenContext(token)
                                          |
                                  { userId, workspaceId }     <-- same shape as getCurrentContext()
                                          |
                       existing ownership helper + Drizzle repositories
```

**The MCP layer never handles an id it did not obtain through that resolver.**

Existing isolation tests cover the Server Action path only. A parallel suite for the token path
is part of this work, not a follow-up.

---

## 3. Transport and Framework

**Vercel's `mcp-handler`**, a drop-in MCP adapter for Next.js App Router. v2 serves the current
MCP spec statelessly with **no Redis or session storage**, which matters because a stateful MCP
server on serverless would otherwise need external session state.

HTTP is Claude Code's recommended remote transport. Registration is one command per machine:

```bash
claude mcp add --transport http prompt-saver https://prompt-saver-two.vercel.app/api/mcp \
  --header "Authorization: Bearer ps_..."
```

Use `--scope user` so the server is available in every project rather than one.

---

## 4. The MCP Surface

### Prompts → slash commands

Every **favourited** prompt becomes `/mcp__prompt-saver__<slug>`.

`is_favorite` already exists on the `Prompt` type and already has a star in the UI, so the
selection rule needs no new field and no new concept. Starring a prompt promotes it to a command.

- Slug derives from the title: "Daily Planning" → `daily-planning`
- Collisions get a short, **deterministic** id suffix so commands do not shuffle between sessions
- Each accepts one optional `context` argument, appended to the body:
  `/mcp__prompt-saver__daily-planning auth refactor`

### Tools

| Tool | Backed by | Returns |
|---|---|---|
| `search_prompts(query, limit?)` | `DrizzlePromptRepository.search` | Summaries only |
| `get_prompt(id)` | `findById` + ownership check | Full content |
| `create_prompt(title, content, description?, tags?)` | `createWithFirstVersion` | New id |
| `update_prompt(id, …)` | `update` | Updated prompt |
| `save_version(id, content, change_summary?)` | `createVersionAtomic` | New version |

**No new database logic.** The write tools reuse the exact code already reviewed and tested,
including `createWithFirstVersion`'s transaction and `createVersionAtomic`'s row lock.

### Two hard limits

**`search_prompts` returns summaries only** — id, title, description, tags, updated_at — never
bodies. `limit` defaults to 20, capped at 50. Claude Code warns past 10k tokens of tool output
and truncates at 25k; a truncated JSON response is worse than a smaller one because the model
receives malformed data rather than fewer results. Bodies are fetched deliberately via
`get_prompt`.

**Favourites are read when the session connects.** Claude Code caches remote servers between
sessions, and a stateless serverless function cannot push `notifications/prompts/list_changed`.
Starring a prompt will not add its command to a running session — that needs a new session or a
`/mcp` reconnect. A real limitation, documented rather than designed away.

---

## 5. Tokens

New table `api_tokens`:

```
id · user_id → users(id) ON DELETE CASCADE · name · token_hash · prefix
created_at · last_used_at · revoked_at
```

Format `ps_<32 random bytes, base64url>` from `crypto.randomBytes`. Shown **once** at creation,
like a GitHub PAT. Only the hash is stored, so a database leak yields no working tokens.

### SHA-256, not bcrypt

Deliberate, and the opposite of the usual password advice. Bcrypt exists to make brute-forcing
**low-entropy human passwords** expensive. These are 256-bit random secrets — brute force is
already infeasible — so bcrypt's cost function buys nothing while adding 50–100ms to every MCP
request. SHA-256 gives an O(1) indexed lookup: hash the presented token, look it up directly.

### Other decisions

- `prefix` stores the first 8 characters so the UI can show `ps_a3f9b2c1…` in the list. Enough to
  identify which token to revoke; useless as a credential.
- `last_used_at` updates **at most hourly**, not per request. Otherwise every MCP call becomes a
  database write for information only ever read by a human glancing at a list.
- Revocation sets `revoked_at` rather than deleting, so the token stays visible as a record.
  Auth rejects any token with `revoked_at` set.

### Settings UI

`/app/settings/tokens` — list (name, prefix, created, last used), create with a name, revoke with
confirmation. Follows the existing design system and reuses `ConfirmModal`, which already handles
the error case.

---

## 6. Error Handling

**Auth failures return an identical 401** whether the token is malformed, unknown, or revoked. A
different response for "revoked" versus "never existed" would tell an attacker which tokens were
once real.

**Not-found and not-owned are indistinguishable**, reusing the established principle:
`requireOwnedPrompt` throws `NotFoundError`, never `AuthorizationError`, so a token cannot probe
which prompt ids exist in other workspaces.

**Tool errors return messages the model can act on**, not stack traces. "Prompt not found" lets
Claude recover — search again, ask the user. A leaked internal error derails the session. Input
validation via zod schemas, which `mcp-handler` expects.

**Cold starts are the operational risk.** Claude Code's default MCP connect timeout is 5 seconds.
A cold Vercel function plus a Neon compute waking from scale-to-zero can plausibly approach that
on the first request after idle. The discovery cache helps for tools and `MCP_TIMEOUT` can be
raised. Named here so an inexplicable connection failure is recognised rather than misdiagnosed
as a broken server. If it proves annoying, the fix is keeping Neon warm — a cost/latency trade,
not a code change.

**No rate limiting in v1.** Stated rather than silently omitted: a leaked token could burn Vercel
function quota. Acceptable for a personal tool with revocable tokens; not acceptable with real
users.

---

## 7. Testing

### The isolation suite is the point

Existing tests prove user A cannot reach user B's prompts **through Server Actions**. They say
nothing about the token path. This build adds:

> A token belonging to user A cannot search, fetch, create into, update, or version user B's
> prompts. Five tools, five guards.

(There is no delete tool — deletion is out of scope per §1, and stays in the web app.)

Each guard must be verified to **actually fail if its check is removed** — the discipline that
caught a vacuous concurrency test during the Postgres migration.

### Layers

| Layer | Environment | Contents |
|---|---|---|
| Unit | jsdom | Token generation/hashing round-trip; slug derivation including deterministic collision suffixes |
| Integration | node | `resolveTokenContext` across valid/unknown/revoked/malformed; each tool end-to-end against real Postgres |
| Protocol | node | Route handler invoked with a synthetic `Request` — no live server needed |
| Manual | — | Real Claude Code against a preview deployment |

Integration tests follow established conventions: `@jest-environment node` docblock, `closeDb()`
in `afterAll`, `maxWorkers: 1` inherited so they do not race on the shared database, and the
`isTestDatabaseUrl` guard preventing them from ever pointing at Neon.

`create_prompt` must be asserted to produce exactly one version and zero orphans, mirroring the
check that caught a real bug during the migration.

**The manual step is not optional.** Nothing above proves the protocol handshake works against
the real client, and that is precisely the class of thing that passes in tests and fails in
practice.

---

## 8. Sequencing

One spec, staged plan. Ship in this order so each stage is independently verifiable:

1. `api_tokens` table + `resolveTokenContext` + settings UI
2. MCP server with **read-only** tools (`search_prompts`, `get_prompt`) — proves the connection
   and the handshake against real Claude Code
3. Prompts-as-slash-commands from favourites
4. Write tools (`create_prompt`, `update_prompt`, `save_version`)

Writes land on a foundation already exercised, rather than debugging authentication, protocol,
and mutation at once.

---

## 9. Success Criteria

- `claude mcp add` succeeds and `/mcp` shows the server connected
- A favourited prompt appears as `/mcp__prompt-saver__<slug>` and inserts its body when invoked
- The optional `context` argument is appended correctly
- `search_prompts` returns only the calling token's prompts, summaries only, respecting `limit`
- A token for user A receives `NotFoundError` for every one of user B's prompt ids, across all
  five tools
- `create_prompt` yields exactly one version and zero orphaned prompts
- A revoked token is rejected with the same 401 as an unknown one
- Tokens are never stored or logged in plaintext
- Existing Server Action isolation tests still pass unchanged
