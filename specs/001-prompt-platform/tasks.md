# Tasks: LLM Prompt Intelligence Platform

**Status**: Ready for implementation  
**Input**: `/specs/001-prompt-platform/` (spec.md, plan.md, data-model.md, contracts/, research.md)  
**Format**: Sequential ID, priority markers [P], story labels [US#], with file paths

**Organization**: 7 user stories organized by priority

- **P1 (MVP)**: US1 Prompt Authoring, US2 Multi-LLM Testing, US3 Search
- **P2 (Team)**: US4 Collaboration, US5 Evaluation, US6 Cloud Sync
- **P3 (Business)**: US7 Monetization

**Tests**: Included (TDD approach: tests written first, must fail before implementation)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

**Duration**: 3-4 days

**Status**: ✅ COMPLETE

- [x] T001 Create project structure per plan.md in `/src/` (components/, lib/, app/)
- [x] T002 Initialize Next.js 16 project with TypeScript (strict mode) configuration
- [x] T003 [P] Setup ESLint + Prettier configuration with TypeScript strict rules in `.eslintrc.json`
- [x] T004 [P] Install core dependencies: next, react, typescript, next-auth, tailwindcss, jest
- [x] T005 [P] Configure Tailwind CSS with WCAG AA color palette in `tailwind.config.ts`
- [x] T006 [P] Setup Jest configuration with React Testing Library in `jest.config.js`
- [x] T007 Configure environment variables template in `.env.example`
- [x] T008 Setup GitHub Actions CI/CD pipeline in `.github/workflows/test.yml`
- [x] T009 Create project README with setup instructions in `README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before ANY user story

**Duration**: 5-7 days

**Status**: ✅ COMPLETE

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Storage

- [x] T010 [P] Create IndexedDB schema definition and initialization in `src/lib/db/schema.ts`
- [x] T011 [P] Create IndexedDB connection manager in `src/lib/db/client.ts`
- [x] T012 [P] Implement IPromptRepository interface in `src/lib/db/repositories/types.ts`
- [x] T013 [P] Implement IPromptVersionRepository interface in `src/lib/db/repositories/types.ts`
- [x] T014 [P] Implement ITestRunRepository interface in `src/lib/db/repositories/types.ts`
- [x] T015 [P] Implement ILLMProviderRepository interface in `src/lib/db/repositories/types.ts`
- [x] T016 [P] Implement IndexedDBPromptRepository in `src/lib/db/repositories/indexeddb-prompt.ts`
- [x] T017 [P] Implement IndexedDBPromptVersionRepository in `src/lib/db/repositories/indexeddb-prompt-version.ts`
- [x] T018 [P] Implement IndexedDBTestRunRepository in `src/lib/db/repositories/indexeddb-test-run.ts`
- [x] T019 [P] Implement IndexedDBLLMProviderRepository in `src/lib/db/repositories/indexeddb-llm-provider.ts`
- [x] T020 Create repository factory function in `src/lib/db/repositories/factory.ts`
- [x] T021 Setup database migration utilities in `src/lib/db/migrations.ts`

### Authentication

- [x] T022 [P] Configure next-auth.js with Google OAuth provider in `src/lib/auth/config.ts`
- [x] T023 [P] Create session types in `src/lib/auth/types.ts`
- [x] T024 [P] Implement authentication middleware in `src/lib/auth/middleware.ts`
- [x] T025 Create session callback to persist user to IndexedDB in `src/lib/auth/callbacks.ts`
- [x] T026 Create protected route wrapper in `src/lib/auth/protected-route.tsx`

### API Routes & Error Handling

- [x] T027 [P] Setup error handling utilities in `src/lib/errors.ts`
- [x] T028 [P] Create API response wrapper in `src/lib/api/response.ts`
- [x] T029 [P] Implement request validation middleware in `src/lib/api/validate.ts`
- [x] T030 [P] Create structured logging utilities in `src/lib/logging.ts`
- [x] T031 Create CORS configuration in `src/lib/api/cors.ts`

### Core Models & Types

- [x] T032 [P] Define User type in `src/types/user.ts`
- [x] T033 [P] Define Workspace type in `src/types/workspace.ts`
- [x] T034 [P] Define Prompt type in `src/types/prompt.ts`
- [x] T035 [P] Define PromptVersion type in `src/types/prompt-version.ts`
- [x] T036 [P] Define TestRun type in `src/types/test-run.ts`
- [x] T037 [P] Define LLMProvider type in `src/types/llm-provider.ts`
- [x] T038 [P] Create type index file in `src/types/index.ts`

### Utilities & Helpers

- [x] T039 [P] Create ID generation utilities in `src/lib/utils/id-generator.ts`
- [x] T040 [P] Create date/time utilities in `src/lib/utils/datetime.ts`
- [x] T041 [P] Create validation utilities in `src/lib/utils/validators.ts`
- [x] T042 [P] Create encryption utilities for API credentials in `src/lib/utils/crypto.ts`

### UI Foundations

- [x] T043 [P] Create Layout component shell in `src/app/layout.tsx`
- [x] T044 [P] Create Navigation component in `src/components/navigation.tsx`
- [x] T045 [P] Create ErrorBoundary component in `src/components/error-boundary.tsx`
- [x] T046 [P] Create LoadingSpinner component in `src/components/loading-spinner.tsx`
- [x] T047 [P] Create Button base component in `src/components/ui/button.tsx`
- [x] T048 [P] Create Input base component in `src/components/ui/input.tsx`
- [x] T049 [P] Create Modal base component in `src/components/ui/modal.tsx`

**Checkpoint**: ✅ Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Prompt Authoring & Versioning (Priority: P1) 🎯 MVP

**Goal**: Enable users to create prompts with automatic versioning, allowing experiments and easy reversion to previous versions.

**Independent Test**: Create prompt → edit → view version history → revert → confirm all versions persist

**Duration**: 5-6 days

### Tests for User Story 1 ⚠️

> Tests written FIRST, must FAIL before implementation

- [ ] T050 [P] [US1] Contract test for POST /api/workspaces/:id/prompts in `tests/contract/prompts.test.ts`
- [ ] T051 [P] [US1] Contract test for GET /api/workspaces/:id/prompts/:promptId in `tests/contract/prompts.test.ts`
- [ ] T052 [P] [US1] Contract test for POST /api/workspaces/:id/prompts/:promptId/versions in `tests/contract/prompts.test.ts`
- [ ] T053 [P] [US1] Contract test for GET /api/workspaces/:id/prompts/:promptId/versions in `tests/contract/prompts.test.ts`
- [ ] T054 [P] [US1] Contract test for GET /api/workspaces/:id/prompts/:promptId/versions/:versionId/diff in `tests/contract/prompts.test.ts`
- [ ] T055 [P] [US1] Integration test for complete prompt authoring workflow in `tests/integration/prompt-authoring.test.ts`
- [ ] T056 [P] [US1] Unit test for prompt validation in `tests/unit/validators.test.ts`
- [ ] T057 [P] [US1] Unit test for diff generator in `tests/unit/diff-generator.test.ts`

### Implementation for User Story 1

- [ ] T058 [P] [US1] Create diff generator utility in `src/lib/utils/diff-generator.ts`
- [ ] T059 [P] [US1] Create prompt validation schema in `src/lib/validation/prompt-schema.ts`
- [ ] T060 [P] [US1] Implement PromptService in `src/lib/services/prompt-service.ts`
- [ ] T061 [US1] Create API route for POST /api/workspaces/[id]/prompts in `src/app/api/workspaces/[id]/prompts/route.ts`
- [ ] T062 [US1] Create API route for GET /api/workspaces/[id]/prompts in `src/app/api/workspaces/[id]/prompts/route.ts`
- [ ] T063 [US1] Create API route for GET /api/workspaces/[id]/prompts/:promptId in `src/app/api/workspaces/[id]/prompts/[promptId]/route.ts`
- [ ] T064 [US1] Create API route for PUT /api/workspaces/[id]/prompts/:promptId in `src/app/api/workspaces/[id]/prompts/[promptId]/route.ts`
- [ ] T065 [US1] Create API route for DELETE /api/workspaces/[id]/prompts/:promptId in `src/app/api/workspaces/[id]/prompts/[promptId]/route.ts`
- [ ] T066 [US1] Create API route for POST /api/workspaces/[id]/prompts/:promptId/versions in `src/app/api/workspaces/[id]/prompts/[promptId]/versions/route.ts`
- [ ] T067 [US1] Create API route for GET /api/workspaces/[id]/prompts/:promptId/versions in `src/app/api/workspaces/[id]/prompts/[promptId]/versions/route.ts`
- [ ] T068 [US1] Create API route for GET /api/workspaces/[id]/prompts/:promptId/versions/:versionId/diff in `src/app/api/workspaces/[id]/prompts/[promptId]/versions/[versionId]/diff/route.ts`
- [ ] T069 [P] [US1] Create PromptEditor component in `src/components/prompt-editor.tsx`
- [ ] T070 [P] [US1] Create VersionHistory component in `src/components/version-history.tsx`
- [ ] T071 [P] [US1] Create DiffViewer component in `src/components/diff-viewer.tsx`
- [ ] T072 [US1] Create workspace editor page in `src/app/workspaces/[id]/editor/page.tsx`
- [ ] T073 [US1] Create usePrompt hook in `src/lib/hooks/use-prompt.ts`
- [ ] T074 [US1] Create usePromptVersion hook in `src/lib/hooks/use-prompt-version.ts`
- [ ] T075 [US1] Add error handling for version creation failures in `src/lib/services/prompt-service.ts`
- [ ] T076 [US1] Add validation logging for audit trail in `src/lib/services/prompt-service.ts`

**Checkpoint**: User Story 1 complete. Verify: Create prompt → Edit → View history → Restore → All versions persist

---

## Phase 4: User Story 2 - Multi-LLM Execution & Testing (Priority: P1) 🎯 MVP

**Goal**: Enable users to test prompts against multiple LLM providers (ChatGPT, Claude, Gemini) from a single interface with side-by-side result comparison.

**Independent Test**: Write prompt → Select multiple LLMs → Execute tests → Verify results display with metrics

**Duration**: 6-7 days

### Tests for User Story 2 ⚠️

> Tests written FIRST, must FAIL before implementation

- [ ] T077 [P] [US2] Contract test for POST /api/workspaces/:id/prompts/:promptId/test-runs in `tests/contract/test-runs.test.ts`
- [ ] T078 [P] [US2] Contract test for GET /api/workspaces/:id/prompts/:promptId/test-runs in `tests/contract/test-runs.test.ts`
- [ ] T079 [P] [US2] Contract test for GET /api/workspaces/:id/prompts/:promptId/test-runs/:testRunId in `tests/contract/test-runs.test.ts`
- [ ] T080 [P] [US2] Contract test for POST /api/workspaces/:id/prompts/:promptId/test-runs/:testRunId/ratings in `tests/contract/test-runs.test.ts`
- [ ] T081 [P] [US2] Unit test for OpenAI adapter in `tests/unit/adapters/openai-adapter.test.ts`
- [ ] T082 [P] [US2] Unit test for Claude adapter in `tests/unit/adapters/claude-adapter.test.ts`
- [ ] T083 [P] [US2] Unit test for Gemini adapter in `tests/unit/adapters/gemini-adapter.test.ts`
- [ ] T084 [P] [US2] Unit test for response normalization in `tests/unit/response-normalizer.test.ts`
- [ ] T085 [P] [US2] Integration test for multi-LLM execution in `tests/integration/multi-llm-execution.test.ts`

### Implementation for User Story 2

- [ ] T086 [P] [US2] Create abstract LLMProviderAdapter in `src/lib/adapters/llm-provider-adapter.ts`
- [ ] T087 [P] [US2] Implement OpenAI adapter in `src/lib/adapters/openai-adapter.ts`
- [ ] T088 [P] [US2] Implement Claude adapter in `src/lib/adapters/anthropic-adapter.ts`
- [ ] T089 [P] [US2] Implement Gemini adapter in `src/lib/adapters/google-adapter.ts`
- [ ] T090 [P] [US2] Create response normalizer utility in `src/lib/utils/response-normalizer.ts`
- [ ] T091 [P] [US2] Create timeout utility for provider execution in `src/lib/utils/timeout.ts`
- [ ] T092 [US2] Implement TestRunService in `src/lib/services/test-run-service.ts`
- [ ] T093 [US2] Create API route for POST /api/workspaces/[id]/prompts/[promptId]/test-runs in `src/app/api/workspaces/[id]/prompts/[promptId]/test-runs/route.ts`
- [ ] T094 [US2] Create API route for GET /api/workspaces/[id]/prompts/[promptId]/test-runs in `src/app/api/workspaces/[id]/prompts/[promptId]/test-runs/route.ts`
- [ ] T095 [US2] Create API route for GET /api/workspaces/[id]/prompts/[promptId]/test-runs/:testRunId in `src/app/api/workspaces/[id]/prompts/[promptId]/test-runs/[testRunId]/route.ts`
- [ ] T096 [US2] Create API route for POST /api/workspaces/[id]/prompts/[promptId]/test-runs/:testRunId/ratings in `src/app/api/workspaces/[id]/prompts/[promptId]/test-runs/[testRunId]/ratings/route.ts`
- [ ] T097 [P] [US2] Create LLMProviderSelector component in `src/components/llm-provider-selector.tsx`
- [ ] T098 [P] [US2] Create TestResultsGrid component in `src/components/test-results-grid.tsx`
- [ ] T099 [P] [US2] Create TestResultCard component in `src/components/test-result-card.tsx`
- [ ] T100 [P] [US2] Create RatingUI component in `src/components/rating-ui.tsx`
- [ ] T101 [US2] Create test runner page in `src/app/workspaces/[id]/prompts/[promptId]/test/page.tsx`
- [ ] T102 [US2] Create useTestRun hook in `src/lib/hooks/use-test-run.ts`
- [ ] T103 [US2] Create useLLMProviders hook in `src/lib/hooks/use-llm-providers.ts`
- [ ] T104 [US2] Implement provider credential encryption in `src/lib/utils/crypto.ts` (update)
- [ ] T105 [US2] Add error recovery for failed LLM calls in `src/lib/services/test-run-service.ts`
- [ ] T106 [US2] Add metrics calculation (tokens, latency, cost) in `src/lib/services/test-run-service.ts`

**Checkpoint**: User Story 2 complete. Verify: Configure providers → Execute multi-LLM test → View results → Rate output → All data persists

---

## Phase 5: User Story 3 - Prompt Library & Search (Priority: P1) 🎯 MVP

**Goal**: Enable users to discover and reuse existing prompts through fast full-text search and intelligent categorization.

**Independent Test**: Create multiple prompts with tags → Search by keyword → Filter by tag → Verify pagination

**Duration**: 4-5 days

### Tests for User Story 3 ⚠️

> Tests written FIRST, must FAIL before implementation

- [ ] T107 [P] [US3] Contract test for GET /api/workspaces/:id/prompts (search) in `tests/contract/prompts.test.ts` (update)
- [ ] T107a [P] [US3] Contract test for POST /api/workspaces/:id/prompts/:promptId/favorite in `tests/contract/prompts.test.ts`
- [ ] T107b [P] [US3] Contract test for POST /api/workspaces/:id/prompts/:promptId/pin in `tests/contract/prompts.test.ts`
- [ ] T108 [P] [US3] Unit test for search query parser in `tests/unit/search-parser.test.ts`
- [ ] T109 [P] [US3] Unit test for full-text search indexing in `tests/unit/search-indexer.test.ts`
- [ ] T110 [US3] Integration test for search + filtering workflow in `tests/integration/prompt-search.test.ts`

### Implementation for User Story 3

- [ ] T111 [P] [US3] Create search query parser in `src/lib/utils/search-parser.ts`
- [ ] T112 [P] [US3] Create IndexedDB full-text search indexer in `src/lib/db/search-indexer.ts`
- [ ] T113 [US3] Implement search methods in IndexedDBPromptRepository in `src/lib/db/repositories/indexeddb-prompt.ts` (update)
- [ ] T114 [US3] Create API route for search/filter in GET /api/workspaces/[id]/prompts (update existing route)
- [ ] T115 [US3] Create API route for POST /api/workspaces/[id]/prompts/:promptId/favorite in `src/app/api/workspaces/[id]/prompts/[promptId]/favorite/route.ts`
- [ ] T116 [US3] Create API route for POST /api/workspaces/[id]/prompts/:promptId/pin in `src/app/api/workspaces/[id]/prompts/[promptId]/pin/route.ts`
- [ ] T117 [P] [US3] Create PromptLibrary component in `src/components/prompt-library.tsx`
- [ ] T118 [P] [US3] Create SearchBar component in `src/components/search-bar.tsx`
- [ ] T119 [P] [US3] Create PromptCard component in `src/components/prompt-card.tsx`
- [ ] T120 [P] [US3] Create TagFilter component in `src/components/tag-filter.tsx`
- [ ] T121 [P] [US3] Create Pagination component in `src/components/pagination.tsx`
- [ ] T122 [US3] Create library page in `src/app/workspaces/[id]/library/page.tsx`
- [ ] T123 [US3] Create usePromptSearch hook in `src/lib/hooks/use-prompt-search.ts`
- [ ] T124 [US3] Add tag autocomplete suggestions in `src/components/search-bar.tsx` (update)
- [ ] T125 [US3] Add favorites + pinning state management in `src/lib/hooks/use-prompt-favorites.ts`

**Checkpoint**: User Story 3 complete. Verify: Search keywords → Filter by tag → Paginate results → Favorite/pin → All state persists

---

## Phase 6: User Story 4 - Collaboration & Sharing (Priority: P2)

**Goal**: Enable team workflows where prompts are shared, reviewed, and refined collaboratively.

**Independent Test**: Create prompt → Share with team member → Leave feedback → Merge suggestions → Verify final version

**Duration**: 5-6 days

### Tests for User Story 4 ⚠️

- [ ] T126 [P] [US4] Contract test for sharing endpoints in `tests/contract/collaboration.test.ts`
- [ ] T127 [P] [US4] Contract test for comment endpoints in `tests/contract/collaboration.test.ts`
- [ ] T128 [US4] Integration test for collaborative prompt editing in `tests/integration/collaboration.test.ts`

### Implementation for User Story 4

- [ ] T129 [P] [US4] Define Collaboration entity type in `src/types/collaboration.ts`
- [ ] T130 [P] [US4] Create ICollaborationRepository interface in `src/lib/db/repositories/types.ts` (update)
- [ ] T131 [US4] Implement IndexedDBCollaborationRepository in `src/lib/db/repositories/indexeddb-collaboration.ts`
- [ ] T132 [US4] Create CollaborationService in `src/lib/services/collaboration-service.ts`
- [ ] T133 [US4] Create API route for POST /api/workspaces/[id]/prompts/[promptId]/share in `src/app/api/workspaces/[id]/prompts/[promptId]/share/route.ts`
- [ ] T134 [US4] Create API route for GET /api/workspaces/[id]/prompts/[promptId]/collaborators in `src/app/api/workspaces/[id]/prompts/[promptId]/collaborators/route.ts`
- [ ] T135 [US4] Create API route for POST /api/workspaces/[id]/prompts/[promptId]/comments in `src/app/api/workspaces/[id]/prompts/[promptId]/comments/route.ts`
- [ ] T136 [US4] Create API route for GET /api/workspaces/[id]/prompts/[promptId]/comments in `src/app/api/workspaces/[id]/prompts/[promptId]/comments/route.ts`
- [ ] T137 [US4] Create API route for POST /api/workspaces/[id]/prompts/[promptId]/merge in `src/app/api/workspaces/[id]/prompts/[promptId]/merge/route.ts`
- [ ] T138 [P] [US4] Create CollaboratorsList component in `src/components/collaborators-list.tsx`
- [ ] T139 [P] [US4] Create CommentThread component in `src/components/comment-thread.tsx`
- [ ] T140 [P] [US4] Create MergeConflictResolver component in `src/components/merge-conflict-resolver.tsx`
- [ ] T141 [US4] Integrate sharing into PromptEditor in `src/components/prompt-editor.tsx` (update)
- [ ] T142 [US4] Create useCollaborators hook in `src/lib/hooks/use-collaborators.ts`

**Checkpoint**: User Story 4 complete. MVP can now support team prompting workflows

---

## Phase 7: User Story 5 - Prompt Testing & Evaluation (Priority: P2)

**Goal**: Enable data-driven prompt optimization through systematic evaluation with measurable quality metrics.

**Independent Test**: Upload test data → Run evaluations → Compare versions → Generate report

**Duration**: 5-6 days

### Tests for User Story 5 ⚠️

- [ ] T143 [P] [US5] Contract test for batch test endpoints in `tests/contract/evaluation.test.ts`
- [ ] T144 [P] [US5] Unit test for metric calculation in `tests/unit/metrics.test.ts`
- [ ] T145 [US5] Integration test for batch evaluation workflow in `tests/integration/evaluation.test.ts`

### Implementation for User Story 5

- [ ] T146 [P] [US5] Define TestBatch entity type in `src/types/test-batch.ts`
- [ ] T147 [P] [US5] Create evaluation metrics calculator in `src/lib/utils/metrics-calculator.ts`
- [ ] T148 [P] [US5] Create CSV parser for test data in `src/lib/utils/csv-parser.ts`
- [ ] T149 [US5] Create EvaluationService in `src/lib/services/evaluation-service.ts`
- [ ] T150 [US5] Create API route for POST /api/workspaces/[id]/evaluations/upload in `src/app/api/workspaces/[id]/evaluations/upload/route.ts`
- [ ] T151 [US5] Create API route for POST /api/workspaces/[id]/evaluations/run in `src/app/api/workspaces/[id]/evaluations/run/route.ts`
- [ ] T152 [US5] Create API route for GET /api/workspaces/[id]/evaluations/:evaluationId in `src/app/api/workspaces/[id]/evaluations/[evaluationId]/route.ts`
- [ ] T153 [US5] Create API route for POST /api/workspaces/[id]/evaluations/:evaluationId/compare in `src/app/api/workspaces/[id]/evaluations/[evaluationId]/compare/route.ts`
- [ ] T154 [US5] Create API route for POST /api/workspaces/[id]/evaluations/:evaluationId/report in `src/app/api/workspaces/[id]/evaluations/[evaluationId]/report/route.ts`
- [ ] T155 [P] [US5] Create TestDataUpload component in `src/components/test-data-upload.tsx`
- [ ] T156 [P] [US5] Create EvaluationResults component in `src/components/evaluation-results.tsx`
- [ ] T157 [P] [US5] Create MetricsComparison component in `src/components/metrics-comparison.tsx`
- [ ] T158 [US5] Create evaluation page in `src/app/workspaces/[id]/evaluations/page.tsx`
- [ ] T159 [US5] Create useEvaluation hook in `src/lib/hooks/use-evaluation.ts`

**Checkpoint**: User Story 5 complete. Users can now measure prompt quality objectively

---

## Phase 8: User Story 6 - Cloud Sync & Analytics (Priority: P2)

**Goal**: Enable cross-device sync and provide operational insights through analytics dashboards.

**Independent Test**: Create prompt on Device A → Verify sync to Device B → View analytics dashboard

**Duration**: 6-8 days

### Tests for User Story 6 ⚠️

- [ ] T160 [P] [US6] Contract test for analytics endpoints in `tests/contract/analytics.test.ts`
- [ ] T161 [P] [US6] Unit test for analytics aggregation in `tests/unit/analytics-aggregator.test.ts`
- [ ] T162 [US6] Integration test for cross-device sync in `tests/integration/cloud-sync.test.ts`

### Implementation for User Story 6

- [ ] T163 [P] [US6] Create analytics aggregation utility in `src/lib/utils/analytics-aggregator.ts`
- [ ] T164 [US6] Create CloudSyncService in `src/lib/services/cloud-sync-service.ts`
- [ ] T165 [US6] Create AnalyticsService in `src/lib/services/analytics-service.ts`
- [ ] T166 [US6] Create API route for GET /api/workspaces/[id]/analytics/overview in `src/app/api/workspaces/[id]/analytics/overview/route.ts`
- [ ] T167 [US6] Create API route for GET /api/workspaces/[id]/analytics/trends in `src/app/api/workspaces/[id]/analytics/trends/route.ts`
- [ ] T168 [US6] Create API route for GET /api/workspaces/[id]/analytics/team in `src/app/api/workspaces/[id]/analytics/team/route.ts`
- [ ] T169 [US6] Create API route for POST /api/workspaces/[id]/analytics/export in `src/app/api/workspaces/[id]/analytics/export/route.ts`
- [ ] T170 [P] [US6] Create AnalyticsDashboard component in `src/components/analytics-dashboard.tsx`
- [ ] T171 [P] [US6] Create TrendChart component in `src/components/trend-chart.tsx`
- [ ] T172 [P] [US6] Create TeamMetrics component in `src/components/team-metrics.tsx`
- [ ] T173 [US6] Create analytics page in `src/app/workspaces/[id]/analytics/page.tsx`
- [ ] T174 [US6] Create useAnalytics hook in `src/lib/hooks/use-analytics.ts`
- [ ] T175 [US6] Setup background sync job for IndexedDB → Firestore in `src/lib/services/cloud-sync-service.ts`
- [ ] T176 [US6] Implement 5-second sync window after connectivity restoration in `src/lib/services/cloud-sync-service.ts`

**Checkpoint**: User Story 6 complete. Users now have cross-device access and operational visibility

---

## Phase 9: User Story 7 - Monetization & SaaS Tiers (Priority: P3)

**Goal**: Enable revenue generation through flexible subscription plans with usage quotas and premium features.

**Independent Test**: Signup → Hit free quota → Upgrade to Pro → Verify features unlock

**Duration**: 5-6 days

### Tests for User Story 7 ⚠️

- [ ] T177 [P] [US7] Contract test for subscription endpoints in `tests/contract/subscriptions.test.ts`
- [ ] T178 [P] [US7] Contract test for billing endpoints in `tests/contract/billing.test.ts`
- [ ] T179 [US7] Integration test for subscription workflow in `tests/integration/subscriptions.test.ts`

### Implementation for User Story 7

- [ ] T180 [P] [US7] Define Subscription entity type in `src/types/subscription.ts`
- [ ] T181 [P] [US7] Create quota enforcement middleware in `src/lib/api/quota-enforcer.ts`
- [ ] T182 [US7] Create SubscriptionService in `src/lib/services/subscription-service.ts`
- [ ] T183 [US7] Create StripeService in `src/lib/services/stripe-service.ts`
- [ ] T184 [US7] Create API route for GET /api/subscriptions/plans in `src/app/api/subscriptions/plans/route.ts`
- [ ] T185 [US7] Create API route for POST /api/subscriptions/upgrade in `src/app/api/subscriptions/upgrade/route.ts`
- [ ] T186 [US7] Create API route for POST /api/subscriptions/downgrade in `src/app/api/subscriptions/downgrade/route.ts`
- [ ] T187 [US7] Create API route for POST /api/subscriptions/cancel in `src/app/api/subscriptions/cancel/route.ts`
- [ ] T188 [US7] Create Stripe webhook handler in `src/app/api/webhooks/stripe/route.ts`
- [ ] T189 [P] [US7] Create PricingTable component in `src/components/pricing-table.tsx`
- [ ] T190 [P] [US7] Create SubscriptionStatus component in `src/components/subscription-status.tsx`
- [ ] T191 [P] [US7] Create UpgradePrompt component in `src/components/upgrade-prompt.tsx`
- [ ] T192 [US7] Create billing management page in `src/app/account/billing/page.tsx`
- [ ] T193 [US7] Create QuotaWarning component in `src/components/quota-warning.tsx`
- [ ] T194 [US7] Integrate quota enforcement into prompt creation in `src/lib/services/prompt-service.ts` (update)
- [ ] T195 [US7] Integrate quota enforcement into test execution in `src/lib/services/test-run-service.ts` (update)

**Checkpoint**: User Story 7 complete. Platform now has sustainable revenue model

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Quality improvements, documentation, and performance optimization

**Duration**: 3-5 days

### Documentation & Guides

- [ ] T196 [P] Complete quickstart.md validation and update any outdated sections
- [ ] T197 [P] Create API documentation in `docs/api.md` with all endpoints
- [ ] T198 [P] Create component library documentation in `docs/components.md`
- [ ] T199 [P] Create troubleshooting guide in `docs/troubleshooting.md`
- [ ] T200 Create deployment guide in `docs/deployment.md`

### Testing & Quality

- [ ] T201 [P] Add missing unit tests for edge cases (target 80%+ coverage)
- [ ] T202 [P] Run accessibility audit and fix WCAG AA issues
- [ ] T203 [P] Run performance audit (Lighthouse) and optimize
- [ ] T204 [P] Run security audit and patch vulnerabilities
- [ ] T205 Create end-to-end test suite for critical user journeys in `tests/e2e/`

### Performance & Optimization

- [ ] T206 [P] Optimize IndexedDB queries for large datasets (10k+ prompts)
- [ ] T207 [P] Implement virtual scrolling in PromptLibrary for pagination
- [ ] T208 [P] Bundle analysis and code splitting optimization
- [ ] T209 Lazy load LLM provider adapters in `src/lib/adapters/`
- [ ] T210 Memoize expensive components (VersionHistory, TestResultsGrid)

### Error Handling & Observability

- [ ] T211 [P] Configure Sentry error tracking integration
- [ ] T212 [P] Add structured logging to all critical paths
- [ ] T213 [P] Create error recovery strategies for edge cases
- [ ] T214 Implement graceful degradation for unavailable LLM providers

### Deployment & Release

- [ ] T215 Setup production environment variables in deployment configuration
- [ ] T216 Create database migration script for production schema
- [ ] T217 Setup CI/CD deployment pipeline
- [ ] T218 Create rollback procedure documentation
- [ ] T219 Validate all Core Web Vitals in production environment

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundational) ⊣ GATE ⊣
                                           ↓
Phase 3 (US1), Phase 4 (US2), Phase 5 (US3) [P1 - Can run in parallel]
  ↓                ↓                 ↓
Phase 6 (US4), Phase 7 (US5), Phase 8 (US6) [P2 - Depends on any of P1]
  ↓                ↓                 ↓
Phase 9 (US7) [P3 - Depends on all of P2]
  ↓
Phase 10 (Polish) [Final]
```

### Critical Path (Fastest to MVP Launch)

1. Phase 1: Setup (3-4 days) — **REQUIRED**
2. Phase 2: Foundational (5-7 days) — **BLOCKS all stories**
3. Phase 3: US1 Prompt Authoring (5-6 days) — **REQUIRED for MVP**
4. Phase 4: US2 Multi-LLM Testing (6-7 days) — **REQUIRED for MVP**
5. Phase 5: US3 Search (4-5 days) — **REQUIRED for MVP**
6. **MVP Launch Ready** — ~30-35 days from start
7. Phase 10: Polish (3-5 days) — Final quality pass before public launch

### Parallel Opportunities

**All Setup tasks marked [P]** (T003-T009) can run in parallel within Phase 1

**All Foundational tasks marked [P]** (T010-T049) can run in parallel within Phase 2

**After Foundational completion**, all three P1 stories (US1, US2, US3) can start in parallel:

- Team of 3: One developer per story
- Results in 5-7 day sprint vs. 15-18 days sequential
- Each story independently testable and deliverable

**Within each User Story**, tasks marked [P] can run in parallel:

- Example US1: T058-T059 (utilities/validation), T060 (service), T069-T071 (components) all parallelizable
- Coordinated merge of features by story deadline

**Recommended Team Structure for MVP**:

- 1 developer: Phase 1 + Phase 2 (foundational setup) — 8-11 days
- 3 developers: Parallel P1 stories (US1, US2, US3) — 5-7 days (after foundation ready)
- Total MVP: **13-18 days** with 4-person team

### User Story Dependencies

- **US1 (Prompt Authoring)**: No inter-story dependencies ✅
- **US2 (Multi-LLM Testing)**: Uses US1 prompts but independently testable ✅
- **US3 (Search)**: Uses US1 prompts but independently testable ✅
- **US4 (Collaboration)**: Can work with US1 but better with US1+US2
- **US5 (Evaluation)**: Needs US1+US2 for test data
- **US6 (Cloud Sync)**: Works independently but better with all P1/P2
- **US7 (Monetization)**: Needs US1+US2+US3 minimum for MVP tier limits

---

## Within Each User Story

### Test-First Development (TDD)

For each user story:

1. **Write Tests FIRST** (marked with ⚠️) — All tests must FAIL before implementation
2. **Implement Models** — Define types and database entities
3. **Implement Services** — Business logic independent of HTTP
4. **Implement API Routes** — Wire services to HTTP endpoints
5. **Implement Components** — Build UI using hooks + API
6. **Integration Tests Pass** — Full user journey works end-to-end
7. **Story Complete** — Ready for next story or launch

### Quality Gates for Each Story

Before marking story as "Done":

- ✅ All tests passing (unit + integration + contract)
- ✅ 80%+ code coverage for that story
- ✅ WCAG AA accessibility compliance
- ✅ Core Web Vitals targets met
- ✅ No console errors or warnings
- ✅ Performance under load (concurrent users)

---

## Success Checklist

### Phase 1 ✅ Setup Complete

- Project scaffolded with all tools
- TypeScript strict mode configured
- ESLint + Prettier running
- Jest + RTL ready
- Can run `npm test` and `npm dev`

### Phase 2 ✅ Foundational Complete

- IndexedDB working with all repositories
- Google OAuth login working
- API route structure established
- Session management working
- Can authenticate and persist data

### Phase 3 ✅ US1 Complete

- Create prompt, edit, version history working
- Version diff viewer working
- Restore to previous version working
- All versions persist in IndexedDB
- 80%+ test coverage for US1
- Acceptance scenarios all passing

### Phase 4 ✅ US2 Complete

- Configure LLM providers working
- Execute multi-LLM tests working
- Results display side-by-side
- Metrics calculated correctly (tokens, latency, cost)
- Rate outputs with quality scores
- All data persists
- 80%+ test coverage for US2

### Phase 5 ✅ US3 Complete

- Full-text search working
- Tag filtering working
- Pagination working
- Favorite + pin functionality working
- Performance: Search <200ms for 10k prompts
- 80%+ test coverage for US3

### Phase 6-9 ✅ User Stories Complete

- All P2 and P3 stories implemented
- All inter-story integrations working
- No regressions in P1 features
- All tests passing

### Phase 10 ✅ Polish Complete

- 80%+ test coverage overall
- WCAG AA compliance verified
- Core Web Vitals all green
- No security vulnerabilities
- Performance targets met
- Documentation complete
- Ready for public launch

---

## Implementation Velocity

**Typical Developer Productivity**:

- Experienced: 3-4 tasks/day (10-15 points)
- Intermediate: 2-3 tasks/day (8-12 points)
- Junior: 1-2 tasks/day (5-8 points)

**MVP Delivery Estimates**:

- 1 senior developer: 30-35 days
- 2 developers (1 senior + 1 mid): 20-25 days
- 3 developers (mixed skills): 15-18 days
- 4 developers (1 tech lead + 3 mid): 12-15 days

**Recommended**: 2-3 person team for sustainable velocity with code review

---

## Notes

- Tasks marked `[P]` are parallelizable within phase
- Tasks marked `[US#]` belong to specific user story (enables independent delivery)
- Tests are mandatory for Phase 2 (foundation) and each user story (P1, P2, P3)
- Polish phase is optional pre-launch; can defer to v1.1 if needed
- All file paths assume monolithic repo structure from plan.md
- All code must follow Constitution principles: test-first, type-safe, accessible, performant
