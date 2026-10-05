export interface SiteAdapter {
  id: 'claude' | 'chatgpt' | 'gemini';
  findEditor(doc?: Document): HTMLElement | null;
  readDraft(doc?: Document): string;
}

/** First match wins; selectors are tried in order. */
export function makeAdapter(id: SiteAdapter['id'], selectors: string[]): SiteAdapter {
  const findEditor = (doc: Document = document): HTMLElement | null => {
    for (const s of selectors) {
      const el = doc.querySelector<HTMLElement>(s);
      if (el !== null) return el;
    }
    return null;
  };
  return {
    id,
    findEditor,
    readDraft: (doc: Document = document) => {
      const el = findEditor(doc);
      if (el === null) return '';
      return (el instanceof HTMLTextAreaElement ? el.value : (el.innerText ?? el.textContent ?? '')).trim();
    },
  };
}
