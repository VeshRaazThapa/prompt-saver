import { describe, it, expect, vi } from 'vitest';
import { pickTriggerLength, shouldHandleKey, isComposingEvent, copyFallback } from './content-guards';

function textarea(value: string, caret: number): HTMLTextAreaElement {
  const t = document.createElement('textarea');
  document.body.replaceChildren(t);
  t.value = value;
  t.setSelectionRange(caret, caret);
  return t;
}

describe('content guards', () => {
  it('pickTriggerLength recomputes from the current caret', () => {
    expect(pickTriggerLength(textarea('hi //foo', 8))).toBe(5);
    expect(pickTriggerLength(textarea('hi //foo', 0))).toBeNull(); // caret moved Home
    expect(pickTriggerLength(textarea('see https://x', 13))).toBeNull();
  });

  it('shouldHandleKey only for targets inside the editor', () => {
    const ed = textarea('', 0);
    const other = document.createElement('button');
    document.body.append(other);
    expect(shouldHandleKey({ target: ed }, ed)).toBe(true);
    expect(shouldHandleKey({ target: other }, ed)).toBe(false);
    expect(shouldHandleKey({ target: ed }, null)).toBe(false);
  });

  it('detects IME composition', () => {
    expect(isComposingEvent({ isComposing: true })).toBe(true);
    expect(isComposingEvent({ keyCode: 229 })).toBe(true);
    expect(isComposingEvent({ isComposing: false, keyCode: 13 })).toBe(false);
  });

  it('copyFallback reports clipboard success and failure', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyFallback('x')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('x');
    writeText.mockRejectedValue(new Error('no'));
    expect(await copyFallback('x')).toBe(false);
  });
});
