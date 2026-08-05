import { and, desc, eq, sql } from 'drizzle-orm';
import type { PromptVersion } from '@/types';
import type { IPromptVersionRepository } from '../repositories/types';
import { NotFoundError } from '../../errors';
import { getDb } from './client';
import { prompts, promptVersions } from './schema';
import { toPromptVersion } from './mappers';

export class DrizzlePromptVersionRepository implements IPromptVersionRepository {
  async findById(id: string): Promise<PromptVersion | null> {
    const rows = await getDb()
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.id, id))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPromptVersion(row);
  }

  async create(entity: PromptVersion): Promise<PromptVersion> {
    const [row] = await getDb()
      .insert(promptVersions)
      .values({
        id: entity.id,
        promptId: entity.prompt_id,
        versionNumber: entity.version_number,
        content: entity.content,
        result: entity.result ?? null,
        changeSummary: entity.change_summary ?? null,
        previousVersionId: entity.previous_version_id ?? null,
      })
      .returning();
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return toPromptVersion(row);
  }

  async update(id: string, updates: Partial<PromptVersion>): Promise<PromptVersion> {
    const patch: Record<string, unknown> = {};
    if (updates.result !== undefined) patch['result'] = updates.result;
    if (updates.change_summary !== undefined) patch['changeSummary'] = updates.change_summary;
    if (updates.content !== undefined) patch['content'] = updates.content;

    const [row] = await getDb()
      .update(promptVersions)
      .set(patch)
      .where(eq(promptVersions.id, id))
      .returning();
    if (row === undefined) {
      throw new NotFoundError('PromptVersion', id);
    }
    return toPromptVersion(row);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await getDb()
      .delete(promptVersions)
      .where(eq(promptVersions.id, id))
      .returning({ id: promptVersions.id });
    return deleted.length > 0;
  }

  async findByPromptId(
    promptId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PromptVersion[]> {
    let query = getDb()
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptId))
      .orderBy(desc(promptVersions.versionNumber))
      .$dynamic();

    if (options?.limit !== undefined) query = query.limit(options.limit);
    if (options?.offset !== undefined) query = query.offset(options.offset);

    return (await query).map(toPromptVersion);
  }

  async findByVersion(promptId: string, versionNumber: number): Promise<PromptVersion | null> {
    const rows = await getDb()
      .select()
      .from(promptVersions)
      .where(
        and(eq(promptVersions.promptId, promptId), eq(promptVersions.versionNumber, versionNumber))
      )
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPromptVersion(row);
  }

  async getLatestVersion(promptId: string): Promise<PromptVersion | null> {
    const rows = await getDb()
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptId))
      .orderBy(desc(promptVersions.versionNumber))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toPromptVersion(row);
  }

  /**
   * Inserts a version and updates its parent prompt atomically.
   *
   * version_number and previous_version_id are RECOMPUTED here and the caller's
   * values ignored. SELECT ... FOR UPDATE on the parent row serializes concurrent
   * calls, so two browser tabs cannot collide on the unique (prompt_id, version_number).
   */
  async createVersionAtomic(version: PromptVersion, promptId: string): Promise<PromptVersion> {
    return getDb().transaction(async (tx) => {
      const parents = await tx.select().from(prompts).where(eq(prompts.id, promptId)).for('update');
      const parent = parents[0];
      if (parent === undefined) {
        throw new NotFoundError('Prompt', promptId);
      }

      const latest = await tx
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.promptId, promptId))
        .orderBy(desc(promptVersions.versionNumber))
        .limit(1);
      const previous = latest[0];

      const [inserted] = await tx
        .insert(promptVersions)
        .values({
          id: version.id,
          promptId,
          versionNumber: (previous?.versionNumber ?? 0) + 1,
          content: version.content,
          result: version.result ?? null,
          changeSummary: version.change_summary ?? null,
          previousVersionId: previous?.id ?? null,
        })
        .returning();

      if (inserted === undefined) {
        throw new Error('Version insert returned no row');
      }

      await tx
        .update(prompts)
        .set({
          currentVersionId: inserted.id,
          versionCount: sql`${prompts.versionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(prompts.id, promptId));

      return toPromptVersion(inserted);
    });
  }
}
