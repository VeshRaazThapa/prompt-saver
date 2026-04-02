# SaaS Idea → Shipped Product Playbook

A step-by-step reference for taking a SaaS idea from zero to deployed product using Claude Code + Superpowers skills. Based on the Prompt Saver project (March–April 2026).

---

## The Pipeline

```
Idea → Brainstorm → Design Spec → Implementation Plan → Build → Design System → QA → Deploy → Positioning → Landing Page → Ship
```

Each phase produces a concrete artifact. No phase is skipped.

---

## Phase 1: Brainstorm the Idea

**Skill:** `/brainstorming` (superpowers:brainstorming)

**What it does:** Interactive Q&A to refine a vague idea into a concrete design. Asks one question at a time, proposes 2-3 approaches with trade-offs, presents design section by section.

**Process:**
1. Start with a one-sentence idea ("a tool to save and version LLM prompts")
2. Claude asks clarifying questions — answer honestly, don't overthink
3. It proposes approaches (e.g., local-first vs cloud, single-user vs team)
4. You pick one, Claude presents the full design for approval
5. Design gets saved as a spec

**Artifact:** `docs/superpowers/specs/YYYY-MM-DD-<name>-design.md`

**Prompt Saver example:**
- Started with "prompt management tool for Maitri"
- Decided: local-first (IndexedDB), single-user, no LLM API calls
- Key scope decision: NOT a prompt testing platform, just save/version/search

**Learnings:**
- Say "no" early. The brainstorm will suggest features you don't need. Every "not this" saves hours later.
- The "What It Is NOT" section in the spec is as important as "What It Is"
- If the idea spans multiple systems, break it into sub-projects during brainstorming — don't try to spec everything at once

---

## Phase 2: Write the Implementation Plan

**Skill:** `/writing-plans` (superpowers:writing-plans)

**What it does:** Converts the design spec into bite-sized tasks with exact file paths, code, test commands, and commit messages. Each step is 2-5 minutes.

**Process:**
1. Skill reads the spec automatically
2. Produces a file structure map (what to create, modify, test)
3. Each task has: files involved, failing test, implementation, passing test, commit
4. TDD by default — test first, then code

**Artifact:** `docs/superpowers/plans/YYYY-MM-DD-<name>.md`

**Prompt Saver example plan structure:**
```
Task 1: DB schema & repositories
Task 2: Data hooks (usePrompts, usePrompt, useVersions)
Task 3: Shared UI components (TagInput, ConfirmModal, DiffViewer, etc.)
Task 4: Prompt Library page
Task 5: Create Prompt page
Task 6: Edit Prompt page
Task 7: Version History page
Task 8: Auth fixes
```

**Learnings:**
- The plan is a contract. If something isn't in the plan, it doesn't get built.
- Plans that are too big fail. If a plan has more than ~10 tasks, the spec was too big — go back and split.
- "No placeholders" rule is critical. Every step must have actual code, not "add appropriate error handling."

---

## Phase 3: Execute the Plan

**Skill:** `/executing-plans` or `/subagent-driven-development`

**Two modes:**
- **Subagent-driven (recommended):** Fresh agent per task, you review between tasks. Faster, less context bloat.
- **Inline execution:** Execute in current session with checkpoints.

**Process:**
1. Pick execution mode
2. Work through tasks in order
3. Each task: write test → run test (fails) → implement → run test (passes) → commit
4. Review checkpoint after every 2-3 tasks

**Prompt Saver commit history (the build phase):**
```
chore: add diff dependency and constants file
refactor: simplify types for MVP
refactor: bump DB schema to v2
refactor: update repositories for MVP
feat: add token estimation, diff utility, and debounce hook with tests
feat: rewrite navigation
feat: add shared UI components
feat: add data hooks
feat: implement Prompt Library page
feat: implement create prompt page
feat: implement edit prompt page
feat: implement version history page
fix: make Google OAuth conditional
fix: gracefully handle missing OAuth providers
fix: remove IndexedDB calls from auth callbacks
```

**Learnings:**
- Commit after every task. Small commits = easy rollbacks.
- When a task fails, fix the issue in the CURRENT task, don't skip ahead.
- Auth/OAuth is always messier than expected. Plan for 2-3 fix commits after the main build.

---

## Phase 4: Design System

**Skill:** `/design-consultation`

**What it does:** Researches your product space, proposes a complete design system (colors, typography, spacing, motion), generates preview pages, creates DESIGN.md.

**Process:**
1. Claude researches competitors' visual language
2. Proposes aesthetic direction with trade-offs
3. Generates font + color preview pages in browser
4. You approve, it writes DESIGN.md
5. Then applies the design system to all existing components

**Artifact:** `DESIGN.md` (the single source of truth for all visual decisions)

**Prompt Saver design decisions:**
- Stone neutrals (not gray) — warmer, feels like a writing desk
- Teal accent (not blue) — distinguishes from every default Tailwind app
- Instrument Serif for display — signals "this is a writing tool"
- JetBrains Mono for editor — best monospace for prompt writing
- 44px minimum touch targets everywhere

**Learnings:**
- Do design AFTER the app works, not before. You need to see the real UI to make good aesthetic decisions.
- DESIGN.md goes in CLAUDE.md as a required read — this prevents Claude from reverting to default blue/gray in future sessions.
- The anti-patterns list ("Never Use") prevents the most common AI design mistakes: purple gradients, icons in colored circles, "Welcome to X" copy.

---

## Phase 5: QA & Polish

**Skill:** `/qa` (test and fix) or `/qa-only` (report only)

**What it does:** Systematically tests the app in a real browser, finds bugs, fixes them with atomic commits, and verifies the fix with before/after screenshots.

**Process:**
1. Start the dev server
2. QA skill navigates every page and interaction
3. Reports findings by severity (critical → cosmetic)
4. Fixes each bug, commits, re-verifies

**Also useful:** `/design-review` for visual polish after QA

**Learnings:**
- Run QA on the deployed URL, not just localhost — deployment can introduce issues
- OAuth/auth flows are the #1 source of QA failures
- "Works on my machine" is real — test with and without env vars set

---

## Phase 6: Deploy

**Manual for now.** Prompt Saver uses Vercel (auto-deploys from GitHub).

**Steps:**
1. Push to GitHub: `git push origin <branch>`
2. Merge PR if needed
3. Verify at production URL

**Learnings:**
- Deploy BEFORE positioning/landing page work. You need a live URL to reference.
- Add the deployment URL to README immediately.

---

## Phase 7: Market Positioning

**Skill:** `/startup-positioning`

**What it does:** Full April Dunford positioning framework — maps competitive alternatives, discovers customer language, analyzes market categories, produces positioning statements.

**Process:**
1. Intake: describe product, problem, customers, alternatives
2. Research Wave 1: competitive alternatives + customer voice (parallel agents)
3. Research Wave 2: market categories + trends (parallel agents)
4. Checkpoint: align on research findings
5. Synthesis: Dunford's 5+1 components in order
6. Validation: Neumeier Onliness Test + Ries Mental Ladder

**Artifacts:**
- `positioning-doc.md` — the main deliverable (5+1 components)
- `positioning-statement.md` — Moore template, Onliness statement, elevator pitches
- `competitive-analysis.md` — full alternatives map
- `messaging-implications.md` — words to use/avoid, messaging hierarchy
- `research/voice-of-customer.md` — customer language map

**Prompt Saver positioning outcome:**
- **Category:** Personal prompt library (not "prompt management platform")
- **Onliness:** "Prompt Saver is the only personal prompt library that versions every edit automatically for AI users who reuse prompts across sessions"
- **Key insight:** Position AGAINST the status quo (chat history, Notion docs), not against enterprise tools

**Learnings:**
- Positioning before landing page copy. The positioning doc tells you what words to use, what to compare against, and who you're talking to.
- "Competitive alternatives" includes doing nothing / status quo — that's usually your real competitor.
- Customer language matters more than your language. Use their words.

---

## Phase 8: Landing Page

**Skill:** `/brainstorming` → `/writing-plans` → build

**Process:**
1. Brainstorm the landing page design (separate from the app brainstorm)
2. Write the spec — sections, copy, layout, responsive behavior
3. Route restructure: move app to `/app`, free `/` for landing page
4. Build the landing page as a static server component
5. Verify and deploy

**Prompt Saver landing page structure:**
```
Nav (sticky, blurred)
Hero (headline + app preview mockup)
Pain Points (3 relatable scenarios)
How It Works (3 steps)
Features (4 cards)
Final CTA (gradient bg)
Footer
```

**Learnings:**
- Route restructure FIRST, landing page SECOND. Moving routes after building the landing page is painful.
- Landing page is a server component (no 'use client') — it's just static content, no state needed.
- The app preview mockup in the hero is fake data, not a real embed. Keeps it fast and controllable.
- Use positioning doc for copy. The pain points section came directly from voice-of-customer research.

---

## Full Skill Sequence (Quick Reference)

| # | Phase | Skill | Time | Artifact |
|---|-------|-------|------|----------|
| 1 | Ideation | `/brainstorming` | 30-60 min | Design spec |
| 2 | Planning | `/writing-plans` | 15-30 min | Implementation plan |
| 3 | Building | `/executing-plans` or `/subagent-driven-development` | 2-6 hrs | Working app |
| 4 | Design | `/design-consultation` | 30-60 min | DESIGN.md + styled app |
| 5 | QA | `/qa` | 30-60 min | Bug fixes |
| 6 | Deploy | Manual (Vercel/etc) | 10 min | Live URL |
| 7 | Positioning | `/startup-positioning` | 30-60 min | Positioning docs |
| 8 | Landing Page | `/brainstorming` → `/writing-plans` → build | 1-2 hrs | Marketing page |
| 9 | Ship | Push + verify | 10 min | Done |

---

## Common Gotchas

1. **Scope creep during brainstorming.** The brainstorm skill will explore interesting tangents. Your job is to say "not for MVP" repeatedly.

2. **Auth is never simple.** Even "optional Google OAuth" took 3 fix commits. If auth isn't core to your MVP, skip it entirely.

3. **Design system after functionality.** Building pretty UI on broken functionality wastes time. Get it working ugly first.

4. **Positioning informs copy.** Don't write landing page headlines from your gut. The positioning doc gives you the exact words, comparisons, and pain points.

5. **Small commits, always.** Every task = one commit. When something breaks, you can `git bisect` to find it.

6. **Context limits are real.** Long sessions hit context limits. The subagent-driven execution mode handles this better than inline execution.

7. **DESIGN.md in CLAUDE.md.** If you don't add "read DESIGN.md before making visual decisions" to CLAUDE.md, Claude will forget your design system in the next session.

8. **Route structure before landing page.** Decide your URL structure (`/app` for product, `/` for marketing) before building anything.

---

## File Structure Reference

```
project/
├── CLAUDE.md                          # Project instructions (references DESIGN.md)
├── DESIGN.md                          # Design system source of truth
├── docs/
│   ├── competitive-analysis.md        # From positioning
│   └── superpowers/
│       ├── specs/
│       │   ├── YYYY-MM-DD-mvp-design.md
│       │   └── YYYY-MM-DD-landing-page-design.md
│       └── plans/
│           ├── YYYY-MM-DD-mvp.md
│           └── YYYY-MM-DD-landing-page.md
├── prompt-saver/                      # Positioning artifacts
│   ├── positioning-doc.md
│   ├── positioning-statement.md
│   └── messaging-implications.md
├── research/
│   └── voice-of-customer.md
└── src/
    └── app/
        ├── page.tsx                   # Landing page (marketing)
        └── app/                       # Product (behind /app)
            ├── layout.tsx
            ├── page.tsx
            └── ...
```

---

*Created from the Prompt Saver project, March–April 2026. Update as the process evolves.*
