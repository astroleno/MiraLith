import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry"
  },
  webServer: {
    command: "pnpm build && pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } }
    },
    {
      name: "mobile-portrait",
      use: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } }
    },
    {
      name: "mobile-landscape",
      use: { ...devices["Pixel 7 landscape"], viewport: { width: 915, height: 412 } }
    }
  ]
});
