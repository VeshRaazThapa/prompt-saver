import { describe, it, expect, vi, beforeEach } from 'vitest';
import { insertText } from './insert';

function editable(text = ''): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.textContent = text;
  document.body.replaceChildren(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(range);
  return el;
}

/** jsdom has no execCommand; emulate a working editor by inserting at the selection. */
function workingExecCommand() {
  return vi.fn((cmd: string, _ui: boolean, value?: string) => {
    if (cmd !== 'insertText') return false;
    const sel = getSelection()!;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    r.insertNode(document.createTextNode(value ?? ''));
    return true;
  });
}

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('insertText', () => {
  it('uses execCommand insertText and preserves unicode + newlines', async () => {
    document.execCommand = workingExecCommand() as never;
    const el = editable();
    expect(await insertText(el, 'Line 1\nLine 2 ✅ 日本')).toBe('inserted');
    expect(el.textContent).toBe('Line 1\nLine 2 ✅ 日本');
  });

  it('replaces the //query before the caret', async () => {
    document.execCommand = workingExecCommand() as never;
    const el = editable('hi //em');
    expect(await insertText(el, 'PROMPT', 4)).toBe('inserted');
    expect(el.textContent).toBe('hi PROMPT');
  });

  it('works for textarea via setRangeText when execCommand does nothing', async () => {
    document.execCommand = vi.fn(() => false) as never;
    const ta = document.createElement('textarea');
    document.body.replaceChildren(ta);
    ta.value = 'x //q';
    ta.setSelectionRange(5, 5);
    expect(await insertText(ta, 'P', 3)).toBe('inserted');
    expect(ta.value).toBe('x P');
  });

  it('falls back to paste event, then clipboard', async () => {
    document.execCommand = vi.fn(() => false) as never;
    const el = editable();
    const onPaste = vi.fn((e: Event) => {
      el.textContent = (e as ClipboardEvent).clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
    });
    el.addEventListener('paste', onPaste);
    // jsdom lacks DataTransfer; the paste step is only reachable where it exists.
    const pasteResult = await insertText(el, 'pasted');
    expect(pasteResult).toBe(typeof DataTransfer !== 'undefined' ? 'pasted' : 'copied');
    el.removeEventListener('paste', onPaste);
    el.textContent = '';
    expect(await insertText(el, 'clip')).toBe('copied');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('clip');
  });

  it('reports failed when even the clipboard rejects', async () => {
    document.execCommand = vi.fn(() => false) as never;
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'));
    expect(await insertText(editable(), 'x')).toBe('failed');
  });
});
