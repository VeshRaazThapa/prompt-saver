import { describe, it, expect } from 'vitest';
import { filterPrompts } from './filter';

const p = (id: string, title: string, extra: Partial<{ tags: string[]; content: string; is_favorite: boolean }> = {}) => ({
  id, title, description: null, tags: extra.tags ?? [], updated_at: 'x', content: extra.content ?? '', is_favorite: extra.is_favorite ?? false,
});

describe('filterPrompts', () => {
  const list = [
    p('1', 'Code review'),
    p('2', 'Email reply', { tags: ['writing'] }),
    p('3', 'Summarise', { content: 'review this doc' }),
    p('4', 'Fav review', { is_favorite: true }),
  ];
  it('empty query returns favorites first, max 8', () => {
    expect(filterPrompts(list, '').map((x) => x.id)).toEqual(['4', '1', '2', '3']);
    expect(filterPrompts(Array.from({ length: 20 }, (_, i) => p(String(i), `t${i}`)), '')).toHaveLength(8);
  });
  it('ranks title matches over tag over content, favorites first within a rank, case-insensitive', () => {
    expect(filterPrompts(list, 'REVIEW').map((x) => x.id)).toEqual(['4', '1', '3']);
    expect(filterPrompts(list, 'writ').map((x) => x.id)).toEqual(['2']);
  });
  it('returns [] for no match', () => expect(filterPrompts(list, 'zzz')).toEqual([]));
});
