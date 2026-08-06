import { defineConfig, devices } from "@playwright/test";

const localPreviewPort = process.env.MIRALITH_LOCAL_PREVIEW_PLAYWRIGHT_PORT ?? "3112";
const baseURL = `http://127.0.0.1:${localPreviewPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: `pnpm --filter @miralith/site exec next dev -H 127.0.0.1 -p ${localPreviewPort}`,
    cwd: process.cwd(),
    env: {
      MIRALITH_POST_COSCROLL_MEDIA_MODE: "local-preview"
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } }
    }
  ]
});
