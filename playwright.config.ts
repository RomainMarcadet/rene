import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45_000, fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev -w @rene/server', url: 'http://127.0.0.1:3001/health', reuseExistingServer: !process.env.CI, env: { WEB_ORIGIN: 'http://127.0.0.1:5173', HOST: '127.0.0.1', DATABASE_URL: '', LIVEKIT_URL: '', LIVEKIT_API_URL: '', LIVEKIT_API_KEY: '', LIVEKIT_API_SECRET: '' } },
    { command: 'npm run dev -w @rene/web -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  ],
});
