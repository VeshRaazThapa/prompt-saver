import { slugify } from '@/lib/mcp/prompts';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Daily Planning', 'id1', new Set())).toBe('daily-planning');
  });

  it('strips characters that are not slash-command safe', () => {
    expect(slugify('Code Review (v2)!', 'id1', new Set())).toBe('code-review-v2');
  });

  it('collapses repeated separators and trims them', () => {
    expect(slugify('  Hello --- World  ', 'id1', new Set())).toBe('hello-world');
  });

  it('falls back to the id when a title has no usable characters', () => {
    expect(slugify('!!!', 'abc12345', new Set())).toBe('prompt-abc12345');
  });

  it('disambiguates a collision deterministically using the id', () => {
    const taken = new Set(['daily-planning']);
    const first = slugify('Daily Planning', 'abc12345', taken);
    const second = slugify('Daily Planning', 'abc12345', taken);

    expect(first).not.toBe('daily-planning');
    expect(first).toContain('daily-planning');
    expect(second).toBe(first); // stable across calls — commands must not shuffle
  });
});
