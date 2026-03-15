# Data Model: LLM Prompt Intelligence Platform

**Date**: 2026-01-26  
**Storage**: IndexedDB (Phase 1), Firestore (Future)  
**Schema Version**: 1.0

---

## Entity Definitions

### User

Represents an authenticated user (via Google OAuth).

```typescript
interface User {
  id: string; // Google OAuth subject
  email: string; // Google email
  name: string; // Display name
  avatar?: string; // Google profile picture URL
  created_at: string; // ISO8601 timestamp
  last_login: string; // ISO8601 timestamp
  tier: "free" | "pro" | "enterprise"; // Subscription tier
  subscription_id?: string; // Stripe subscription ID
}
```

**Indexes**:

- Primary: `id`
- Secondary: `email` (unique)

**Constraints**:

- Email must be unique per workspace (future: support team invites)

---

### Workspace

Represents a user's "project" or workspace for organizing prompts.

```typescript
interface Workspace {
  id: string; // UUID
  user_id: string; // FK: User.id
  name: string; // "My Project", "LLM Testing", etc.
  description?: string; // Optional workspace description
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
  settings: {
    defaultProvider?: string; // Default LLM provider for quick testing
    theme?: "light" | "dark"; // UI preference
  };
  metadata: {
    promptCount: number; // Denormalized for quick stats
    lastActivity: string; // ISO8601 of last action
  };
}
```

**Indexes**:

- Primary: `id`
- Secondary: `user_id` (one user → many workspaces)

**Constraints**:

- One workspace per user in Phase 1
- Future: support multiple workspaces when teams enabled

---

### Prompt

Represents a versioned prompt document. Points to latest version.

```typescript
interface Prompt {
  id: string; // UUID
  workspace_id: string; // FK: Workspace.id (scoping)
  title: string; // "Email classifier", "Code reviewer", etc.
  description?: string; // Markdown-formatted description
  current_version_id: string; // FK: PromptVersion.id (always latest)
  created_by: string; // FK: User.id
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp (updates when new version created)
  tags: string[]; // ["classification", "email", "production"]
  is_favorite: boolean; // User favorited this prompt
  is_pinned: boolean; // User pinned to top of library
  status: "draft" | "active" | "archived"; // Lifecycle state
  metadata: {
    version_count: number; // Total versions
    test_run_count: number; // Total test runs against all versions
    last_tested: string; // ISO8601 of most recent test run
  };
}
```

**Indexes**:

- Primary: `id`
- Compound: `(workspace_id, created_at DESC)` for list queries
- Compound: `(workspace_id, is_favorite DESC, updated_at DESC)` for favorites list
- Compound: `(workspace_id, title)` for search

**Constraints**:

- `workspace_id` required (isolation)
- `current_version_id` must reference existing PromptVersion in same Prompt
- `created_by` must be User.id
- Immutable after creation except: `is_favorite`, `is_pinned`, `tags`, `status`, `current_version_id`

---

### PromptVersion

Immutable snapshot of a prompt at a point in time.

```typescript
interface PromptVersion {
  id: string; // UUID
  prompt_id: string; // FK: Prompt.id
  version_number: number; // 1, 2, 3, ... (auto-increment)
  content: {
    systemPrompt: string; // System message (optional)
    userPrompt: string; // Main prompt content
    temperature?: number; // LLM parameter (0-2)
    max_tokens?: number; // LLM parameter
    top_p?: number; // LLM parameter
  };
  metadata: {
    summary?: string; // Version summary ("Improved clarity", "Fixed typo")
    tags: string[]; // Version-specific tags
  };
  created_by: string; // FK: User.id
  created_at: string; // ISO8601 timestamp (immutable)
  previous_version_id?: string; // FK: PromptVersion.id (for diff tracking)

  // Immutable after creation
  readonly?: boolean; // Always true (enforced in code)
}
```

**Indexes**:

- Primary: `id`
- Compound: `(prompt_id, version_number DESC)` for version history
- Secondary: `prompt_id` for "all versions of prompt"

**Constraints**:

- `version_number` auto-incremented per Prompt (1-based)
- Immutable after creation (DELETE after 30 days allowed, but not UPDATE)
- `previous_version_id` links to prior version for diff computation
- Creation must be atomic: single IndexedDB transaction

**Atomic Creation Guarantee**:

```typescript
// Pseudo-code for atomic version creation
transaction = db.transaction(['prompts', 'promptVersions'], 'readwrite');

// 1. Create new version
newVersion = { id, prompt_id, version_number: lastVersion.version_number + 1, ... };
transaction.objectStore('promptVersions').add(newVersion);

// 2. Update prompt to point to new version
prompt.current_version_id = newVersion.id;
prompt.updated_at = now;
transaction.objectStore('prompts').put(prompt);

await transaction.complete(); // Both succeed or both fail
```

---

### TestRun

Represents a batch execution of a prompt version against one or more LLM providers.

```typescript
interface TestRun {
  id: string; // UUID
  prompt_id: string; // FK: Prompt.id
  prompt_version_id: string; // FK: PromptVersion.id (immutable reference)
  workspace_id: string; // FK: Workspace.id (scoping)
  created_by: string; // FK: User.id
  created_at: string; // ISO8601 timestamp

  // Execution metadata
  execution: {
    status: "queued" | "running" | "completed" | "failed";
    started_at?: string; // When execution began
    completed_at?: string; // When execution ended
    duration_ms?: number; // Total execution time
  };

  // Test inputs
  inputs: {
    provider_ids: string[]; // Providers to test against
    input_data?: Record<string, any>; // User-provided test input
    parameters: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
    };
  };

  // Test results (one per provider)
  results: TestResult[]; // See below

  // User ratings/feedback
  ratings: {
    [provider_id: string]: {
      score: 1 | 2 | 3 | 4 | 5; // 1-5 stars
      notes?: string; // User feedback
      rated_at: string; // ISO8601
    };
  };
}
```

**Indexes**:

- Primary: `id`
- Compound: `(workspace_id, prompt_id)` for test history
- Compound: `(workspace_id, created_at DESC)` for recency
- Secondary: `prompt_version_id` for "all tests against version X"

**Constraints**:

- Always references specific PromptVersion (enables version-to-version comparison)
- Multiple TestRuns can exist for same PromptVersion
- Results array length = providers tested
- Ratings optional (can be added after execution)

---

### TestResult

Individual result from testing a prompt against one provider.

```typescript
interface TestResult {
  provider_id: string; // FK: LLMProvider.id
  status: "success" | "timeout" | "error" | "rate_limited";

  // Raw provider response (stored as-is for audits)
  raw_response: {
    model: string; // e.g., "gpt-4-turbo"
    content: string; // Full response text
    stop_reason: string; // "stop", "length", etc.
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  };

  // Normalized fields (computed for analytics)
  normalized: {
    tokens_total: number;
    latency_ms: number;
    cost_usd?: number; // Estimated cost
    character_count: number;
  };

  // Error info (if failed)
  error?: {
    code: string; // "timeout", "invalid_api_key", "rate_limit", etc.
    message: string;
  };

  executed_at: string; // ISO8601 timestamp
}
```

**Constraints**:

- Immutable after creation
- Used for comparison metrics (which provider produced best results)
- Raw response preserved for model fine-tuning data in future

---

### LLMProvider

User's configured LLM provider integration.

```typescript
interface LLMProvider {
  id: string; // UUID
  workspace_id: string; // FK: Workspace.id (scoping)
  provider_name: "openai" | "anthropic" | "google" | "custom";

  // Credentials (encrypted at rest)
  credentials: {
    api_key: string; // ENCRYPTED
    org_id?: string; // Optional (OpenAI org)
    region?: string; // Optional (Google region)
  };

  // Configuration
  config: {
    model: string; // "gpt-4-turbo", "claude-3-opus", etc.
    base_url?: string; // Custom endpoint (for self-hosted)
    timeout_ms: number; // Timeout for this provider
  };

  // Metadata
  created_at: string; // ISO8601 timestamp
  updated_at: string; // ISO8601 timestamp
  status: "active" | "disabled" | "error";
  error?: string; // Last error message (e.g., "Invalid API key")
  last_tested: string; // ISO8601 of last successful call

  // Usage tracking
  stats: {
    total_calls: number;
    successful_calls: number;
    failed_calls: number;
    total_tokens: number;
    estimated_cost_usd: number;
  };
}
```

**Indexes**:

- Primary: `id`
- Compound: `(workspace_id, provider_name)` for "which providers configured"

**Constraints**:

- API keys encrypted before storage (using Web Crypto API)
- One provider per type per workspace (can't have 2x OpenAI configs)
- User must provide own API credentials (no key brokering)
- Status changes trigger validation (e.g., test connection on enable)

---

### Rating (embedded in TestRun)

```typescript
interface Rating {
  provider_id: string; // Which provider was rated
  score: 1 | 2 | 3 | 4 | 5; // Likert scale
  notes?: string; // User feedback
  rated_at: string; // ISO8601
  updated_at?: string; // Last modified
}
```

**Constraints**:

- Can be added/updated after TestRun completes
- Used for tracking "best performing provider" for this prompt version
- Aggregated for dashboard metrics

---

## Relationships & Scoping

### Workspace Isolation

All queries must be scoped by `workspace_id`. Example:

```typescript
// ✅ CORRECT: Scoped by workspace
const prompts = await db.prompts
  .where("workspace_id")
  .equals(workspaceId)
  .toArray();

// ❌ WRONG: No scoping (security issue)
const prompts = await db.prompts.toArray();
```

### Version Immutability Pattern

```typescript
// ✅ CORRECT: New version created, Prompt updated
const newVersion = { id: uuid(), version_number: 2, ... };
await db.promptVersions.add(newVersion);
await db.prompts.update(promptId, { current_version_id: newVersion.id });

// ❌ WRONG: Editing version (breaks contract)
await db.promptVersions.update(versionId, { content: newContent });
```

### Atomic Version Creation

All version creation operations MUST be atomic:

```typescript
const transaction = db.transaction(["prompts", "promptVersions"], "readwrite");
// Add version, update prompt — both succeed or both fail
```

---

## Storage Migration Path (Phase 2+)

**Current Design (IndexedDB)**:

- User data stored locally in browser
- Persistence across sessions via IndexedDB
- No backup; loss if user clears storage

**Future (Firestore)**:

- Same entity schema, translated to Firestore document structure
- Repository pattern enables swap:

```typescript
// Phase 1: IndexedDB
const promptRepo = new IndexedDBPromptRepository();

// Phase 2: Firestore (swap single line)
const promptRepo = new FirestorePromptRepository();

// UI code unchanged
const prompts = await promptRepo.findByWorkspace(workspaceId);
```

### Firestore Document Structure

```
/users/{userId}/workspaces/{workspaceId}/prompts/{promptId}
{
  title, description, current_version_id, created_at, updated_at, tags, is_favorite, is_pinned, status, metadata
}

/users/{userId}/workspaces/{workspaceId}/prompts/{promptId}/versions/{versionId}
{
  version_number, content, metadata, created_by, created_at, previous_version_id
}

/users/{userId}/workspaces/{workspaceId}/test_runs/{testRunId}
{
  prompt_id, prompt_version_id, execution, inputs, results[], ratings, created_at
}

/users/{userId}/workspaces/{workspaceId}/llm_providers/{providerId}
{
  provider_name, config, credentials (encrypted), status, stats, created_at, updated_at
}
```

---

## Constraints Summary

| Constraint                   | Type           | Enforcement                 |
| ---------------------------- | -------------- | --------------------------- |
| Workspace isolation          | Security       | Query-level filtering       |
| PromptVersion immutability   | Data integrity | Code-level (no update API)  |
| Atomic version creation      | Performance    | IndexedDB transaction       |
| Composite indexes            | Performance    | IndexedDB schema            |
| Encrypted credentials        | Security       | Web Crypto API before store |
| One provider per type        | Business logic | Unique constraint           |
| Version reference in TestRun | Analytics      | Foreign key reference       |

---

## Next Steps

1. Implement IndexedDB schema in `src/lib/db/schemas.ts`
2. Create repository classes in `src/lib/db/repositories/`
3. Implement migrations framework for schema updates
4. Add validation layer for all mutations
5. Create Firestore equivalent for future migration
