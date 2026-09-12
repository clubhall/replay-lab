import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/mobile",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5201",
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: [
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-zygote",
          ],
        }
      : {},
  },
  webServer: {
    command: "node scripts/serve-replay-mobile.mjs",
    port: 5201,
    timeout: 20000,
    reuseExistingServer: false,
  },
});
