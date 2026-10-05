// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { makeExternalListener, makeMessageListener } from './listeners';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('makeMessageListener', () => {
  it('returns true and sends the route result via sendResponse', async () => {
    const route = vi.fn().mockResolvedValue({ ok: true, data: 1 });
    const send = vi.fn();
    expect(makeMessageListener(route)({ type: 'getStatus' }, { tab: { id: 2 } }, send)).toBe(true);
    await flush();
    expect(route).toHaveBeenCalledWith({ type: 'getStatus' }, { tab: { id: 2 } });
    expect(send).toHaveBeenCalledWith({ ok: true, data: 1 });
  });

  it('always answers: a rejected route becomes an internal error response', async () => {
    const route = vi.fn().mockRejectedValue(new Error('storage exploded'));
    const send = vi.fn();
    expect(makeMessageListener(route)({ type: 'getPrompts' }, {}, send)).toBe(true);
    await flush();
    expect(send).toHaveBeenCalledWith({ ok: false, code: 'internal', message: 'Something went wrong. Please try again.' });
  });
});

describe('makeExternalListener', () => {
  const mk = () => {
    const setToken = vi.fn().mockResolvedValue(undefined);
    const onConnected = vi.fn();
    const l = makeExternalListener({ allowedOrigins: (o) => o === 'https://site.test', setToken, onConnected });
    return { l, setToken, onConnected };
  };
  it('stores the token and answers ok for a valid site message', async () => {
    const { l, setToken, onConnected } = mk();
    const send = vi.fn();
    expect(l({ type: 'ps-token', token: 'ps_abc' }, { origin: 'https://site.test' }, send)).toBe(true);
    await flush();
    expect(setToken).toHaveBeenCalledWith('ps_abc');
    expect(onConnected).toHaveBeenCalled();
    expect(send).toHaveBeenCalledWith({ ok: true });
  });
  it('rejects a wrong origin', async () => {
    const { l, setToken } = mk();
    const send = vi.fn();
    expect(l({ type: 'ps-token', token: 'ps_abc' }, { origin: 'https://evil.test' }, send)).toBe(true);
    expect(send).toHaveBeenCalledWith({ ok: false });
    expect(setToken).not.toHaveBeenCalled();
  });
  it('rejects a non ps_ token or wrong type', async () => {
    const { l, setToken } = mk();
    const send = vi.fn();
    expect(l({ type: 'ps-token', token: 'abc' }, { origin: 'https://site.test' }, send)).toBe(true);
    expect(l({ type: 'other', token: 'ps_a' }, { origin: 'https://site.test' }, send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith({ ok: false });
    expect(setToken).not.toHaveBeenCalled();
  });
});
