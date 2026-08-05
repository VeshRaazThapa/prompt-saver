import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { Prompt } from '@/types';
import type { IPromptRepository } from '../repositories/types';
import { NotFoundError } from '../../errors';
import { getDb } from './client';
import { prompts } from './schema';
import { escapeLike, toPrompt } from './mappers';

type FindOptions = Parameters<IPromptRepository['findByWorkspaceId']>[1];

export class DrizzlePromptRepository implements IPromptRepository {
  async findById(id: string): Promise<Prompt | null> {
    const rows = await getDb().select().from(prompts).where(eq(prompts.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toPrompt(row);
  }

  async create(entity: Prompt): Promise<Prompt> {
    const [row] = await getDb()
      .insert(prompts)
      .values({
        id: entity.id,
        workspaceId: entity.workspace_id,
        title: entity.title,
        description: entity.description ?? null,
        content: entity.content,
        currentVersionId: entity.current_version_id === '' ? null : entity.current_version_id,
        tags: entity.tags,
        isFavorite: entity.is_favorite,
        status: entity.status,
        versionCount: entity.metadata.version_count,
      })
      .returning();
    if (row === undefined) {
      throw new Error('Insert returned no row');
    }
    return toPrompt(row);
  }

  async update(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) patch['title'] = updates.title;
    // An empty string is an explicit "clear this field"; absent means "leave unchanged".
    if (updates.description !== undefined) {
      patch['description'] = updates.description === '' ? null : updates.description;
    }
    if (updates.content !== undefined) patch['content'] = updates.content;
    if (updates.tags !== undefined) patch['tags'] = updates.tags;
    if (updates.is_favorite !== undefined) patch['isFavorite'] = updates.is_favorite;
    if (updates.status !== undefined) patch['status'] = updates.status;
    if (updates.current_version_id !== undefined) {
      patch['currentVersionId'] = updates.current_version_id;
    }

    const [row] = await getDb().update(prompts).set(patch).where(eq(prompts.id, id)).returning();
    if (row === undefined) {
      throw new NotFoundError('Prompt', id);
    }
    return toPrompt(row);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await getDb().delete(prompts).where(eq(prompts.id, id)).returning({
      id: prompts.id,
    });
    return deleted.length > 0;
  }

  async findByWorkspaceId(workspaceId: string, options?: FindOptions): Promise<Prompt[]> {
    const filters = [eq(prompts.workspaceId, workspaceId)];
    if (options?.favoritesOnly === true) filters.push(eq(prompts.isFavorite, true));
    if (options?.status !== undefined) filters.push(eq(prompts.status, options.status));

    const column =
      options?.sortBy === 'title'
        ? prompts.title
        : options?.sortBy === 'created_at'
          ? prompts.createdAt
          : prompts.updatedAt;
    const direction = options?.sortOrder === 'asc' ? asc : desc;

    let query = getDb()
      .select()
      .from(prompts)
      .where(and(...filters))
      .orderBy(direction(column))
      .$dynamic();
    if (options?.limit !== undefined) query = query.limit(options.limit);
    if (options?.offset !== undefined) query = query.offset(options.offset);

    return (await query).map(toPrompt);
  }

  async search(
    workspaceId: string,
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Prompt[]> {
    const pattern = `%${escapeLike(query)}%`;
    let statement = getDb()
      .select()
      .from(prompts)
      .where(
        and(
          eq(prompts.workspaceId, workspaceId),
          or(
            ilike(prompts.title, pattern),
            ilike(prompts.description, pattern),
            ilike(prompts.content, pattern),
            sql`EXISTS (SELECT 1 FROM unnest(${prompts.tags}) AS tag WHERE tag ILIKE ${pattern})`
          )
        )
      )
      .orderBy(desc(prompts.updatedAt))
      .$dynamic();

    if (options?.limit !== undefined) statement = statement.limit(options.limit);
    if (options?.offset !== undefined) statement = statement.offset(options.offset);

    return (await statement).map(toPrompt);
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    const [row] = await getDb()
      .select({ value: count() })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspaceId));
    return row?.value ?? 0;
  }
}
