import { makeAdapter } from './types';
export const geminiAdapter = makeAdapter('gemini', ['rich-textarea .ql-editor[contenteditable="true"]', '.ql-editor[contenteditable="true"]']);
