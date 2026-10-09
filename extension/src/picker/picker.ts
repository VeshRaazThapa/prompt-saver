import css from './picker.css?inline';
import { filterPrompts } from './filter';
import type { ExtPrompt } from '../lib/types';

type Row = { kind: 'prompt'; prompt: ExtPrompt } | { kind: 'save' } | { kind: 'signin' } | { kind: 'empty' };

interface Opts {
  getState: () => { prompts: ExtPrompt[]; signedIn: boolean };
  onPick: (p: ExtPrompt) => void;
  onSaveDraft: () => void;
  onSignIn: () => void;
  root?: HTMLElement;
}

function rowsFor(state: { prompts: ExtPrompt[]; signedIn: boolean }, query: string): Row[] {
  if (!state.signedIn) return [{ kind: 'signin' }];
  if (state.prompts.length === 0) return [{ kind: 'empty' }, { kind: 'save' }];
  return [...filterPrompts(state.prompts, query).map((prompt) => ({ kind: 'prompt' as const, prompt })), { kind: 'save' }];
}

// Same artwork as the toolbar icon, at 16px.
const MARK =
  '<svg viewBox="0 0 32 32" width="16" height="16" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0D9488"/><path d="M9 6.5a1.5 1.5 0 0 1 1.5-1.5h11a1.5 1.5 0 0 1 1.5 1.5V27l-7-5-7 5z" fill="#FAFAF9"/><g stroke="#0D9488" stroke-width="2.6" stroke-linecap="round"><line x1="12.6" y1="17.5" x2="14.6" y2="10"/><line x1="17.4" y1="17.5" x2="19.4" y2="10"/></g></svg>';

const LABEL = { save: 'Save current draft…', signin: 'Sign in to Prompt Saver', empty: 'No prompts yet — open panel' };

export function createPicker(opts: Opts) {
  const host = opts.root ?? document.createElement('div');
  host.setAttribute('data-ps-picker', '');
  const shadow = host.attachShadow({ mode: opts.root !== undefined ? 'open' : 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  const panel = document.createElement('div');
  panel.className = 'ps-panel';
  const head = document.createElement('div');
  head.className = 'ps-head';
  head.innerHTML = `${MARK}<span>Prompt Saver</span><span class="ps-query"></span>`;
  const list = document.createElement('div');
  list.className = 'ps-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Prompt Saver prompts');
  const foot = document.createElement('div');
  foot.className = 'ps-foot';
  foot.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> insert</span><span><kbd>esc</kbd> close</span>';
  panel.append(head, list, foot);
  shadow.append(style, panel);
  const queryEl = head.querySelector<HTMLElement>('.ps-query')!;
  let rows: Row[] = [];
  let active = 0;
  let open = false;

  function activate(row: Row): void {
    close();
    if (row.kind === 'prompt') opts.onPick(row.prompt);
    else if (row.kind === 'save' || row.kind === 'empty') opts.onSaveDraft();
    else opts.onSignIn();
  }

  function render(): void {
    const noMatch = rows[0]?.kind === 'save' && opts.getState().prompts.length > 0;
    const els = rows.map((row, i) => {
      const el = document.createElement('div');
      el.className = `ps-row${row.kind === 'prompt' ? '' : ' ps-action'}`;
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(i === active));
      const title = document.createElement('span');
      title.className = 'ps-title';
      title.textContent = row.kind === 'prompt' ? row.prompt.title : LABEL[row.kind];
      el.append(title);
      if (row.kind === 'prompt') {
        const sub = document.createElement('span');
        sub.className = 'ps-sub';
        sub.textContent = row.prompt.content.replace(/\s+/g, ' ').slice(0, 140);
        el.append(sub);
        if (row.prompt.is_favorite) el.classList.add('ps-fav');
      }
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keep editor focus and selection
        activate(row);
      });
      el.addEventListener('mousemove', () => {
        if (active === i) return;
        active = i;
        render();
      });
      return el;
    });
    if (noMatch) {
      const empty = document.createElement('div');
      empty.className = 'ps-empty';
      empty.textContent = 'No prompts match';
      els.unshift(empty);
    }
    list.replaceChildren(...els);
    list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }

  function place(anchor: DOMRect): void {
    // Chat boxes sit at the bottom of the screen, so open above the caret.
    panel.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - 392))}px`;
    panel.style.bottom = `${Math.max(8, window.innerHeight - anchor.top + 8)}px`;
  }

  function update(query: string): void {
    rows = rowsFor(opts.getState(), query);
    queryEl.textContent = query === '' ? '' : `//${query}`;
    active = Math.max(0, Math.min(active, rows.length - 1));
    render();
  }

  function close(): void {
    open = false;
    if (opts.root !== undefined) panel.remove();
    else host.remove();
  }

  return {
    open(anchor: DOMRect, query: string): void {
      if (host.isConnected === false) document.body.append(host);
      if (!panel.isConnected) shadow.append(panel);
      open = true;
      active = 0;
      place(anchor);
      update(query);
    },
    update,
    close,
    isOpen: () => open,
    contains: (node: Node): boolean => node === host || host.contains(node),
    handleKey(e: KeyboardEvent): boolean {
      if (!open || e.isComposing || e.keyCode === 229) return false;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (rows.length > 0) active = (active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
        render();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        const row = rows[active];
        if (row !== undefined) activate(row);
      } else if (e.key === 'Escape') {
        close();
      } else {
        return false;
      }
      e.preventDefault();
      e.stopPropagation();
      return true;
    },
  };
}
