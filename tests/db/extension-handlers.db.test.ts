/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  createPromptHandler,
  updatePromptHandler,
  saveVersionHandler,
  listPromptsWithContentHandler,
} from '@/lib/mcp/tools';
import { LimitReachedError, ValidationError } from '@/lib/errors';
import { MAX_CONTENT_LENGTH, MAX_PROMPTS_PER_WORKSPACE } from '@/lib/limits';
import { resetDb, seedUser, closeDb } from './helpers';

beforeEach(resetDb);
afterAll(closeDb);

describe('caps', () => {
  it('rejects content over the max length on create, update and save_version', async () => {
    const { workspaceId } = await seedUser();
    const tooLong = 'x'.repeat(MAX_CONTENT_LENGTH + 1);
    await expect(createPromptHandler(workspaceId, { title: 't', content: tooLong })).rejects.toBeInstanceOf(ValidationError);
    const { id } = await createPromptHandler(workspaceId, { title: 't', content: 'ok' });
    await expect(updatePromptHandler(workspaceId, id, { content: tooLong })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveVersionHandler(workspaceId, id, tooLong)).rejects.toBeInstanceOf(ValidationError);
  });

  it('accepts content exactly at the max length', async () => {
    const { workspaceId } = await seedUser();
    await expect(
      createPromptHandler(workspaceId, { title: 't', content: 'x'.repeat(MAX_CONTENT_LENGTH) })
    ).resolves.toHaveProperty('id');
  });

  it('throws LimitReachedError at the prompt cap, ignoring archived prompts', async () => {
    const { workspaceId } = await seedUser();
    const db = getDb();
    const rows = Array.from({ length: MAX_PROMPTS_PER_WORKSPACE }, (_, i) => ({
      id: `p${i}`, workspaceId, title: `p${i}`, content: 'c',
    }));
    await db.insert(prompts).values(rows);
    await expect(createPromptHandler(workspaceId, { title: 'over', content: 'c' })).rejects.toBeInstanceOf(LimitReachedError);
    await db.update(prompts).set({ status: 'archived' }).where(eq(prompts.id, 'p0'));
    await expect(createPromptHandler(workspaceId, { title: 'fits', content: 'c' })).resolves.toHaveProperty('id');
  });
});

describe('updatePromptHandler isFavorite', () => {
  it('toggles the favorite flag', async () => {
    const { workspaceId } = await seedUser();
    const { id } = await createPromptHandler(workspaceId, { title: 't', content: 'c' });
    const updated = await updatePromptHandler(workspaceId, id, { isFavorite: true });
    expect(updated.is_favorite).toBe(true);
  });
});

describe('listPromptsWithContentHandler', () => {
  it('returns content, excludes archived, favorites first then newest, scoped to workspace', async () => {
    const { workspaceId } = await seedUser();
    const other = await seedUser('user-2', 'u2@example.com');
    const db = getDb();
    await db.insert(prompts).values([
      { id: 'old', workspaceId, title: 'Old', content: 'old body', updatedAt: new Date('2026-01-01') },
      { id: 'new', workspaceId, title: 'New', content: 'new body', updatedAt: new Date('2026-06-01') },
      { id: 'fav', workspaceId, title: 'Fav', content: 'fav body', isFavorite: true, updatedAt: new Date('2025-01-01') },
      { id: 'arch', workspaceId, title: 'Arch', content: 'a', status: 'archived' },
      { id: 'theirs', workspaceId: other.workspaceId, title: 'Theirs', content: 't' },
    ]);
    const list = await listPromptsWithContentHandler(workspaceId, '', 200);
    expect(list.map((p) => p.id)).toEqual(['fav', 'new', 'old']);
    expect(list[0]).toMatchObject({ content: 'fav body', is_favorite: true, title: 'Fav' });
  });

  it('filters by query across title, content and tags', async () => {
    const { workspaceId } = await seedUser();
    await getDb().insert(prompts).values([
      { id: 'a', workspaceId, title: 'Email reply', content: 'x' },
      { id: 'b', workspaceId, title: 'Other', content: 'x', tags: ['email'] },
      { id: 'c', workspaceId, title: 'Nope', content: 'x' },
    ]);
    const ids = (await listPromptsWithContentHandler(workspaceId, 'email', 200)).map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('caps the limit at MAX_EXTENSION_LIST', async () => {
    const { workspaceId } = await seedUser();
    await getDb().insert(prompts).values(
      Array.from({ length: 205 }, (_, i) => ({ id: `q${i}`, workspaceId, title: `q${i}`, content: 'c' }))
    );
    expect(await listPromptsWithContentHandler(workspaceId, '', 9999)).toHaveLength(200);
  });
});
