import type { Prompt } from '@/types';
import { requireOwnedPrompt } from '../actions/ownership';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';

const repo = new DrizzlePromptRepository();

export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_SEARCH_LIMIT = 20;

export interface PromptSummary {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  updated_at: string;
}

function toSummary(p: Prompt): PromptSummary {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    tags: p.tags,
    updated_at: p.updated_at,
  };
}

/**
 * Summaries only — never bodies. Claude Code warns past 10k tokens of tool
 * output and truncates at 25k; a truncated JSON response gives the model
 * malformed data rather than fewer results.
 */
export async function searchPromptsHandler(
  workspaceId: string,
  query: string,
  limit: number
): Promise<PromptSummary[]> {
  const capped = Math.min(Math.max(1, limit), MAX_SEARCH_LIMIT);
  const found =
    query.trim() === ''
      ? await repo.findByWorkspaceId(workspaceId, { limit: capped })
      : await repo.search(workspaceId, query, { limit: capped });

  return found.map(toSummary);
}

/**
 * Loads one prompt with its full content, scoped to the caller's workspace.
 * Delegates to requireOwnedPrompt, which throws NotFoundError — never
 * AuthorizationError — for a prompt owned by another workspace, so the
 * response can't be used to probe which ids exist elsewhere.
 */
export async function getPromptHandler(workspaceId: string, id: string): Promise<Prompt> {
  return requireOwnedPrompt(id, workspaceId);
}
