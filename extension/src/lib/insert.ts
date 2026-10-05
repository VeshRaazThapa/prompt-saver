export type InsertResult = 'inserted' | 'pasted' | 'copied' | 'failed';

function isField(el: HTMLElement): el is HTMLTextAreaElement | HTMLInputElement {
  return el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
}
const read = (el: HTMLElement): string => (isField(el) ? el.value : (el.textContent ?? ''));

/** Last text node that starts before the (container, offset) boundary. */
function lastTextBefore(root: HTMLElement, container: Node, offset: number): Text | null {
  const doc = root.ownerDocument;
  const probe = doc.createRange();
  probe.selectNodeContents(root);
  probe.setEnd(container, offset);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    if (probe.comparePoint(n, 0) === 0 && (n as Text).length > 0) last = n as Text;
  }
  return last;
}

/** Extends the current selection backward by n characters so the next insert replaces them. */
function selectBack(el: HTMLElement, n: number): void {
  if (n <= 0) return;
  if (isField(el)) {
    const end = el.selectionStart ?? el.value.length;
    el.setSelectionRange(Math.max(0, end - n), end);
    return;
  }
  const sel = el.ownerDocument.getSelection();
  if (sel === null || sel.rangeCount === 0) return;
  if (typeof sel.modify === 'function') {
    for (let i = 0; i < n; i++) sel.modify('extend', 'backward', 'character');
    return;
  }
  const r = sel.getRangeAt(0);
  let node: Node = r.startContainer;
  let end = r.startOffset;
  if (node.nodeType !== Node.TEXT_NODE) {
    const t = lastTextBefore(el, node, end);
    if (t === null) return;
    node = t;
    end = t.length;
  }
  const next = el.ownerDocument.createRange();
  next.setStart(node, Math.max(0, end - n));
  next.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(next);
}

function tryExec(el: HTMLElement, text: string): boolean {
  const before = read(el);
  try {
    el.ownerDocument.execCommand('insertText', false, text);
  } catch {
    return false;
  }
  if (read(el) !== before) return true;
  if (isField(el)) {
    // React-controlled textareas: setRangeText + input event.
    el.setRangeText(text, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return read(el) !== before;
  }
  return false;
}

function tryPaste(el: HTMLElement, text: string): boolean {
  const before = read(el);
  try {
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  } catch {
    return false;
  }
  return read(el) !== before;
}

/** Insert strategy chain (spec 5.4). Never submits the message. */
export async function insertText(editor: HTMLElement, text: string, replaceChars = 0): Promise<InsertResult> {
  editor.focus();
  selectBack(editor, replaceChars);
  if (tryExec(editor, text)) return 'inserted';
  if (tryPaste(editor, text)) return 'pasted';
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
