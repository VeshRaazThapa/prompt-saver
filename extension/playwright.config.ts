import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  workers: 1,
  webServer: { command: 'node e2e/api-stub.mjs', port: 4599, reuseExistingServer: true },
});
