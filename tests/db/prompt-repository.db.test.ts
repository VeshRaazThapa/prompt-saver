/**
 * @jest-environment node
 */
import { DrizzlePromptRepository } from '@/lib/db/drizzle/prompt-repository';
import type { Prompt, PromptVersion } from '@/types';
import { closeDb, resetDb, seedUser } from './helpers';

const repo = new DrizzlePromptRepository();

function makePrompt(overrides: Partial<Prompt> & { id: string; workspace_id: string }): Prompt {
  return {
    title: 'Untitled',
    content: '',
    current_version_id: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: [],
    is_favorite: false,
    status: 'active',
    metadata: { version_count: 0 },
    ...overrides,
  };
}

function makeVersion(
  overrides: Partial<PromptVersion> & { id: string; prompt_id: string }
): PromptVersion {
  return {
    version_number: 1,
    content: 'draft',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('DrizzlePromptRepository', () => {
  let workspaceA: string;
  let workspaceB: string;

  beforeEach(async () => {
    await resetDb();
    workspaceA = (await seedUser('user-a', 'a@example.com')).workspaceId;
    workspaceB = (await seedUser('user-b', 'b@example.com')).workspaceId;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates and reads back a prompt with domain-shaped fields', async () => {
    await repo.create(
      makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Hello', tags: ['x'] })
    );

    const found = await repo.findById('p1');
    expect(found?.title).toBe('Hello');
    expect(found?.tags).toEqual(['x']);
    expect(found?.metadata.version_count).toBe(0);
    expect(typeof found?.created_at).toBe('string');
  });

  it('returns null for a missing prompt', async () => {
    expect(await repo.findById('nope')).toBeNull();
  });

  // THE ISOLATION GUARD — see spec section 2.
  it('never returns another workspace prompt', async () => {
    await repo.create(makePrompt({ id: 'secret', workspace_id: workspaceB, title: 'Private' }));

    const listed = await repo.findByWorkspaceId(workspaceA);
    expect(listed).toHaveLength(0);

    const searched = await repo.search(workspaceA, 'Private');
    expect(searched).toHaveLength(0);

    expect(await repo.countByWorkspaceId(workspaceA)).toBe(0);
  });

  it('finds by substring, matching current IndexedDB behavior', async () => {
    await repo.create(
      makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Prompt Engineering' })
    );

    expect(await repo.search(workspaceA, 'prom')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'ENGINE')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'zzz')).toHaveLength(0);
  });

  it('searches description, content, and tags too', async () => {
    await repo.create(
      makePrompt({
        id: 'p1',
        workspace_id: workspaceA,
        title: 'A',
        description: 'about llamas',
        content: 'body text',
        tags: ['research'],
      })
    );

    expect(await repo.search(workspaceA, 'llamas')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'body')).toHaveLength(1);
    expect(await repo.search(workspaceA, 'research')).toHaveLength(1);
  });

  it('treats % as a literal character, not a wildcard', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'plain title' }));
    expect(await repo.search(workspaceA, '%')).toHaveLength(0);
  });

  it('filters favorites and archived', async () => {
    await repo.create(
      makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Fav', is_favorite: true })
    );
    await repo.create(
      makePrompt({ id: 'p2', workspace_id: workspaceA, title: 'Arch', status: 'archived' })
    );

    expect(await repo.findByWorkspaceId(workspaceA, { favoritesOnly: true })).toHaveLength(1);
    expect(await repo.findByWorkspaceId(workspaceA, { status: 'archived' })).toHaveLength(1);
  });

  it('sorts by title ascending', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Beta' }));
    await repo.create(makePrompt({ id: 'p2', workspace_id: workspaceA, title: 'Alpha' }));

    const sorted = await repo.findByWorkspaceId(workspaceA, {
      sortBy: 'title',
      sortOrder: 'asc',
    });
    expect(sorted.map((p) => p.title)).toEqual(['Alpha', 'Beta']);
  });

  it('updates and deletes', async () => {
    await repo.create(makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'Old' }));

    const updated = await repo.update('p1', { title: 'New', is_favorite: true });
    expect(updated.title).toBe('New');
    expect(updated.is_favorite).toBe(true);

    expect(await repo.delete('p1')).toBe(true);
    expect(await repo.delete('p1')).toBe(false);
  });

  it('throws NotFoundError when updating a missing prompt', async () => {
    await expect(repo.update('ghost', { title: 'x' })).rejects.toThrow(
      'Prompt with id ghost not found'
    );
  });

  it('creates a prompt and its first version atomically', async () => {
    const result = await repo.createWithFirstVersion(
      makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'New', content: 'hello' }),
      makeVersion({ id: 'v1', prompt_id: 'p1', content: 'hello' })
    );

    expect(result.current_version_id).toBe('v1');
    expect(result.metadata.version_count).toBe(1);

    const found = await repo.findById('p1');
    expect(found?.current_version_id).toBe('v1');
    expect(found?.metadata.version_count).toBe(1);
  });

  // Proves createPromptAction/duplicatePromptAction can no longer leave an orphaned
  // prompt row behind when the version insert fails partway through.
  it('rolls back the prompt row when the version insert fails', async () => {
    await repo.createWithFirstVersion(
      makePrompt({ id: 'p1', workspace_id: workspaceA, title: 'First' }),
      makeVersion({ id: 'dup-version-id', prompt_id: 'p1' })
    );

    // Reusing the same version id on a different prompt collides with
    // prompt_versions' primary key — a real Postgres constraint violation,
    // not a simulated failure.
    await expect(
      repo.createWithFirstVersion(
        makePrompt({ id: 'p2', workspace_id: workspaceA, title: 'Second' }),
        makeVersion({ id: 'dup-version-id', prompt_id: 'p2' })
      )
    ).rejects.toThrow();

    expect(await repo.findById('p2')).toBeNull();
  });
});
