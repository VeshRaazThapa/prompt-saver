import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    // Type-only modules: no runtime code exists to exercise, so counting
    // them as "uncovered" measures nothing real.
    '!src/types/**', // interfaces only
    '!src/lib/db/repositories/types.ts', // pure interface file
    '!src/lib/auth/types.ts', // ambient `declare module` type augmentation only
    // Framework shells: pure composition/wiring with no branching logic of
    // their own. All actual behavior they delegate to lives in files that
    // remain in coverage scope (e.g. lib/auth/config.ts, components).
    '!src/app/**/layout.tsx',
    '!src/app/api/auth/\\[...nextauth\\]/route.ts',
  ],
  // These thresholds reflect actual measured coverage as of 2026-08-10
  // (statements 34.19%, branches 75.44%, functions 55.63%, lines 34.19%,
  // after excluding type-only modules and framework shells above), each
  // rounded down with a small buffer so normal jitter doesn't trip CI.
  // They are a floor, not a target: whole areas (components, hooks, pages)
  // have ~0% coverage. Raise these numbers as real tests are added — do
  // not treat them as "good enough" or lower them to make CI pass.
  coverageThreshold: {
    global: {
      branches: 74,
      functions: 54,
      lines: 33,
      statements: 33,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
  // The tests/db/*.db.test.ts suites all share ONE database (see
  // tests/db/helpers.ts: resetDb() truncates every table in beforeEach).
  // Jest runs test *files* in parallel worker processes by default, so two
  // db suites executing concurrently race: one file's TRUNCATE wipes rows
  // another file's test is mid-assertion on. That produced an intermittent
  // ~40% failure rate under default parallelism (verified 37/58 and 35/58
  // failures across repeated runs) despite every test being correct in
  // isolation (`--runInBand` passed 58/58 every time).
  //
  // Fix: force the whole suite to run in a single worker process, so Jest
  // executes test files one at a time and the db suites never overlap.
  // The full suite (58 tests) takes ~2-5s either way, so losing inter-file
  // parallelism is free at this scale. This is scoped in config (not a
  // package.json `--runInBand` flag) so it applies uniformly to `npm test`,
  // `npm run test:coverage`, and any future ad-hoc `npx jest` invocation
  // (including CI) without relying on every call site remembering the flag.
  //
  // A per-suite-only serialization (e.g. Jest `projects`, or two separate
  // jest invocations) was considered and rejected: `projects` does not
  // support per-project worker counts (maxWorkers is a single run-wide
  // setting), and splitting into two jest invocations would require merging
  // two partial coverage reports to keep `coverageThreshold` meaningful —
  // real added machinery for a suite that's already fast serially.
  maxWorkers: 1,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config) as Config;
