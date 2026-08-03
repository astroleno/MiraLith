import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

process.env.MIRALITH_REFERENCE_ABSORPTION_SYSTEM_CHROME = "1";

const port = process.env.MIRALITH_PLAYWRIGHT_PORT ?? "3115";
const baseURL = `http://127.0.0.1:${port}`;
const evidenceDirectory = process.env.MIRALITH_REFERENCE_ABSORPTION_EVIDENCE_DIR;
const reportDirectory = process.env.MIRALITH_REFERENCE_ABSORPTION_REPORT_DIR ??
  "output/playwright/lubirth-reference-absorption-system-chrome";
const outputDirectory = evidenceDirectory
  ? join(evidenceDirectory, "playwright-output")
  : "test-results";
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

if (!existsSync(systemChromeExecutable)) {
  throw new Error(
    "System Chrome was not found. Set MIRALITH_SYSTEM_CHROME_EXECUTABLE to the exact Chrome binary."
  );
}

mkdirSync(reportDirectory, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "lubirth-reference-absorption-spike.spec.ts",
  timeout: 1_500_000,
  workers: 1,
  fullyParallel: false,
  expect: {
    timeout: 25_000
  },
  reporter: [
    ["list"],
    ["json", { outputFile: join(reportDirectory, "report.json") }],
    ["junit", { outputFile: join(reportDirectory, "report.junit.xml") }]
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
    timeout: 180_000
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } }
    },
    {
      name: "mobile-landscape",
      use: {
        ...devices["Pixel 7 landscape"],
        viewport: { width: 844, height: 390 }
      }
    }
  ]
});
