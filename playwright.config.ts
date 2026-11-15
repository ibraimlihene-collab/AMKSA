import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 30000, retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', video: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI },
});
