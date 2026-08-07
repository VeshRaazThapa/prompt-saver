import type { Prompt, PromptVersion } from '@/types';
import { requireOwnedPrompt } from '../actions/ownership';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { generateId } from '../utils/id-generator';
import { now } from '../utils/datetime';

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

const versionRepo = new DrizzlePromptVersionRepository();

export interface CreatePromptInput {
  title: string;
  content: string;
  description?: string;
  tags?: string[];
}

/** Reuses createWithFirstVersion so prompt and first version land atomically. */
export async function createPromptHandler(
  workspaceId: string,
  input: CreatePromptInput
): Promise<{ id: string }> {
  const id = generateId();
  const timestamp = now();

  await repo.createWithFirstVersion(
    {
      id,
      workspace_id: workspaceId,
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      content: input.content,
      tags: input.tags ?? [],
      status: 'active',
      is_favorite: false,
      current_version_id: '',
      created_at: timestamp,
      updated_at: timestamp,
      metadata: { version_count: 0 },
    },
    {
      id: generateId(),
      prompt_id: id,
      version_number: 1,
      content: input.content,
      change_summary: 'Created via MCP',
      created_at: timestamp,
    }
  );

  return { id };
}

export interface UpdatePromptInput {
  title?: string;
  content?: string;
  description?: string;
  tags?: string[];
}

export async function updatePromptHandler(
  workspaceId: string,
  id: string,
  input: UpdatePromptInput
): Promise<Prompt> {
  await requireOwnedPrompt(id, workspaceId);
  return repo.update(id, input);
}

/**
 * Reuses createVersionAtomic — row-locked, version number recomputed
 * server-side — then writes the new content onto prompts.content, mirroring
 * saveVersionAction (src/lib/actions/versions.ts). createVersionAtomic only
 * touches current_version_id / version_count / updated_at; without this
 * second write prompts.content stays on the old body and get_prompt, the web
 * editor, and favourite slash commands all keep serving stale text.
 */
export async function saveVersionHandler(
  workspaceId: string,
  id: string,
  content: string,
  changeSummary?: string
): Promise<PromptVersion> {
  await requireOwnedPrompt(id, workspaceId);
  const version = await versionRepo.createVersionAtomic(
    {
      id: generateId(),
      prompt_id: id,
      version_number: 0, // recomputed inside the transaction
      content,
      change_summary: changeSummary ?? 'Saved via MCP',
      created_at: now(),
    },
    id
  );

  await repo.update(id, { content });

  return version;
}
