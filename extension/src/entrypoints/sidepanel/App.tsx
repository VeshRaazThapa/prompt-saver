import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExtPrompt, Msg, MsgResult, PendingSave } from '@/lib/types';
import { getPrompts as readCachedPrompts, takePendingSave, watchPendingSave, watchPrompts, watchToken } from '@/lib/cache';
import { filterPrompts } from '@/picker/filter';
import { SITE_BASE } from '@/lib/config';
import { PromptCard } from './PromptCard';
import { SaveForm } from './SaveForm';
import { isSupportedUrl, type ActiveTab } from './useActiveTab';
import { AlertIcon, CheckIcon, DraftIcon, ExternalIcon, Logo, PlusIcon, SearchIcon } from './icons';
import { btnGhost, btnPrimary, btnSecondary, field } from './ui';

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

type Notice = { text: string; tone: 'success' | 'error' };
const SUCCESS_MS = 2500;

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  useEffect(() => {
    if (notice.tone !== 'success') return;
    const t = setTimeout(onDismiss, SUCCESS_MS);
    return () => clearTimeout(t);
  }, [notice, onDismiss]);
  const tone =
    notice.tone === 'success'
      ? 'border-teal-600 bg-white text-stone-800 dark:border-teal-400 dark:bg-stone-800 dark:text-stone-100'
      : 'border-red-600 bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200';
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-10 flex justify-center">
      <p role="status" className={`ps-toast pointer-events-auto flex max-w-full items-start gap-2 rounded-lg border-l-2 px-3 py-2.5 text-sm shadow-lg shadow-stone-900/10 ${tone}`}>
        {notice.tone === 'success' ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-teal-600 dark:text-teal-400" /> : <AlertIcon className="mt-0.5 size-4 shrink-0" />}
        <span>{notice.text}</span>
        {notice.tone === 'error' && (
          <button onClick={onDismiss} aria-label="Dismiss" className="-my-1 -mr-1 ml-1 rounded px-1 text-current opacity-60 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none">✕</button>
        )}
      </p>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <span className="font-display text-[22px] leading-none tracking-tight text-stone-900 dark:text-stone-100">Prompt Saver</span>
    </div>
  );
}

function Skeleton() {
  return (
    <main className="space-y-3 p-4" aria-busy="true" aria-label="Loading prompts">
      <Brand />
      <div className="ps-skeleton mt-4 h-11 rounded-lg bg-stone-200/70 dark:bg-stone-800" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="ps-skeleton space-y-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-800/50">
          <div className="h-4 w-2/3 rounded bg-stone-200 dark:bg-stone-700" />
          <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-700/60" />
          <div className="h-3 w-4/5 rounded bg-stone-100 dark:bg-stone-700/60" />
        </div>
      ))}
    </main>
  );
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-stone-600 shadow-[0_1px_0_0] shadow-stone-200 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:shadow-stone-700">{children}</kbd>
);

function Welcome({ reconnect, onConnect }: { reconnect: boolean; onConnect: () => void }) {
  const steps = [
    ['Connect', 'Link the extension to your Prompt Saver library.'],
    ['Type //', 'In Claude, ChatGPT, Codex or Gemini, type // to search your prompts.'],
    ['Press Enter', 'The prompt drops into the chat box, ready to send.'],
  ];
  return (
    <main className="flex min-h-screen flex-col p-5">
      <Brand />
      <h1 className="mt-10 font-display text-[34px] leading-[1.1] text-stone-900 dark:text-stone-100">
        {reconnect ? 'Welcome back.' : <>Your best prompts,<br />one <span className="pr-1 text-teal-600 italic dark:text-teal-400">//</span> away.</>}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">
        {reconnect ? 'Your session ended. Reconnect to keep using your prompts.' : 'Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini.'}
      </p>
      {!reconnect && (
        <ol className="mt-8 space-y-4">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 tabular-nums dark:bg-teal-950 dark:text-teal-300">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button onClick={onConnect} className={`${btnPrimary} mt-8 w-full`}>
        {reconnect ? 'Reconnect' : 'Connect account'}
      </button>
      <p className="mt-auto pt-8 text-xs leading-relaxed text-stone-400 dark:text-stone-500">
        Prompts sync with your account at prompt-saver-two.vercel.app.{' '}
        <a href={`${SITE_BASE}/privacy`} target="_blank" rel="noreferrer" className="underline decoration-stone-300 underline-offset-2 transition-colors duration-150 ease-out hover:text-stone-600 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none dark:decoration-stone-600 dark:hover:text-stone-300">Privacy</a>
      </p>
    </main>
  );
}

function EmptyLibrary({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 px-5 py-8 text-center dark:border-stone-700">
      <Logo className="mx-auto size-10 opacity-90" />
      <p className="mt-4 font-display text-2xl text-stone-900 dark:text-stone-100">Start your library</p>
      <p className="mx-auto mt-1.5 max-w-60 text-sm text-stone-500 dark:text-stone-400">
        Save a prompt you keep retyping. Next time, type <Kbd>//</Kbd> in any chat box to insert it.
      </p>
      <button onClick={onNew} className={`${btnPrimary} mt-5`}><PlusIcon /> Save your first prompt</button>
    </div>
  );
}

export function App({ activeTab }: { activeTab: ActiveTab }) {
  const [prompts, setPrompts] = useState<ExtPrompt[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [notice, setNoticeState] = useState<Notice | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const setNotice = useCallback((text: string, tone: Notice['tone'] = 'error') => setNoticeState({ text, tone }), []);
  const dismiss = useCallback(() => setNoticeState(null), []);

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
  }, [setNotice]);

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

  // "/" jumps to search, like most libraries.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]') !== null;
      if (e.key === '/' && !typing && searchRef.current !== null) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
    if (r.ok) return setNotice(`Inserted “${p.title}”`, 'success');
    // The tab couldn't insert (or couldn't copy: its document isn't focused while the panel is).
    // The panel has focus and a fresh click, so copy here.
    if (r.code === 'no_editor' && (await navigator.clipboard.writeText(p.content).then(() => true, () => false))) {
      setNotice('Copied — paste it into the chat box', 'success');
      return;
    }
    setNotice(r.message);
  }
  async function copy(p: ExtPrompt): Promise<boolean> {
    const ok = await navigator.clipboard.writeText(p.content).then(() => true, () => false);
    if (!ok) setNotice("Couldn't copy to the clipboard");
    return ok;
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

  if (signedIn === null) return <Skeleton />;

  if (!signedIn) return <Welcome reconnect={needsReconnect} onConnect={connect} />;

  const toast = notice !== null && <Toast notice={notice} onDismiss={dismiss} />;

  if (view.kind === 'save') {
    return (
      <main className="p-4">
        <div className="mb-5 flex items-center justify-between">
          <Brand />
        </div>
        <h1 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-100">Save prompt</h1>
        <SaveForm
          key={view.key}
          initial={view.initial}
          onCancel={() => setView({ kind: 'list' })}
          onSave={async (v) => {
            const r = track(await sendWithRetry({ type: 'createPrompt', ...v }));
            if (r.ok) { setView({ kind: 'list' }); setNotice('Saved to your library', 'success'); return null; }
            return messageFor(r);
          }}
        />
        {toast}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 space-y-3 border-b border-stone-200/80 bg-stone-50/90 px-4 pt-3 pb-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90">
        <div className="flex items-center justify-between">
          <Brand />
          <a className={btnGhost} href={`${SITE_BASE}/app`} target="_blank" rel="noreferrer" aria-label="Open Prompt Saver" title="Open your library on the web">
            <ExternalIcon />
          </a>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
          <input ref={searchRef} type="search" aria-label="Search prompts" placeholder="Search prompts" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            className={`${field} min-h-11 pr-9 pl-9`} />
          {query === '' && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"><Kbd>/</Kbd></span>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView(saveView({ title: '', content: '' }))} className={`${btnPrimary} flex-1`}><PlusIcon /> New prompt</button>
          {canInsert && (
            <button onClick={() => void saveDraftFromTab()} className={`${btnSecondary} flex-1`}><DraftIcon /> Save current draft</button>
          )}
        </div>
      </header>

      <main className="flex-1 space-y-3 px-4 py-3">
        {!canInsert && prompts.length > 0 && (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-xs leading-relaxed text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            Open Claude, ChatGPT, Codex or Gemini to insert prompts straight into the chat box.
          </p>
        )}
        {visible.length === 0 ? (
          prompts.length === 0 ? (
            <EmptyLibrary onNew={() => setView(saveView({ title: '', content: '' }))} />
          ) : (
            <p className="py-8 text-center text-sm text-stone-500 dark:text-stone-400">No prompts match “{query}”.</p>
          )
        ) : (
          <ul className="space-y-2">
            {visible.map((p) => (
              <PromptCard key={p.id} prompt={p} canInsert={canInsert} onInsert={() => void insert(p)} onCopy={() => copy(p)} onStar={() => void star(p)} />
            ))}
          </ul>
        )}
      </main>

      <footer className="flex items-center justify-between border-t border-stone-200/80 px-4 py-1 text-xs text-stone-400 dark:border-stone-800 dark:text-stone-500">
        <span className="tabular-nums">{prompts.length} {prompts.length === 1 ? 'prompt' : 'prompts'} · type <Kbd>//</Kbd> in chat</span>
        <button className={`${btnGhost} text-xs`} onClick={() => void send({ type: 'disconnect' })}>Disconnect</button>
      </footer>
      {toast}
    </div>
  );
}
