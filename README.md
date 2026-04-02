# Prompt Saver - LLM Prompt Intelligence Platform

**Live:** https://prompt-saver-two.vercel.app/

A local-first prompt management tool for saving, versioning, and searching LLM prompts. Built with Next.js, IndexedDB, and a warm stone/teal design system.

## Features (MVP - Phase 1)

- **Prompt Authoring**: Create and edit prompts with automatic versioning
- **Multi-LLM Testing**: Execute prompts against multiple LLM providers from a single interface
- **Prompt Library**: Full-text search and intelligent categorization of prompts
- **Workspace-Based Organization**: Organize prompts within dedicated workspaces

## Technology Stack

- **Frontend**: Next.js 16, React 18, TypeScript (strict mode)
- **Styling**: Tailwind CSS (WCAG 2.1 AA accessible)
- **Storage**: Browser IndexedDB (Phase 1), Firestore (Future)
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
```

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
```

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

Database operations use the Repository pattern to enable seamless migration from IndexedDB (Phase 1) to Firestore (Future) without changing service layer code.

### Immutable Versions

PromptVersions are immutable by design - no in-place edits allowed. This enables clean audit trails and version history.

### Workspace Isolation

All data queries enforce workspace scoping to prevent cross-workspace data leaks.

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
