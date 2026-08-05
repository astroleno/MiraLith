import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = process.env.MIRALITH_PLAYWRIGHT_PORT ?? "3114";
const baseURL = `http://127.0.0.1:${port}`;
const reportDirectory = process.env.MIRALITH_PHASE1_REPORT_DIR ??
  "output/playwright/lubirth-hybrid-phase1-system-chrome";
const evidenceDirectory = process.env.MIRALITH_PHASE1_EVIDENCE_DIR;
const outputDirectory = evidenceDirectory
  ? join(evidenceDirectory, "playwright-output")
  : "test-results";
const systemChromeExecutable = process.env.MIRALITH_SYSTEM_CHROME_EXECUTABLE ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const captureVideo = process.env.MIRALITH_PHASE1_CAPTURE_VIDEO === "1";

if (!existsSync(systemChromeExecutable)) {
  throw new Error(
    "System Chrome was not found. Set MIRALITH_SYSTEM_CHROME_EXECUTABLE to the exact Chrome binary."
  );
}

mkdirSync(reportDirectory, { recursive: true });
mkdirSync(outputDirectory, { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: outputDirectory,
  testMatch: "lubirth-hybrid-cloud-kill-spike.spec.ts",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  expect: {
    timeout: 10_000
  },
  reporter: [
    ["list"],
    ["json", { outputFile: join(reportDirectory, "report.json") }],
    ["junit", { outputFile: join(reportDirectory, "report.junit.xml") }]
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    // Evidence capture is opt-in so normal acceptance runs do not pay the
    // video encoder cost. The motion gate can turn this on to produce a WebM
    // from the same headed System Chrome path and source tree it verifies.
    video: captureVideo ? "on" : "off",
    launchOptions: {
      executablePath: systemChromeExecutable,
      // A headed System Chrome window launched by Playwright can remain behind
      // the foreground Codex window on macOS. Without these switches Chromium
      // throttles requestAnimationFrame/timer-query polling, so the mandated
      // 120-sample acceptance window times out before it can evaluate GPU p95.
      // They remove only background scheduling throttles; rendering still uses
      // the same visible System Chrome + Metal path under test.
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
      ],
      // Phase -1 is a GPU acceptance run. Keep System Chrome headed so the
      // Metal compositor and timer-query path match the visible browser users
      // actually run, rather than Chromium's headless rendering mode.
      headless: false
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
    },
    {
      name: "mobile-landscape-system-chrome",
      use: { ...devices["Pixel 7 landscape"], viewport: { width: 915, height: 412 } }
    }
  ]
});
