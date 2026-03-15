# Implementation Plan: LLM Prompt Intelligence Platform

**Branch**: `001-prompt-platform` | **Date**: 2026-01-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-prompt-platform/spec.md`

## Summary

A full-stack Next.js SaaS application that enables AI practitioners to create, version, test, and collaborate on LLM prompts. MVP includes prompt authoring with automatic versioning, multi-LLM execution (ChatGPT, Claude, Gemini), and workspace-based prompt library with search. Phase 1 uses browser IndexedDB for persistence with future migration to Firestore. Built as monolithic repo with Next.js App Router frontend and NestJS API routes backend, both in single repository for cohesive development.

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Frontend Framework**: Next.js 15+ (App Router with Server/Client Components)  
**Backend Framework**: NestJS API route handlers (within Next.js)  
**Storage (Phase 1)**: Browser IndexedDB (user-scoped, ephemeral)  
**Storage (Future)**: Google Firestore (cloud persistence, cross-device sync)  
**Database Abstraction**: Repository pattern to enable IndexedDB → Firestore migration  
**Authentication**: Google Sign-In (OAuth2)  
**Styling**: Tailwind CSS (utility-first, WCAG AA accessible)  
**Testing**: Jest + React Testing Library (frontend), Jest (backend)  
**Package Manager**: pnpm  
**Target Platform**: Web (SPA, PWA-ready)  
**Project Type**: Web monolithic (frontend + backend in single repo)

**Performance Goals**:

- Initial page load: <2.5s LCP on 3G (Core Web Vitals)
- Version creation latency: <100ms (atomic)
- Search response: <200ms for 10k prompts
- API response time (p95): <200ms
- Concurrent LLM executions: 100+ parallel without blocking

**Constraints**:

- Version creation must be atomic (no partial updates)
- No in-place edits of PromptVersions (immutable by design)
- Workspace isolation enforced at all data query boundaries
- Provider responses stored raw + normalized for future ML/analytics
- IndexedDB schema must support future Firestore migration (same entity structure)

**Scale/Scope**:

- MVP: Single workspace per user (no team collaboration in Phase 1)
- Prompt limit: 5 (Free tier), unlimited (Pro/Enterprise)
- Batch test limit: 10 executions/month (Free), unlimited (Pro)
- Expected concurrency at launch: 1,000 concurrent users
- Future scale target: 10,000 concurrent users

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Code Quality**:

- ✅ TypeScript strict mode enforced (no `any` types without justification)
- ✅ ESLint + Prettier configuration for style consistency
- ✅ No code duplication (shared utilities, abstract providers)
- ✅ Maximum function complexity: 10 cyclomatic points

**Test-First Development**:

- ✅ Jest unit tests for all utilities, hooks, services (80%+ coverage target)
- ✅ React Testing Library for component integration tests
- ✅ Contract tests for API routes (request/response validation)
- ✅ CI/CD gate: tests must pass before merge

**User Experience Consistency**:

- ✅ WCAG 2.1 AA compliance (accessible components, keyboard navigation)
- ✅ Responsive design (tested on 320px to 1920px+)
- ✅ Centralized logging and error tracking
- ✅ Loading/error/empty states explicitly designed

**Performance Requirements**:

- ✅ Core Web Vitals: LCP ≤2.5s, FID ≤100ms, CLS ≤0.1
- ✅ Version creation <100ms (atomic constraint)
- ✅ Search <200ms (optimized queries, indexed data)
- ✅ API p95 latency <200ms
- ✅ Bundle size monitored (<250KB gzipped per page)

**Status**: ✅ PASSED — No constitution violations. Technical approach aligns with all core principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-prompt-platform/
├── plan.md              # This file (technical planning)
├── spec.md              # Feature specification (user stories, requirements)
├── research.md          # Phase 0 output (research findings)
├── data-model.md        # Phase 1 output (entity schemas, relationships)
├── quickstart.md        # Phase 1 output (developer onboarding)
├── contracts/           # Phase 1 output (API contracts)
│   ├── auth.md
│   ├── prompts.md
│   ├── llm-providers.md
│   ├── test-runs.md
│   └── workspaces.md
├── checklists/
│   └── requirements.md   # Quality validation (PASSED)
└── tasks.md             # Phase 2 output (implementation tasks)
```

### Source Code (Monolithic Repository)

```text
.
├── public/              # Static assets
├── src/
│   ├── app/             # Next.js App Router
│   │   ├── (auth)/      # Authentication flows
│   │   │   ├── login/page.tsx
│   │   │   └── callback/route.ts
│   │   ├── dashboard/   # Main app (protected)
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── [workspaceId]/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── prompts/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── [promptId]/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── layout.tsx
│   │   │   │   │   └── new/page.tsx
│   │   │   │   ├── settings/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   └── layout.tsx
│   │   └── api/         # API route handlers
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── callback/route.ts
│   │       ├── workspaces/
│   │       │   └── [workspaceId]/
│   │       │       ├── prompts/
│   │       │       │   ├── route.ts (GET/POST)
│   │       │       │   └── [promptId]/
│   │       │       │       ├── route.ts (GET/PUT)
│   │       │       │       ├── versions/route.ts (GET)
│   │       │       │       ├── test-runs/route.ts (GET/POST)
│   │       │       │       └── favorite/route.ts (POST)
│   │       │       ├── providers/
│   │       │       │   ├── route.ts (GET/POST)
│   │       │       │   └── [providerId]/route.ts (DELETE)
│   │       │       └── route.ts (workspace metadata)
│   │       └── health/route.ts
│   ├── components/      # React components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Navbar.tsx
│   │   │   └── Layout.tsx
│   │   ├── prompts/
│   │   │   ├── PromptEditor.tsx
│   │   │   ├── VersionTimeline.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   └── PromptList.tsx
│   │   ├── testing/
│   │   │   ├── ProviderSelector.tsx
│   │   │   ├── TestRunner.tsx
│   │   │   ├── ResultsGrid.tsx
│   │   │   └── RatingPanel.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── icons/
│   │       └── [icon components]
│   ├── hooks/           # Custom React hooks
│   │   ├── usePrompts.ts
│   │   ├── useWorkspace.ts
│   │   ├── useTestRuns.ts
│   │   ├── useProviders.ts
│   │   └── useLocalStorage.ts
│   ├── lib/             # Shared utilities
│   │   ├── db/          # IndexedDB access layer
│   │   │   ├── client.ts
│   │   │   ├── schemas.ts
│   │   │   ├── migrations.ts
│   │   │   └── repositories/
│   │   │       ├── baseRepository.ts
│   │   │       ├── promptRepository.ts
│   │   │       ├── versionRepository.ts
│   │   │       ├── testRunRepository.ts
│   │   │       └── providerRepository.ts
│   │   ├── providers/   # LLM provider abstraction
│   │   │   ├── types.ts
│   │   │   ├── adapters/
│   │   │   │   ├── openaiAdapter.ts
│   │   │   │   ├── anthropicAdapter.ts
│   │   │   │   └── googleAdapter.ts
│   │   │   ├── executor.ts
│   │   │   └── responseNormalizer.ts
│   │   ├── auth/
│   │   │   ├── google.ts
│   │   │   ├── session.ts
│   │   │   └── middleware.ts
│   │   ├── utils/
│   │   │   ├── diffGenerator.ts
│   │   │   ├── logging.ts
│   │   │   ├── validation.ts
│   │   │   └── errors.ts
│   │   └── constants/
│   │       ├── providers.ts
│   │       ├── limits.ts
│   │       └── defaults.ts
│   ├── types/           # TypeScript types
│   │   ├── index.ts
│   │   ├── db.ts
│   │   ├── api.ts
│   │   └── providers.ts
│   └── styles/
│       ├── globals.css
│       └── tailwind.config.ts
├── tests/
│   ├── unit/
│   │   ├── utils/
│   │   ├── hooks/
│   │   └── providers/
│   ├── integration/
│   │   ├── api/
│   │   ├── db/
│   │   └── auth/
│   └── e2e/
│       └── [playwright tests]
├── prisma/              # (Future: when migrating to backend DB)
│   └── schema.prisma
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── jest.config.js
└── next.config.js
```

**Structure Decision**: Monolithic Next.js repository with colocated frontend and API routes. This enables:

- Shared TypeScript types between frontend and API
- Unified testing and deployment
- Easier future migration: move API routes to separate NestJS backend when needed
- IndexedDB repository pattern abstraction enables future cloud storage swap without UI changes

## Complexity Tracking

> **No Constitution violations — all complexity justified by requirements**

| Decision                                        | Justification                                                                               | Alternative Rejected                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Monolithic repo (not separate frontend/backend) | Simplifies type sharing, deployment, and future migration to NestJS                         | Microservices: adds infrastructure complexity without current scale need                          |
| Repository pattern for IndexedDB                | Enables future swap to Firestore/PostgreSQL without changing UI code                        | Direct IndexedDB queries: couples storage layer to components, blocks migration                   |
| Provider adapter pattern                        | LLMProviderAdapter allows adding ChatGPT/Claude/Gemini without duplicating auth/retry logic | Inline provider logic: each provider would have separate execution, error handling, normalization |

---

## Phase 0: Research & Unknowns (RESOLVED)

### Research Tasks Completed

1. **IndexedDB Schema Design** ✅
   - Decision: Use IDBKeyRange queries with compound indexes for workspace/prompt queries
   - Rationale: Supports fast <100ms version creation + <200ms search
   - Implementation: Index by (workspace_id, prompt_id) for list queries; (workspace_id, created_at desc) for timeline

2. **Google OAuth2 Integration** ✅
   - Decision: Use next-auth.js with Google provider
   - Rationale: Battle-tested, handles token refresh, session persistence
   - Configuration: Single OAuth app, localhost://3000/api/auth/callback for dev

3. **LLM Provider API Rate Limiting** ✅
   - Decision: Queue-based execution (async, non-blocking) with client-side rate display
   - Rationale: Prevents blocking UI; allows parallel execution up to provider limits
   - Implementation: Bull.js for job queue (in-memory for MVP, Redis for production)

4. **Performance Optimization: Version Creation <100ms** ✅
   - Decision: Immutable append-only design + optimistic UI updates
   - Rationale: No read-modify-write cycle; IndexedDB transaction is single write
   - Validation: Measure with performance.mark() in tests

5. **Provider Response Normalization** ✅
   - Decision: Store raw response + computed fields (tokens, cost, latency)
   - Rationale: Preserves provider-specific data for audits; normalized fields enable analytics
   - Schema: `TestRun.responses[i] = { raw: {...}, normalized: { tokens, latency, cost } }`

---

## Phase 1: Design & Contracts

### 1.1 Data Model

See [data-model.md](data-model.md) for complete entity definitions.

**Core Entities**:

```
User (Google OAuth subject)
  ├─> Workspace (user's "project")
  │     ├─> Prompt (versioned document)
  │     │     └─> PromptVersion (immutable, append-only)
  │     │           └─> TestRun (execution against 1+ providers)
  │     │                 └─> TestResult (single provider response + rating)
  │     └─> LLMProvider (API credentials, user-configured)
```

**Key Constraints**:

- PromptVersion is immutable (no edits after creation)
- Prompt points to latest PromptVersion
- TestRun always references specific PromptVersion (enables version comparison)
- Provider responses stored raw + normalized
- Workspace_id scope enforced in all queries

### 1.2 API Contracts

See `contracts/` directory:

- [auth.md](contracts/auth.md) — Authentication flows
- [prompts.md](contracts/prompts.md) — Prompt CRUD + versioning
- [llm-providers.md](contracts/llm-providers.md) — Provider management
- [test-runs.md](contracts/test-runs.md) — Test execution + results
- [workspaces.md](contracts/workspaces.md) — Workspace operations

**Contract Example** (Prompt Creation):

```
POST /api/workspaces/[workspaceId]/prompts
Request: { title, description, systemPrompt, userPrompt, tags[] }
Response: { id, version: 1, created: ISO8601, content: {...} }
Status: 201 Created
Errors: 400 (invalid), 401 (auth), 403 (workspace access), 409 (quota)
```

### 1.3 Implementation Approach

**Phase 1a (MVP — P1 Stories)**:

- Prompt authoring + versioning (immutable design)
- Multi-LLM execution via provider adapters
- Search + library (IndexedDB full-text search)
- Authentication (Google Sign-In)

**Phase 1b (Team Features — P2 Stories)**:

- Collaboration + sharing (add workspace members)
- Batch evaluation framework
- Analytics dashboards
- Cloud sync placeholder (Firestore)

**Phase 1c (Monetization — P3)**:

- Tier enforcement (quota gates)
- Stripe integration
- Usage tracking

---

## Next Steps

1. **Phase 0 Research** → Conduct detailed research on specific technical unknowns (in progress)
2. **Phase 1 Design** → Create detailed data model, API contracts, and quickstart guide
3. **Phase 1 Agent Context** → Update Copilot context with tech stack and architecture decisions
4. **Phase 2 Tasks** → Break down into actionable implementation tasks per user story

**Ready to proceed with Phase 0 research**. Research findings will be consolidated in [research.md](research.md).
