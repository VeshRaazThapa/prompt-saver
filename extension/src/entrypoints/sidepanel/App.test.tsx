import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { App } from './App';
import { isSupportedUrl } from './useActiveTab';

// Mocking approach (b): wxt storage/esbuild cannot load under jsdom, so '@/lib/cache' is
// stubbed with in-memory no-ops and `wxt/browser` is mocked.
vi.mock('@/lib/cache', () => ({
  takePendingSave: vi.fn(async () => null),
  watchPendingSave: vi.fn(() => () => {}),
  watchPrompts: vi.fn(() => () => {}),
  watchToken: vi.fn(() => () => {}),
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
});
