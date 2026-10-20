import { defineConfig } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const runDir = process.env.PORTFOLIO_E2E_RUN_DIR || mkdtempSync(path.join(tmpdir(), 'portfolio-e2e-'));
process.env.PORTFOLIO_E2E_RUN_DIR = runDir;
const chrome = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(value => value && existsSync(value));

export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  globalTeardown: './tests/e2e/global-teardown.ts',
  timeout: 120_000, expect: { timeout: 15_000 },
  outputDir: path.join(runDir, 'evidence'), reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100', browserName: 'chromium',
    launchOptions: chrome ? { executablePath: chrome } : {},
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" --import tsx scripts/e2e-server.mjs`,
    url: 'http://127.0.0.1:3100/api/health', timeout: 240_000, reuseExistingServer: false,
    env: { PORTFOLIO_E2E_RUN_DIR: runDir, TSX_TSCONFIG_PATH: path.resolve('apps/api/tsconfig.json') },
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
