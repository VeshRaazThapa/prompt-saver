export interface SiteAdapter {
  id: 'claude' | 'chatgpt' | 'gemini';
  findEditor(doc?: Document): HTMLElement | null;
  readDraft(doc?: Document): string;
}

/** Not rendered: display:none on it or an ancestor, or detached. Such an editor can't take input. */
function isRendered(el: HTMLElement): boolean {
  return el.getClientRects().length > 0;
}

/** First rendered match wins; selectors are tried in order, then elements in document order. */
export function makeAdapter(id: SiteAdapter['id'], selectors: string[]): SiteAdapter {
  const findEditor = (doc: Document = document): HTMLElement | null => {
    for (const s of selectors) {
      for (const el of Array.from(doc.querySelectorAll<HTMLElement>(s))) {
        if (isRendered(el)) return el;
      }
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
