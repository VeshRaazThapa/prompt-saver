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
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
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
