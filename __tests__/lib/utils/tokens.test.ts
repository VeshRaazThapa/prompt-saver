import { estimateTokens } from '@/lib/utils/tokens';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens as ceil(length / 4)', () => {
    expect(estimateTokens('hello')).toBe(2); // 5/4 = 1.25 -> 2
    expect(estimateTokens('hi')).toBe(1); // 2/4 = 0.5 -> 1
    expect(estimateTokens('abcdefgh')).toBe(2); // 8/4 = 2
  });
});
