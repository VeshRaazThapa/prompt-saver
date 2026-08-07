/**
 * @jest-environment node
 */
import { getDb } from '@/lib/db/drizzle/client';
import { prompts } from '@/lib/db/drizzle/schema';
import {
  createPromptHandler,
  updatePromptHandler,
  saveVersionHandler,
  getPromptHandler,
} from '@/lib/mcp/tools';
import { resetDb, seedUser, closeDb } from './helpers';

describe('mcp write tools', () => {
  let a: { userId: string; workspaceId: string };
  let b: { userId: string; workspaceId: string };

  beforeEach(async () => {
    await resetDb();
    a = await seedUser('user-a', 'a@example.com');
    b = await seedUser('user-b', 'b@example.com');
    await getDb()
      .insert(prompts)
      .values({ id: 'b1', workspaceId: b.workspaceId, title: 'Secret', content: 'private' });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('creates a prompt with exactly one version and no orphan', async () => {
    const { id } = await createPromptHandler(a.workspaceId, {
      title: 'From Claude',
      content: 'body',
      tags: ['mcp'],
    });

    const p = await getPromptHandler(a.workspaceId, id);
    expect(p.metadata.version_count).toBe(1);
    expect(p.current_version_id).not.toBe('');
    expect(p.tags).toEqual(['mcp']);
  });

  it('updates an owned prompt', async () => {
    const { id } = await createPromptHandler(a.workspaceId, { title: 'X', content: 'old' });
    const updated = await updatePromptHandler(a.workspaceId, id, { content: 'new' });
    expect(updated.content).toBe('new');
  });

  it('saves a new version and bumps the count', async () => {
    const { id } = await createPromptHandler(a.workspaceId, { title: 'X', content: 'v1' });
    const v = await saveVersionHandler(a.workspaceId, id, 'v2', 'second pass');

    expect(v.version_number).toBe(2);
    const p = await getPromptHandler(a.workspaceId, id);
    expect(p.metadata.version_count).toBe(2);
    // save_version must also write prompts.content — otherwise get_prompt,
    // the web editor, and favourite slash commands all keep serving the
    // stale body even though the version row and current_version_id moved on.
    expect(p.content).toBe('v2');
  });

  // THE ISOLATION GUARDS.
  it('refuses to update another workspace prompt', async () => {
    await expect(updatePromptHandler(a.workspaceId, 'b1', { content: 'hacked' })).rejects.toThrow(
      'not found'
    );
    expect((await getPromptHandler(b.workspaceId, 'b1')).content).toBe('private');
  });

  it('refuses to version another workspace prompt', async () => {
    await expect(saveVersionHandler(a.workspaceId, 'b1', 'hacked')).rejects.toThrow('not found');
  });

  it('creates into the caller own workspace, never another', async () => {
    const { id } = await createPromptHandler(a.workspaceId, { title: 'Mine', content: 'x' });
    const p = await getPromptHandler(a.workspaceId, id);
    expect(p.workspace_id).toBe(a.workspaceId);
    expect(p.workspace_id).not.toBe(b.workspaceId);
  });
});
