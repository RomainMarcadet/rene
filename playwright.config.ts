import { defineConfig, devices } from '@playwright/test';
const voice = process.env.RENE_VOICE_E2E === '1';
export default defineConfig({
  testDir: './tests/e2e', timeout: 45_000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175', trace: 'retain-on-failure', actionTimeout: 8000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev -w @rene/server', url: 'http://127.0.0.1:3005/health', reuseExistingServer: false, env: { WEB_ORIGIN: 'http://127.0.0.1:5175', HOST: '127.0.0.1', PORT: '3005', DATABASE_URL: '', LIVEKIT_URL: voice ? 'ws://127.0.0.1:7880' : '', LIVEKIT_API_URL: voice ? 'http://127.0.0.1:7880' : '', LIVEKIT_API_KEY: voice ? 'rene_dev' : '', LIVEKIT_API_SECRET: voice ? 'rene_development_secret_not_for_production' : '' } },
    { command: 'npm run dev -w @rene/web -- --host 127.0.0.1 --port 5175', url: 'http://127.0.0.1:5175', reuseExistingServer: false, env: { RENE_API_PROXY: 'http://127.0.0.1:3005' } },
  ],
});
