import { runContentScript } from '@/lib/content-main';
import { claudeAdapter } from '@/sites/claude';

export default defineContentScript({
  matches: ['https://claude.ai/*'],
  main() {
    runContentScript(claudeAdapter);
  },
});
