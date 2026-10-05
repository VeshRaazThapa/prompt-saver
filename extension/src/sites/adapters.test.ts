import { describe, it, expect } from 'vitest';
import { claudeAdapter } from './claude';
import { chatgptAdapter } from './chatgpt';
import { geminiAdapter } from './gemini';

function page(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
}

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
});
