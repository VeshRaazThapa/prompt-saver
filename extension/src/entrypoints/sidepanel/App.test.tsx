import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { App } from './App';
import { isSupportedUrl } from './useActiveTab';

// Mocking approach (b): wxt storage/esbuild cannot load under jsdom, so '@/lib/cache' is
// stubbed with in-memory no-ops and `wxt/browser` is mocked.
let tokenCb: ((t: string | null) => void) | undefined;
const cacheStub = vi.hoisted(() => ({
  prompts: [] as unknown[],
  pending: null as { title: string; content: string } | null,
  pendingCb: undefined as ((p: unknown) => void) | undefined,
}));
vi.mock('@/lib/cache', () => ({
  getPrompts: vi.fn(async () => ({ prompts: cacheStub.prompts, syncedAt: 0 })),
  takePendingSave: vi.fn(async () => { const v = cacheStub.pending; cacheStub.pending = null; return v; }),
  watchPendingSave: vi.fn((cb: (p: unknown) => void) => { cacheStub.pendingCb = cb; return () => {}; }),
  watchPrompts: vi.fn(() => () => {}),
  watchToken: vi.fn((cb: (t: string | null) => void) => { tokenCb = cb; return () => {}; }),
}));

const P = (id: string, fav = false) => ({ id, title: `Title ${id}`, description: null, tags: [], updated_at: 'x', content: `body ${id}`, is_favorite: fav });

// WXT auto-imports `browser` from 'wxt/browser', which pulls in esbuild and crashes under
// jsdom, so that module is replaced with a mutable stub.
const stub = vi.hoisted(() => ({ browser: { runtime: { sendMessage: undefined as unknown, id: 'ext-id' }, tabs: { sendMessage: undefined as unknown } } }));
vi.mock('wxt/browser', () => stub);

let sendMessage: ReturnType<typeof vi.fn>;
function mockBackground(handlers: Record<string, (m: any) => unknown>) {
  sendMessage = vi.fn(async (m: { type: string }) => handlers[m.type]?.(m) ?? { ok: true, data: null });
  stub.browser.runtime.sendMessage = sendMessage;
  stub.browser.tabs.sendMessage = vi.fn();
}

beforeEach(() => {
  cacheStub.prompts = [];
  cacheStub.pending = null;
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(cleanup);

describe('isSupportedUrl', () => {
  it.each([
    ['https://claude.ai/new', true],
    ['https://chatgpt.com/codex', true],
    ['https://gemini.google.com/app', true],
    ['https://example.com', false],
    [undefined, false],
  ])('%s → %s', (url, expected) => expect(isSupportedUrl(url)).toBe(expected));
});

describe('App', () => {
  it('signed out shows Connect account', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [], signedIn: false } }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByRole('button', { name: /connect account/i })).toBeTruthy();
  });

  it('lists prompts favorites first and filters by search', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [P('a'), P('b', true)], signedIn: true } }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    const titles = await screen.findAllByRole('heading', { level: 3 });
    expect(titles.map((h) => h.textContent)).toEqual(['Title b', 'Title a']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Title a']));
  });

  it('Insert is shown only on supported sites and sends insertIntoTab', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [P('a')], signedIn: true } }) });
    const { unmount } = render(<App activeTab={{ id: 9, url: 'https://chatgpt.com/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /insert title a/i }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: 'insertIntoTab', tabId: 9, text: 'body a' }));
    unmount();
    render(<App activeTab={{ id: 9, url: 'https://example.com/' }} />);
    await screen.findByRole('button', { name: /copy title a/i });
    expect(screen.queryByRole('button', { name: /insert title a/i })).toBeNull();
  });

  it('Copy writes the content to the clipboard', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [P('a')], signedIn: true } }) });
    render(<App activeTab={{ id: 1, url: 'https://example.com/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /copy title a/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('body a'));
  });

  it('save form posts createPrompt and shows limit_reached message on failure', async () => {
    mockBackground({
      getPrompts: () => ({ ok: true, data: { prompts: [], signedIn: true } }),
      createPrompt: () => ({ ok: false, code: 'limit_reached', message: "You've reached 1,000 prompts." }),
    });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /new prompt/i }));
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'T' } });
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'C' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/1,000 prompts/)).toBeTruthy();
    expect(sendMessage).toHaveBeenCalledWith({ type: 'createPrompt', title: 'T', content: 'C', tags: [] });
    expect((screen.getByLabelText(/content/i) as HTMLTextAreaElement).value).toBe('C'); // form kept on failure
  });

  it('unauthorized from getPrompts shows Reconnect', async () => {
    mockBackground({ getPrompts: () => ({ ok: false, code: 'unauthorized', message: 'x' }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByRole('button', { name: /reconnect/i })).toBeTruthy();
  });

  it('unauthorized during a session (star) then token cleared shows Reconnect, not Connect account', async () => {
    mockBackground({
      getPrompts: () => ({ ok: true, data: { prompts: [P('a')], signedIn: true } }),
      toggleFavorite: () => ({ ok: false, code: 'unauthorized', message: 'x' }),
    });
    render(<App activeTab={{ id: 1, url: 'https://example.com/' }} />);
    fireEvent.click(await screen.findByRole('button', { name: /star title a/i }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith({ type: 'toggleFavorite', id: 'a', isFavorite: true }));
    await waitFor(() => expect(screen.getByRole('status') || true).toBeTruthy());
    act(() => tokenCb!(null));
    expect(await screen.findByRole('button', { name: /reconnect/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /connect account/i })).toBeNull();
  });

  it('a non-401 getPrompts failure is not stuck on Loading: shows the list and the error', async () => {
    mockBackground({
      getPrompts: () => ({ ok: false, code: 'internal', message: 'Something went wrong. Please try again.' }),
      getStatus: () => ({ ok: true, data: { signedIn: true } }),
    });
    cacheStub.prompts = [P('cached')];
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(await screen.findByRole('heading', { level: 3, name: 'Title cached' })).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.getByRole('button', { name: /new prompt/i })).toBeTruthy();
  });

  it('a non-401 failure when getStatus also fails falls back to signed out', async () => {
    mockBackground({
      getPrompts: () => ({ ok: false, code: 'internal', message: 'boom' }),
      getStatus: () => { throw new Error('no receiver'); },
    });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByRole('button', { name: /connect account/i })).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('sendMessage rejecting (worker unavailable) is not stuck on Loading', async () => {
    mockBackground({});
    stub.browser.runtime.sendMessage = vi.fn().mockRejectedValue(new Error('Could not establish connection'));
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    expect(await screen.findByRole('button', { name: /connect account/i })).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('a new prefill while the save form is open replaces the form contents', async () => {
    mockBackground({ getPrompts: () => ({ ok: true, data: { prompts: [], signedIn: true } }) });
    render(<App activeTab={{ id: 1, url: 'https://claude.ai/' }} />);
    await screen.findByRole('button', { name: /new prompt/i });
    const push = async (p: { title: string; content: string }) => {
      cacheStub.pending = p;
      await act(async () => { cacheStub.pendingCb!(p); });
    };
    await push({ title: 'First', content: 'first selection' });
    await waitFor(() => expect((screen.getByLabelText(/content/i) as HTMLTextAreaElement).value).toBe('first selection'));
    await push({ title: 'Second', content: 'second selection' });
    await waitFor(() => expect((screen.getByLabelText(/content/i) as HTMLTextAreaElement).value).toBe('second selection'));
    expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Second');
  });
});
