import { createPicker } from '../picker/picker';
import { detectTrigger, textBeforeCaret } from '../picker/trigger';
import { copyFallback, isComposingEvent, pickTriggerLength, shouldHandleKey } from './content-guards';
import { insertText, type InsertResult } from './insert';
import { watchPrompts, watchToken } from './cache';
import type { SiteAdapter } from '../sites/types';
import type { ExtPrompt, Msg, MsgResult } from './types';
import { SITE_BASE } from './config';

const send = <T>(msg: Msg): Promise<MsgResult<T>> => browser.runtime.sendMessage(msg);

function toast(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#1c1917;color:#fafaf9;padding:10px 16px;border-radius:8px;font:14px system-ui';
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

function reportInsert(r: InsertResult): void {
  if (r === 'copied') toast('Copied — press ⌘V / Ctrl+V to paste');
  if (r === 'failed') toast("Couldn't insert. Open the Prompt Saver panel and use Copy.");
}

async function copyOnly(text: string): Promise<boolean> {
  const ok = await copyFallback(text);
  toast(ok ? 'Copied — press ⌘V / Ctrl+V to paste' : "Couldn't insert. Open the Prompt Saver panel and use Copy.");
  return ok;
}

function caretRect(editor: HTMLElement): DOMRect {
  const sel = document.getSelection();
  const r = sel !== null && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
  return r !== null && (r.width > 0 || r.height > 0 || r.top > 0) ? r : editor.getBoundingClientRect();
}

export function runContentScript(adapter: SiteAdapter): void {
  const state = { prompts: [] as ExtPrompt[], signedIn: false };
  void send<{ prompts: ExtPrompt[]; signedIn: boolean }>({ type: 'getPrompts' }).then((r) => {
    if (r.ok) Object.assign(state, r.data);
  });
  watchPrompts((p) => (state.prompts = p));
  watchToken((t) => {
    state.signedIn = t !== null;
    if (t === null) state.prompts = [];
  });

  let openEditor: HTMLElement | null = null;
  const picker = createPicker({
    getState: () => state,
    onPick: (p) => {
      const editor = adapter.findEditor();
      if (editor === null) return void copyOnly(p.content);
      const length = pickTriggerLength(editor); // caret may have moved since the last input
      if (length === null) return picker.close();
      void insertText(editor, p.content, length).then(reportInsert);
    },
    onSaveDraft: () => {
      const draft = adapter.readDraft().replace(/(?:^|\s)\/\/[^\s/]*$/, '').trim();
      void send<{ opened: boolean }>({ type: 'openSavePanel', prefill: { title: draft.split('\n')[0]?.slice(0, 80) ?? '', content: draft } }).then((r) => {
        if (r.ok && !r.data.opened) toast('Click the Prompt Saver icon to finish saving');
      });
    },
    onSignIn: () => window.open(`${SITE_BASE}/extension/connect?ext=${browser.runtime.id}`, '_blank'),
  });

  document.addEventListener(
    'input',
    (e) => {
      const editor = adapter.findEditor();
      if (!shouldHandleKey(e, editor) || editor === null || isComposingEvent(e as InputEvent)) return;
      const trig = detectTrigger(textBeforeCaret(editor));
      if (trig === null) return picker.close();
      if (picker.isOpen()) picker.update(trig.query);
      else {
        openEditor = editor;
        picker.open(caretRect(editor), trig.query);
        void send({ type: 'getPrompts' }); // refreshes in background if stale
      }
    },
    true
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (!picker.isOpen()) return;
      const editor = adapter.findEditor();
      if (editor !== openEditor) return picker.close(); // SPA swapped the editor
      if (shouldHandleKey(e, editor)) picker.handleKey(e);
    },
    true
  );
  document.addEventListener('focusout', (e) => {
    if (picker.isOpen() && shouldHandleKey(e, openEditor)) picker.close();
  });
  document.addEventListener('selectionchange', () => {
    const editor = adapter.findEditor();
    if (picker.isOpen() && (editor === null || editor !== openEditor || pickTriggerLength(editor) === null)) picker.close();
  });
  window.addEventListener('popstate', () => picker.close());
  document.addEventListener('mousedown', (e) => {
    const path = e.composedPath();
    if (path.some((n) => n instanceof Node && picker.contains(n))) return;
    picker.close();
  });

  browser.runtime.onMessage.addListener((msg: { type?: string; text?: string }, _sender, sendResponse) => {
    if (msg.type === 'ps-read-draft') {
      sendResponse({ draft: adapter.readDraft() });
      return false;
    }
    if (msg.type !== 'ps-insert' || typeof msg.text !== 'string') return undefined;
    const editor = adapter.findEditor();
    if (editor === null) {
      void copyOnly(msg.text).then((ok) => sendResponse({ ok }));
      return true;
    }
    void insertText(editor, msg.text).then((r) => {
      reportInsert(r);
      sendResponse({ ok: r !== 'failed' });
    });
    return true;
  });
}
