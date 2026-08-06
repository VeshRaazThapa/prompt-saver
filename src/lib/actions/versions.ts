'use server';

import type { PromptVersion } from '@/types';
import { getCurrentContext } from '../auth/context';
import { DrizzlePromptRepository } from '../db/drizzle/prompt-repository';
import { DrizzlePromptVersionRepository } from '../db/drizzle/prompt-version-repository';
import { NotFoundError } from '../errors';
import { generateId } from '../utils/id-generator';
import { requireOwnedPrompt } from './ownership';
import { run, type ActionResult, type DraftInput } from './result';

const promptRepo = new DrizzlePromptRepository();
const versionRepo = new DrizzlePromptVersionRepository();

/**
 * Ownership is proven via the parent prompt, never the version id alone —
 * DrizzlePromptVersionRepository has no workspace scoping of its own, so this
 * chain (prompt ownership, then version-belongs-to-prompt) is the only guard.
 * The prompt-ownership check itself is the shared `requireOwnedPrompt` so it
 * can't drift from the one `prompts.ts` uses.
 */
async function requireOwnedVersion(promptId: string, versionId: string): Promise<PromptVersion> {
  const { workspaceId } = await getCurrentContext();
  await requireOwnedPrompt(promptId, workspaceId);
  const version = await versionRepo.findById(versionId);
  if (version === null || version.prompt_id !== promptId) {
    throw new NotFoundError('PromptVersion', versionId);
  }
  return version;
}

export async function listVersionsAction(promptId: string): Promise<ActionResult<PromptVersion[]>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    await requireOwnedPrompt(promptId, workspaceId);
    return versionRepo.findByPromptId(promptId);
  });
}

export async function saveVersionAction(
  promptId: string,
  input: DraftInput & { changeSummary?: string; result?: string }
): Promise<ActionResult<PromptVersion>> {
  return run(async () => {
    const { workspaceId } = await getCurrentContext();
    await requireOwnedPrompt(promptId, workspaceId);

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
    const { workspaceId } = await getCurrentContext();
    const prompt = await requireOwnedPrompt(promptId, workspaceId);

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
