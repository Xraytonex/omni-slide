import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Use a preinstalled Chromium when present (e.g. cloud dev containers) instead of downloading one.
const chromium = process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
