import { detectTrigger, textBeforeCaret } from '../picker/trigger';

/** Characters to replace for the trigger currently ending at the caret, or null if there is none. */
export function pickTriggerLength(editor: HTMLElement): number | null {
  return detectTrigger(textBeforeCaret(editor))?.length ?? null;
}

/** Only keys originating inside the live editor may be consumed by the picker. */
export function shouldHandleKey(e: Pick<Event, 'target'>, editor: HTMLElement | null): boolean {
  return editor !== null && e.target instanceof Node && editor.contains(e.target);
}

/** IME composition events must not drive the picker. */
export function isComposingEvent(e: { isComposing?: boolean; keyCode?: number }): boolean {
  return e.isComposing === true || e.keyCode === 229;
}

/** Clipboard fallback when no editor is available. Resolves true on success. */
export async function copyFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
