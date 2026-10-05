import { describe, it, expect } from 'vitest';
import { detectTrigger, textBeforeCaret } from './trigger';

describe('detectTrigger', () => {
  it.each([
    ['//', { query: '', length: 2 }],
    ['hello //em', { query: 'em', length: 4 }],
    ['line\n//code', { query: 'code', length: 6 }],
  ])('triggers for %j', (input, expected) => expect(detectTrigger(input)).toEqual(expected));

  it.each(['https://', 'see https://exa', 'foo//bar', 'a / /b', '// two words', '///'])('does not trigger for %j', (input) =>
    expect(detectTrigger(input)).toBeNull()
  );
});

function caretAtEnd(html: string): HTMLElement {
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.innerHTML = html;
  document.body.replaceChildren(el);
  const last = el.lastElementChild!;
  const range = document.createRange();
  range.selectNodeContents(last);
  range.collapse(false);
  getSelection()!.removeAllRanges();
  getSelection()!.addRange(range);
  return el;
}

describe('textBeforeCaret', () => {
  it('triggers at the start of a later <p> line', () => {
    const t = textBeforeCaret(caretAtEnd('<p>line1</p><p>//em</p>'));
    expect(t.endsWith('//em')).toBe(true);
    expect(detectTrigger(t)).toEqual({ query: 'em', length: 4 });
  });
  it('treats <br> as a newline', () => {
    expect(detectTrigger(textBeforeCaret(caretAtEnd('<p>first line<br>//co</p>')))).toEqual({ query: 'co', length: 4 });
  });
  it('does not trigger on a url', () => {
    expect(detectTrigger(textBeforeCaret(caretAtEnd('<p>see https://x</p>')))).toBeNull();
  });
  it('works for a textarea', () => {
    const ta = document.createElement('textarea');
    document.body.replaceChildren(ta);
    ta.value = 'a\n//q';
    ta.setSelectionRange(5, 5);
    expect(detectTrigger(textBeforeCaret(ta))).toEqual({ query: 'q', length: 3 });
  });
});
