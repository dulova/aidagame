import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
const chrome = process.env.PLAYWRIGHT_CHROME_PATH || (!process.env.CI && existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173/aidagame/', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chrome ? { executablePath: chrome } : {} } }, { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', launchOptions: chrome ? { executablePath: chrome } : {} } }, { name: 'webkit', use: { ...devices['iPhone 13'] } }],
  webServer: { command: 'npm run preview -- --host 127.0.0.1', url: 'http://127.0.0.1:4173/aidagame/', reuseExistingServer: !process.env.CI },
});
