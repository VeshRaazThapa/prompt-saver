import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { claudeAdapter } from './claude';
import { chatgptAdapter } from './chatgpt';
import { geminiAdapter } from './gemini';

function page(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

// jsdom has no layout, so every element reports zero client rects. Stub it: elements are
// rendered unless marked data-hidden (standing in for display:none / a detached template).
const realRects = HTMLElement.prototype.getClientRects;
beforeEach(() => {
  HTMLElement.prototype.getClientRects = function (this: HTMLElement) {
    return (this.closest('[data-hidden]') !== null ? [] : [new DOMRect(0, 0, 10, 10)]) as unknown as DOMRectList;
  };
});
afterEach(() => {
  HTMLElement.prototype.getClientRects = realRects;
});

describe('adapters', () => {
  it('claude finds the ProseMirror editor and reads its draft', () => {
    const d = page('<div contenteditable="true" class="ProseMirror">draft text</div>');
    expect(claudeAdapter.findEditor(d)?.className).toBe('ProseMirror');
    expect(claudeAdapter.readDraft(d)).toBe('draft text');
  });
  it('chatgpt prefers #prompt-textarea', () => {
    const d = page('<div id="prompt-textarea" contenteditable="true">hi</div>');
    expect(chatgptAdapter.findEditor(d)?.id).toBe('prompt-textarea');
    expect(chatgptAdapter.readDraft(d)).toBe('hi');
  });
  it('chatgpt falls back to a textarea (Codex task input)', () => {
    const d = page('<textarea placeholder="Describe a task">task</textarea>');
    expect(chatgptAdapter.findEditor(d)?.tagName).toBe('TEXTAREA');
    expect(chatgptAdapter.readDraft(d)).toBe('task');
  });
  it('gemini finds the Quill editor', () => {
    const d = page('<rich-textarea><div class="ql-editor" contenteditable="true">g</div></rich-textarea>');
    expect(geminiAdapter.findEditor(d)?.classList.contains('ql-editor')).toBe(true);
  });
  it('returns null / empty when no editor exists', () => {
    expect(claudeAdapter.findEditor(page('<p>x</p>'))).toBeNull();
    expect(geminiAdapter.readDraft(page('<p>x</p>'))).toBe('');
  });
  it('skips a hidden match and keeps selector order', () => {
    // Hidden #prompt-textarea (e.g. a stale chat composer under Codex) must not win over a visible textarea.
    const d = page('<div data-hidden><div id="prompt-textarea" contenteditable="true">old</div></div><textarea>task</textarea>');
    expect(chatgptAdapter.findEditor(d)?.tagName).toBe('TEXTAREA');
    expect(chatgptAdapter.readDraft(d)).toBe('task');
    // A hidden first element for a selector falls through to the next element matching the same selector.
    const two = page('<div data-hidden><div class="ProseMirror" contenteditable="true">a</div></div><div class="ProseMirror" contenteditable="true">b</div>');
    expect(claudeAdapter.findEditor(two)?.textContent).toBe('b');
    // Order is still respected when both are visible.
    const both = page('<textarea>t</textarea><div id="prompt-textarea" contenteditable="true">p</div>');
    expect(chatgptAdapter.findEditor(both)?.id).toBe('prompt-textarea');
  });
  it('returns null when every match is hidden', () => {
    expect(claudeAdapter.findEditor(page('<div data-hidden><div contenteditable="true">x</div></div>'))).toBeNull();
  });
});
