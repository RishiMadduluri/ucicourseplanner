import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end coverage for the critical user paths.
 * Runs against the production build so the tests exercise the same bundle and
 * the same static catalogue snapshot a real local install would use.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /(?:desktop|transfer)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
    },
    {
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    // Always rebuild. Reusing an already-running preview silently serves a
    // stale `dist/`, which makes the suite pass against code that is no longer
    // in the tree.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
