# Prompt Saver MVP — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Author:** Claude + Bhesh
**Project:** Maitri internal tool

---

## 1. Overview

### What
A local-first prompt management tool for individual users at Maitri. Save complex prompt templates, organize them with tags, version them automatically, and find them fast via full-text search.

### What It Is NOT
- Not a prompt testing/execution platform (no LLM API calls)
- Not a team collaboration tool (single-user, browser-local)
- Not cloud-synced (all data in IndexedDB — clearing browser data destroys everything; export/import is deferred to a future phase)

### Target User
Individual Maitri team members who write and reuse structured LLM prompts — often long, multi-section templates with embedded instructions, evaluation criteria, and output format specifications.

### Example Prompt
A typical prompt is 500-2000 characters of structured text containing:
- Role/objective instructions
- Input specifications (URLs, documents, data sources)
- Detailed evaluation criteria with sections
- Verification rules
- Structured output format (tables, checklists, scoring rubrics)

These are plain text documents, not rich text. They may contain markdown-like formatting but are consumed as raw text by LLMs.

---

## 2. Data Model

Three entities. Simplified from the existing 6-entity schema.

### Prompt
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| workspace_id | string | Always `"default"` — see Migration Strategy below |
| title | string | Required, max 200 chars |
| description | string | Optional, max 500 chars |
| content | string | **Mutable working draft** — auto-saved, not versioned |
| tags | string[] | Free-form tags |
| status | enum | draft / active / archived |
| is_favorite | boolean | Default false |
| current_version_id | string | FK to latest PromptVersion |
| metadata | object | `{ version_count: number }` — incremented on version save |
| created_at | ISO8601 | Auto-set |
| updated_at | ISO8601 | Auto-updated on save |

**Draft vs Version semantics:**
- `Prompt.content` is the mutable working draft. Auto-save writes here (no new version created).
- On "Save Version," `Prompt.content` is copied into a new immutable `PromptVersion`.
- On page load, the editor shows `Prompt.content`. If it differs from the latest `PromptVersion.content`, the user sees their unsaved draft with a "unsaved changes" indicator.

### PromptVersion
| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| prompt_id | string | FK to Prompt |
| version_number | number | Sequential, starts at 1 |
| content | string | **Immutable** plain text snapshot of prompt content |
| change_summary | string | Optional, user-provided (replaces old `metadata.summary`) |
| created_at | ISO8601 | Auto-set |
| previous_version_id | string | Nullable, FK to prior version |

Versions are **append-only**. No in-place edits. Restoring an old version creates a new version with that content.

**Type change from existing code:** The existing `PromptVersion.content` is a structured object (`{ systemPrompt, userPrompt, temperature, ... }`). For MVP, this becomes a plain `string`. See Migration Strategy below.

### User (Optional)
| Field | Type | Notes |
|-------|------|-------|
| id | string | From Google OAuth |
| name | string | Display name |
| email | string | From OAuth |
| avatar | string | Profile image URL |

User record is created on first Google sign-in. The app functions fully without sign-in — user data is purely cosmetic (shows name/avatar in nav).

### Dropped Entities
- **TestRun** — no LLM execution in MVP
- **LLMProvider** — no LLM execution in MVP

### Dropped Fields (from existing Prompt type)
- `is_pinned` — not needed for MVP
- `created_by` — single user, no attribution needed
- `metadata.test_run_count`, `metadata.last_tested` — no test runs in MVP

### Workspace Strategy
The existing codebase has pervasive `workspace_id` scoping (indexes, repository methods, compound keys). Rather than rewriting all repository code, we use a **hardcoded sentinel workspace**: `workspace_id = "default"` on all records. This preserves existing indexes and query patterns with zero refactoring. The Workspace entity itself is not exposed in the UI.

### Delete Behavior
Deleting a prompt **cascades**: all associated `PromptVersion` records are deleted in the same IndexedDB transaction.

---

## 3. Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Prompt Library | Home page. Grid/list of all prompts with search, filters, sort. |
| `/prompts/new` | Create Prompt | Title, description, tags, content editor. |
| `/prompts/[id]` | View/Edit Prompt | Full editor with auto-save. Version history accessible from here. |
| `/prompts/[id]/versions` | Version History | Timeline of all versions with diff viewer. |
| `/auth/signin` | Sign In | Existing Google OAuth page. Optional. |

### Navigation Bar
`Logo ("Prompt Saver")` | `Search bar` | `+ New Prompt button` | `Avatar (if signed in) / Sign In link`

No separate dashboard. The library page IS the landing page.

---

## 4. Features

### 4.1 Prompt Editor (`/prompts/new` and `/prompts/[id]`)

**Layout:**
- Top: Title field (large, prominent) + Description field (smaller, optional)
- Below title: Tag input (chip-style, comma to add, auto-suggest from existing tags)
- Main area: Large monospace textarea for prompt content
- Footer bar: Character count | Estimated token count | Last saved timestamp | "Save Version" button

**Behavior:**
- Auto-save draft to IndexedDB after 5 seconds of inactivity (debounced)
- Auto-save does NOT create a new version — it updates the current draft state
- "Save Version" button creates an immutable PromptVersion with optional change summary
- First save of a new prompt creates version 1 automatically
- Estimated tokens: `Math.ceil(content.length / 4)` — displayed as "~X tokens (approx.)"
- Textarea uses monospace font, no syntax highlighting, no rich text
- Ctrl+S / Cmd+S triggers "Save Version"

**Navigation guard:**
- A `beforeunload` handler warns the user if they navigate away with unsaved changes (content differs from last auto-save).

**Validation:**
- Title required (1-200 chars)
- Content required (min 1 char)
- Tags: max 20 tags, each max 50 chars

### 4.2 Version History (`/prompts/[id]/versions`)

**Layout:**
- Left panel: Version timeline (vertical list, newest first)
  - Each entry: version number, change summary (or "No summary"), timestamp
  - Click to select and view
- Right panel: Version content viewer OR diff viewer

**Behavior:**
- Default view: latest version content
- Select any version to view its full content
- "Compare" mode: select two versions, show line-by-line diff (green = added, red = removed)
- "Restore" button on any version: creates a NEW version with that version's content, change summary auto-set to "Restored from version N"
- Accessible from the edit page via a "History" button/link

**Diff implementation:**
- Use the `diff` npm package (~5KB, well-tested LCS algorithm) for line-by-line comparison
- A naive line comparison breaks on insertions/deletions; LCS is needed for usable diffs
- Render as unified diff: green lines = added, red lines = removed, gray = context

### 4.3 Prompt Library (`/`)

**Layout:**
- Top: Search bar (full-width, prominent) + View toggle (grid/list) + Sort dropdown
- Left sidebar: Tag filter cloud + Status filter (All / Favorites / Archived)
- Main area: Prompt cards (grid) or rows (list)

**Card contents:**
- Title (truncated to 2 lines)
- Description (truncated to 1 line, if present)
- Tags (first 3, "+N more" if overflow)
- Last updated timestamp
- Favorite star icon (toggleable)
- Status badge (draft/active/archived) if not "active"

**Search:**
- Full-text search across title, description, `Prompt.content` (the draft field), and tags
- Client-side: load all prompts from IndexedDB, filter by substring match (case-insensitive)
- Feasible for MVP scale (< 200 prompts). Pagination deferred; if needed, virtual scrolling can be added later.
- Debounced input (300ms)
- Empty state: "No prompts yet. Create your first one."
- No results state: "No prompts match your search."

**Sort options:**
- Recently updated (default)
- Recently created
- Alphabetical (A-Z)
- Alphabetical (Z-A)

**Quick actions (on card hover or via menu):**
- Edit (navigate to `/prompts/[id]`)
- Duplicate (creates copy with "Copy of {title}")
- Toggle favorite
- Archive / Unarchive
- Delete (with confirmation modal)

### 4.4 Tags

- Free-form, no predefined taxonomy
- Created inline when saving a prompt
- Auto-suggest dropdown when typing in tag input (matches existing tags)
- Tag cloud in library sidebar shows all used tags with count
- Click a tag in the cloud to filter library
- Deleting the last prompt with a tag removes it from suggestions

### 4.5 Authentication (Optional)

- Google OAuth via NextAuth.js (existing implementation)
- Signed-in state: avatar + name in nav, sign-out option
- Signed-out state: "Sign In" link in nav
- No auth gating — all features work without sign-in
- User record stored in IndexedDB on first sign-in

---

## 5. Technical Architecture

### Reused from Existing Codebase
- IndexedDB client + connection manager (singleton)
- Repository pattern + factory
- Prompt repository (needs minor updates for simplified model)
- PromptVersion repository
- User repository
- Error handling (custom error classes, ErrorBoundary)
- Structured logging
- Crypto utilities (UUID generation, etc.)
- UI components: Button, Input, Textarea, Modal, LoadingSpinner
- NextAuth.js configuration + session management
- Tailwind CSS configuration (WCAG AA colors)
- ESLint, Prettier, Jest setup

### New Code Needed
- Prompt Library page (`/`)
- Prompt Editor page (`/prompts/new` and `/prompts/[id]`)
- Version History page (`/prompts/[id]/versions`)
- Tag input component
- Search/filter logic
- Diff viewer component (using `diff` npm package)
- Prompt card component
- View toggle (grid/list)
- Sort logic
- **Navigation component (full rewrite)** — existing nav has Dashboard/Prompts/Test Runs/Providers links and gates on auth. Replace entirely with: Logo | Search | + New Prompt | Avatar. No auth gating.
- Updated IndexedDB schema (see Migration Strategy)

### Schema Migration Strategy

The existing IndexedDB schema (v1) needs these changes for MVP:

1. **Bump schema version** to v2 with a migration function
2. **Prompt store changes:**
   - Add `content` field (string) — new mutable draft field
   - Remove `is_pinned`, `created_by`, `metadata.test_run_count`, `metadata.last_tested`
   - Keep `workspace_id` (hardcode `"default"`), `metadata.version_count`
3. **PromptVersion store changes:**
   - Change `content` from structured object to plain string
   - Rename `metadata.summary` to top-level `change_summary`
   - Remove `metadata.tags`, `created_by`
4. **Drop unused object stores:** `test_runs`, `llm_providers`
5. **Keep stores:** `users`, `workspaces` (auto-create one `"default"` workspace), `prompts`, `prompt_versions`

Since this is an internal MVP with no production data, a clean DB wipe on schema version bump is acceptable. The migration function can simply delete and recreate stores.

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) — already installed and working in existing codebase |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3.3+ |
| Storage | IndexedDB (browser-local) |
| Auth | NextAuth.js + Google OAuth (optional) |
| Testing | Jest + React Testing Library |
| Editor | Plain `<textarea>` with monospace font |
| Diff | `diff` npm package (~5KB, LCS-based) |
| Search | Client-side text matching on IndexedDB data |
| Token estimate | `Math.ceil(content.length / 4)` |

### State Management
- React hooks (useState, useEffect, useCallback)
- No global state library needed — each page fetches from IndexedDB repositories directly
- Auto-save uses useEffect with debounce

---

## 6. Deployment

### Platform: Vercel (Free Hobby Tier)

**Setup:**
1. Connect GitHub repo to Vercel
2. Set environment variables:
   - `NEXTAUTH_SECRET` (required for auth)
   - `GOOGLE_CLIENT_ID` (required for Google sign-in)
   - `GOOGLE_CLIENT_SECRET` (required for Google sign-in)
3. Push to main → auto-deploy

**Free tier limits (sufficient for internal use):**
- 100 GB bandwidth/month
- 6,000 build minutes/month
- Automatic HTTPS/SSL
- Custom domain supported

**Why Vercel:**
- Zero-config Next.js deployment (built by the same team)
- NextAuth URL auto-detected
- No server-side database needed (IndexedDB is client-side)
- Preview deployments for PRs

**Google OAuth redirect URIs to configure:**
- `https://<your-vercel-domain>/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/google` (dev)

---

## 7. Success Criteria

The MVP is complete when a user can:

1. Open the app and see an empty library with a clear call-to-action
2. Create a new prompt with title, description, tags, and content
3. Save a version and see it in version history
4. Edit the prompt, save another version, and diff the two
5. Return to the library and see their prompt listed
6. Search for the prompt by title, tag, or content keywords
7. Favorite a prompt and filter to show only favorites
8. Duplicate a prompt to create a variant
9. Archive a prompt to hide it from the default view
10. Optionally sign in with Google to see their name in the nav

---

## 8. Out of Scope (Future)

- LLM execution / testing (Phase 2)
- Multi-user / team collaboration
- Cloud sync / backup
- Import/export prompts
- Prompt marketplace or sharing
- Rich text or markdown preview
- Syntax highlighting for template variables
- Workspaces or folders
- API access
- Mobile-optimized layout
