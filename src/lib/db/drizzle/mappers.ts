import type { Prompt, PromptVersion } from '@/types';
import type { prompts, promptVersions } from './schema';

type PromptRow = typeof prompts.$inferSelect;
type PromptVersionRow = typeof promptVersions.$inferSelect;

/** Maps a DB row to the domain Prompt the UI expects (ISO strings, nested metadata). */
export function toPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    title: row.title,
    ...(row.description !== null ? { description: row.description } : {}),
    content: row.content,
    current_version_id: row.currentVersionId ?? '',
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    tags: row.tags,
    is_favorite: row.isFavorite,
    status: row.status,
    metadata: { version_count: row.versionCount },
  };
}

export function toPromptVersion(row: PromptVersionRow): PromptVersion {
  return {
    id: row.id,
    prompt_id: row.promptId,
    version_number: row.versionNumber,
    content: row.content,
    ...(row.result !== null ? { result: row.result } : {}),
    ...(row.changeSummary !== null ? { change_summary: row.changeSummary } : {}),
    created_at: row.createdAt.toISOString(),
    ...(row.previousVersionId !== null ? { previous_version_id: row.previousVersionId } : {}),
  };
}

/** Escapes LIKE wildcards so a user searching for "50%" doesn't match everything. */
export function escapeLike(input: string): string {
  return input.replace(/([\\%_])/g, '\\$1');
}
