/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { favouritePromptsFor, buildPromptBody } from '@/lib/mcp/prompts';
import { resetDb, seedUser, closeDb } from './helpers';

describe('mcp prompts', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');

    await getDb()
      .insert(prompts)
      .values([
        { id: 'fav', workspaceId: a.workspaceId, title: 'Fav', content: 'body', isFavorite: true },
        {
          id: 'plain',
          workspaceId: a.workspaceId,
          title: 'Plain',
          content: 'body',
          isFavorite: false,
        },
        {
          id: 'arch',
          workspaceId: a.workspaceId,
          title: 'Old',
          content: 'body',
          isFavorite: true,
          status: 'archived',
        },
        {
          id: 'bfav',
          workspaceId: b.workspaceId,
          title: 'B Fav',
          content: 'body',
          isFavorite: true,
        },
      ]);
  });

  afterAll(async () => {
    await closeDb();
  });

  it('returns only favourited, non-archived prompts', async () => {
    const found = await favouritePromptsFor(a.workspaceId);
    expect(found.map((p) => p.id)).toEqual(['fav']);
  });

  // THE ISOLATION GUARD.
  it('never returns another workspace favourites', async () => {
    const found = await favouritePromptsFor(a.workspaceId);
    expect(found.map((p) => p.id)).not.toContain('bfav');
  });

  it('appends context when given, and does not when not', async () => {
    const [p] = await favouritePromptsFor(a.workspaceId);
    expect(buildPromptBody(p!)).toBe('body');
    expect(buildPromptBody(p!, '  ')).toBe('body');
    expect(buildPromptBody(p!, 'auth work')).toBe('body\n\nAdditional context: auth work');
  });
});
