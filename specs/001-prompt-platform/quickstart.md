# Developer Quickstart: LLM Prompt Intelligence Platform

**Target Audience**: Frontend and full-stack developers  
**Prerequisites**: Node.js 18+, pnpm, TypeScript knowledge  
**Estimated Setup Time**: 15 minutes

---

## Project Overview

This is a monolithic Next.js + TypeScript application for managing, versioning, and testing LLM prompts. The codebase includes:

- **Frontend**: Next.js App Router with React Server Components
- **Backend**: API route handlers (NestJS-style patterns)
- **Storage**: IndexedDB (Phase 1), Firestore (Phase 2+)
- **Auth**: Google OAuth2 via next-auth.js

**Key Principle**: Repository pattern abstracts storage layer, enabling future IndexedDB → Firestore migration without UI changes.

---

## Getting Started

### 1. Clone & Install

```bash
git clone <repo>
cd prompt-saver

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local
```

### 2. Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth2 credentials (Web Application)
3. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy `Client ID` and `Client Secret` to `.env.local`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=generate-with: openssl rand -base64 32
```

### 3. Run Development Server

```bash
pnpm dev
```

Navigate to `http://localhost:3000`

### 4. Verify Setup

- [ ] OAuth login works
- [ ] Can create a prompt
- [ ] Version history appears
- [ ] No console errors

---

## Project Structure at a Glance

```
src/
├── app/
│   ├── (auth)/           # Login/OAuth flows
│   ├── dashboard/        # Main app (protected)
│   ├── api/              # Backend endpoints
│   └── page.tsx          # Landing page
├── components/           # React components
├── lib/
│   ├── db/              # IndexedDB access
│   │   └── repositories/  # CRUD classes per entity
│   ├── providers/       # LLM provider abstractions
│   └── utils/           # Helpers (diff, logging, etc.)
├── hooks/               # Custom React hooks
├── types/               # TypeScript types
└── styles/              # Tailwind CSS
```

---

## Key Concepts

### 1. Immutable Versions

Every save creates a new `PromptVersion`. The current `Prompt` always points to the latest version.

```typescript
// ✅ CREATE new version
const newVersion = { version_number: 2, content: {...} };
await versionRepository.create(newVersion);
await promptRepository.update(promptId, { current_version_id: newVersion.id });

// ❌ DON'T: Edit version in-place
await versionRepository.update(versionId, { content: {...} }); // Will error
```

### 2. Repository Pattern

Repositories abstract storage layer. This enables swapping IndexedDB ↔ Firestore without changing UI code.

```typescript
// Interface (same for all storage backends)
interface IPromptRepository {
  create(prompt: Prompt): Promise<Prompt>;
  findById(id: string): Promise<Prompt | null>;
  findByWorkspace(workspaceId: string): Promise<Prompt[]>;
  update(id: string, updates: Partial<Prompt>): Promise<void>;
}

// Phase 1: IndexedDB implementation
export class IndexedDBPromptRepository implements IPromptRepository { ... }

// Phase 2: Firestore implementation (same interface)
export class FirestorePromptRepository implements IPromptRepository { ... }
```

### 3. Workspace Isolation

All queries must be scoped by `workspace_id`. Every API endpoint checks this.

```typescript
// ✅ CORRECT: Scoped query
const prompts = await promptRepository.findByWorkspace(workspaceId);

// ❌ WRONG: Unscoped query (security issue)
const prompts = await promptRepository.getAll();
```

### 4. Provider Abstraction

LLMProviderAdapter pattern enables adding new providers without duplicating execution logic.

```typescript
abstract class LLMProviderAdapter {
  abstract execute(prompt: string, options: ExecuteOptions): Promise<ExecutionResult>;
  abstract normalizeResponse(raw: any): NormalizedResponse;
  abstract classifyError(error: any): ErrorType;
}

class OpenAIAdapter extends LLMProviderAdapter { ... }
class ClaudeAdapter extends LLMProviderAdapter { ... }
class GeminiAdapter extends LLMProviderAdapter { ... }
```

---

## Common Tasks

### Task 1: Add a New Prompt

```typescript
// In: src/app/api/workspaces/[workspaceId]/prompts/route.ts
export async function POST(req: Request) {
  const { title, systemPrompt, userPrompt } = await req.json();

  // Create prompt with version 1
  const prompt = await promptRepository.create({
    id: uuid(),
    title,
    workspace_id: workspaceId,
    // ... other fields
  });

  const version = await versionRepository.create({
    prompt_id: prompt.id,
    version_number: 1,
    content: { systemPrompt, userPrompt },
  });

  await promptRepository.update(prompt.id, {
    current_version_id: version.id,
  });

  return Response.json(prompt, { status: 201 });
}
```

### Task 2: Create a New Prompt Version

```typescript
// ✅ Atomic version creation
const transaction = db.transaction(["prompts", "promptVersions"], "readwrite");

// 1. Fetch current prompt
const currentPrompt = await promptRepository.findById(promptId);
const currentVersion = currentPrompt.version_number;

// 2. Create new version
const newVersion = {
  id: uuid(),
  prompt_id: promptId,
  version_number: currentVersion + 1,
  content: newContent,
  previous_version_id: currentPrompt.current_version_id,
};
await versionRepository.create(newVersion); // Within transaction

// 3. Update prompt to latest
await promptRepository.update(promptId, {
  current_version_id: newVersion.id,
  updated_at: now,
});

// Both succeed or both fail (atomic)
```

### Task 3: Execute Test on Multiple Providers

```typescript
// In: TestRunner component
async function executeTestRun(promptVersionId: string, providerIds: string[]) {
  // 1. Fetch prompt version
  const version = await versionRepository.findById(promptVersionId);

  // 2. Execute in parallel against all providers
  const results = await Promise.all(
    providerIds.map(async (providerId) => {
      const provider = await providerRepository.findById(providerId);
      const adapter = ProviderFactory.create(provider); // Returns OpenAI/Claude/Gemini adapter

      try {
        const result = await adapter.execute(version.content.userPrompt, {
          temperature: version.content.temperature,
          max_tokens: version.content.max_tokens,
        });

        return {
          provider_id: providerId,
          status: "success",
          raw_response: result.raw,
          normalized: adapter.normalizeResponse(result.raw),
        };
      } catch (error) {
        return {
          provider_id: providerId,
          status: "error",
          error: adapter.classifyError(error),
        };
      }
    }),
  );

  // 3. Store test run
  const testRun = await testRunRepository.create({
    id: uuid(),
    prompt_id: promptVersionId.split("/")[0],
    prompt_version_id: promptVersionId,
    results,
    created_at: new Date().toISOString(),
  });

  return testRun;
}
```

### Task 4: Search Prompts (Full-Text)

```typescript
// IndexedDB full-text search implementation
async function searchPrompts(workspaceId: string, query: string) {
  const db = await getDBInstance();
  const prompts = await db.prompts
    .where("workspace_id")
    .equals(workspaceId)
    .toArray();

  // Client-side filtering (for MVP; server-side for scale)
  return prompts.filter(
    (p) =>
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      p.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase())),
  );
}
```

---

## Testing

### Unit Tests (Utilities, Hooks)

```bash
pnpm test:unit
```

Example test file: `tests/unit/utils/diffGenerator.test.ts`

```typescript
describe("diffGenerator", () => {
  it("should detect added lines", () => {
    const diff = generateDiff("line1", "line1\nline2");
    expect(diff).toContainEqual({ type: "add", text: "line2" });
  });
});
```

### Integration Tests (API Routes, DB)

```bash
pnpm test:integration
```

Example: `tests/integration/api/prompts.test.ts`

```typescript
describe("POST /api/workspaces/[id]/prompts", () => {
  it("should create prompt with version 1", async () => {
    const response = await fetch("/api/workspaces/ws-1/prompts", {
      method: "POST",
      body: JSON.stringify({ title: "Test", userPrompt: "..." }),
    });

    expect(response.status).toBe(201);
    const prompt = await response.json();
    expect(prompt.current_version_id).toBeDefined();
  });
});
```

### Run All Tests

```bash
pnpm test
```

---

## Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# NextAuth
NEXTAUTH_SECRET=...  # Generated with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# LLM Provider APIs (user-provided via UI, not here)

# Optional: Logging
LOG_LEVEL=debug  # debug, info, warn, error
```

---

## File Conventions

### Component Files

```typescript
// Client Components (require 'use client' directive)
// - src/components/prompts/PromptEditor.tsx
// - src/components/testing/TestRunner.tsx
// - src/components/common/Button.tsx

"use client";

export function PromptEditor() {
  // Interactive, uses hooks
}

// Server Components (default, no directive)
// - src/components/layout/Navbar.tsx
// - Can fetch data, use secrets
```

### Repository Files

```typescript
// src/lib/db/repositories/promptRepository.ts
export interface IPromptRepository {
  create(prompt: Prompt): Promise<Prompt>;
  // ... other methods
}

export class IndexedDBPromptRepository implements IPromptRepository {
  async create(prompt: Prompt): Promise<Prompt> {
    // Implementation
  }
}
```

### API Route Files

```typescript
// src/app/api/workspaces/[workspaceId]/prompts/route.ts
import { auth } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Handle request
}
```

---

## Performance Tips

### 1. Optimize IndexedDB Queries

```typescript
// ✅ Good: Use indexes for fast queries
const prompts = await db.prompts
  .where("(workspace_id, updated_at)")
  .between([workspaceId, new Date("2026-01-01")], [workspaceId, new Date()])
  .toArray();

// ❌ Avoid: Full table scan
const prompts = await db.prompts.toArray();
```

### 2. Memoize Repository Instances

```typescript
// ✅ Reuse instances
const promptRepo = usePromptRepository();

// Use promptRepo multiple times in component
```

### 3. Version Creation Latency

Optimize atomic transactions to stay under 100ms:

```typescript
// Profile with performance marks
performance.mark("version-start");
// ... create version
performance.mark("version-end");
console.log(performance.measure("version", "version-start", "version-end"));
```

---

## Debugging

### Enable Debug Logging

```env
LOG_LEVEL=debug
```

Check browser console for detailed logs:

- API calls
- IndexedDB operations
- Provider executions
- Errors with stack traces

### React DevTools

```bash
# Install React DevTools browser extension
# Inspect components, hooks state, performance
```

### IndexedDB Inspector

In Chrome DevTools:

1. Open DevTools (F12)
2. Go to Application → IndexedDB
3. Inspect `prompt-saver` database
4. Browse tables: `users`, `workspaces`, `prompts`, `versions`, `testRuns`, `providers`

---

## Troubleshooting

### OAuth Not Working

**Problem**: "Callback mismatch"  
**Solution**: Ensure redirect URI in Google Console matches `NEXTAUTH_URL + /api/auth/callback/google`

### IndexedDB Errors

**Problem**: "QuotaExceededError"  
**Solution**: Browser storage quota exceeded. Clear old data or increase browser storage quota.

### Version Creation Slow (>100ms)

**Problem**: Version creation takes too long  
**Solution**:

- Check for large blob storage in versions
- Verify IndexedDB indexes are created
- Profile with performance marks

### Test Execution Timeout

**Problem**: Tests hang when executing against LLM provider  
**Solution**:

- Verify API key is valid
- Check provider rate limits
- Increase timeout in provider config
- Check browser network in DevTools

---

## Next Steps

1. **Start with P1**: Implement prompt authoring + versioning (User Story 1)
2. **Add multi-LLM**: Integrate providers (User Story 2)
3. **Enable search**: Add library + search (User Story 3)
4. **Test thoroughly**: Aim for 80%+ coverage
5. **Performance**: Measure Core Web Vitals, optimize hot paths

---

## Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Dexie.js](https://dexie.org/) (IndexedDB wrapper library, if we add it)
- [NextAuth.js Docs](https://next-auth.js.org/)

---

## Questions?

Check existing issues on GitHub or create a new one with:

- Error message / stack trace
- Steps to reproduce
- Environment (Node version, browser, etc.)
