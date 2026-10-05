import { build } from 'esbuild';
import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('e2e/fixtures/dist', { recursive: true });
await build({ entryPoints: ['e2e/fixtures/pm-entry.ts'], bundle: true, outfile: 'e2e/fixtures/dist/pm.js', format: 'iife' });
copyFileSync('node_modules/quill/dist/quill.js', 'e2e/fixtures/dist/quill.js');
