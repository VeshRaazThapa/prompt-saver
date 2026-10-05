import { describe, it, expect, vi } from 'vitest';
import { createPicker } from './picker';

const p = (id: string, fav = false) => ({ id, title: `Title ${id}`, description: null, tags: [], updated_at: 'x', content: `text ${id}`, is_favorite: fav });
const RECT = { top: 500, left: 100, bottom: 520, right: 110, width: 10, height: 20, x: 100, y: 500, toJSON: () => ({}) } as DOMRect;
const key = (k: string) => new KeyboardEvent('keydown', { key: k, cancelable: true });

function make(state: { prompts: ReturnType<typeof p>[]; signedIn: boolean }) {
  const onPick = vi.fn(), onSaveDraft = vi.fn(), onSignIn = vi.fn();
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const picker = createPicker({ getState: () => state, onPick, onSaveDraft, onSignIn, root });
  return { picker, onPick, onSaveDraft, onSignIn, root };
}
const rows = (root: HTMLElement) => Array.from(root.shadowRoot?.querySelectorAll('[role="option"]') ?? root.querySelectorAll('[role="option"]')).map((r) => r.textContent);

describe('picker', () => {
  it('lists filtered prompts then the save-draft row; Enter picks the active row', () => {
    const { picker, onPick, root } = make({ prompts: [p('a'), p('b', true)], signedIn: true });
    picker.open(RECT, '');
    expect(rows(root)).toEqual(['Title b', 'Title a', 'Save current draft…']);
    expect(picker.handleKey(key('ArrowDown'))).toBe(true);
    expect(picker.handleKey(key('Enter'))).toBe(true);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(picker.isOpen()).toBe(false);
  });

  it('update(query) refilters; Esc closes without picking', () => {
    const { picker, onPick, root } = make({ prompts: [p('a'), p('b')], signedIn: true });
    picker.open(RECT, '');
    picker.update('b');
    expect(rows(root)).toEqual(['Title b', 'Save current draft…']);
    expect(picker.handleKey(key('Escape'))).toBe(true);
    expect(picker.isOpen()).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('save-draft row calls onSaveDraft', () => {
    const { picker, onSaveDraft } = make({ prompts: [], signedIn: true });
    picker.open(RECT, '');
    picker.handleKey(key('ArrowDown'));
    picker.handleKey(key('Enter'));
    expect(onSaveDraft).toHaveBeenCalled();
  });

  it('signed out shows exactly one sign-in row; Enter calls onSignIn and nothing else', () => {
    const { picker, onPick, onSaveDraft, onSignIn, root } = make({ prompts: [], signedIn: false });
    picker.open(RECT, '');
    expect(rows(root)).toEqual(['Sign in to Prompt Saver']);
    picker.handleKey(key('Enter'));
    expect(onSignIn).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('signed in with zero prompts shows guidance + save-draft', () => {
    const { picker, root } = make({ prompts: [], signedIn: true });
    picker.open(RECT, '');
    expect(rows(root)).toEqual(['No prompts yet — open panel', 'Save current draft…']);
  });

  it('ignores keys while closed', () => {
    const { picker } = make({ prompts: [p('a')], signedIn: true });
    expect(picker.handleKey(key('Enter'))).toBe(false);
  });

  it('ignores keys during IME composition', () => {
    const { picker, onPick } = make({ prompts: [p('a')], signedIn: true });
    picker.open(RECT, '');
    expect(picker.handleKey(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true }))).toBe(false);
    const e229 = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, cancelable: true });
    expect(picker.handleKey(e229)).toBe(false);
    expect(onPick).not.toHaveBeenCalled();
    expect(picker.isOpen()).toBe(true);
  });
});
