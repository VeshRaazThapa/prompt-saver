/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import { favouritePromptsFor, buildPromptBody, slugify } from '@/lib/mcp/prompts';
import { resetDb, seedUser, closeDb } from './helpers';

/**
 * Mirrors the registration loop in src/app/api/mcp/route.ts: fetch
 * favourites, then assign each a slug in iteration order, feeding the
 * growing `taken` set forward exactly as the route does.
 */
async function nameFavourites(workspaceId: string): Promise<Record<string, string>> {
  const taken = new Set<string>();
  const names: Record<string, string> = {};
  for (const prompt of await favouritePromptsFor(workspaceId)) {
    const name = slugify(prompt.title, prompt.id, taken);
    taken.add(name);
    names[prompt.id] = name;
  }
  return names;
}

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

  // Guards against non-deterministic slug assignment: findByWorkspaceId's
  // default order is `updated_at DESC` with no secondary key, and
  // `updated_at` uses defaultNow() — rows inserted in one statement share a
  // transaction timestamp, so Postgres is free to return them in either
  // order on a tie. Without a stable secondary sort in favouritePromptsFor,
  // whichever prompt lands first would get the bare slug, and that could
  // flip between requests — the exact "command changes identity between
  // sessions" failure the brief calls worse than an ugly name.
  it('assigns the same slugs to same-titled favourites on every run, even with a tied updated_at', async () => {
    // Same INSERT statement -> same transaction -> identical updated_at for both rows.
    await getDb()
      .insert(prompts)
      .values([
        {
          id: 'tie-b',
          workspaceId: a.workspaceId,
          title: 'Daily Planning',
          content: 'body',
          isFavorite: true,
        },
        {
          id: 'tie-a',
          workspaceId: a.workspaceId,
          title: 'Daily Planning',
          content: 'body',
          isFavorite: true,
        },
      ]);

    const first = await nameFavourites(a.workspaceId);
    const second = await nameFavourites(a.workspaceId);

    // Stable across runs — the regression this guards against.
    expect(second).toEqual(first);
    // And pinned to the id-ascending contract favouritePromptsFor promises,
    // not just "whatever the first run happened to produce".
    expect(first['tie-a']).toBe('daily-planning');
    expect(first['tie-b']).toBe('daily-planning-tie-b');
  });
});
