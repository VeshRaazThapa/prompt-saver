import { runContentScript } from '@/lib/content-main';
import { chatgptAdapter } from '@/sites/chatgpt';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  main() {
    runContentScript(chatgptAdapter);
  },
});
