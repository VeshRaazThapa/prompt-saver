import { runContentScript } from '@/lib/content-main';
import { geminiAdapter } from '@/sites/gemini';

export default defineContentScript({
  matches: ['https://gemini.google.com/*'],
  main() {
    runContentScript(geminiAdapter);
  },
});
