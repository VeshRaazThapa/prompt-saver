import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const API_BASE = process.env.WXT_API_BASE ?? 'https://prompt-saver-two.vercel.app';
const isDev = process.env.NODE_ENV === 'development';

export default defineConfig({
  srcDir: 'src',
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
    action: { default_title: 'Prompt Saver' },
  },
});
