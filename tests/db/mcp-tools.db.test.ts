/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { searchPromptsHandler, getPromptHandler } from '@/lib/mcp/tools';
import { resetDb, seedUser, closeDb } from './helpers';

describe('mcp read tools', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');

    await getDb()
      .insert(prompts)
      .values([
        {
          id: 'a1',
          workspaceId: a.workspaceId,
          title: 'Daily Planning',
          content: 'plan the day',
          tags: ['routine'],
        },
        {
          id: 'b1',
          workspaceId: b.workspaceId,
          title: 'Secret Prompt',
          content: 'private stuff',
          tags: [],
        },
      ]);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('searches within the caller workspace', async () => {
    const results = await searchPromptsHandler(a.workspaceId, 'planning', 20);
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe('Daily Planning');
  });

  it('returns summaries only, never prompt bodies', async () => {
    const results = await searchPromptsHandler(a.workspaceId, 'planning', 20);
    expect(JSON.stringify(results)).not.toContain('plan the day');
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('updated_at');
  });

  // THE ISOLATION GUARD.
  it('never surfaces another workspace prompt in search', async () => {
    expect(await searchPromptsHandler(a.workspaceId, 'Secret', 20)).toHaveLength(0);
  });

  it('refuses to fetch another workspace prompt by id', async () => {
    await expect(getPromptHandler(a.workspaceId, 'b1')).rejects.toThrow('not found');
  });

  it('fetches an owned prompt with its full content', async () => {
    const p = await getPromptHandler(a.workspaceId, 'a1');
    expect(p.content).toBe('plan the day');
  });

  it('caps limit at 50 even when asked for more', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `bulk-${i}`,
      workspaceId: a.workspaceId,
      title: `Bulk ${i}`,
      content: 'x',
    }));
    await getDb().insert(prompts).values(rows);

    expect((await searchPromptsHandler(a.workspaceId, 'Bulk', 999)).length).toBeLessThanOrEqual(
      50
    );
  });
});
