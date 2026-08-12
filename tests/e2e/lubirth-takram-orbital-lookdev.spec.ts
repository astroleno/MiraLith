import { expect, test, type Page } from "@playwright/test";

test.setTimeout(900_000);

const openingQuery = (coverage: 0.3 | 0.4 = 0.3) =>
  "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06" +
  `&orbitalPreset=h80&orbitalCoverage=${coverage}` +
  "&verticalScale=1&opticalDepthScale=1&diagnostic=full&visualTest=pixels";

async function waitForOrbitalReady(page: Page, coverage: 0.3 | 0.4) {
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-orbital-preset", "h80");
  await expect(root).toHaveAttribute("data-orbital-coverage", String(coverage));
  await expect(root).toHaveAttribute("data-vertical-scale", "1");
  await expect(root).toHaveAttribute("data-optical-depth-scale", "1");
  await expect(root).toHaveAttribute("data-runtime", "ready", { timeout: 120_000 });
  return page.evaluate(() => Reflect.get(window, "__MiraLithTakramParity")) as Promise<any>;
}

test("orbital route publishes audited identity and remounts the complete native composer", async ({ page }) => {
  const response = await page.goto(openingQuery());
  expect(response?.status()).toBe(200);
  const first = await waitForOrbitalReady(page, 0.3);

  expect(first).toMatchObject({
    active: true,
    driftAttemptLedgerOutcome: "none",
    driftSignature: null,
    lookdevSetupState: "ORBITAL_LOOKDEV_RUNTIME_READY",
    presentationPreset: "orbital-parameter-lookdev",
    resetNonce: 0,
    rendererFingerprint: { schemaVersion: 6 },
    orbitalLookdev: {
      drift: [],
      requested: {
        classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
        coverage: 0.3,
        opticalDepthScale: 1,
        preset: "h80",
        verticalScale: 1
      },
      readback: {
        coverage: 0.3,
        effectiveTurbulenceRepeat: [25, 25],
        localWeatherRepeat: [1.25, 1.25],
        shapeDetailRepeat: [0.000075, 0.000075, 0.000075],
        shapeRepeat: [0.00000375, 0.00000375, 0.00000375],
        turbulenceRepeat: [20, 20]
      }
    }
  });
  expect(first.nativeFrameCount).toBeGreaterThanOrEqual(32);
  expect(first.matchedTemporalFrameCapture.nativeFrameCount).toBe(32);
  expect(first.lookdevBaseKey).toMatch(/^takram-lookdev-base:/);
  expect(first.lookdevMountKey).toBe(JSON.stringify([first.lookdevBaseKey, 0]));
  expect(first.runtimeEvidenceEpoch).toMatch(/^takram-runtime-evidence:/);
  const firstAllocations = [
    ...Object.values(first.orbitalLookdev.readback.allocations.clouds),
    ...Object.values(first.orbitalLookdev.readback.allocations.shadow)
  ] as number[];
  expect(firstAllocations).toHaveLength(6);
  expect(new Set(firstAllocations).size).toBe(6);

  await page.evaluate((url) => window.history.pushState({}, "", url), openingQuery(0.4));
  const second = await waitForOrbitalReady(page, 0.4);
  expect(second.lookdevBaseKey).not.toBe(first.lookdevBaseKey);
  expect(second.lookdevMountKey).not.toBe(first.lookdevMountKey);
  expect(second.resetNonce).toBe(0);
  expect(second.orbitalLookdev.requested.coverage).toBe(0.4);
  expect(second.orbitalLookdev.drift).toEqual([]);
  const secondAllocations = [
    ...Object.values(second.orbitalLookdev.readback.allocations.clouds),
    ...Object.values(second.orbitalLookdev.readback.allocations.shadow)
  ] as number[];
  expect(secondAllocations.every((value) => !firstAllocations.includes(value))).toBe(true);

  await page.waitForTimeout(250);
  const stable = await page.evaluate(() => Reflect.get(window, "__MiraLithTakramParity"));
  expect(stable.lookdevBaseKey).toBe(second.lookdevBaseKey);
  expect(stable.lookdevMountKey).toBe(second.lookdevMountKey);
  expect(stable.resetNonce).toBe(0);
});
