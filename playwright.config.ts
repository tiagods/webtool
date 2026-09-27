import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';

function findChromium(): string | undefined {
  const env = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (env) return env;

  const home = process.env.LOCALAPPDATA || process.env.USERPROFILE + '\\AppData\\Local';
  const base = resolve(home, 'ms-playwright');
  for (const ver of ['chromium-1243', 'chromium-1208']) {
    const exe = resolve(base, ver, 'chrome-win64', 'chrome.exe');
    if (existsSync(exe)) return exe;
  }
  return undefined;
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report' }]],
  use: {
    baseURL: 'http://localhost',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'pt-BR',
        launchOptions: {
          executablePath: findChromium(),
        },
      },
    },
  ],
});