import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXT = path.resolve('.output-e2e/chrome-mv3');
const fx = (f: string) => readFileSync(path.resolve('e2e/fixtures', f), 'utf8');

const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await context.route('https://claude.ai/__fixtures/pm.js', (r) => r.fulfill({ path: 'e2e/fixtures/dist/pm.js', contentType: 'text/javascript' }));
    await context.route('https://gemini.google.com/__fixtures/quill.js', (r) => r.fulfill({ path: 'e2e/fixtures/dist/quill.js', contentType: 'text/javascript' }));
    await context.route('https://claude.ai/new', (r) => r.fulfill({ body: fx('claude.html'), contentType: 'text/html' }));
    await context.route('https://gemini.google.com/app', (r) => r.fulfill({ body: fx('gemini.html'), contentType: 'text/html' }));
    await context.route('https://chatgpt.com/', (r) => r.fulfill({ body: fx('chatgpt-noeditor.html'), contentType: 'text/html' }));
    let [sw] = context.serviceWorkers();
    if (sw === undefined) sw = await context.waitForEvent('serviceworker');
    await sw.evaluate(() => (globalThis as any).chrome.storage.local.set({ psToken: 'ps_e2e' }));
    await use(context);
    await context.close();
  },
});

test('// picker inserts into a real ProseMirror editor, replacing the query', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://claude.ai/new');
  const editor = page.locator('.ProseMirror');
  await editor.click();
  await page.keyboard.type('Please //code');
  await expect(page.locator('[data-ps-picker]')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(editor).toContainText('Please Review this code:');
  await expect(editor).toContainText('focus on bugs ✅');
  await expect(editor).not.toContainText('//code');
  await expect(editor.locator('p')).toHaveCount(2); // newline preserved as a paragraph break
});

test('// picker works in a real Quill editor (Gemini)', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app');
  const editor = page.locator('.ql-editor');
  await editor.click();
  await page.keyboard.type('//email');
  await page.keyboard.press('Enter');
  await expect(editor).toContainText('Write a polite reply.');
});

test('https:// does not open the picker; Esc closes an open one and leaves text untouched', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('https://claude.ai/new');
  const editor = page.locator('.ProseMirror');
  const picker = page.locator('[data-ps-picker]');
  await editor.click();
  await page.keyboard.type('see https://x');
  await page.waitForTimeout(300);
  await expect(picker).toHaveCount(0);
  await page.keyboard.press('Enter'); // would pick a prompt if the picker were open
  await expect(editor).not.toContainText('Review this code');
  await page.keyboard.type(' //');
  await expect(picker).toHaveCount(1); // positive control: the test can see an open picker
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
  await expect(editor).toHaveText(/see https:\/\/x\s*\/\/$/);
});
