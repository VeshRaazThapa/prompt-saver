# Prompt Saver - LLM Prompt Intelligence Platform

**Live:** https://prompt-saver-two.vercel.app/

A prompt management tool for saving, versioning, and searching LLM prompts. Built with Next.js, Neon Postgres, and a warm stone/teal design system.

## Features (MVP - Phase 1)

- **Prompt Authoring**: Create and edit prompts with automatic versioning
- **Multi-LLM Testing**: Execute prompts against multiple LLM providers from a single interface
- **Prompt Library**: Full-text search and intelligent categorization of prompts
- **Workspace-Based Organization**: Organize prompts within dedicated workspaces

## MCP Server (Claude Code Integration)

Prompt Saver runs a remote [MCP](https://modelcontextprotocol.io) server at
`/api/mcp`, so a Claude Code session can search, read, and save your prompts
without leaving the terminal.

### Connect

1. Sign in at https://prompt-saver-two.vercel.app/, then generate a token at
   **Settings → API Tokens** (`/app/settings/tokens`). The raw token is shown
   exactly once — copy it immediately. Only its SHA-256 hash is stored, so a
   lost token can't be recovered; revoke it on the same page and create a new
   one.
2. The tokens page shows the registration command with your token filled in.
   It looks like:

   ```bash
   claude mcp add --transport http prompt-saver --scope user \
     https://prompt-saver-two.vercel.app/api/mcp \
     --header "Authorization: Bearer ps_..."
   ```

   `--scope user` registers the server once for every project rather than
   just the current one.

### Tools

Once connected, Claude Code can call five tools against your prompt library:

- `search_prompts(query, limit?)` — searches title, description, content and
  tags. Returns summaries only (id, title, description, tags, `updated_at`) —
  never full bodies. `limit` defaults to 20 and is capped at 50.
- `get_prompt(id)` — fetches the full text of one prompt.
- `create_prompt(title, content, description?, tags?)` — saves a new prompt
  along with its first version.
- `update_prompt(id, ...)` — updates a prompt's draft in place, without
  creating a new version.
- `save_version(id, content, change_summary?)` — saves an immutable new
  version of an existing prompt.

There is no delete tool.

### Favourite prompts as slash commands

Any prompt marked as a favourite (the star in the web app) is also registered
as a slash command, named from its title — "Daily Planning" becomes
`/mcp__prompt-saver__daily-planning`. Archived favourites are excluded. Each
command takes one optional `context` argument, appended to the prompt body:

```
/mcp__prompt-saver__daily-planning auth refactor
```

**Favourites are read once, when the session connects.** Starring a prompt
does not add its slash command to a session that's already running — open a
new session, or run `/mcp` to reconnect, to pick up newly starred prompts.
Claude Code also caches remote server definitions between sessions, so a
stale command list can persist longer than you'd expect.

### Cold starts

The database backing this app (Neon Postgres) scales its compute to zero when
idle. The first MCP request after a period of inactivity may take noticeably
longer while it wakes back up; subsequent requests are fast.

## Technology Stack

- **Frontend**: Next.js 16, React 18, TypeScript (strict mode)
- **Styling**: Tailwind CSS (WCAG 2.1 AA accessible)
- **Storage**: Neon Postgres via Drizzle ORM (server-side, per-user isolated)
- **Authentication**: Google OAuth via NextAuth.js
- **Testing**: Jest + React Testing Library
- **Code Quality**: ESLint, Prettier, TypeScript strict mode

## Prerequisites

- Node.js 18.17+ or 20.x
- npm 9+ (or use `npm ci` with `--legacy-peer-deps`)

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd prompt-saver
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables

Create `.env.local` based on `.env.example`:

```bash
cp .env.example .env.local
```

Required variables:

```env
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
ALLOWED_EMAILS=you@example.com
```

**Warning:** leaving `ALLOWED_EMAILS` unset lets anyone with a Google account sign in and get their own workspace. Always set it to a comma-separated allowlist of emails before deploying anywhere reachable.

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Development

### Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run tests
npm run test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
npm run format:check

# Type checking
npm run type-check
```

### Project Structure

```
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # React components
├── lib/              # Utilities, hooks, services, and business logic
│   ├── api/          # API response wrappers
│   ├── auth/         # Authentication logic
│   ├── db/           # Database repositories and schemas
│   ├── hooks/        # Custom React hooks
│   ├── services/     # Business logic services
│   └── utils/        # Helper utilities
└── types/            # TypeScript type definitions

tests/
├── unit/             # Unit tests for utilities and hooks
├── integration/      # Integration tests
└── contract/         # API contract tests
```

## Code Quality Standards

### TypeScript Strict Mode

- No `any` types without justification
- All implicit returns must be typed
- Strict null checking enabled
- Strict property initialization required

### ESLint Rules

- 80%+ test coverage for all utilities and hooks
- Maximum function complexity: 10 cyclomatic points
- No console statements in production code (warning only)
- No unused variables or imports

### Testing Requirements

- All utilities must have unit tests
- All components must have integration tests
- API routes must have contract tests
- TDD approach: write tests first, must fail before implementation

## Performance Targets

- Core Web Vitals: LCP ≤2.5s, FID ≤100ms, CLS ≤0.1
- Version creation: <100ms (atomic)
- Search response: <200ms for 10k prompts
- API response time (p95): <200ms
- Concurrent LLM executions: 100+ parallel

## Accessibility

- WCAG 2.1 AA compliance
- Responsive design (320px to 1920px+)
- Keyboard navigation support
- Screen reader friendly components

## Deployment

### Build

```bash
npm run build
```

### Environment Variables (Production)

Set these in your deployment platform:

```env
NEXTAUTH_SECRET=<generate-with-: openssl rand -base64 32>
NEXTAUTH_URL=https://your-production-domain.com
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://.../neondb?sslmode=require
ALLOWED_EMAILS=you@example.com
```

**Warning:** leaving `ALLOWED_EMAILS` unset lets anyone with a Google account sign in and get their own workspace. Do not skip it.

## CI/CD

GitHub Actions automatically runs on push and pull requests:

- TypeScript type checking
- ESLint linting
- Prettier formatting
- Jest test suite
- Next.js build verification

Tests must pass before merging to `main` branch.

## Contributing

1. Create a feature branch from `001-prompt-platform`
2. Follow the TypeScript strict mode guidelines
3. Write tests first (TDD approach)
4. Ensure all tests pass: `npm test`
5. Ensure linting passes: `npm run lint`
6. Submit a pull request

## Architecture Decisions

### Repository Pattern

Database access is confined to repository classes implementing the interfaces in
`src/lib/db/repositories/types.ts`. Server Actions are the only callers; client
components never touch the database.

### Immutable Versions

PromptVersions are immutable by design - no in-place edits allowed. This enables clean audit trails and version history.

### Workspace Isolation

Every user gets one private workspace, created on first sign-in. All queries are
scoped to the workspace id returned by `getCurrentContext()` — never to a value
supplied by the client.

## Roadmap

- **Phase 2**: Foundational infrastructure (database, auth, API patterns)
- **Phase 3**: User Story 1 - Prompt Authoring & Versioning
- **Phase 4**: User Story 2 - Multi-LLM Execution & Testing
- **Phase 5**: User Story 3 - Prompt Library & Search
- **Phase 6**: User Story 4 - Collaboration & Sharing
- **Phase 7**: User Story 5 - Prompt Testing & Evaluation

## License

Proprietary - All rights reserved

## Support

For issues or questions, please contact the development team.
