import { makeAdapter } from './types';
// Selectors verified against claude.ai on 2026-10-05; update here only when the site changes.
export const claudeAdapter = makeAdapter('claude', ['div.ProseMirror[contenteditable="true"]', '[contenteditable="true"]']);
