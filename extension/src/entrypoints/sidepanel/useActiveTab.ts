import { useEffect, useState } from 'react';

const SUPPORTED = [/^https:\/\/claude\.ai\//, /^https:\/\/chatgpt\.com\//, /^https:\/\/gemini\.google\.com\//];
export const isSupportedUrl = (url?: string): boolean => url !== undefined && SUPPORTED.some((r) => r.test(url));

export interface ActiveTab { id?: number; url?: string }

export function useActiveTab(): ActiveTab {
  const [tab, setTab] = useState<ActiveTab>({});
  useEffect(() => {
    const load = () => void browser.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab({ id: t?.id, url: t?.url }));
    load();
    browser.tabs.onActivated.addListener(load);
    browser.tabs.onUpdated.addListener(load);
    return () => {
      browser.tabs.onActivated.removeListener(load);
      browser.tabs.onUpdated.removeListener(load);
    };
  }, []);
  return tab;
}
