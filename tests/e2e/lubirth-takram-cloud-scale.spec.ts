import { expect, test, type Page } from "@playwright/test";

test.setTimeout(900_000);

type Scale = 80 | 120 | 160;
type CoverageMode = "parity" | "presentation";

interface ScaleTelemetry {
  active: boolean;
  adapter: {
    cloudLayers: Array<{
      altitude: number;
      channel: "r" | "g" | "b" | "a";
      densityScale: number;
      height: number;
      shadow: boolean;
    }>;
    disableDefaultLayers: boolean;
    globalWeatherMapping: boolean;
    localWeatherHash: string | null;
    localWeatherOffset: [number, number] | null;
    localWeatherRepeat: [number, number] | null;
    localWeatherSource: "stock" | "v3" | null;
  };
  cloudScale: {
    atmosphereDomain: {
      atmosphereHeight: number;
      layersExceedingAtmosphere: Array<"r" | "g" | "b" | "a">;
      physicalAerialPerspectiveParityClaim: false;
      presentationDomain: "artistic-orbital";
    };
    drift: Array<{ actual: unknown; expected: unknown; path: string }>;
    readback: Record<string, any>;
    requested: Record<string, any>;
  } | null;
  coverage: number | null;
  historyEpochHash: string;
  historyFirstFrameCapture: {
    nativeFrameCount: 1;
  } | null;
  input: "stock" | "v3";
  presentationPreset: string;
  rendererFingerprint: Record<string, any> | null;
  rendererFingerprintHash: string | null;
  shapeDetailRepeat: number | null;
  shapeRepeat: number | null;
}

function query(input: "stock" | "v3", scale: Scale, coverageMode: CoverageMode) {
  return `/lubirth-takram-parity-spike?input=${input}&view=opening&progress=0.06` +
    `&cloudScale=${scale}&cloudCoverage=${coverageMode}`;
}

async function readTelemetry(page: Page): Promise<ScaleTelemetry | undefined> {
  return page.evaluate(() => Reflect.get(window, "__MiraLithTakramParity"));
}

async function openScaleCandidate(
  page: Page,
  input: "stock" | "v3",
  scale: Scale,
  coverageMode: CoverageMode,
  diagnostic = "full"
) {
  const response = await page.goto(`${query(input, scale, coverageMode)}&diagnostic=${diagnostic}`);
  expect(response?.status()).toBe(200);
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-cloud-scale", String(scale));
  await expect(root).toHaveAttribute("data-cloud-coverage", coverageMode);
  await expect(root).toHaveAttribute("data-runtime", "ready", { timeout: 120_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  const telemetry = await readTelemetry(page);
  expect(telemetry).toBeDefined();
  return telemetry!;
}

test("rejects invalid and conflicting cloud-scale route contracts", async ({ page }) => {
  const invalidQueries = [
    "input=stock&view=control&cloudScale=80&cloudCoverage=parity",
    "input=stock&view=opening&cloudScale=81&cloudCoverage=parity",
    "input=stock&view=opening&cloudScale=80",
    "input=stock&view=opening&cloudCoverage=parity",
    "input=stock&view=opening&cloudScale=80&cloudCoverage=legacy",
    "input=v3&view=opening&cloudScale=80&cloudCoverage=parity&morphologyView=opening-orbit"
  ];

  for (const invalidQuery of invalidQueries) {
    const response = await page.goto(`/lubirth-takram-parity-spike?${invalidQuery}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-takram-parity-route='true']"))
      .toHaveAttribute("data-runtime", "invalid-query");
    await expect(page.locator("canvas")).toHaveCount(0);
  }
});

test("applies the same explicit official renderer contract to stock and V3", async ({ page }) => {
  const overflowByScale: Record<Scale, string[]> = {
    80: ["g"],
    120: ["r", "g", "b"],
    160: ["r", "g", "b"]
  };

  for (const scale of [80, 120, 160] as const) {
    for (const coverageMode of ["parity", "presentation"] as const) {
      const stock = await openScaleCandidate(page, "stock", scale, coverageMode);
      const v3 = await openScaleCandidate(page, "v3", scale, coverageMode);
      const expectedCoverage = coverageMode === "parity" ? 0.3 : 0.55;

      for (const telemetry of [stock, v3]) {
        expect(telemetry).toMatchObject({
          active: true,
          cloudScale: {
            atmosphereDomain: {
              atmosphereHeight: 60_000,
              layersExceedingAtmosphere: overflowByScale[scale],
              physicalAerialPerspectiveParityClaim: false,
              presentationDomain: "artistic-orbital"
            },
            drift: [],
            requested: {
              classification: "PUBLIC_PARAMETER_SIMILARITY",
              coverage: expectedCoverage,
              coverageMode,
              mipDistancePatch: { active: false, scale: 1 },
              scale
            }
          },
          coverage: expectedCoverage,
          presentationPreset: "cloud-scale-similarity",
          rendererFingerprint: {
            schemaVersion: 4
          },
          shapeDetailRepeat: 0.006 / scale,
          shapeRepeat: 0.0003 / scale
        });
        expect(telemetry.adapter.disableDefaultLayers).toBe(true);
        expect(telemetry.adapter.cloudLayers).toHaveLength(4);
        expect(telemetry.adapter.cloudLayers.map((layer) => layer.channel))
          .toEqual(["r", "g", "b", "a"]);
        expect(telemetry.adapter.cloudLayers[3]).toMatchObject({
          altitude: 0,
          channel: "a",
          height: 0,
          shadow: false
        });
        expect(telemetry.cloudScale?.readback.layers)
          .toEqual(telemetry.cloudScale?.requested.layers);
        expect(telemetry.rendererFingerprint?.cloudScale)
          .toEqual(telemetry.cloudScale?.readback);
      }

      expect(stock.cloudScale?.readback).toEqual(v3.cloudScale?.readback);
      expect(stock.adapter.cloudLayers).toEqual(v3.adapter.cloudLayers);
      expect(stock.rendererFingerprint).toEqual(v3.rendererFingerprint);
      expect(stock.rendererFingerprintHash).toBe(v3.rendererFingerprintHash);
      expect(stock.adapter).toMatchObject({
        disableDefaultLayers: true,
        globalWeatherMapping: false,
        localWeatherOffset: [0, 0],
        localWeatherRepeat: [100, 100],
        localWeatherSource: "stock"
      });
      expect(v3.adapter).toMatchObject({
        disableDefaultLayers: true,
        globalWeatherMapping: true,
        localWeatherOffset: [-0.045, 0.018],
        localWeatherRepeat: [1, 1],
        localWeatherSource: "v3"
      });
    }
  }
});

test("resets exact first-frame history when the scale contract changes", async ({ page }) => {
  const first = await openScaleCandidate(page, "stock", 80, "parity", "history-reset-first");
  const second = await openScaleCandidate(page, "stock", 120, "parity", "history-reset-first");

  expect(first.historyFirstFrameCapture?.nativeFrameCount).toBe(1);
  expect(second.historyFirstFrameCapture?.nativeFrameCount).toBe(1);
  expect(first.historyEpochHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect(second.historyEpochHash).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect(first.historyEpochHash).not.toBe(second.historyEpochHash);
  expect(first.rendererFingerprintHash).not.toBe(second.rendererFingerprintHash);
});
