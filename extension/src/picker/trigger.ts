/**
 * "//" at line start or after whitespace, followed by a query with no spaces
 * or slashes, ending at the caret. "https://" never triggers: ':' precedes it.
 */
const TRIGGER = /(?:^|\s)\/\/([^\s/]*)$/;

export function detectTrigger(textBeforeCaret: string): { query: string; length: number } | null {
  const m = TRIGGER.exec(textBeforeCaret);
  if (m === null) return null;
  const query = m[1] ?? '';
  return { query, length: query.length + 2 };
}

const BLOCK = /^(P|DIV|LI|PRE|BLOCKQUOTE|H[1-6])$/;

/** Nearest block ancestor of the node, stopping at the editor itself. */
function blockOf(editor: HTMLElement, node: Node): HTMLElement {
  let el: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (el !== null && el !== editor) {
    if (el instanceof HTMLElement && BLOCK.test(el.tagName)) return el;
    el = el.parentNode;
  }
  return editor;
}

/** Text from the start of the caret's line (block, or after <br>) up to the caret; <br> counts as newline. */
export function textBeforeCaret(editor: HTMLElement): string {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return editor.value.slice(0, editor.selectionStart ?? editor.value.length);
  }
  const sel = editor.ownerDocument.getSelection();
  if (sel === null || sel.rangeCount === 0) return '';
  const r = sel.getRangeAt(0);
  if (!editor.contains(r.startContainer)) return '';
  const pre = editor.ownerDocument.createRange();
  pre.selectNodeContents(blockOf(editor, r.startContainer));
  pre.setEnd(r.startContainer, r.startOffset);
  const walker = editor.ownerDocument.createTreeWalker(pre.cloneContents(), NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let out = '';
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) out += n.nodeValue ?? '';
    else if ((n as Element).tagName === 'BR') out += '\n';
  }
  return out;
}
