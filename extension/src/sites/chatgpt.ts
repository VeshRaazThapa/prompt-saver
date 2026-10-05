import { makeAdapter } from './types';
// Chat uses #prompt-textarea (ProseMirror). Codex (/codex) task input is tried via the textarea fallback.
export const chatgptAdapter = makeAdapter('chatgpt', ['#prompt-textarea', 'div.ProseMirror[contenteditable="true"]', 'textarea']);
