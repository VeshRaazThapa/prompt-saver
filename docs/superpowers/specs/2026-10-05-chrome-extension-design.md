# Prompt Saver Chrome Extension — Design

Date: 2026-10-05 · Status: approved design, pending spec review

## 1. Goal

Ship Prompt Saver as a public Chrome Web Store extension: a prompt manager for
Claude, ChatGPT/Codex and Gemini, backed by the user's Prompt Saver account.
The extension and the website share one library.

Market evidence: `~/brainstorming/cws-research/reports/08-ai-prompt-space-traction.md`.
For prompt-manager searches the leaders have 70–100k users, and no extension has 500k+.

### Success criteria

- Listed on the Chrome Web Store, and installable by anyone.
- A stranger can sign up with Google without manual approval.
- Insert works on claude.ai, chatgpt.com (chat + `/codex`) and gemini.google.com.
  Copy works on any page.
- `//` picker, side panel and save-from-page all work on those sites.

### Out of scope (v1)

Prompt variables (`{{x}}`), a usage/limit tracker, payments, Firefox/Edge,
an offline-first editor, a Save button injected next to chat messages, and
version history UI in the extension (versions stay on the website).

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| Audience | Public, account required | Single shared library with the website |
| Sign-in | Connect via website: `/extension/connect` mints an API token | Reuses NextAuth + `api_tokens`. Revocable from Settings |
| Extension stack | WXT (MV3) + TypeScript + React + Tailwind | Current standard MV3 toolkit. Reuses `DESIGN.md` tokens |
| Location | `extension/` folder in this repo | Shared types, one PR flow |
| API | New REST `/api/v1/prompts` over existing handlers | MCP's JSON-RPC is the wrong shape for an extension client |
| Message Save button | Replaced by "Save current draft" | Message markup changes often; draft read is one selector per site |

## 3. Architecture

```
Website (Next.js, Vercel)                       Extension (WXT, MV3)
├─ /extension/connect  → mints ps_ token  ──►   background service worker
├─ /api/v1/prompts     GET list/search, POST     ├─ token, API client, prompt cache
├─ /api/v1/prompts/:id GET, PATCH                ├─ context menu "Save to Prompt Saver"
├─ /privacy                                      side panel (React)
└─ open sign-ups + per-user caps                 content scripts (one per AI site)
                                                  ├─ "//" inline picker
                                                  ├─ insert into the site's editor
                                                  └─ read current draft
```

## 4. Website changes

### 4.1 Open sign-ups

`isEmailAllowed` already treats an unset `ALLOWED_EMAILS` as "everyone allowed".
Going public is an ops step: remove `ALLOWED_EMAILS` from the Vercel
production env. No code change. Do this only after 4.4 and 4.5 ship.

### 4.2 Connect flow — `/extension/connect`

1. The extension opens `https://prompt-saver-two.vercel.app/extension/connect?ext=<extension-id>`.
2. The page requires a NextAuth session and redirects to sign-in if there isn't one.
3. The page shows "Connect Chrome extension?" with a **Connect** button.
   It must not mint on page load, so a visit alone can't create tokens.
4. On click, a Server Action mints a token named `Chrome extension` via the existing
   `generateToken()` + `createToken()` (`src/lib/tokens/`), as `createTokenAction` does. At most one active extension token
   per user: any previous active token named `Chrome extension` is revoked.
5. The page calls `chrome.runtime.sendMessage(EXTENSION_ID, { type: 'ps-token', token })`.
   `EXTENSION_ID` comes from env `NEXT_PUBLIC_EXTENSION_IDS` (comma list: store ID + dev ID).
   The `ext` query param is accepted only if it's in that list.
6. The page shows "Connected — you can close this tab". If `sendMessage` fails
   (extension not installed), it shows an install link instead. The token is
   revoked on failure.

### 4.3 REST API — `/api/v1/prompts`

Auth: `Authorization: Bearer ps_…`, resolved by `resolveTokenContext`,
rate-limited by `checkRateLimit` (same as MCP). The workspace always comes from
the token, never from the request.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/v1/prompts` | `?q=&limit=` (limit ≤ 200, default 200) | `{ prompts: PromptWithContent[] }` — includes `content`, for the extension cache. Excludes archived. Favorites first, then `updated_at` desc |
| POST | `/api/v1/prompts` | `{ title, content, description?, tags? }` | `201 { prompt }` — via `createPromptHandler` |
| GET | `/api/v1/prompts/:id` | — | `{ prompt }` — via `getPromptHandler` |
| PATCH | `/api/v1/prompts/:id` | `{ title?, content?, description?, tags?, isFavorite? }` | `{ prompt }` — via `updatePromptHandler` (draft edit, no new version). `UpdatePromptInput` gains an optional `isFavorite` field (new; it doesn't exist today) |

`PromptWithContent = PromptSummary & { content: string; is_favorite: boolean }`.

Errors: JSON `{ error: { code, message } }`, with codes
`unauthorized` (401), `not_found` (404), `validation` (400),
`rate_limited` (429 + `Retry-After`), `limit_reached` (403), `internal` (500, generic message).
This reuses the `withSafeErrors` sanitizing policy from the MCP route.

CORS: allow `Origin: chrome-extension://<id>` only for IDs in
`NEXT_PUBLIC_EXTENSION_IDS`. Handle `OPTIONS` preflight. No cookies.

### 4.4 Per-user caps

- Max **1,000 non-archived prompts** per workspace. Create returns `limit_reached` when reached.
- Max content length **50,000 chars** per prompt (validation).
- Existing per-token rate limit applies to `/api/v1/*`.

Caps live in one constants module so a future paid tier can raise them.

### 4.5 Privacy policy — `/privacy`

A static page required by the Web Store. It covers: what is stored (Google
profile, prompts), where (Neon Postgres, Vercel), that the extension reads chat
box text only when the user triggers insert/save, no selling of data, and how to
delete an account (by email for v1).

## 5. Extension

### 5.1 Layout

```
extension/
  wxt.config.ts            manifest: permissions, host_permissions, externally_connectable
  src/entrypoints/
    background.ts          token store, API client, cache, context menu, message router
    sidepanel/             React app
    claude.content.ts      matches https://claude.ai/*
    chatgpt.content.ts     matches https://chatgpt.com/*
    gemini.content.ts      matches https://gemini.google.com/*
  src/sites/               adapters (one file per site) + types.ts
  src/picker/              "//" picker (shadow DOM) + filter logic
  src/lib/api.ts           typed REST client
  src/lib/cache.ts         chrome.storage cache
  src/lib/insert.ts        insert strategy chain
```

### 5.2 Manifest

- `permissions`: `storage`, `sidePanel`, `contextMenus`.
- `host_permissions`: `https://claude.ai/*`, `https://chatgpt.com/*`,
  `https://gemini.google.com/*`, `https://prompt-saver-two.vercel.app/*`.
- `externally_connectable.matches`: `https://prompt-saver-two.vercel.app/*` (plus `http://localhost:3000/*` in dev builds only).
- No `<all_urls>`. The context menu uses `contexts: ['selection']`, and selected
  text comes from the click event (`info.selectionText`), which needs no host permission.

### 5.3 Site adapters

```ts
interface SiteAdapter {
  id: 'claude' | 'chatgpt' | 'gemini';
  findEditor(): HTMLElement | null;   // the chat input (contenteditable or textarea)
  readDraft(): string;                // current chat box text, '' if none
}
```

Selectors live only in the adapter file. Codex (`chatgpt.com/codex`) is handled by
the ChatGPT adapter, which tries the Codex task input selector first.

### 5.4 Insert strategy (`insert.ts`)

The same for every site, given an editor element:

1. Focus the editor, then `document.execCommand('insertText', false, text)`.
   Success = editor text changed.
2. Otherwise, dispatch a synthetic `paste` `ClipboardEvent` with a `DataTransfer` holding `text/plain`.
3. Otherwise, write to the clipboard and show a toast: "Copied — press ⌘V / Ctrl+V".

Insert never sends the message. The user always presses Enter themselves.

### 5.5 `//` picker

- Trigger: the user types `//` in the adapter's editor, at line start or after whitespace.
  `//` inside URLs (`https://`) never triggers.
- A floating list is anchored to the caret and rendered in a closed shadow root
  with the extension's own CSS. It reads from the cache only.
- Text typed after `//` filters by case-insensitive substring match on title, then
  tags, then content. Favorites rank first. Max 8 rows.
- Keys: ↑/↓ move, Enter/Tab insert, Esc closes and leaves the text. Clicking outside also closes.
- On insert: select the `//query` range backward from the caret, then run the insert
  chain (5.4) so the selection is replaced.
- The last row is always **"Save current draft…"**. It opens the side panel save
  form prefilled with `readDraft()` minus the `//query`.
- Empty cache: one row, "Sign in to Prompt Saver" or "No prompts yet — open panel".

### 5.6 Side panel

Built with `DESIGN.md` tokens (stone/teal, DM Sans, JetBrains Mono for prompt text,
44px targets, focus rings).

- **Signed out:** explanation plus a **Connect account** button (opens 4.2).
- **Signed in:** search box, favorites pinned, prompt cards with **Insert**
  (only when the active tab is a supported site) and **Copy**; a star toggle;
  **New prompt**; **Save current draft** (supported sites only); account menu
  with Disconnect and "Open Prompt Saver".
- **Save form:** title (default = first line, ≤ 80 chars), content, tags. POSTs, then refreshes the cache.
- Editing an existing prompt opens it on the website. The extension doesn't edit
  existing prompts in v1 beyond the star.

### 5.7 Background worker

- Token in `chrome.storage.local` (`psToken`). Accepts `ps-token` messages only via
  `onMessageExternal` from the website origin.
- Cache in `chrome.storage.local` (`psPrompts`, `psSyncedAt`). Refreshed on panel
  open, after every write, and on picker open if older than 5 minutes (stale data is
  served immediately and refreshed in the background).
- Message router for content scripts and the panel: `getPrompts`, `createPrompt`,
  `toggleFavorite`, `openSavePanel(prefill)`, `insertIntoTab(tabId, text)`.
- Context menu "Save to Prompt Saver" on text selection: opens the side panel with
  the save form prefilled from `info.selectionText`.

## 6. Errors

| Situation | Behavior |
|---|---|
| 401 | Clear token and cache. Panel shows "Reconnect"; picker shows the sign-in row |
| Network failure / Neon cold start | Serve the cache. Writes show a spinner, retry once after 3 s, then show "Couldn't save — try again" with the form kept |
| 429 | "Too many requests — try again in N s" (from `Retry-After`) |
| 403 `limit_reached` | "You've hit 1,000 prompts — archive some on the website" |
| Editor not found / insert fails | Clipboard fallback + toast (5.4 step 3) |
| Connect page: extension missing | Install link. The minted token is revoked |

## 7. Testing

**Website (Jest, existing patterns):**
- `/api/v1/prompts` contract tests for every row in 4.3, including workspace isolation
  (token A can't read B's prompt → 404), CORS allow/deny, 429, and `limit_reached`.
- Connect flow: no minting without a click, prior extension token revoked,
  unknown `ext` id rejected.

**Extension (Vitest):**
- Picker trigger detection (`//` vs `https://`), filtering and ranking.
- `insert.ts` chain against jsdom `contenteditable` and `textarea`.
- API client error mapping (401/429/403/network).

**Extension (Playwright, unpacked extension):**
- Local fixture pages with real ProseMirror and Quill editors: `//` picker
  insert replaces the query, the side panel Insert works, the clipboard fallback triggers.

**Manual smoke checklist (pre-release, logged-in browser):**
claude.ai, chatgpt.com, chatgpt.com/codex, gemini.google.com. Check insert, picker,
save draft and save selection on each.

## 8. Release

1. Ship website changes 4.2–4.5 (sign-ups still allowlisted).
2. Build the extension. Test with a dev extension ID against production.
3. Write the store listing (name targets "AI Prompt Manager for Claude, ChatGPT,
   Gemini & Codex", screenshots, privacy URL). Submit for review.
4. On approval: add the store ID to `NEXT_PUBLIC_EXTENSION_IDS`, then remove
   `ALLOWED_EMAILS` (4.1).
