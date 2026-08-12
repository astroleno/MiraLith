import { defineConfig, devices } from "@playwright/test";

const contractPort = process.env.MIRALITH_CONTRACT_PLAYWRIGHT_PORT ?? "3113";
const baseURL = `http://127.0.0.1:${contractPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: {
    command: `pnpm --filter @miralith/site exec next dev -H 127.0.0.1 -p ${contractPort}`,
    cwd: process.cwd(),
    env: {
      MIRALITH_CONTRACT_FIXTURES: "1"
    },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }
    }
  ]
});
