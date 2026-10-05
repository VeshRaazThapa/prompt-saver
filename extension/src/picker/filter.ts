import type { ExtPrompt } from '../lib/types';

function rank(p: ExtPrompt, q: string): number {
  if (q === '') return 0;
  if (p.title.toLowerCase().includes(q)) return 0;
  if (p.tags.some((t) => t.toLowerCase().includes(q))) return 1;
  if (p.content.toLowerCase().includes(q)) return 2;
  return -1;
}

export function filterPrompts(prompts: ExtPrompt[], query: string, max = 8): ExtPrompt[] {
  const q = query.trim().toLowerCase();
  return prompts
    .map((p, i) => ({ p, i, r: rank(p, q) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || Number(b.p.is_favorite) - Number(a.p.is_favorite) || a.i - b.i)
    .slice(0, max)
    .map((x) => x.p);
}
