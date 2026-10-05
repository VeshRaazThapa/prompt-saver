import type { ExtPrompt, PendingSave } from './types';

export const STALE_MS = 300_000;
const token = storage.defineItem<string | null>('local:psToken', { fallback: null });
const prompts = storage.defineItem<ExtPrompt[]>('local:psPrompts', { fallback: [] });
const syncedAt = storage.defineItem<number>('local:psSyncedAt', { fallback: 0 });
const pending = storage.defineItem<PendingSave | null>('session:psPendingSave', { fallback: null });

export const getToken = (): Promise<string | null> => token.getValue();
/** Stores a token. A different token means a different account: drop the old account's cache first. */
export async function setToken(t: string): Promise<void> {
  if ((await token.getValue()) !== t) await Promise.all([prompts.removeValue(), syncedAt.removeValue()]);
  await token.setValue(t);
}
export async function clearAuth(): Promise<void> {
  await Promise.all([token.removeValue(), prompts.removeValue(), syncedAt.removeValue()]);
}
export async function getPrompts(): Promise<{ prompts: ExtPrompt[]; syncedAt: number }> {
  return { prompts: await prompts.getValue(), syncedAt: await syncedAt.getValue() };
}
export async function setPrompts(p: ExtPrompt[], at: number = Date.now()): Promise<void> {
  await Promise.all([prompts.setValue(p), syncedAt.setValue(at)]);
}
export const setPendingSave = (p: PendingSave | null): Promise<void> => pending.setValue(p);
export async function takePendingSave(): Promise<PendingSave | null> {
  const v = await pending.getValue();
  await pending.removeValue();
  return v;
}
/** Panel and content scripts subscribe to cache changes. */
export const watchPrompts = (cb: (p: ExtPrompt[]) => void): (() => void) => prompts.watch((v) => cb(v ?? []));
export const watchToken = (cb: (t: string | null) => void): (() => void) => token.watch((v) => cb(v ?? null));
export const watchPendingSave = (cb: (p: PendingSave | null) => void): (() => void) => pending.watch((v) => cb(v ?? null));
