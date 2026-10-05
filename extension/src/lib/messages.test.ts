// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { createRouter } from './messages';
import { setToken, setPrompts, getToken, getPrompts, takePendingSave } from './cache';
import { ApiError } from './api';

const P = (id: string) => ({ id, title: id, description: null, tags: [], updated_at: 'x', content: 'c', is_favorite: false });

function setup(api: Partial<Record<'list' | 'create' | 'patch', ReturnType<typeof vi.fn>>> = {}, now = 1_000_000) {
  const full = { list: vi.fn().mockResolvedValue([P('fresh')]), create: vi.fn(), patch: vi.fn(), ...api };
  const openPanel = vi.fn().mockResolvedValue(true);
  const sendToTab = vi.fn().mockResolvedValue({ ok: true });
  const route = createRouter({ apiFor: () => full as never, openPanel, sendToTab, now: () => now });
  return { route, api: full, openPanel, sendToTab };
}
beforeEach(() => fakeBrowser.reset());

describe('router', () => {
  it('signed out: getPrompts returns empty and signedIn false without calling the API', async () => {
    const { route, api } = setup();
    expect(await route({ type: 'getPrompts' })).toEqual({ ok: true, data: { prompts: [], signedIn: false } });
    expect(api.list).not.toHaveBeenCalled();
  });

  it('serves fresh cache without refetching, refetches when stale or forced', async () => {
    await setToken('ps_a');
    await setPrompts([P('cached')]);
    const { syncedAt } = await getPrompts();
    const fresh = setup({}, syncedAt + 1000);
    expect((await fresh.route({ type: 'getPrompts' })) ).toMatchObject({ data: { prompts: [P('cached')] } });
    expect(fresh.api.list).not.toHaveBeenCalled();
    const stale = setup({}, syncedAt + 301_000);
    expect(await stale.route({ type: 'getPrompts' })).toMatchObject({ data: { prompts: [P('fresh')] } });
    const forced = setup({}, syncedAt + 1000);
    await forced.route({ type: 'getPrompts', refresh: true });
    expect(forced.api.list).toHaveBeenCalled();
  });

  it('401 clears token and cache and reports unauthorized (no retry loop)', async () => {
    await setToken('ps_a');
    await setPrompts([P('cached')]);
    const { route, api } = setup({ list: vi.fn().mockRejectedValue(new ApiError('unauthorized', 'x')) });
    expect(await route({ type: 'getPrompts', refresh: true })).toMatchObject({ ok: false, code: 'unauthorized' });
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(await getToken()).toBeNull();
    expect((await getPrompts()).prompts).toEqual([]);
  });

  it('network failure on refresh serves the cache', async () => {
    await setToken('ps_a');
    await setPrompts([P('cached')]);
    const { route } = setup({ list: vi.fn().mockRejectedValue(new ApiError('network', 'x')) });
    expect(await route({ type: 'getPrompts', refresh: true })).toMatchObject({ ok: true, data: { prompts: [P('cached')] } });
  });

  it('createPrompt posts then refreshes the cache', async () => {
    await setToken('ps_a');
    const { route, api } = setup({ create: vi.fn().mockResolvedValue(P('new')), list: vi.fn().mockResolvedValue([P('new')]) });
    expect(await route({ type: 'createPrompt', title: 'new', content: 'c' })).toMatchObject({ ok: true });
    expect(api.create).toHaveBeenCalledWith({ title: 'new', content: 'c' });
    expect((await getPrompts()).prompts).toEqual([P('new')]);
  });

  it('createPrompt surfaces limit_reached with its message', async () => {
    await setToken('ps_a');
    const { route } = setup({ create: vi.fn().mockRejectedValue(new ApiError('limit_reached', 'You have reached 1,000 prompts')) });
    expect(await route({ type: 'createPrompt', title: 't', content: 'c' })).toEqual({ ok: false, code: 'limit_reached', message: 'You have reached 1,000 prompts' });
  });

  it('openSavePanel stores the prefill and reports whether the panel opened', async () => {
    const { route, openPanel } = setup();
    openPanel.mockResolvedValueOnce(false);
    expect(await route({ type: 'openSavePanel', prefill: { title: 't', content: 'c' } }, { tab: { id: 7 } })).toEqual({ ok: true, data: { opened: false } });
    expect(openPanel).toHaveBeenCalledWith(7);
    expect(await takePendingSave()).toEqual({ title: 't', content: 'c' });
  });

  it('insertIntoTab forwards ps-insert and maps a failed insert to no_editor', async () => {
    const { route, sendToTab } = setup();
    expect(await route({ type: 'insertIntoTab', tabId: 3, text: 'hi' })).toEqual({ ok: true, data: null });
    expect(sendToTab).toHaveBeenCalledWith(3, { type: 'ps-insert', text: 'hi' });
    sendToTab.mockResolvedValueOnce({ ok: false });
    expect(await route({ type: 'insertIntoTab', tabId: 3, text: 'hi' })).toMatchObject({ ok: false, code: 'no_editor' });
  });
});
