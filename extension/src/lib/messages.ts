import { ApiError, type Api } from './api';
import { clearAuth, getPrompts, getToken, setPendingSave, setPrompts, STALE_MS } from './cache';
import type { ExtPrompt, Msg, MsgResult } from './types';

interface Deps {
  apiFor: (token: string) => Api;
  openPanel: (tabId?: number) => Promise<boolean>;
  sendToTab: (tabId: number, msg: unknown) => Promise<unknown>;
  now?: () => number;
}

const ok = <T>(data: T): MsgResult<T> => ({ ok: true, data });
const signedOut: MsgResult<never> = { ok: false, code: 'signed_out', message: 'Connect your Prompt Saver account first.' };

async function fromError(e: unknown): Promise<MsgResult<never>> {
  if (e instanceof ApiError) {
    if (e.code === 'unauthorized') await clearAuth();
    return { ok: false, code: e.code, message: e.message, ...(e.retryAfter !== undefined ? { retryAfter: e.retryAfter } : {}) };
  }
  return { ok: false, code: 'internal', message: 'Something went wrong. Please try again.' };
}

export function createRouter(deps: Deps) {
  const now = deps.now ?? Date.now;

  async function refresh(token: string): Promise<ExtPrompt[]> {
    const list = await deps.apiFor(token).list();
    await setPrompts(list, now());
    return list;
  }

  async function getPromptsMsg(force: boolean): Promise<MsgResult> {
    const token = await getToken();
    if (token === null) return ok({ prompts: [], signedIn: false });
    const cached = await getPrompts();
    if (!force && now() - cached.syncedAt < STALE_MS) return ok({ prompts: cached.prompts, signedIn: true });
    try {
      return ok({ prompts: await refresh(token), signedIn: true });
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'unauthorized') return ok({ prompts: cached.prompts, signedIn: true });
      return fromError(e);
    }
  }

  async function withToken(fn: (token: string) => Promise<MsgResult>): Promise<MsgResult> {
    const token = await getToken();
    if (token === null) return signedOut;
    try {
      return await fn(token);
    } catch (e) {
      return fromError(e);
    }
  }

  return async function route(msg: Msg, sender?: { tab?: { id?: number } }): Promise<MsgResult> {
    switch (msg.type) {
      case 'getPrompts':
        return getPromptsMsg(msg.refresh === true);
      case 'getStatus':
        return ok({ signedIn: (await getToken()) !== null });
      case 'createPrompt':
        return withToken(async (t) => {
          const input = { title: msg.title, content: msg.content, ...(msg.tags !== undefined ? { tags: msg.tags } : {}) };
          const created = await deps.apiFor(t).create(input);
          await refresh(t).catch(() => undefined);
          return ok(created);
        });
      case 'toggleFavorite':
        return withToken(async (t) => {
          const updated = await deps.apiFor(t).patch(msg.id, { isFavorite: msg.isFavorite });
          await refresh(t).catch(() => undefined);
          return ok(updated);
        });
      case 'openSavePanel':
        await setPendingSave(msg.prefill);
        return ok({ opened: await deps.openPanel(sender?.tab?.id) });
      case 'insertIntoTab': {
        const resp = (await deps.sendToTab(msg.tabId, { type: 'ps-insert', text: msg.text }).catch(() => null)) as { ok?: boolean } | null;
        return resp?.ok === true ? ok(null) : { ok: false, code: 'no_editor', message: "Couldn't find the chat box on this page." };
      }
      case 'disconnect':
        await clearAuth();
        return ok(null);
    }
  };
}
