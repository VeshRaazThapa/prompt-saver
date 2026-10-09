import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const API_BASE = process.env.WXT_API_BASE ?? 'https://prompt-saver-two.vercel.app';
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  srcDir: 'src',
  outDir: process.env.WXT_OUT_DIR ?? '.output',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Prompt Saver — AI Prompt Manager for Claude, ChatGPT, Gemini & Codex',
    short_name: 'Prompt Saver',
    description: 'Save, search and insert your best prompts in Claude, ChatGPT, Codex and Gemini. Type // to insert.',
    permissions: ['storage', 'sidePanel', 'contextMenus'],
    host_permissions: [
      'https://claude.ai/*',
      'https://chatgpt.com/*',
      'https://gemini.google.com/*',
      `${API_BASE}/*`,
    ],
    externally_connectable: {
      matches: [`${API_BASE}/*`, ...(isDev ? ['http://localhost:3000/*'] : [])],
    },
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_title: 'Prompt Saver — type // in any chat box', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png' } },
  },
});
