# Prompt Saver MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first prompt management tool — create, version, search, and organize LLM prompts in the browser using IndexedDB.

**Architecture:** Next.js 16 App Router with client-side IndexedDB storage. Existing repository pattern and UI components are reused. Schema is migrated from v1 (6 stores, structured content) to v2 (4 stores, plain string content). All pages are client components since they interact with IndexedDB directly.

**Tech Stack:** Next.js 16, TypeScript (strict), Tailwind CSS, IndexedDB, NextAuth.js (optional), `diff` npm package for version diffing.

**Spec:** `docs/superpowers/specs/2026-03-18-prompt-saver-mvp-design.md`

---

## File Structure

### Files to Create
| File | Responsibility |
|------|---------------|
| `src/app/prompts/new/page.tsx` | Create new prompt page |
| `src/app/prompts/[id]/page.tsx` | Edit prompt page |
| `src/app/prompts/[id]/versions/page.tsx` | Version history page |
| `src/components/PromptCard.tsx` | Prompt card for library grid/list |
| `src/components/TagInput.tsx` | Chip-style tag input with auto-suggest |
| `src/components/PromptEditor.tsx` | Reusable editor (title, description, tags, content textarea) |
| `src/components/DiffViewer.tsx` | Line-by-line diff display component |
| `src/components/VersionTimeline.tsx` | Version list sidebar for history page |
| `src/components/SearchBar.tsx` | Search input for library and nav |
| `src/components/ConfirmModal.tsx` | Reusable delete/archive confirmation |
| `src/lib/utils/diff.ts` | Diff utility wrapping `diff` npm package |
| `src/lib/utils/tokens.ts` | Token estimation utility |
| `src/lib/constants.ts` | DEFAULT_WORKSPACE_ID and other constants |
| `src/hooks/usePrompts.ts` | Hook for loading/searching/filtering prompts |
| `src/hooks/usePrompt.ts` | Hook for single prompt CRUD + auto-save |
| `src/hooks/useVersions.ts` | Hook for version history + diff |
| `src/hooks/useDebounce.ts` | Generic debounce hook |
| `__tests__/lib/utils/diff.test.ts` | Diff utility tests |
| `__tests__/lib/utils/tokens.test.ts` | Token estimation tests |

### Files to Modify
| File | Changes |
|------|---------|
| `src/types/prompt.ts` | Add `content` field, remove `is_pinned`/`created_by`, simplify `metadata` |
| `src/types/prompt-version.ts` | Change `content` from object to string, add `change_summary`, remove `metadata`/`created_by` |
| `src/types/index.ts` | Keep exports, no structural change |
| `src/lib/db/schema.ts` | Bump to v2, drop test_runs/llm_providers stores, add content field handling |
| `src/lib/db/repositories/indexeddb-prompt.ts` | Add content to search, add cascading delete |
| `src/lib/db/repositories/indexeddb-prompt-version.ts` | Update `createVersionAtomic` for new types |
| `src/lib/db/repositories/types.ts` | Remove ITestRunRepository, ILLMProviderRepository |
| `src/lib/db/repositories/factory.ts` | Remove test run and LLM provider repos |
| `src/components/Navigation.tsx` | Full rewrite — Logo, SearchBar, + New Prompt, avatar |
| `src/app/page.tsx` | Replace placeholder with Prompt Library |
| `src/app/layout.tsx` | Minor: update metadata title to "Prompt Saver" |
| `package.json` | Add `diff` dependency |

### Files to Delete
| File | Reason |
|------|--------|
| `src/lib/db/repositories/indexeddb-test-run.ts` | Not used in MVP |
| `src/lib/db/repositories/indexeddb-llm-provider.ts` | Not used in MVP |
| `src/types/test-run.ts` | Not used in MVP |
| `src/types/llm-provider.ts` | Not used in MVP |

---

## Task 1: Install Dependencies and Update Constants

**Files:**
- Modify: `package.json`
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Install diff package**

```bash
npm install diff
npm install -D @types/diff
```

- [ ] **Step 2: Create constants file**

```typescript
// src/lib/constants.ts
export const DEFAULT_WORKSPACE_ID = 'default';
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/lib/constants.ts
git commit -m "chore: add diff dependency and constants file"
```

---

## Task 2: Update Type Definitions

**Files:**
- Modify: `src/types/prompt.ts`
- Modify: `src/types/prompt-version.ts`
- Modify: `src/types/index.ts`
- Delete: `src/types/test-run.ts`
- Delete: `src/types/llm-provider.ts`

- [ ] **Step 1: Update Prompt type**

Replace `src/types/prompt.ts` with:

```typescript
export interface Prompt {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  content: string; // Mutable working draft — auto-saved, not versioned
  current_version_id: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  is_favorite: boolean;
  status: 'draft' | 'active' | 'archived';
  metadata: {
    version_count: number;
  };
}
```

- [ ] **Step 2: Update PromptVersion type**

Replace `src/types/prompt-version.ts` with:

```typescript
export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  content: string; // Immutable plain text snapshot
  change_summary?: string;
  created_at: string;
  previous_version_id?: string;
}
```

- [ ] **Step 3: Update index.ts exports and delete unused types**

Replace `src/types/index.ts` with:

```typescript
export type { User } from './user';
export type { Workspace } from './workspace';
export type { Prompt } from './prompt';
export type { PromptVersion } from './prompt-version';
```

Delete `src/types/test-run.ts` and `src/types/llm-provider.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/
git rm src/types/test-run.ts src/types/llm-provider.ts
git commit -m "refactor: simplify types for MVP — plain string content, drop unused entities"
```

---

## Task 3: Update Database Schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/migrations.ts`

- [ ] **Step 1: Update schema to v2**

Replace `src/lib/db/schema.ts` with:

```typescript
export const DB_NAME = 'prompt-saver';
export const DB_VERSION = 2;

export const STORES = {
  USERS: 'users',
  WORKSPACES: 'workspaces',
  PROMPTS: 'prompts',
  PROMPT_VERSIONS: 'prompt_versions',
} as const;

export const INDEXES = {
  USERS: {
    EMAIL: 'email',
  },
  WORKSPACES: {
    USER_ID: 'user_id',
  },
  PROMPTS: {
    WORKSPACE_ID: 'workspace_id',
    WORKSPACE_CREATED: 'workspace_created',
    WORKSPACE_FAVORITE: 'workspace_favorite',
    WORKSPACE_TITLE: 'workspace_title',
  },
  PROMPT_VERSIONS: {
    PROMPT_ID: 'prompt_id',
    PROMPT_VERSION: 'prompt_version',
  },
} as const;

export function upgradeSchema(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    // Users store
    const usersStore = db.createObjectStore(STORES.USERS, { keyPath: 'id' });
    usersStore.createIndex(INDEXES.USERS.EMAIL, 'email', { unique: true });

    // Workspaces store
    const workspacesStore = db.createObjectStore(STORES.WORKSPACES, { keyPath: 'id' });
    workspacesStore.createIndex(INDEXES.WORKSPACES.USER_ID, 'user_id', { unique: false });

    // Prompts store
    const promptsStore = db.createObjectStore(STORES.PROMPTS, { keyPath: 'id' });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_ID, 'workspace_id', { unique: false });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_CREATED, ['workspace_id', 'created_at'], { unique: false });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_FAVORITE, ['workspace_id', 'is_favorite', 'updated_at'], { unique: false });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_TITLE, ['workspace_id', 'title'], { unique: false });

    // Prompt versions store
    const versionsStore = db.createObjectStore(STORES.PROMPT_VERSIONS, { keyPath: 'id' });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_ID, 'prompt_id', { unique: false });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_VERSION, ['prompt_id', 'version_number'], { unique: true });
  }

  // V1 -> V2: Clean wipe for internal MVP — type shapes changed, no prod data to migrate
  if (oldVersion >= 1 && oldVersion < 2) {
    // Drop unused stores
    if (db.objectStoreNames.contains('test_runs')) {
      db.deleteObjectStore('test_runs');
    }
    if (db.objectStoreNames.contains('llm_providers')) {
      db.deleteObjectStore('llm_providers');
    }

    // Wipe and recreate prompts + prompt_versions (content type changed)
    if (db.objectStoreNames.contains('prompts')) {
      db.deleteObjectStore('prompts');
    }
    if (db.objectStoreNames.contains('prompt_versions')) {
      db.deleteObjectStore('prompt_versions');
    }

    const promptsStore = db.createObjectStore(STORES.PROMPTS, { keyPath: 'id' });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_ID, 'workspace_id', { unique: false });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_CREATED, ['workspace_id', 'created_at'], { unique: false });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_FAVORITE, ['workspace_id', 'is_favorite', 'updated_at'], { unique: false });
    promptsStore.createIndex(INDEXES.PROMPTS.WORKSPACE_TITLE, ['workspace_id', 'title'], { unique: false });

    const versionsStore = db.createObjectStore(STORES.PROMPT_VERSIONS, { keyPath: 'id' });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_ID, 'prompt_id', { unique: false });
    versionsStore.createIndex(INDEXES.PROMPT_VERSIONS.PROMPT_VERSION, ['prompt_id', 'version_number'], { unique: true });
  }
}
```

- [ ] **Step 2: Update migrations.ts**

Read `src/lib/db/migrations.ts` and update any references to `TEST_RUNS` or `LLM_PROVIDERS` stores. Remove migration code for those stores. Keep the migration infrastructure intact.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/migrations.ts
git commit -m "refactor: bump DB schema to v2 — drop test_runs and llm_providers stores"
```

---

## Task 4: Update Repositories

**Files:**
- Modify: `src/lib/db/repositories/types.ts`
- Modify: `src/lib/db/repositories/factory.ts`
- Modify: `src/lib/db/repositories/indexeddb-prompt.ts`
- Modify: `src/lib/db/repositories/indexeddb-prompt-version.ts`
- Delete: `src/lib/db/repositories/indexeddb-test-run.ts`
- Delete: `src/lib/db/repositories/indexeddb-llm-provider.ts`

- [ ] **Step 1: Remove unused repository interfaces from types.ts**

Remove `ITestRunRepository` and `ILLMProviderRepository` interfaces from `src/lib/db/repositories/types.ts`. Remove the `TestRun` and `LLMProvider` imports. Keep all other interfaces.

- [ ] **Step 2: Update IPromptRepository.search to include content**

In `src/lib/db/repositories/types.ts`, update the `search` method JSDoc to note it searches title, description, content, and tags.

- [ ] **Step 3: Update factory.ts — remove unused repos**

Remove `IndexedDBTestRunRepository` and `IndexedDBLLMProviderRepository` imports and factory methods from `src/lib/db/repositories/factory.ts`. Remove all references to `testRunRepo` and `llmProviderRepo`.

- [ ] **Step 4: Update indexeddb-prompt.ts — add content to search, add cascade delete**

In the `search` method, add content matching. Change the filter in `search()` method:

```typescript
// In the filter function, add content matching:
const lowerQuery = query.toLowerCase();
let results = (request.result as Prompt[]).filter((prompt) => {
  return (
    prompt.title.toLowerCase().includes(lowerQuery) ||
    prompt.description?.toLowerCase().includes(lowerQuery) === true ||
    prompt.content?.toLowerCase().includes(lowerQuery) === true ||
    prompt.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
});
```

Update the `delete` method to cascade-delete all PromptVersion records:

```typescript
async delete(id: string): Promise<boolean> {
  const db = await openDB();
  const tx = db.transaction([STORES.PROMPTS, STORES.PROMPT_VERSIONS], 'readwrite');
  const promptStore = tx.objectStore(STORES.PROMPTS);
  const versionStore = tx.objectStore(STORES.PROMPT_VERSIONS);
  const versionIndex = versionStore.index(INDEXES.PROMPT_VERSIONS.PROMPT_ID);

  return new Promise((resolve, reject) => {
    // Delete all versions first
    const versionsRequest = versionIndex.getAll(id);

    versionsRequest.onsuccess = () => {
      const versions = versionsRequest.result;
      for (const version of versions) {
        versionStore.delete(version.id);
      }

      // Then delete the prompt
      const deleteRequest = promptStore.delete(id);

      deleteRequest.onsuccess = () => {
        resolve(true);
      };

      deleteRequest.onerror = () => {
        reject(new Error('Failed to delete prompt'));
      };
    };

    versionsRequest.onerror = () => {
      reject(new Error('Failed to find prompt versions for deletion'));
    };
  });
}
```

Add `INDEXES` import if not already present.

- [ ] **Step 5: Update indexeddb-prompt-version.ts for new types**

The `createVersionAtomic` method references `prompt.metadata.version_count`. This still works since we kept `metadata.version_count` in the new Prompt type. No change needed to the method logic — just verify it compiles with the new types.

Update the `content` field handling: since `content` is now a plain string (not an object), no serialization changes are needed — IndexedDB stores any JS value.

- [ ] **Step 6: Delete unused repository files**

```bash
git rm src/lib/db/repositories/indexeddb-test-run.ts
git rm src/lib/db/repositories/indexeddb-llm-provider.ts
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Fix any type errors. Expected: the Prompt and PromptVersion type changes may cause errors in other files that reference the old fields. Fix each by removing references to dropped fields.

- [ ] **Step 8: Commit**

```bash
git add src/lib/db/repositories/ src/types/
git commit -m "refactor: update repositories for MVP — cascade delete, content search, remove unused"
```

---

## Task 5: Utility Functions (with TDD)

**Files:**
- Create: `src/lib/utils/tokens.ts`
- Create: `src/lib/utils/diff.ts`
- Create: `src/hooks/useDebounce.ts`
- Create: `__tests__/lib/utils/tokens.test.ts`
- Create: `__tests__/lib/utils/diff.test.ts`
- Create: `__tests__/hooks/useDebounce.test.ts`

- [ ] **Step 1: Write token estimation test**

```typescript
// __tests__/lib/utils/tokens.test.ts
import { estimateTokens } from '@/lib/utils/tokens';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens as ceil(length / 4)', () => {
    expect(estimateTokens('hello')).toBe(2); // 5/4 = 1.25 -> 2
    expect(estimateTokens('hi')).toBe(1); // 2/4 = 0.5 -> 1
    expect(estimateTokens('abcdefgh')).toBe(2); // 8/4 = 2
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/utils/tokens.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement token estimation**

```typescript
// src/lib/utils/tokens.ts
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/utils/tokens.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 5: Write diff utility test**

```typescript
// __tests__/lib/utils/diff.test.ts
import { computeDiff, DiffLine } from '@/lib/utils/diff';

describe('computeDiff', () => {
  it('returns empty array for identical strings', () => {
    const result = computeDiff('hello\nworld', 'hello\nworld');
    expect(result.every((line) => line.type === 'unchanged')).toBe(true);
  });

  it('detects added lines', () => {
    const result = computeDiff('line1', 'line1\nline2');
    const added = result.filter((line) => line.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].value).toBe('line2');
  });

  it('detects removed lines', () => {
    const result = computeDiff('line1\nline2', 'line1');
    const removed = result.filter((line) => line.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].value).toBe('line2');
  });

  it('handles empty inputs', () => {
    const result = computeDiff('', 'new content');
    expect(result.filter((l) => l.type === 'added').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npx jest __tests__/lib/utils/diff.test.ts --no-coverage
```

Expected: FAIL.

- [ ] **Step 7: Implement diff utility**

```typescript
// src/lib/utils/diff.ts
import { diffLines } from 'diff';

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const changes = diffLines(oldText, newText);
  const lines: DiffLine[] = [];

  for (const change of changes) {
    const changeLines = change.value.replace(/\n$/, '').split('\n');
    const type: DiffLine['type'] = change.added
      ? 'added'
      : change.removed
        ? 'removed'
        : 'unchanged';

    for (const line of changeLines) {
      lines.push({ type, value: line });
    }
  }

  return lines;
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npx jest __tests__/lib/utils/diff.test.ts --no-coverage
```

Expected: PASS.

- [ ] **Step 9: Create useDebounce hook**

```typescript
// src/hooks/useDebounce.ts
'use client';

import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/utils/tokens.ts src/lib/utils/diff.ts src/hooks/useDebounce.ts __tests__/
git commit -m "feat: add token estimation, diff utility, and debounce hook with tests"
```

---

## Task 6: Rewrite Navigation Component

**Files:**
- Modify: `src/components/Navigation.tsx`
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: Create SearchBar component**

```typescript
// src/components/SearchBar.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className = '' }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push('/');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <input
        type="text"
        placeholder="Search prompts..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 pl-9 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <svg
        className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </form>
  );
}
```

- [ ] **Step 2: Rewrite Navigation component**

Replace `src/components/Navigation.tsx` entirely:

```typescript
'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { SearchBar } from './SearchBar';

export function Navigation() {
  const { data: session } = useSession();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0 text-lg font-bold text-gray-900">
            Prompt Saver
          </Link>

          {/* Search */}
          <SearchBar className="hidden sm:block sm:max-w-md sm:flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/prompts/new"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + New Prompt
            </Link>

            {session?.user ? (
              <div className="flex items-center gap-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? ''}
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <span className="hidden text-sm text-gray-700 sm:inline">
                  {session.user.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Verify it renders**

```bash
npx next dev -p 3847 &
sleep 5
curl -s http://localhost:3847 | grep -o "Prompt Saver"
kill %1
```

Expected: "Prompt Saver" in output.

- [ ] **Step 4: Commit**

```bash
git add src/components/Navigation.tsx src/components/SearchBar.tsx
git commit -m "feat: rewrite navigation — search bar, new prompt button, no auth gating"
```

---

## Task 7: Shared UI Components

**Files:**
- Create: `src/components/TagInput.tsx`
- Create: `src/components/ConfirmModal.tsx`
- Create: `src/components/PromptCard.tsx`
- Create: `src/components/DiffViewer.tsx`
- Create: `src/components/VersionTimeline.tsx`

- [ ] **Step 1: Create TagInput component**

```typescript
// src/components/TagInput.tsx
'use client';

import { useState, useRef, useEffect } from 'react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  maxLength?: number;
}

export function TagInput({
  tags,
  onChange,
  suggestions = [],
  maxTags = 20,
  maxLength = 50,
}: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (s) =>
      s.toLowerCase().includes(input.toLowerCase()) &&
      !tags.includes(s) &&
      input.length > 0
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim().slice(0, maxLength);
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-1.5 rounded-md border border-gray-300 px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        {tags.map((tag, i) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-blue-600 hover:text-blue-900"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length === 0 ? 'Add tags (comma to add)...' : ''}
          className="min-w-[120px] flex-1 border-none p-0 text-sm focus:outline-none focus:ring-0"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
          {filteredSuggestions.slice(0, 8).map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addTag(s)}
              className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create ConfirmModal component**

```typescript
// src/components/ConfirmModal.tsx
'use client';

import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  );
}
```

- [ ] **Step 3: Create PromptCard component**

```typescript
// src/components/PromptCard.tsx
'use client';

import Link from 'next/link';
import type { Prompt } from '@/types';

interface PromptCardProps {
  prompt: Prompt;
  onToggleFavorite: (id: string) => void;
  onDuplicate: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PromptCard({
  prompt,
  onToggleFavorite,
  onDuplicate,
  onArchive,
  onDelete,
}: PromptCardProps) {
  const timeAgo = formatTimeAgo(prompt.updated_at);

  return (
    <div className="group relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Favorite star */}
      <button
        onClick={() => onToggleFavorite(prompt.id)}
        className="absolute right-3 top-3 text-gray-300 hover:text-yellow-400"
        aria-label={prompt.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <svg className={`h-5 w-5 ${prompt.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      </button>

      {/* Content */}
      <Link href={`/prompts/${prompt.id}`} className="block">
        <h3 className="pr-8 text-base font-semibold text-gray-900 line-clamp-2">
          {prompt.title}
        </h3>
        {prompt.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-1">{prompt.description}</p>
        )}
      </Link>

      {/* Tags */}
      {prompt.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{prompt.tags.length - 3} more</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-400">{timeAgo}</span>
        {prompt.status !== 'active' && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            prompt.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {prompt.status}
          </span>
        )}
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="absolute bottom-3 right-3 hidden gap-1 group-hover:flex">
        <button onClick={() => onDuplicate(prompt.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Duplicate">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
        <button onClick={() => onArchive(prompt.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title={prompt.status === 'archived' ? 'Unarchive' : 'Archive'}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        </button>
        <button onClick={() => onDelete(prompt.id)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600" title="Delete">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
```

- [ ] **Step 4: Create DiffViewer component**

```typescript
// src/components/DiffViewer.tsx
'use client';

import { computeDiff } from '@/lib/utils/diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

export function DiffViewer({ oldText, newText, oldLabel, newLabel }: DiffViewerProps) {
  const lines = computeDiff(oldText, newText);

  if (oldText === newText) {
    return <p className="py-4 text-center text-sm text-gray-500">No differences</p>;
  }

  return (
    <div className="overflow-auto rounded border border-gray-200">
      {(oldLabel || newLabel) && (
        <div className="flex border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          {oldLabel && <span className="text-red-600">{oldLabel}</span>}
          {oldLabel && newLabel && <span className="mx-2">&rarr;</span>}
          {newLabel && <span className="text-green-600">{newLabel}</span>}
        </div>
      )}
      <pre className="text-sm">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-3 py-0.5 ${
              line.type === 'added'
                ? 'bg-green-50 text-green-800'
                : line.type === 'removed'
                  ? 'bg-red-50 text-red-800'
                  : 'text-gray-700'
            }`}
          >
            <span className="mr-2 inline-block w-4 select-none text-gray-400">
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </span>
            {line.value || '\u00A0'}
          </div>
        ))}
      </pre>
    </div>
  );
}
```

- [ ] **Step 5: Create VersionTimeline component**

```typescript
// src/components/VersionTimeline.tsx
'use client';

import type { PromptVersion } from '@/types';

interface VersionTimelineProps {
  versions: PromptVersion[];
  selectedId?: string;
  compareId?: string;
  onSelect: (version: PromptVersion) => void;
  onCompareSelect?: (version: PromptVersion) => void;
  compareMode?: boolean;
}

export function VersionTimeline({
  versions,
  selectedId,
  compareId,
  onSelect,
  onCompareSelect,
  compareMode = false,
}: VersionTimelineProps) {
  return (
    <div className="space-y-1">
      {versions.map((version) => {
        const isSelected = version.id === selectedId;
        const isCompare = version.id === compareId;

        return (
          <button
            key={version.id}
            onClick={() => {
              if (compareMode && onCompareSelect) {
                onCompareSelect(version);
              } else {
                onSelect(version);
              }
            }}
            className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
              isSelected
                ? 'bg-blue-50 ring-1 ring-blue-200'
                : isCompare
                  ? 'bg-orange-50 ring-1 ring-orange-200'
                  : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">v{version.version_number}</span>
              <span className="text-xs text-gray-400">
                {new Date(version.created_at).toLocaleDateString()}
              </span>
            </div>
            {version.change_summary && (
              <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                {version.change_summary}
              </p>
            )}
            {(isSelected || isCompare) && (
              <span className={`mt-1 inline-block rounded px-1 text-xs ${
                isSelected ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {isSelected ? 'viewing' : 'comparing'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/TagInput.tsx src/components/ConfirmModal.tsx src/components/PromptCard.tsx src/components/DiffViewer.tsx src/components/VersionTimeline.tsx
git commit -m "feat: add shared UI components — TagInput, ConfirmModal, PromptCard, DiffViewer, VersionTimeline"
```

---

## Task 8: Data Hooks

**Files:**
- Create: `src/hooks/usePrompts.ts`
- Create: `src/hooks/usePrompt.ts`
- Create: `src/hooks/useVersions.ts`

- [ ] **Step 1: Create usePrompts hook (library)**

```typescript
// src/hooks/usePrompts.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Prompt } from '@/types';
import { getPromptRepository } from '@/lib/db/repositories/factory';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants';
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
  const [loading, setLoading] = useState(true);
  const [allTags, setAllTags] = useState<{ tag: string; count: number }[]>([]);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const load = useCallback(async () => {
    setLoading(true);
    const repo = getPromptRepository();

    try {
      // Always load ALL prompts first for tag cloud (unfiltered)
      const allPrompts = await repo.findByWorkspaceId(DEFAULT_WORKSPACE_ID);

      // Build tag counts from all prompts
      const tagCounts = new Map<string, number>();
      allPrompts.forEach((p) => p.tags.forEach((t) => {
        tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
      }));
      setAllTags(
        Array.from(tagCounts.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => a.tag.localeCompare(b.tag))
      );

      // Now filter/search for display
      let results: Prompt[];

      if (debouncedQuery) {
        results = await repo.search(DEFAULT_WORKSPACE_ID, debouncedQuery);
        // Apply sort to search results client-side
        results.sort((a, b) => {
          const aVal = a[sortBy] ?? '';
          const bVal = b[sortBy] ?? '';
          const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : 0;
          return sortOrder === 'asc' ? cmp : -cmp;
        });
      } else {
        results = await repo.findByWorkspaceId(DEFAULT_WORKSPACE_ID, {
          favoritesOnly: filter === 'favorites',
          status: filter === 'archived' ? 'archived' : undefined,
          sortBy,
          sortOrder,
        });
      }

      // Exclude archived from default view unless specifically filtering for them
      if (filter === 'all') {
        results = results.filter((p) => p.status !== 'archived');
      }

      setPrompts(results);
    } catch (err) {
      console.error('Failed to load prompts', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filter, sortBy, sortOrder]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFavorite = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    const prompt = await repo.findById(id);
    if (prompt) {
      await repo.update(id, { is_favorite: !prompt.is_favorite });
      load();
    }
  }, [load]);

  const duplicatePrompt = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    const prompt = await repo.findById(id);
    if (prompt) {
      const { generateId } = await import('@/lib/utils/id-generator');
      const { now } = await import('@/lib/utils/datetime');
      const newPrompt: Prompt = {
        ...prompt,
        id: generateId(),
        title: `Copy of ${prompt.title}`,
        current_version_id: '',
        created_at: now(),
        updated_at: now(),
        metadata: { version_count: 0 },
      };
      await repo.create(newPrompt);
      load();
    }
  }, [load]);

  const archivePrompt = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    const prompt = await repo.findById(id);
    if (prompt) {
      const newStatus = prompt.status === 'archived' ? 'active' : 'archived';
      await repo.update(id, { status: newStatus });
      load();
    }
  }, [load]);

  const deletePrompt = useCallback(async (id: string) => {
    const repo = getPromptRepository();
    await repo.delete(id);
    load();
  }, [load]);

  return { prompts, loading, allTags, toggleFavorite, duplicatePrompt, archivePrompt, deletePrompt, reload: load };
}
```

- [ ] **Step 2: Create usePrompt hook (single prompt editor)**

```typescript
// src/hooks/usePrompt.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Prompt, PromptVersion } from '@/types';
import { getPromptRepository, getPromptVersionRepository } from '@/lib/db/repositories/factory';
import { DEFAULT_WORKSPACE_ID } from '@/lib/constants';
import { generateId } from '@/lib/utils/id-generator';
import { now } from '@/lib/utils/datetime';

interface PromptDraft {
  title: string;
  description: string;
  content: string;
  tags: string[];
}

export function usePrompt(promptId?: string) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [draft, setDraft] = useState<PromptDraft>({ title: '', description: '', content: '', tags: [] });
  const [loading, setLoading] = useState(!!promptId);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dirty, setDirty] = useState(false); // Only true after user edits, not on load
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load existing prompt
  useEffect(() => {
    if (!promptId) return;

    const loadPrompt = async () => {
      setLoading(true);
      const repo = getPromptRepository();
      const existing = await repo.findById(promptId);
      if (existing) {
        setPrompt(existing);
        setDraft({
          title: existing.title,
          description: existing.description ?? '',
          content: existing.content,
          tags: existing.tags,
        });
        // Do NOT set dirty here — this is initial load, not a user edit
      }
      setLoading(false);
    };

    loadPrompt();
  }, [promptId]);

  // Auto-save draft (5s debounce) — only fires when dirty (user made changes)
  useEffect(() => {
    if (!prompt || !dirty) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      const repo = getPromptRepository();
      await repo.update(prompt.id, {
        title: draft.title,
        description: draft.description || undefined,
        content: draft.content,
        tags: draft.tags,
        updated_at: now(),
      });
      setLastSaved(now());
      setHasUnsavedChanges(false);
    }, 5000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [draft, prompt, dirty]);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const updateDraft = useCallback((updates: Partial<PromptDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
    setDirty(true);
  }, []);

  // Create new prompt (for /prompts/new) — atomic: prompt + version in one transaction
  const createPrompt = useCallback(async (): Promise<string> => {
    setSaving(true);
    const repo = getPromptRepository();
    const versionRepo = getPromptVersionRepository();

    const promptIdNew = generateId();
    const versionId = generateId();
    const timestamp = now();

    // Step 1: Create prompt with version_count: 0 and empty current_version_id
    const newPrompt: Prompt = {
      id: promptIdNew,
      workspace_id: DEFAULT_WORKSPACE_ID,
      title: draft.title,
      description: draft.description || undefined,
      content: draft.content,
      tags: draft.tags,
      status: 'active',
      is_favorite: false,
      current_version_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { version_count: 0 },
    };

    await repo.create(newPrompt);

    // Step 2: Use createVersionAtomic to create version + update prompt atomically
    const version: PromptVersion = {
      id: versionId,
      prompt_id: promptIdNew,
      version_number: 1,
      content: draft.content,
      change_summary: 'Initial version',
      created_at: timestamp,
    };

    await versionRepo.createVersionAtomic(version, promptIdNew);

    const savedPrompt = { ...newPrompt, current_version_id: versionId, metadata: { version_count: 1 } };
    setPrompt(savedPrompt);
    setSaving(false);
    setLastSaved(timestamp);
    setHasUnsavedChanges(false);
    return promptIdNew;
  }, [draft]);

  // Save new version
  const saveVersion = useCallback(async (changeSummary?: string) => {
    if (!prompt) return;

    setSaving(true);
    const versionRepo = getPromptVersionRepository();
    const latestVersion = await versionRepo.getLatestVersion(prompt.id);

    const newVersion: PromptVersion = {
      id: generateId(),
      prompt_id: prompt.id,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      content: draft.content,
      change_summary: changeSummary,
      created_at: now(),
      previous_version_id: latestVersion?.id,
    };

    await versionRepo.createVersionAtomic(newVersion, prompt.id);

    // Also update the draft fields on the prompt
    const repo = getPromptRepository();
    await repo.update(prompt.id, {
      title: draft.title,
      description: draft.description || undefined,
      content: draft.content,
      tags: draft.tags,
      updated_at: now(),
    });

    setPrompt((prev) =>
      prev
        ? {
            ...prev,
            current_version_id: newVersion.id,
            title: draft.title,
            description: draft.description || undefined,
            content: draft.content,
            tags: draft.tags,
            updated_at: now(),
            metadata: { version_count: prev.metadata.version_count + 1 },
          }
        : null
    );
    setSaving(false);
    setLastSaved(now());
    setHasUnsavedChanges(false);
  }, [draft, prompt]);

  return {
    prompt,
    draft,
    updateDraft,
    loading,
    saving,
    lastSaved,
    hasUnsavedChanges,
    createPrompt,
    saveVersion,
  };
}
```

- [ ] **Step 3: Create useVersions hook**

```typescript
// src/hooks/useVersions.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PromptVersion } from '@/types';
import { getPromptVersionRepository } from '@/lib/db/repositories/factory';

export function useVersions(promptId: string) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PromptVersion | null>(null);
  const [compareWith, setCompareWith] = useState<PromptVersion | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const repo = getPromptVersionRepository();
    const results = await repo.findByPromptId(promptId);
    setVersions(results);
    // Auto-select latest on first load only (use functional update to avoid dep on selected)
    setSelected((prev) => prev ?? (results[0] ?? null));
    setLoading(false);
  }, [promptId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => {
      if (!prev && versions.length >= 2) {
        // Auto-select previous version for comparison
        setCompareWith(versions[1] ?? null);
      } else {
        setCompareWith(null);
      }
      return !prev;
    });
  }, [versions]);

  const restoreVersion = useCallback(async (version: PromptVersion) => {
    const repo = getPromptVersionRepository();
    const latestVersion = await repo.getLatestVersion(promptId);
    const { generateId } = await import('@/lib/utils/id-generator');
    const { now } = await import('@/lib/utils/datetime');

    const restored: PromptVersion = {
      id: generateId(),
      prompt_id: promptId,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      content: version.content,
      change_summary: `Restored from version ${version.version_number}`,
      created_at: now(),
      previous_version_id: latestVersion?.id,
    };

    await repo.createVersionAtomic(restored, promptId);

    // Also update the Prompt.content (mutable draft) to match the restored version
    const { getPromptRepository } = await import('@/lib/db/repositories/factory');
    const promptRepo = getPromptRepository();
    await promptRepo.update(promptId, { content: version.content, updated_at: now() });

    await load();
    setSelected(restored);
  }, [promptId, load]);

  return {
    versions,
    loading,
    selected,
    setSelected,
    compareWith,
    setCompareWith,
    compareMode,
    toggleCompareMode,
    restoreVersion,
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: add data hooks — usePrompts, usePrompt, useVersions"
```

---

## Task 9: Prompt Library Page (Home)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace home page with Prompt Library**

Replace `src/app/page.tsx` entirely with a client component that uses `usePrompts` hook:

```typescript
// src/app/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePrompts } from '@/hooks/usePrompts';
import { PromptCard } from '@/components/PromptCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

type FilterType = 'all' | 'favorites' | 'archived';
type SortOption = 'updated_at' | 'created_at' | 'title';

// Wrap in Suspense because useSearchParams() requires it in Next.js 16
export default function PromptLibraryWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <PromptLibrary />
    </Suspense>
  );
}

function PromptLibrary() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { prompts, loading, allTags, toggleFavorite, duplicatePrompt, archivePrompt, deletePrompt } =
    usePrompts({ searchQuery, filter, sortBy, sortOrder });

  // Apply tag filter client-side (allTags are now {tag, count} objects)
  const filteredPrompts = tagFilter
    ? prompts.filter((p) => p.tags.includes(tagFilter))
    : prompts;

  // Tag suggestions for other components (flat list)
  const tagSuggestions = allTags.map((t) => t.tag);

  const handleDelete = async () => {
    if (deleteId) {
      await deletePrompt(deleteId);
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex gap-6">
        {/* Sidebar: Tags + Filters */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Filter
          </h3>
          <div className="space-y-1">
            {(['all', 'favorites', 'archived'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setTagFilter(null); }}
                className={`block w-full rounded px-2 py-1 text-left text-sm ${
                  filter === f && !tagFilter ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {allTags.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Tags
              </h3>
              <div className="flex flex-wrap gap-1">
                {allTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={`rounded px-2 py-0.5 text-xs ${
                      tagFilter === tag
                        ? 'bg-blue-100 font-medium text-blue-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag} <span className="text-gray-400">({count})</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Search + Sort bar */}
          <div className="mb-4 flex items-center gap-3">
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-') as [SortOption, 'asc' | 'desc'];
                setSortBy(by);
                setSortOrder(order);
              }}
              className="rounded-md border border-gray-300 px-2 py-2 text-sm"
            >
              <option value="updated_at-desc">Recently updated</option>
              <option value="created_at-desc">Recently created</option>
              <option value="title-asc">A-Z</option>
              <option value="title-desc">Z-A</option>
            </select>
          </div>

          {/* Prompts grid */}
          {filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-gray-500">
                {searchQuery || tagFilter ? 'No prompts match your search.' : 'No prompts yet.'}
              </p>
              {!searchQuery && !tagFilter && (
                <Link
                  href="/prompts/new"
                  className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Create your first prompt
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onToggleFavorite={toggleFavorite}
                  onDuplicate={duplicatePrompt}
                  onArchive={archivePrompt}
                  onDelete={(id) => setDeleteId(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Prompt"
        message="This will permanently delete this prompt and all its versions. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

```bash
npx next dev -p 3847 &
sleep 5
curl -s http://localhost:3847 | grep -o "No prompts yet"
kill %1
```

Expected: "No prompts yet" in output (empty library state).

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: implement Prompt Library page with search, filters, tags, and sort"
```

---

## Task 10: Create Prompt Page

**Files:**
- Create: `src/components/PromptEditor.tsx`
- Create: `src/app/prompts/new/page.tsx`

- [ ] **Step 1: Create PromptEditor component**

```typescript
// src/components/PromptEditor.tsx
'use client';

import { TagInput } from './TagInput';
import { estimateTokens } from '@/lib/utils/tokens';

interface PromptEditorProps {
  title: string;
  description: string;
  content: string;
  tags: string[];
  tagSuggestions?: string[];
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onTagsChange: (tags: string[]) => void;
  lastSaved: string | null;
  hasUnsavedChanges: boolean;
}

export function PromptEditor({
  title,
  description,
  content,
  tags,
  tagSuggestions = [],
  onTitleChange,
  onDescriptionChange,
  onContentChange,
  onTagsChange,
  lastSaved,
  hasUnsavedChanges,
}: PromptEditorProps) {
  const tokens = estimateTokens(content);

  return (
    <div className="space-y-4">
      {/* Title */}
      <input
        type="text"
        placeholder="Prompt title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        maxLength={200}
        className="w-full border-0 border-b border-gray-200 pb-2 text-2xl font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-0"
      />

      {/* Description */}
      <input
        type="text"
        placeholder="Short description (optional)"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        maxLength={500}
        className="w-full border-0 border-b border-gray-100 pb-2 text-sm text-gray-600 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-0"
      />

      {/* Tags */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Tags</label>
        <TagInput tags={tags} onChange={onTagsChange} suggestions={tagSuggestions} />
      </div>

      {/* Content textarea */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Prompt Content</label>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Write your prompt here..."
          rows={20}
          className="w-full resize-y rounded-md border border-gray-300 bg-gray-50 px-4 py-3 font-mono text-sm leading-relaxed text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex gap-4">
          <span>{content.length} characters</span>
          <span>~{tokens} tokens (approx.)</span>
        </div>
        <div>
          {hasUnsavedChanges && <span className="text-yellow-600">Unsaved changes</span>}
          {!hasUnsavedChanges && lastSaved && (
            <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create new prompt page**

```typescript
// src/app/prompts/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { PromptEditor } from '@/components/PromptEditor';
import { Button } from '@/components/ui/Button';

export default function NewPromptPage() {
  const router = useRouter();
  const { draft, updateDraft, createPrompt, saving } = usePrompt();
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!draft.content.trim()) {
      setError('Content is required');
      return;
    }
    setError('');

    const newId = await createPrompt();
    router.push(`/prompts/${newId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" onKeyDown={handleKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">New Prompt</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push('/')}>
            Cancel
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            Save Prompt
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <PromptEditor
        title={draft.title}
        description={draft.description}
        content={draft.content}
        tags={draft.tags}
        onTitleChange={(title) => updateDraft({ title })}
        onDescriptionChange={(description) => updateDraft({ description })}
        onContentChange={(content) => updateDraft({ content })}
        onTagsChange={(tags) => updateDraft({ tags })}
        lastSaved={null}
        hasUnsavedChanges={false}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders**

```bash
npx next dev -p 3847 &
sleep 5
curl -s http://localhost:3847/prompts/new | grep -o "New Prompt"
kill %1
```

Expected: "New Prompt" found.

- [ ] **Step 4: Commit**

```bash
git add src/components/PromptEditor.tsx src/app/prompts/
git commit -m "feat: implement create prompt page with editor component"
```

---

## Task 11: Edit Prompt Page

**Files:**
- Create: `src/app/prompts/[id]/page.tsx`

- [ ] **Step 1: Create edit prompt page**

```typescript
// src/app/prompts/[id]/page.tsx
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrompt } from '@/hooks/usePrompt';
import { PromptEditor } from '@/components/PromptEditor';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function EditPromptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { prompt, draft, updateDraft, loading, saving, lastSaved, hasUnsavedChanges, saveVersion } =
    usePrompt(id);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  const handleSaveVersion = async () => {
    await saveVersion(changeSummary || undefined);
    setShowSaveModal(false);
    setChangeSummary('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      setShowSaveModal(true);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Prompt not found.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6" onKeyDown={handleKeyDown}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Library
          </Link>
          {prompt.metadata.version_count > 0 && (
            <Link
              href={`/prompts/${id}/versions`}
              className="text-sm text-blue-600 hover:underline"
            >
              History ({prompt.metadata.version_count} versions)
            </Link>
          )}
        </div>
        <Button onClick={() => setShowSaveModal(true)} isLoading={saving}>
          Save Version
        </Button>
      </div>

      <PromptEditor
        title={draft.title}
        description={draft.description}
        content={draft.content}
        tags={draft.tags}
        onTitleChange={(title) => updateDraft({ title })}
        onDescriptionChange={(description) => updateDraft({ description })}
        onContentChange={(content) => updateDraft({ content })}
        onTagsChange={(tags) => updateDraft({ tags })}
        lastSaved={lastSaved}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      {/* Save Version Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        title="Save New Version"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSaveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVersion} isLoading={saving}>
              Save Version
            </Button>
          </div>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Change summary (optional)
          </label>
          <input
            type="text"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="What changed? e.g., 'Improved evaluation criteria'"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveVersion();
              }
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/prompts/
git commit -m "feat: implement edit prompt page with auto-save and version saving"
```

---

## Task 12: Version History Page

**Files:**
- Create: `src/app/prompts/[id]/versions/page.tsx`

- [ ] **Step 1: Create version history page**

```typescript
// src/app/prompts/[id]/versions/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useVersions } from '@/hooks/useVersions';
import { VersionTimeline } from '@/components/VersionTimeline';
import { DiffViewer } from '@/components/DiffViewer';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import Link from 'next/link';

export default function VersionHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const {
    versions,
    loading,
    selected,
    setSelected,
    compareWith,
    setCompareWith,
    compareMode,
    toggleCompareMode,
    restoreVersion,
  } = useVersions(id);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-gray-500">No versions yet.</p>
        <Link href={`/prompts/${id}`} className="text-sm text-blue-600 hover:underline">
          Back to editor
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/prompts/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to editor
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Version History</h1>
        </div>
        <div className="flex items-center gap-2">
          {versions.length >= 2 && (
            <Button
              variant={compareMode ? 'primary' : 'secondary'}
              size="sm"
              onClick={toggleCompareMode}
            >
              {compareMode ? 'Exit Compare' : 'Compare'}
            </Button>
          )}
          {selected && selected.id !== versions[0]?.id && (
            <Button size="sm" variant="secondary" onClick={() => restoreVersion(selected)}>
              Restore v{selected.version_number}
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: Version Timeline */}
        <aside className="w-64 shrink-0">
          <VersionTimeline
            versions={versions}
            selectedId={selected?.id}
            compareId={compareWith?.id}
            onSelect={setSelected}
            onCompareSelect={setCompareWith}
            compareMode={compareMode}
          />
        </aside>

        {/* Right: Content or Diff */}
        <div className="flex-1">
          {compareMode && selected && compareWith ? (
            <DiffViewer
              oldText={compareWith.content}
              newText={selected.content}
              oldLabel={`v${compareWith.version_number}`}
              newLabel={`v${selected.version_number}`}
            />
          ) : selected ? (
            <div className="rounded-md border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    Version {selected.version_number}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(selected.created_at).toLocaleString()}
                  </span>
                </div>
                {selected.change_summary && (
                  <p className="mt-0.5 text-sm text-gray-500">{selected.change_summary}</p>
                )}
              </div>
              <pre className="whitespace-pre-wrap px-4 py-3 font-mono text-sm leading-relaxed text-gray-800">
                {selected.content}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/prompts/
git commit -m "feat: implement version history page with diff viewer and restore"
```

---

## Task 13: Final Wiring and Type Check

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update layout metadata**

In `src/app/layout.tsx`, ensure the metadata title says "Prompt Saver" (it already does, just verify).

- [ ] **Step 2: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issues:
- Old field references (`is_pinned`, `created_by`, etc.) in files not yet updated
- Import paths for deleted files

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 4: Run tests**

```bash
npm test -- --no-coverage
```

Ensure all tests pass.

- [ ] **Step 5: Manual smoke test**

```bash
npx next dev -p 3847
```

Manually verify:
1. Home page shows empty library with "Create your first prompt" CTA
2. Click "Create your first prompt" → editor loads
3. Fill in title + content → click "Save Prompt" → redirects to edit page
4. Edit content → see "Unsaved changes" indicator → wait 5s → auto-saved
5. Click "Save Version" → modal appears → save with summary
6. Click "History" link → version timeline shows
7. Navigate back to library → prompt card visible
8. Search works, favorite toggle works, archive works

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: final wiring, type fixes, and smoke test verification"
```

---

## Task 14: Deploy to Vercel

- [ ] **Step 1: Verify production build**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 2: Commit build fixes if any**

```bash
git add -A
git commit -m "fix: resolve production build issues"
```

- [ ] **Step 3: Deploy**

Create a Vercel project:
1. Go to vercel.com, import the GitHub repo
2. Set environment variables:
   - `NEXTAUTH_SECRET` = run `openssl rand -base64 32` to generate
   - `GOOGLE_CLIENT_ID` = from Google Cloud Console
   - `GOOGLE_CLIENT_SECRET` = from Google Cloud Console
3. Deploy

Or use CLI:
```bash
npx vercel
```

- [ ] **Step 4: Verify deployment**

Visit the deployed URL and run through the smoke test from Task 13 Step 5.
