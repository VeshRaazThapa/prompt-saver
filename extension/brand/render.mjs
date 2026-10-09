// Renders brand/*.svg to the PNG icons WXT ships (public/icon/*.png).
// Run from extension/: node brand/render.mjs
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

const jobs = [
  ['icon-small.svg', 16], ['icon-small.svg', 32],
  ['icon.svg', 48], ['icon.svg', 96], ['icon.svg', 128],
];
await mkdir('public/icon', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size] of jobs) {
  const svg = await readFile(`brand/${file}`, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: `public/icon/${size}.png`, omitBackground: true });
}
await browser.close();
