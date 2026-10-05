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

/** Text from the start of the editor up to the caret. */
export function textBeforeCaret(editor: HTMLElement): string {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return editor.value.slice(0, editor.selectionStart ?? editor.value.length);
  }
  const sel = editor.ownerDocument.getSelection();
  if (sel === null || sel.rangeCount === 0) return '';
  const r = sel.getRangeAt(0);
  if (!editor.contains(r.startContainer)) return '';
  const pre = editor.ownerDocument.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString();
}
