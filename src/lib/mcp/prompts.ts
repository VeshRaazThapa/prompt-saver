import type { Prompt } from '@/types';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';

const repo = new DrizzlePromptRepository();

/**
 * Derives a slash-command name from a prompt title.
 *
 * Collisions are disambiguated with a slice of the prompt id rather than a
 * counter, so a command keeps the same name between sessions even if the set
 * of prompts changes.
 */
export function slugify(title: string, id: string, taken: Set<string>): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const name = base === '' ? `prompt-${id.slice(0, 8)}` : base;
  return taken.has(name) ? `${name}-${id.slice(0, 6)}` : name;
}

/**
 * Favourited, non-archived prompts become slash commands.
 *
 * Sorted by id after fetching: the repository's default order is
 * `updated_at DESC` with no secondary key, and `updated_at` uses
 * `defaultNow()` — rows inserted in the same transaction (a bulk import, a
 * seed script, two favourites created in one request) get an identical
 * timestamp, and Postgres does not guarantee stable ordering for ties. The
 * registration loop in the route builds its `taken` set from this order, so
 * an unstable order let two same-titled prompts swap which one got the bare
 * slug between requests — exactly the "changes identity between sessions"
 * failure the brief calls out. `id` is unique and never changes, so sorting
 * by it makes iteration order — and therefore slug assignment — stable
 * regardless of how ties in `updated_at` land.
 *
 * The archived filter stays in application code rather than
 * `findByWorkspaceId`'s `options.status`: that option is a single equality
 * filter (typed off `IPromptRepository`, which this task must not change),
 * so it can express "status = 'active'" but not "status != 'archived'" —
 * using it here would silently drop favourited drafts, a behavior change
 * beyond this fix's scope.
 */
export async function favouritePromptsFor(workspaceId: string): Promise<Prompt[]> {
  const found = await repo.findByWorkspaceId(workspaceId, { favoritesOnly: true });
  return found.filter((p) => p.status !== 'archived').sort((a, b) => a.id.localeCompare(b.id));
}

export function buildPromptBody(prompt: Prompt, context?: string): string {
  if (context === undefined || context.trim() === '') {
    return prompt.content;
  }
  return `${prompt.content}\n\nAdditional context: ${context}`;
}
