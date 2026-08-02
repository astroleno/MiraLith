import { defineConfig, devices } from "@playwright/test";

const port = process.env.MIRALITH_CINEMATIC_PRELUDE_PORT ?? "3202";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 15_000
  },
  reporter: "list",
  use: {
    baseURL,
    channel: "chrome",
    headless: true,
    trace: "on-first-retry"
  },
  webServer: {
    command: `pnpm build && pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p ${port}`,
    cwd: process.cwd(),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "system-chrome-desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 960 }
      }
    },
    {
      name: "system-chrome-mobile-landscape",
      use: {
        ...devices["Pixel 7 landscape"],
        channel: "chrome",
        viewport: { width: 915, height: 412 }
      }
    }
  ]
});
