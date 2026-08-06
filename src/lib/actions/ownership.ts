import type { Prompt } from '@/types';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { NotFoundError } from '../errors';

// Deliberately NOT a 'use server' file — that directive restricts a module to
// async exported functions only, which this shared helper module is not bound by.

const promptRepo = new DrizzlePromptRepository();

/**
 * Loads a prompt and proves it belongs to the caller's workspace.
 * Throws NotFoundError — never AuthorizationError — so the response cannot be
 * used to probe whether an id exists in someone else's workspace.
 *
 * The single implementation the entire cross-user isolation guarantee rests
 * on. Both `prompts.ts` and `versions.ts` import this rather than keeping
 * their own copies, so there is exactly one place this check can drift.
 */
export async function requireOwnedPrompt(id: string, workspaceId: string): Promise<Prompt> {
  const prompt = await promptRepo.findById(id);
  if (prompt === null || prompt.workspace_id !== workspaceId) {
    throw new NotFoundError('Prompt', id);
  }
  return prompt;
}
