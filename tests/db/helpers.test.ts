import { isTestDatabaseUrl } from './helpers';

// Pure decision logic behind resetDb()'s guard — no live connection needed.
// This is the only thing standing between `npm test` and TRUNCATE-ing
// production if a developer has a shell-exported DATABASE_URL.
describe('isTestDatabaseUrl', () => {
  it('allows localhost', () => {
    expect(
      isTestDatabaseUrl('postgresql://postgres:postgres@localhost:5432/prompt_saver_test')
    ).toBe(true);
  });

  it('allows 127.0.0.1', () => {
    expect(isTestDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:5432/anything')).toBe(true);
  });

  it('allows a remote database whose name ends in _test', () => {
    expect(
      isTestDatabaseUrl(
        'postgresql://user:pass@ep-cool-forest-12345.us-east-2.aws.neon.tech/scratch_test?sslmode=require'
      )
    ).toBe(true);
  });

  it('refuses a production-looking Neon URL', () => {
    expect(
      isTestDatabaseUrl(
        'postgresql://user:pass@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require'
      )
    ).toBe(false);
  });

  it('refuses an empty string', () => {
    expect(isTestDatabaseUrl('')).toBe(false);
  });

  it('refuses malformed input', () => {
    expect(isTestDatabaseUrl('not-a-url-at-all')).toBe(false);
  });
});
