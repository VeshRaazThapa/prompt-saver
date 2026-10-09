// Captures the real extension UI and composes Chrome Web Store assets into store/assets/ (raw captures go to the ignored store/out/raw/).
// Run from extension/: npm run store-assets  (builds the extension against a local stub API first)
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { prompts } from './stub-data.mjs';

const EXT = path.resolve('.output-e2e/chrome-mv3');
const RAW = path.resolve('store/out/raw');
const OUT = path.resolve('store/assets');
await mkdir(RAW, { recursive: true });
await mkdir(OUT, { recursive: true });

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.headers.authorization !== 'Bearer ps_e2e') return res.writeHead(401).end('{"error":{"code":"unauthorized","message":"x"}}');
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ prompts }));
}).listen(4599);

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  deviceScaleFactor: 2,
});
// The panel normally reads the browser's active tab; pretend it's the chat tab so Insert shows.
await context.addInitScript(() => {
  const c = globalThis.chrome;
  if (location.protocol !== 'chrome-extension:' || c?.tabs === undefined) return;
  const query = c.tabs.query.bind(c.tabs);
  c.tabs.query = async (q) => {
    const chat = await query({ url: 'https://claude.ai/*' });
    return chat.length > 0 ? chat : query(q);
  };
});
const mock = await readFile('store/chat-mock.html', 'utf8');
await context.route('https://claude.ai/__fixtures/pm.js', (r) => r.fulfill({ path: 'e2e/fixtures/dist/pm.js', contentType: 'text/javascript' }));
await context.route('https://claude.ai/new', (r) => r.fulfill({ body: mock, contentType: 'text/html' }));

let [sw] = context.serviceWorkers();
if (sw === undefined) sw = await context.waitForEvent('serviceworker');
const extId = new URL(sw.url()).host;
const setToken = (t) => sw.evaluate((v) => (v === null ? chrome.storage.local.clear() : chrome.storage.local.set({ psToken: v })), t);
await setToken('ps_e2e');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Chat page with the // picker open.
async function chat(file, scheme) {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 880, height: 800 });
  await page.goto('https://claude.ai/new');
  await page.locator('.ProseMirror').click();
  await pause(600);
  await page.keyboard.type('Review my changes before I open the PR //re', { delay: 15 });
  await page.locator('[data-ps-picker]').waitFor({ state: 'attached' });
  await pause(300);
  await page.screenshot({ path: `${RAW}/${file}` });
  return page;
}

async function panel(file, { scheme = 'light', setup } = {}) {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto(`chrome-extension://${extId}/sidepanel.html`);
  await pause(800);
  if (setup) await setup(page);
  await page.screenshot({ path: `${RAW}/${file}` });
  await page.close();
}

const chatPage = await chat('chat-picker.png', 'light');
await panel('panel-list.png');
await panel('panel-dark.png', { scheme: 'dark' });
await panel('panel-save.png', {
  setup: async (p) => {
    await p.getByRole('button', { name: /new prompt/i }).click();
    await p.getByLabel(/title/i).fill('Turn a stack trace into a fix');
    await p.getByLabel(/content/i).fill('Here is a stack trace and the code around it.\n1. Explain the root cause in one sentence.\n2. Propose the smallest safe fix.\n3. Suggest a regression test.');
    await p.getByLabel(/tags/i).fill('debugging');
    await p.evaluate(() => document.activeElement?.blur());
  },
});
await chatPage.close();
const chatDark = await chat('chat-picker-dark.png', 'dark');
await chatDark.close();
await setToken(null);
await panel('panel-welcome.png');
await context.close();
server.close();

// ---------- Compose ----------
const fonts = (base) => `
@font-face { font-family: 'Instrument Serif'; src: url(${base}/instrument-serif/files/instrument-serif-latin-400-normal.woff2); }
@font-face { font-family: 'Instrument Serif'; font-style: italic; src: url(${base}/instrument-serif/files/instrument-serif-latin-400-italic.woff2); }
@font-face { font-family: 'DM Sans'; font-weight: 400; src: url(${base}/dm-sans/files/dm-sans-latin-400-normal.woff2); }
@font-face { font-family: 'DM Sans'; font-weight: 500; src: url(${base}/dm-sans/files/dm-sans-latin-500-normal.woff2); }
@font-face { font-family: 'DM Sans'; font-weight: 600; src: url(${base}/dm-sans/files/dm-sans-latin-600-normal.woff2); }`;
const FONT_BASE = path.resolve('node_modules/@fontsource');
const logo = (await readFile('brand/icon-small.svg', 'utf8')).replace(/<!--.*?-->/s, '');

const css = `
${fonts('file://' + FONT_BASE)}
* { box-sizing: border-box; margin: 0; }
body { width: var(--w); height: var(--h); overflow: hidden; font-family: 'DM Sans', sans-serif; color: #1c1917; background: #fafaf9; }
.serif { font-family: 'Instrument Serif', serif; font-weight: 400; letter-spacing: -0.01em; }
.teal { color: #0d9488; }
.brand { display: flex; align-items: center; gap: 12px; font-size: 26px; }
.brand svg { width: 36px; height: 36px; }
.shot { border-radius: 12px; border: 1px solid #e7e5e4; box-shadow: 0 1px 2px rgba(28,25,23,.06), 0 24px 60px rgba(28,25,23,.14); display: block; }
.dark .shot { border-color: #44403c; box-shadow: 0 24px 60px rgba(0,0,0,.5); }
.kbd { font-family: ui-monospace, monospace; font-size: .8em; border: 1px solid #d6d3d1; border-bottom-width: 2px; border-radius: 6px; padding: 0 .3em; background: #fff; }
`;

/** A browser-ish frame: chat page left, real side panel right (exactly 1280×800). */
const browserFrame = (chatImg, panelImg, dark = false) => `
<div style="display:flex;width:1280px;height:800px;background:${dark ? '#1c1917' : '#fff'}">
  <img src="${RAW}/${chatImg}" style="width:880px;height:800px;display:block">
  <img src="${RAW}/${panelImg}" style="width:400px;height:800px;display:block;border-left:1px solid ${dark ? '#44403c' : '#e7e5e4'}">
</div>`;

const captioned = ({ eyebrow, title, body, img, dark = false, extra = '' }) => `
<div class="${dark ? 'dark' : ''}" style="display:flex;align-items:center;gap:72px;width:1280px;height:800px;padding:0 96px;background:${dark ? '#1c1917' : '#fafaf9'};color:${dark ? '#e7e5e4' : '#1c1917'}">
  <div style="flex:1">
    <div class="brand serif">${logo}<span>Prompt Saver</span></div>
    <p style="margin-top:56px;font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${dark ? '#2dd4bf' : '#0d9488'}">${eyebrow}</p>
    <h1 class="serif" style="margin-top:14px;font-size:64px;line-height:1.04">${title}</h1>
    <p style="margin-top:22px;font-size:20px;line-height:1.55;color:${dark ? '#a8a29e' : '#57534e'};max-width:440px">${body}</p>
    ${extra}
  </div>
  <img class="shot" src="${RAW}/${img}" style="width:360px;height:720px">
</div>`;

const sites = `<p style="margin-top:36px;display:flex;gap:10px;flex-wrap:wrap">${['Claude', 'ChatGPT', 'Codex', 'Gemini']
  .map((s) => `<span style="border:1px solid #e7e5e4;background:#fff;border-radius:999px;padding:8px 16px;font-size:16px;font-weight:500">${s}</span>`)
  .join('')}</p>`;

const assets = [
  ['screenshot-1-picker.png', 1280, 800, browserFrame('chat-picker.png', 'panel-list.png')],
  ['screenshot-2-library.png', 1280, 800, captioned({ eyebrow: 'Side panel', title: 'Your whole library,<br>one click away.', body: 'Search, star and insert prompts without leaving the conversation. Favorites float to the top.', img: 'panel-list.png' })],
  ['screenshot-3-save.png', 1280, 800, captioned({ eyebrow: 'Capture', title: 'Save a prompt<br>the moment it works.', body: 'Right-click any text and choose “Save to Prompt Saver”, or save the draft you are typing. Every prompt is versioned.', img: 'panel-save.png' })],
  ['screenshot-4-sites.png', 1280, 800, captioned({ eyebrow: 'Works where you work', title: 'One library for<br>every AI chat.', body: 'Type <span class="kbd">//</span> in Claude, ChatGPT, Codex or Gemini and pick a prompt. It lands in the chat box, ready to send.', img: 'panel-welcome.png', extra: sites })],
  ['screenshot-5-dark.png', 1280, 800, browserFrame('chat-picker-dark.png', 'panel-dark.png', true)],
  ['promo-small-440x280.png', 440, 280, `
<div style="width:440px;height:280px;background:#0d9488;color:#fff;padding:36px 36px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden">
  <div style="position:absolute;right:18px;bottom:-78px;font:400 300px/1 'Instrument Serif',serif;color:rgba(255,255,255,.12);font-style:italic">//</div>
  <div class="brand serif" style="font-size:24px">${logo.replace(/#0D9488/g, '#0F766E').replace('<rect', '<rect stroke="#fff" stroke-opacity=".35"')}<span>Prompt Saver</span></div>
  <h1 class="serif" style="font-size:40px;line-height:1.05;position:relative">Your best prompts,<br>one <span style="font-style:italic">//</span> away.</h1>
</div>`],
  ['promo-marquee-1400x560.png', 1400, 560, `
<div style="width:1400px;height:560px;background:#fafaf9;display:flex;align-items:center;padding:0 0 0 110px;gap:80px;overflow:hidden">
  <div style="flex:1">
    <div class="brand serif">${logo}<span>Prompt Saver</span></div>
    <h1 class="serif" style="margin-top:36px;font-size:76px;line-height:1.02">Your best prompts,<br>one <span class="teal" style="font-style:italic">//</span> away.</h1>
    <p style="margin-top:22px;font-size:21px;color:#57534e">Save, search and insert prompts in Claude, ChatGPT, Codex and Gemini.</p>
  </div>
  <img class="shot" src="${RAW}/chat-picker.png" style="width:640px;height:582px;object-fit:cover;object-position:left bottom;margin-top:80px;border-radius:12px 0 0 0">
</div>`],
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, w, h, html] of assets) {
  const htmlPath = `${RAW}/${file}.html`;
  await writeFile(htmlPath, `<!doctype html><meta charset="utf-8"><style>:root{--w:${w}px;--h:${h}px}${css}</style>${html}`);
  await page.setViewportSize({ width: w, height: h });
  await page.goto('file://' + htmlPath);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${file}` });
}
await browser.close();
console.log('Wrote', assets.length, 'assets to', OUT);
