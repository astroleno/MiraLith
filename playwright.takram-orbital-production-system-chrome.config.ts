import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3117";
const reportDirectory =
  process.env.MIRALITH_TAKRAM_ORBITAL_PRODUCTION_REPORT_DIR ??
  "output/playwright/lubirth-takram-orbital-production-system-chrome";
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const buildIdPath = "apps/site/.next/BUILD_ID";

if (process.env.MIRALITH_TAKRAM_ORBITAL_HEADLESS === "1" ||
  process.env.PLAYWRIGHT_HEADLESS === "1") {
  throw new Error("Orbital production evidence rejects headless execution.");
}
if (!existsSync(systemChromeExecutable)) {
  throw new Error(
    "System Chrome was not found. Set MIRALITH_SYSTEM_CHROME_EXECUTABLE to the exact Chrome binary."
  );
}
if (!existsSync(buildIdPath)) {
  throw new Error(
    "The prebuilt production apps/site/.next/BUILD_ID is missing. Run pnpm build before this config; the capture server never builds."
  );
}

mkdirSync(reportDirectory, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "lubirth-takram-orbital-production-lookdev.spec.ts",
  timeout: 900_000,
  workers: 1,
  fullyParallel: false,
  expect: { timeout: 180_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: join(reportDirectory, "report.json") }]
  ],
  use: {
    baseURL,
    deviceScaleFactor: 1,
    trace: "off",
    video: "off",
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
    command: "pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3117",
    cwd: process.cwd(),
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "desktop-system-chrome",
      use: {
        ...devices["Desktop Chrome"],
        deviceScaleFactor: 1,
        viewport: { width: 1440, height: 960 }
      }
    }
  ]
});
