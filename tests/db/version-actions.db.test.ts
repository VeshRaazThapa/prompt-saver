/**
 * @jest-environment node
 */
import { closeDb, resetDb } from './helpers';

const mockSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({ requireAuth: () => mockSession() }));

// The isolation tests below deliberately trigger expected errors that run()
// logs via logger.error. Mocking the logger keeps test output pristine.
jest.mock('@/lib/logging', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import * as prompts from '@/lib/actions/prompts';
import * as versions from '@/lib/actions/versions';

function signInAs(id: string, email: string) {
  mockSession.mockResolvedValue({ user: { id, email, name: id, image: null } });
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(`Expected ok, got: ${result.error}`);
  return result.data;
}

async function newPrompt(title = 'P', content = 'v1 body'): Promise<string> {
  return unwrap(await prompts.createPromptAction({ title, content, tags: [] })).id;
}

describe('version actions', () => {
  beforeEach(async () => {
    await resetDb();
    mockSession.mockReset();
  });

  afterAll(async () => {
    await closeDb();
  });

  it('saves a new version and bumps the prompt', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt();

    const version = unwrap(
      await versions.saveVersionAction(id, {
        title: 'P',
        content: 'v2 body',
        tags: [],
        changeSummary: 'second pass',
      })
    );

    expect(version.version_number).toBe(2);

    const { prompt } = unwrap(await prompts.getPromptAction(id));
    expect(prompt.metadata.version_count).toBe(2);
    expect(prompt.current_version_id).toBe(version.id);
  });

  it('lists versions newest first', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt();
    await versions.saveVersionAction(id, { title: 'P', content: 'v2', tags: [] });

    const list = unwrap(await versions.listVersionsAction(id));
    expect(list.map((v) => v.version_number)).toEqual([2, 1]);
  });

  it('saveCurrent updates the draft and the current version result without adding a version', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt();

    await versions.saveCurrentAction(id, {
      title: 'Renamed',
      content: 'edited',
      tags: ['t'],
      result: 'output',
    });

    const { prompt, currentVersionResult } = unwrap(await prompts.getPromptAction(id));
    expect(prompt.title).toBe('Renamed');
    expect(prompt.metadata.version_count).toBe(1);
    expect(currentVersionResult).toBe('output');
  });

  it('restores an old version as a new version', async () => {
    signInAs('user-a', 'a@example.com');
    const id = await newPrompt('P', 'original');
    await versions.saveVersionAction(id, { title: 'P', content: 'changed', tags: [] });

    const list = unwrap(await versions.listVersionsAction(id));
    const first = list.find((v) => v.version_number === 1);

    const restored = unwrap(await versions.restoreVersionAction(id, first!.id));
    expect(restored.version_number).toBe(3);
    expect(restored.content).toBe('original');
    expect(restored.change_summary).toBe('Restored from version 1');

    const { prompt } = unwrap(await prompts.getPromptAction(id));
    expect(prompt.content).toBe('original');
  });

  // THE ISOLATION GUARD.
  it('refuses to list or mutate versions of another user prompt', async () => {
    signInAs('user-b', 'b@example.com');
    const id = await newPrompt('Secret', 'private');
    const list = unwrap(await versions.listVersionsAction(id));
    const versionId = list[0]!.id;

    signInAs('user-a', 'a@example.com');
    expect((await versions.listVersionsAction(id)).ok).toBe(false);
    expect((await versions.saveVersionAction(id, { title: 'x', content: 'x', tags: [] })).ok).toBe(
      false
    );
    expect((await versions.updateVersionResultAction(id, versionId, 'hacked')).ok).toBe(false);
    expect((await versions.restoreVersionAction(id, versionId)).ok).toBe(false);
  });

  it('refuses a version that belongs to a different prompt', async () => {
    signInAs('user-a', 'a@example.com');
    const first = await newPrompt('One', 'a');
    const second = await newPrompt('Two', 'b');
    const otherVersion = unwrap(await versions.listVersionsAction(second))[0]!.id;

    expect((await versions.updateVersionResultAction(first, otherVersion, 'x')).ok).toBe(false);
  });
});
