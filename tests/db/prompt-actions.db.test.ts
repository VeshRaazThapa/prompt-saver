/**
 * @jest-environment node
 */
import { closeDb, resetDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({ requireAuth: () => mockSession() }));

// The isolation/auth-failure tests below deliberately trigger expected errors that
// run() logs via logger.error. Mocking the logger keeps test output pristine while
// still letting us assert the logging actually happened (see "refuses to read
// another user prompt" below) — so a regression that silently drops the log call
// would still be caught.
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import * as actions from '@/lib/actions/prompts';
import { logger } from '@/lib/logging';

function signInAs(id: string, email: string) {
  mockSession.mockResolvedValue({ user: { id, email, name: id, image: null } });
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error}`);
  return result.data;
}

describe('prompt actions', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
    jest.mocked(logger.error).mockClear();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates a prompt with its first version', async () => {
    signInAs('user-a', 'a@example.com');

    const { id } = unwrap(
      await actions.createPromptAction({ title: 'First', content: 'hello', tags: ['x'] })
    );
    const { prompt } = unwrap(await actions.getPromptAction(id));

    expect(prompt.title).toBe('First');
    expect(prompt.metadata.version_count).toBe(1);
    expect(prompt.current_version_id).not.toBe('');
  });

  // THE ISOLATION GUARD — user A must not reach user B's prompt.
  it('refuses to read another user prompt', async () => {
    signInAs('user-b', 'b@example.com');
    const { id } = unwrap(
      await actions.createPromptAction({ title: 'Secret', content: 's', tags: [] })
    );

    signInAs('user-a', 'a@example.com');
    const result = await actions.getPromptAction(id);

    expect(result.ok).toBe(false);
    // The mock above swallows the log line so test output stays clean — assert it
    // still fired so a regression that stops run() from logging errors is caught.
    expect(logger.error).toHaveBeenCalled();
  });

  it('refuses to delete another user prompt', async () => {
    signInAs('user-b', 'b@example.com');
    const { id } = unwrap(
      await actions.createPromptAction({ title: 'Secret', content: 's', tags: [] })
    );

    signInAs('user-a', 'a@example.com');
    expect((await actions.deletePromptAction(id)).ok).toBe(false);

    signInAs('user-b', 'b@example.com');
    expect((await actions.getPromptAction(id)).ok).toBe(true);
  });

  it('lists only the signed-in user prompts, with tag counts', async () => {
    signInAs('user-b', 'b@example.com');
    await actions.createPromptAction({ title: 'B prompt', content: '', tags: ['shared'] });

    signInAs('user-a', 'a@example.com');
    await actions.createPromptAction({ title: 'A prompt', content: '', tags: ['shared', 'mine'] });

    const { prompts, allTags } = unwrap(await actions.listPrompts({}));
    expect(prompts).toHaveLength(1);
    expect(allTags).toEqual([
      { tag: 'mine', count: 1 },
      { tag: 'shared', count: 1 },
    ]);
  });

  it('hides archived prompts from the default view', async () => {
    signInAs('user-a', 'a@example.com');
    const { id } = unwrap(
      await actions.createPromptAction({ title: 'Old', content: '', tags: [] })
    );
    await actions.archivePromptAction(id);

    expect(unwrap(await actions.listPrompts({})).prompts).toHaveLength(0);
    expect(unwrap(await actions.listPrompts({ filter: 'archived' })).prompts).toHaveLength(1);
  });

  it('toggles favorite and filters by it', async () => {
    signInAs('user-a', 'a@example.com');
    const { id } = unwrap(
      await actions.createPromptAction({ title: 'Fav', content: '', tags: [] })
    );

    await actions.toggleFavoriteAction(id);
    expect(unwrap(await actions.listPrompts({ filter: 'favorites' })).prompts).toHaveLength(1);

    await actions.toggleFavoriteAction(id);
    expect(unwrap(await actions.listPrompts({ filter: 'favorites' })).prompts).toHaveLength(0);
  });

  it('duplicates a prompt into the same workspace', async () => {
    signInAs('user-a', 'a@example.com');
    await actions.createPromptAction({ title: 'Original', content: 'body', tags: [] });

    const [first] = unwrap(await actions.listPrompts({})).prompts;
    await actions.duplicatePromptAction(first!.id);

    const titles = unwrap(await actions.listPrompts({})).prompts.map((p) => p.title);
    expect(titles).toContain('Copy of Original');
  });

  it('searches by substring', async () => {
    signInAs('user-a', 'a@example.com');
    await actions.createPromptAction({ title: 'Engineering notes', content: '', tags: [] });

    expect(unwrap(await actions.listPrompts({ searchQuery: 'engine' })).prompts).toHaveLength(1);
    expect(unwrap(await actions.listPrompts({ searchQuery: 'zzz' })).prompts).toHaveLength(0);
  });

  it('fails cleanly when not signed in', async () => {
    mockSession.mockRejectedValue(new Error('Authentication required'));
    const result = await actions.listPrompts({});
    expect(result.ok).toBe(false);
  });
});
