import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/coach",
  outputDir: "./test-results/coach",
  testMatch: "replay.spec.ts",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4175",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm --filter replay-coach dev",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "coach-desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.COACH_CHROMIUM_PATH
          ? { executablePath: process.env.COACH_CHROMIUM_PATH }
          : {},
      },
    },
    {
      // Browser/device emulation only; this does not validate a physical iPhone.
      name: "coach-mobile",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        launchOptions: process.env.COACH_WEBKIT_PATH
          ? { executablePath: process.env.COACH_WEBKIT_PATH }
          : {},
      },
    },
  ],
});
