// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { getToken, setToken, clearAuth, getPrompts, setPrompts, setPendingSave, takePendingSave } from './cache';

const P = { id: 'p1', title: 'T', description: null, tags: [], updated_at: 'x', content: 'C', is_favorite: false };
beforeEach(() => fakeBrowser.reset());

describe('cache', () => {
  it('stores and clears auth with prompts', async () => {
    await setToken('ps_a');
    await setPrompts([P]);
    expect(await getToken()).toBe('ps_a');
    expect((await getPrompts()).prompts).toEqual([P]);
    await clearAuth();
    expect(await getToken()).toBeNull();
    expect(await getPrompts()).toEqual({ prompts: [], syncedAt: 0 });
  });
  it('pending save is taken once', async () => {
    await setPendingSave({ title: 't', content: 'c' });
    expect(await takePendingSave()).toEqual({ title: 't', content: 'c' });
    expect(await takePendingSave()).toBeNull();
  });
});
