import { createApi } from '@/lib/api';
import { setToken } from '@/lib/cache';
import { createRouter } from '@/lib/messages';
import { SITE_BASE } from '@/lib/config';
import { makeExternalListener, makeMessageListener } from '@/lib/listeners';

export default defineBackground(() => {
  const route = createRouter({
    apiFor: (t) => createApi(t),
    openPanel: async (tabId) => {
      try {
        if (tabId !== undefined) await browser.sidePanel.open({ tabId });
        else await browser.sidePanel.open({ windowId: (await browser.windows.getCurrent()).id! });
        return true;
      } catch {
        return false; // no user gesture available: caller shows "click the icon"
      }
    },
    sendToTab: (tabId, msg) => browser.tabs.sendMessage(tabId, msg),
  });

  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.runtime.onMessage.addListener(makeMessageListener(route));

  // Token hand-off from /extension/connect. Only our site can reach this
  // (manifest externally_connectable); the origin check is defence in depth.
  browser.runtime.onMessageExternal.addListener(
    makeExternalListener({
      allowedOrigins: (o) => o === new URL(SITE_BASE).origin || (o?.startsWith('http://localhost:3000') ?? false),
      setToken,
      onConnected: () => void route({ type: 'getPrompts', refresh: true }),
    }),
  );

  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({ id: 'ps-save-selection', title: 'Save to Prompt Saver', contexts: ['selection'] });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'ps-save-selection' || info.selectionText === undefined) return;
    const content = info.selectionText;
    // sidePanel.open must run synchronously inside the user gesture: open first, then store.
    if (tab?.id !== undefined) void browser.sidePanel.open({ tabId: tab.id });
    void route({ type: 'openSavePanel', prefill: { title: content.split('\n')[0]!.slice(0, 80), content } }, { tab });
  });
});
