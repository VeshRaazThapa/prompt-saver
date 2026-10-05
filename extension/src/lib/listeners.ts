import type { Msg, MsgResult } from './types';

type Sender = { tab?: { id?: number }; origin?: string };
type Route = (msg: Msg, sender?: { tab?: { id?: number } }) => Promise<MsgResult>;

/** Returns true so Chrome keeps the reply channel open for the async sendResponse. */
export function makeMessageListener(route: Route) {
  return (msg: Msg, sender: Sender, sendResponse: (r: unknown) => void): boolean => {
    void route(msg, sender).then(sendResponse);
    return true;
  };
}

export interface ExternalDeps {
  allowedOrigins: (origin: string | undefined) => boolean;
  setToken: (t: string) => Promise<void>;
  onConnected: () => void;
}

export function makeExternalListener(deps: ExternalDeps) {
  return (msg: { type?: string; token?: string } | undefined, sender: Sender, sendResponse: (r: unknown) => void): boolean => {
    if (!deps.allowedOrigins(sender.origin) || msg?.type !== 'ps-token' || typeof msg.token !== 'string' || !msg.token.startsWith('ps_')) {
      sendResponse({ ok: false });
      return true;
    }
    const token = msg.token;
    void deps
      .setToken(token)
      .then(() => {
        deps.onConnected();
        sendResponse({ ok: true });
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  };
}
