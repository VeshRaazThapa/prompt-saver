import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ExtPrompt, Msg, MsgResult, PendingSave } from '@/lib/types';
import { getPrompts as readCachedPrompts, takePendingSave, watchPendingSave, watchPrompts, watchToken } from '@/lib/cache';
import { filterPrompts } from '@/picker/filter';
import { SITE_BASE } from '@/lib/config';
import { PromptCard } from './PromptCard';
import { SaveForm } from './SaveForm';
import { isSupportedUrl, type ActiveTab } from './useActiveTab';

const INTERNAL = 'Something went wrong. Please try again.';
/** Never rejects: a missing or crashed worker becomes an internal error result. */
async function send<T>(msg: Msg): Promise<MsgResult<T>> {
  try {
    const r = (await browser.runtime.sendMessage(msg)) as MsgResult<T> | undefined;
    return r ?? { ok: false, code: 'internal', message: INTERNAL };
  } catch {
    return { ok: false, code: 'internal', message: INTERNAL };
  }
}
type View = { kind: 'list' } | { kind: 'save'; initial: PendingSave; key: number };
let formKey = 0;
/** Each prefill gets a fresh key so SaveForm remounts with the new values instead of keeping old state. */
const saveView = (initial: PendingSave): View => ({ kind: 'save', initial, key: ++formKey });

const RETRY_MS = 3000;
async function sendWithRetry<T>(msg: Msg): Promise<MsgResult<T>> {
  const first = await send<T>(msg);
  if (first.ok || first.code !== 'network') return first;
  await new Promise((r) => setTimeout(r, RETRY_MS));
  return send<T>(msg);
}

function messageFor(r: Extract<MsgResult, { ok: false }>): string {
  if (r.code === 'rate_limited') return `Too many requests — try again in ${r.retryAfter ?? 60}s`;
  if (r.code === 'network') return "Couldn't save — try again";
  return r.message;
}

export function App({ activeTab }: { activeTab: ActiveTab }) {
  const [prompts, setPrompts] = useState<ExtPrompt[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await send<{ prompts: ExtPrompt[]; signedIn: boolean }>({ type: 'getPrompts', refresh: true });
    if (r.ok) {
      setPrompts(r.data.prompts);
      setSignedIn(r.data.signedIn);
    } else if (r.code === 'unauthorized') {
      setSignedIn(false);
      setNeedsReconnect(true);
    } else {
      // Any other failure: leave Loading, keep whatever list the cache watcher delivers, explain why.
      const status = await send<{ signedIn: boolean }>({ type: 'getStatus' });
      const signedInNow = status.ok && status.data.signedIn;
      if (signedInNow) {
        const cached = await readCachedPrompts().catch(() => null);
        if (cached !== null) setPrompts(cached.prompts);
      }
      setSignedIn(signedInNow);
      setNotice(r.message);
    }
  }, []);

  useEffect(() => {
    void load();
    void takePendingSave().then((p) => p !== null && setView(saveView(p)));
    const offs = [
      watchPrompts(setPrompts),
      watchToken((t) => { setSignedIn(t !== null); if (t !== null) setNeedsReconnect(false); }),
      watchPendingSave((p) => { if (p !== null) void takePendingSave().then((v) => v !== null && setView(saveView(v))); }),
    ];
    return () => offs.forEach((off) => off());
  }, [load]);

  // Any unauthorized result means the session ended: show Reconnect, not first-time Connect.
  const track = <T,>(r: MsgResult<T>): MsgResult<T> => {
    if (!r.ok && r.code === 'unauthorized') setNeedsReconnect(true);
    return r;
  };
  const visible = useMemo(() => filterPrompts(prompts, query, Infinity), [prompts, query]);
  const connect = () => window.open(`${SITE_BASE}/extension/connect?ext=${browser.runtime.id}`, '_blank');
  const canInsert = isSupportedUrl(activeTab.url) && activeTab.id !== undefined;

  async function insert(p: ExtPrompt) {
    const r = track(await send({ type: 'insertIntoTab', tabId: activeTab.id!, text: p.content }));
    if (r.ok) return;
    // The tab couldn't insert (or couldn't copy: its document isn't focused while the panel is).
    // The panel has focus and a fresh click, so copy here.
    if (r.code === 'no_editor' && (await navigator.clipboard.writeText(p.content).then(() => true, () => false))) {
      setNotice('Copied — paste it into the chat box');
      return;
    }
    setNotice(r.message);
  }
  async function copy(p: ExtPrompt) {
    await navigator.clipboard.writeText(p.content);
    setNotice('Copied');
  }
  async function star(p: ExtPrompt) {
    const r = track(await send({ type: 'toggleFavorite', id: p.id, isFavorite: !p.is_favorite }));
    if (!r.ok) setNotice(messageFor(r));
  }
  async function saveDraftFromTab() {
    // Ask the page for its draft via the content script's adapter.
    const r = await browser.tabs.sendMessage(activeTab.id!, { type: 'ps-read-draft' }).catch(() => null) as { draft?: string } | null;
    const draft = r?.draft ?? '';
    setView(saveView({ title: draft.split('\n')[0]?.slice(0, 80) ?? '', content: draft }));
  }

  if (signedIn === null) return <p className="p-4 text-sm text-stone-500">Loading…</p>;

  if (!signedIn) {
    return (
      <main className="space-y-4 p-4">
        <h1 className="text-xl font-semibold">Prompt Saver</h1>
        <p className="text-sm text-stone-600 dark:text-stone-300">
          {needsReconnect ? 'Your session ended. Reconnect to keep using your prompts.' : 'Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini.'}
        </p>
        <button onClick={connect} className="min-h-11 w-full rounded-lg bg-teal-600 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-teal-700 focus-visible:ring-2">
          {needsReconnect ? 'Reconnect' : 'Connect account'}
        </button>
      </main>
    );
  }

  if (view.kind === 'save') {
    return (
      <main className="p-4">
        <h1 className="mb-3 text-lg font-semibold">Save prompt</h1>
        <SaveForm
          key={view.key}
          initial={view.initial}
          onCancel={() => setView({ kind: 'list' })}
          onSave={async (v) => {
            const r = track(await sendWithRetry({ type: 'createPrompt', ...v }));
            if (r.ok) { setView({ kind: 'list' }); setNotice('Saved'); return null; }
            return messageFor(r);
          }}
        />
      </main>
    );
  }

  return (
    <main className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Prompt Saver</h1>
        <div className="flex gap-1 text-sm">
          <a className="inline-flex min-h-11 items-center rounded px-2 text-teal-700 transition-colors duration-150 ease-out hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none" href={`${SITE_BASE}/app`} target="_blank" rel="noreferrer">Open Prompt Saver</a>
          <button className="min-h-11 rounded px-2 text-stone-500 transition-colors duration-150 ease-out hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none" onClick={() => void send({ type: 'disconnect' })}>Disconnect</button>
        </div>
      </div>
      <input type="search" aria-label="Search prompts" placeholder="Search prompts" value={query} onChange={(e) => setQuery(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-stone-300 p-2 text-sm transition-colors duration-150 ease-out dark:border-stone-600 dark:bg-stone-900 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none" />
      <div className="flex gap-2">
        <button onClick={() => setView(saveView({ title: '', content: '' }))} className="min-h-11 flex-1 rounded-lg bg-teal-600 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-teal-700 focus-visible:ring-2">New prompt</button>
        {canInsert && (
          <button onClick={() => void saveDraftFromTab()} className="min-h-11 flex-1 rounded-lg border border-stone-300 text-sm transition-colors duration-150 ease-out hover:bg-stone-100 focus-visible:ring-2">Save current draft</button>
        )}
      </div>
      {notice !== null && <p role="status" className="text-sm text-teal-700">{notice}</p>}
      {visible.length === 0 ? (
        <p className="text-sm text-stone-500">{prompts.length === 0 ? 'No prompts yet. Click New prompt, or type // in a chat box.' : 'No matches.'}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <PromptCard key={p.id} prompt={p} canInsert={canInsert} onInsert={() => void insert(p)} onCopy={() => void copy(p)} onStar={() => void star(p)} />
          ))}
        </ul>
      )}
    </main>
  );
}
