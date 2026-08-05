'use server';

import type { Prompt, PromptVersion } from '@/types';
import { getCurrentContext } from '../auth/context';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { NotFoundError } from '../errors';
import { generateId } from '../utils/id-generator';
import { run, type ActionResult, type DraftInput } from './result';

const promptRepo = new DrizzlePromptRepository();
const versionRepo = new DrizzlePromptVersionRepository();

/**
 * Loads a prompt and proves it belongs to the caller's workspace.
 * Throws NotFoundError — never AuthorizationError — so the response cannot be
 * used to probe whether an id exists in someone else's workspace.
 */
async function requireOwnedPrompt(id: string): Promise<Prompt> {
  const { workspaceId } = await getCurrentContext();
  const prompt = await promptRepo.findById(id);
  if (prompt === null || prompt.workspace_id !== workspaceId) {
    throw new NotFoundError('Prompt', id);
  }
  return prompt;
}

/**
 * Ownership is proven via the parent prompt, never the version id alone —
 * DrizzlePromptVersionRepository has no workspace scoping of its own, so this
 * chain (prompt ownership, then version-belongs-to-prompt) is the only guard.
 */
async function requireOwnedVersion(promptId: string, versionId: string): Promise<PromptVersion> {
  await requireOwnedPrompt(promptId);
  const version = await versionRepo.findById(versionId);
  if (version === null || version.prompt_id !== promptId) {
    throw new NotFoundError('PromptVersion', versionId);
  }
  return version;
}

export async function listVersionsAction(promptId: string): Promise<ActionResult<PromptVersion[]>> {
  return run(async () => {
    await requireOwnedPrompt(promptId);
    return versionRepo.findByPromptId(promptId);
  });
}

export async function saveVersionAction(
  promptId: string,
  input: DraftInput & { changeSummary?: string; result?: string }
): Promise<ActionResult<PromptVersion>> {
  return run(async () => {
    await requireOwnedPrompt(promptId);

    const version = await versionRepo.createVersionAtomic(
      {
        id: generateId(),
        prompt_id: promptId,
        version_number: 0, // recomputed inside the transaction
        content: input.content,
        ...(input.result !== undefined ? { result: input.result } : {}),
        ...(input.changeSummary !== undefined ? { change_summary: input.changeSummary } : {}),
        created_at: new Date().toISOString(),
      },
      promptId
    );

    await promptRepo.update(promptId, {
      title: input.title,
      description: input.description ?? '', // '' clears it; undefined would mean "leave unchanged"
      content: input.content,
      tags: input.tags,
    });

    return version;
  });
}

export async function saveCurrentAction(
  promptId: string,
  input: DraftInput & { result?: string }
): Promise<ActionResult<null>> {
  return run(async () => {
    const prompt = await requireOwnedPrompt(promptId);

    await promptRepo.update(promptId, {
      title: input.title,
      description: input.description ?? '', // '' clears it; undefined would mean "leave unchanged"
      content: input.content,
      tags: input.tags,
    });

    if (prompt.current_version_id !== '') {
      await versionRepo.update(prompt.current_version_id, {
        content: input.content,
        ...(input.result !== undefined ? { result: input.result } : {}),
      });
    }
    return null;
  });
}

export async function updateVersionResultAction(
  promptId: string,
  versionId: string,
  result: string
): Promise<ActionResult<null>> {
  return run(async () => {
    await requireOwnedVersion(promptId, versionId);
    await versionRepo.update(versionId, { result });
    return null;
  });
}

export async function restoreVersionAction(
  promptId: string,
  versionId: string
): Promise<ActionResult<PromptVersion>> {
  return run(async () => {
    const source = await requireOwnedVersion(promptId, versionId);

    const restored = await versionRepo.createVersionAtomic(
      {
        id: generateId(),
        prompt_id: promptId,
        version_number: 0, // recomputed inside the transaction
        content: source.content,
        change_summary: `Restored from version ${source.version_number}`,
        created_at: new Date().toISOString(),
      },
      promptId
    );

    await promptRepo.update(promptId, { content: source.content });
    return restored;
  });
}
