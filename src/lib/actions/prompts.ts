'use server';

import type { Prompt } from '@/types';
import { getCurrentContext } from '../auth/context';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { generateId } from '../utils/id-generator';
import { now } from '../utils/datetime';
import { requireOwnedPrompt } from './ownership';
import {
  run,
  type ActionResult,
  type DraftInput,
  type ListPromptsInput,
  type TagCount,
} from './result';

const promptRepo = new DrizzlePromptRepository();
const versionRepo = new DrizzlePromptVersionRepository();

export async function listPrompts(
  input: ListPromptsInput
): Promise<ActionResult<{ prompts: Prompt[]; allTags: TagCount[] }>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const { searchQuery = '', filter = 'all', sortBy = 'updated_at', sortOrder = 'desc' } = input;

    const all = await promptRepo.findByWorkspaceId(workspaceId);
    const tagCounts = new Map<string, number>();
    all.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
    const allTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => a.tag.localeCompare(b.tag));

    let results: Prompt[];
    if (searchQuery !== '') {
      results = await promptRepo.search(workspaceId, searchQuery);
      results.sort((a, b) => {
        const cmp = String(a[sortBy]).localeCompare(String(b[sortBy]));
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else {
      results = await promptRepo.findByWorkspaceId(workspaceId, {
        favoritesOnly: filter === 'favorites',
        ...(filter === 'archived' ? { status: 'archived' as const } : {}),
        sortBy,
        sortOrder,
      });
    }

    // Matches the existing IndexedDB behavior exactly: only the default view hides archived.
    if (filter === 'all') {
      results = results.filter((p) => p.status !== 'archived');
    }

    return { prompts: results, allTags };
  });
}

export async function getPromptAction(
  id: string
): Promise<ActionResult<{ prompt: Prompt; currentVersionResult: string }>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(id, workspaceId);

    let currentVersionResult = '';
    if (prompt.current_version_id !== '') {
      const version = await versionRepo.findById(prompt.current_version_id);
      currentVersionResult = version?.result ?? '';
    }
    return { prompt, currentVersionResult };
  });
}

export async function createPromptAction(input: DraftInput): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const id = generateId();
    const timestamp = now();

    // One transaction: a prompt with no version (or vice versa) should never be
    // observable. See DrizzlePromptRepository.createWithFirstVersion.
    await promptRepo.createWithFirstVersion(
      {
        id,
        workspace_id: workspaceId,
        title: input.title,
        ...(input.description !== undefined && input.description !== ''
          ? { description: input.description }
          : {}),
        content: input.content,
        tags: input.tags,
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
        change_summary: 'Initial version',
        created_at: timestamp,
      }
    );

    return { id };
  });
}

export async function updateDraftAction(
  id: string,
  input: DraftInput
): Promise<ActionResult<Prompt>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    await requireOwnedPrompt(id, workspaceId);
    return promptRepo.update(id, {
      title: input.title,
      description: input.description ?? '', // '' clears it; undefined would mean "leave unchanged"
      content: input.content,
      tags: input.tags,
    });
  });
}

export async function toggleFavoriteAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(id, workspaceId);
    await promptRepo.update(id, { is_favorite: !prompt.is_favorite });
    return null;
  });
}

export async function archivePromptAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(id, workspaceId);
    await promptRepo.update(id, { status: prompt.status === 'archived' ? 'active' : 'archived' });
    return null;
  });
}

export async function deletePromptAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    await requireOwnedPrompt(id, workspaceId);
    await promptRepo.delete(id);
    return null;
  });
}

export async function duplicatePromptAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    const source = await requireOwnedPrompt(id, workspaceId);
    const newId = generateId();
    const timestamp = now();

    // One transaction: a prompt with no version (or vice versa) should never be
    // observable. See DrizzlePromptRepository.createWithFirstVersion.
    await promptRepo.createWithFirstVersion(
      {
        ...source,
        id: newId,
        title: `Copy of ${source.title}`,
        current_version_id: '',
        created_at: timestamp,
        updated_at: timestamp,
        metadata: { version_count: 0 },
      },
      {
        id: generateId(),
        prompt_id: newId,
        version_number: 1,
        content: source.content,
        change_summary: 'Duplicated',
        created_at: timestamp,
      }
    );

    return null;
  });
}
