// Records the // picker demo (type // → pick → prompt lands in the chat box) as an MP4 and GIF in store/assets/.
// Run from extension/: npm run store-demo  (builds the extension against a local stub API first; needs ffmpeg)
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { prompts } from './stub-data.mjs';

const EXT = path.resolve('.output-e2e/chrome-mv3');
const RAW = path.resolve('store/out/demo');
const OUT = path.resolve('store/assets');
const SIZE = { width: 960, height: 600 };
await rm(RAW, { recursive: true, force: true });
await mkdir(RAW, { recursive: true });

const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ prompts }));
}).listen(4599);

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  viewport: SIZE,
  recordVideo: { dir: RAW, size: SIZE },
});
const mock = await readFile('store/chat-mock.html', 'utf8');
await context.route('https://claude.ai/__fixtures/pm.js', (r) => r.fulfill({ path: 'e2e/fixtures/dist/pm.js', contentType: 'text/javascript' }));
await context.route('https://claude.ai/new', (r) => r.fulfill({ body: mock, contentType: 'text/html' }));

let [sw] = context.serviceWorkers();
if (sw === undefined) sw = await context.waitForEvent('serviceworker');
await sw.evaluate(() => chrome.storage.local.set({ psToken: 'ps_e2e' }));
// The persistent context opens a blank page first; close it so only the demo page is recorded.
for (const p of context.pages()) await p.close();

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await context.newPage();
await page.emulateMedia({ colorScheme: 'light' });
await page.goto('https://claude.ai/new');
await page.locator('.ProseMirror').click();
await pause(900);
await page.keyboard.type('Before I open the PR: ', { delay: 45 });
await pause(400);
await page.keyboard.type('//', { delay: 160 });
await page.locator('[data-ps-picker]').waitFor({ state: 'attached' });
await pause(700);
await page.keyboard.type('secur', { delay: 140 });
await pause(1100);
await page.keyboard.press('Enter');
await pause(2600);
await page.close();
await context.close();
server.close();

const webm = path.join(RAW, (await readdir(RAW)).find((f) => f.endsWith('.webm')));
// Trim the page-load flash at the start.
const trim = ['-ss', '0.6'];
execFileSync('ffmpeg', ['-y', ...trim, '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', '-an', `${OUT}/demo-picker.mp4`], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-y', ...trim, '-i', webm, '-vf', 'fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${OUT}/demo-picker.gif`], { stdio: 'ignore' });
console.log('Wrote demo-picker.mp4 and demo-picker.gif to', OUT);
