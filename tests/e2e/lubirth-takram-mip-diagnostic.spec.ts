import { expect, test, type Page } from "@playwright/test";

test.setTimeout(900_000);

type MipCaptureMetadata = {
  completed: boolean;
  scale: 1 | 80 | 120 | 160;
  targetNativeFrames: readonly [16, 32, 48];
  runtimeFragmentShaderFnv1a64: string;
  frames: Array<{
    nativeFrame: 16 | 32 | 48;
    recordCount: number;
    lastSampleOrdinal: number;
    recordStride: 9;
    byteLength: number;
    dataBase64: string;
    temporalFrame: {
      cloudsFrame: number;
      resolveFrame: number;
      shadowFrame: number;
      frameLockPass: boolean;
      historyEpochHash: string;
    };
  }>;
};

async function openMipDiagnostic(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(200);
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-runtime", "ready", { timeout: 300_000 });
  return page.evaluate(() => {
    const capture = Reflect.get(window, "__MiraLithTakramMipDiagnostic") as
      | MipCaptureMetadata
      | undefined;
    const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
      | { active?: boolean; diagnostic?: string; mipDiagnostic?: MipCaptureMetadata }
      | undefined;
    if (!capture) return { capture: null, telemetry: telemetry ?? null };
    return {
      capture: {
        ...capture,
        frames: capture.frames.map(({ dataBase64: _dataBase64, ...frame }) => frame)
      },
      telemetry: telemetry ?? null
    };
  });
}

test("captures read-only exact-frame mip populations for healthy and scaled stock", async ({
  page
}) => {
  const healthy = await openMipDiagnostic(
    page,
    "/lubirth-takram-parity-spike?input=stock&view=control&diagnostic=mip-diagnostic"
  );
  const scaled = await openMipDiagnostic(
    page,
    "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06" +
      "&cloudScale=120&cloudCoverage=parity&stockWeather=similarity" +
      "&diagnostic=mip-diagnostic"
  );

  for (const [expectedScale, result] of [[1, healthy], [120, scaled]] as const) {
    expect(result.telemetry).toMatchObject({
      active: true,
      diagnostic: "mip-diagnostic",
      mipDiagnostic: {
        completed: true,
        scale: expectedScale,
        targetNativeFrames: [16, 32, 48]
      }
    });
    expect(result.capture).toMatchObject({
      completed: true,
      scale: expectedScale,
      targetNativeFrames: [16, 32, 48]
    });
    expect(result.capture?.runtimeFragmentShaderFnv1a64)
      .toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
    expect(result.capture?.frames.map((frame) => frame.nativeFrame))
      .toEqual([16, 32, 48]);
    for (const frame of result.capture?.frames ?? []) {
      expect(frame.recordCount).toBeGreaterThan(0);
      expect(frame.byteLength).toBe(frame.recordCount * frame.recordStride * 4);
      expect(frame.temporalFrame).toMatchObject({
        cloudsFrame: frame.nativeFrame,
        resolveFrame: frame.nativeFrame,
        shadowFrame: frame.nativeFrame,
        frameLockPass: true
      });
    }
  }
  expect(healthy.capture?.runtimeFragmentShaderFnv1a64)
    .toBe(scaled.capture?.runtimeFragmentShaderFnv1a64);
});

test("rejects mip diagnostics on V3", async ({ page }) => {
  const response = await page.goto(
    "/lubirth-takram-parity-spike?input=v3&view=opening&diagnostic=mip-diagnostic"
  );
  expect(response?.status()).toBe(200);
  await expect(page.locator("[data-takram-parity-route='true']"))
    .toHaveAttribute("data-runtime", "invalid-query");
  await expect(page.locator("canvas")).toHaveCount(0);
});
