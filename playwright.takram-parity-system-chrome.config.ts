import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.MIRALITH_PLAYWRIGHT_PORT ?? "3116";
const baseURL = `http://127.0.0.1:${port}`;
const reportDirectory = process.env.MIRALITH_TAKRAM_PARITY_REPORT_DIR ??
  "output/playwright/lubirth-takram-parity-system-chrome";
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!existsSync(systemChromeExecutable)) {
  throw new Error(
    "System Chrome was not found. Set MIRALITH_SYSTEM_CHROME_EXECUTABLE to the exact Chrome binary."
  );
}

mkdirSync(reportDirectory, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 900_000,
  workers: 1,
  fullyParallel: false,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: join(reportDirectory, "report.json") }]
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: {
      executablePath: systemChromeExecutable,
      headless: false,
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
      ]
    }
  },
  webServer: {
    command: `pnpm build && pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p ${port}`,
    cwd: process.cwd(),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop-system-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } }
    }
  ]
});
