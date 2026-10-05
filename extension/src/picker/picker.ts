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

const LABEL = { save: 'Save current draft…', signin: 'Sign in to Prompt Saver', empty: 'No prompts yet — open panel' };

export function createPicker(opts: Opts) {
  const host = opts.root ?? document.createElement('div');
  const shadow = host.attachShadow({ mode: opts.root !== undefined ? 'open' : 'closed' });
  const style = document.createElement('style');
  style.textContent = css;
  const list = document.createElement('div');
  list.className = 'ps-list';
  list.setAttribute('role', 'listbox');
  shadow.append(style, list);
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
    list.replaceChildren(
      ...rows.map((row, i) => {
        const el = document.createElement('div');
        el.className = `ps-row${row.kind === 'prompt' ? '' : ' ps-action'}`;
        el.setAttribute('role', 'option');
        el.setAttribute('aria-selected', String(i === active));
        el.textContent = row.kind === 'prompt' ? row.prompt.title : LABEL[row.kind];
        el.addEventListener('mousedown', (e) => {
          e.preventDefault(); // keep editor focus and selection
          activate(row);
        });
        return el;
      })
    );
  }

  function place(anchor: DOMRect): void {
    // Chat boxes sit at the bottom of the screen, so open above the caret.
    list.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - 370))}px`;
    list.style.bottom = `${Math.max(8, window.innerHeight - anchor.top + 6)}px`;
  }

  function update(query: string): void {
    rows = rowsFor(opts.getState(), query);
    active = Math.max(0, Math.min(active, rows.length - 1));
    render();
  }

  function close(): void {
    open = false;
    if (opts.root !== undefined) list.replaceChildren();
    else host.remove();
  }

  return {
    open(anchor: DOMRect, query: string): void {
      if (host.isConnected === false) document.body.append(host);
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
