import { computeDiff, DiffLine } from '@/lib/utils/diff';

describe('computeDiff', () => {
  it('returns empty array for identical strings', () => {
    const result = computeDiff('hello\nworld', 'hello\nworld');
    expect(result.every((line) => line.type === 'unchanged')).toBe(true);
  });

  it('detects added lines', () => {
    const result = computeDiff('line1', 'line1\nline2');
    const added = result.filter((line) => line.type === 'added');
    expect(added).toHaveLength(1);
    expect(added[0].value).toBe('line2');
  });

  it('detects removed lines', () => {
    const result = computeDiff('line1\nline2', 'line1');
    const removed = result.filter((line) => line.type === 'removed');
    expect(removed).toHaveLength(1);
    expect(removed[0].value).toBe('line2');
  });

  it('handles empty inputs', () => {
    const result = computeDiff('', 'new content');
    expect(result.filter((l) => l.type === 'added').length).toBeGreaterThan(0);
  });
});
