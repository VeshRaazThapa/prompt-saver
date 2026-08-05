/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import { DrizzlePromptVersionRepository } from '@/lib/db/drizzle/prompt-version-repository';
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import type { PromptVersion } from '@/types';
import { closeDb, resetDb, seedUser } from './helpers';

const repo = new DrizzlePromptVersionRepository();

function makeVersion(id: string, promptId: string, content: string): PromptVersion {
  return {
    id,
    prompt_id: promptId,
    version_number: 1, // deliberately wrong — the repo must recompute it
    content,
    created_at: new Date().toISOString(),
  };
}

describe('DrizzlePromptVersionRepository', () => {
  beforeEach(async () => {
    await resetDb();
    const { workspaceId } = await seedUser();
    await getDb().insert(prompts).values({ id: 'p1', workspaceId, title: 'T', content: 'draft' });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('assigns sequential version numbers, ignoring the caller value', async () => {
    const first = await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    const second = await repo.createVersionAtomic(makeVersion('v2', 'p1', 'two'), 'p1');

    expect(first.version_number).toBe(1);
    expect(second.version_number).toBe(2);
    expect(second.previous_version_id).toBe('v1');
  });

  it('updates the parent prompt in the same transaction', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');

    const [row] = await getDb().select().from(prompts).where(eq(prompts.id, 'p1'));
    expect(row?.currentVersionId).toBe('v1');
    expect(row?.versionCount).toBe(1);
  });

  it('rolls back completely when the prompt does not exist', async () => {
    await expect(
      repo.createVersionAtomic(makeVersion('v9', 'ghost', 'x'), 'ghost')
    ).rejects.toThrow('Prompt with id ghost not found');
    expect(await repo.findByPromptId('ghost')).toHaveLength(0);
  });

  it('serializes concurrent version creation without collisions', async () => {
    const results = await Promise.all([
      repo.createVersionAtomic(makeVersion('a', 'p1', 'a'), 'p1'),
      repo.createVersionAtomic(makeVersion('b', 'p1', 'b'), 'p1'),
      repo.createVersionAtomic(makeVersion('c', 'p1', 'c'), 'p1'),
    ]);

    const numbers = results.map((v) => v.version_number).sort();
    expect(numbers).toEqual([1, 2, 3]);

    const [row] = await getDb().select().from(prompts).where(eq(prompts.id, 'p1'));
    expect(row?.versionCount).toBe(3);
  });

  it('lists versions newest first', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    await repo.createVersionAtomic(makeVersion('v2', 'p1', 'two'), 'p1');

    const all = await repo.findByPromptId('p1');
    expect(all.map((v) => v.version_number)).toEqual([2, 1]);
  });

  it('finds a specific version and the latest', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    await repo.createVersionAtomic(makeVersion('v2', 'p1', 'two'), 'p1');

    expect((await repo.findByVersion('p1', 1))?.content).toBe('one');
    expect((await repo.getLatestVersion('p1'))?.id).toBe('v2');
    expect(await repo.findByVersion('p1', 99)).toBeNull();
  });

  it('updates a version result', async () => {
    await repo.createVersionAtomic(makeVersion('v1', 'p1', 'one'), 'p1');
    const updated = await repo.update('v1', { result: 'model output' });
    expect(updated.result).toBe('model output');
  });
});
