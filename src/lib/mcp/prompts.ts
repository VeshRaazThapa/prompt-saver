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

/** Favourited, non-archived prompts become slash commands. */
export async function favouritePromptsFor(workspaceId: string): Promise<Prompt[]> {
  const found = await repo.findByWorkspaceId(workspaceId, { favoritesOnly: true });
  return found.filter((p) => p.status !== 'archived');
}

export function buildPromptBody(prompt: Prompt, context?: string): string {
  if (context === undefined || context.trim() === '') {
    return prompt.content;
  }
  return `${prompt.content}\n\nAdditional context: ${context}`;
}
