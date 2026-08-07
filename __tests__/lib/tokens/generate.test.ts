import { generateToken, hashToken } from '@/lib/tokens/generate';

describe('generateToken', () => {
  it('produces a ps_-prefixed token', () => {
    expect(generateToken().token.startsWith('ps_')).toBe(true);
  });

  it('produces a different token every call', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateToken().token));
    expect(seen.size).toBe(50);
  });

  it('returns a hash matching hashToken of the token', () => {
    const { token, hash } = generateToken();
    expect(hash).toBe(hashToken(token));
  });

  it('never returns the raw token inside the hash', () => {
    const { token, hash } = generateToken();
    expect(hash).not.toContain(token.slice(3));
    expect(hash).toHaveLength(64); // sha256 hex
  });

  it('returns a prefix that is a leading slice of the token and too short to be usable', () => {
    const { token, prefix } = generateToken();
    expect(token.startsWith(prefix)).toBe(true);
    expect(prefix).toHaveLength(11); // "ps_" + 8 chars
    expect(prefix.length).toBeLessThan(token.length);
  });

  it('hashToken is deterministic', () => {
    expect(hashToken('ps_abc')).toBe(hashToken('ps_abc'));
    expect(hashToken('ps_abc')).not.toBe(hashToken('ps_abd'));
  });
});
