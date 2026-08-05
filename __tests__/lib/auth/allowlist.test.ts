import { isEmailAllowed } from '@/lib/auth/allowlist';

describe('isEmailAllowed', () => {
  const original = process.env['ALLOWED_EMAILS'];
  afterEach(() => {
    if (original === undefined) delete process.env['ALLOWED_EMAILS'];
    else process.env['ALLOWED_EMAILS'] = original;
  });

  it('allows anyone when unset (the public switch)', () => {
    delete process.env['ALLOWED_EMAILS'];
    expect(isEmailAllowed('stranger@example.com')).toBe(true);
  });

  it('allows anyone when set to an empty string', () => {
    process.env['ALLOWED_EMAILS'] = '   ';
    expect(isEmailAllowed('stranger@example.com')).toBe(true);
  });

  it('allows a listed email', () => {
    process.env['ALLOWED_EMAILS'] = 'a@x.com,b@y.com';
    expect(isEmailAllowed('b@y.com')).toBe(true);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    process.env['ALLOWED_EMAILS'] = ' A@X.com , b@y.com ';
    expect(isEmailAllowed('a@x.COM')).toBe(true);
  });

  it('rejects an unlisted email', () => {
    process.env['ALLOWED_EMAILS'] = 'a@x.com';
    expect(isEmailAllowed('intruder@evil.com')).toBe(false);
  });

  it('rejects null or undefined when a list is configured', () => {
    process.env['ALLOWED_EMAILS'] = 'a@x.com';
    expect(isEmailAllowed(null)).toBe(false);
    expect(isEmailAllowed(undefined)).toBe(false);
  });
});
