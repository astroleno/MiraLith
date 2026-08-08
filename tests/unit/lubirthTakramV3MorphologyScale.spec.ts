import { expect, test } from "@playwright/test";

type MorphologyContractModule = {
  TAKRAM_V3_MORPHOLOGY_BASELINE: {
    coverage: number;
    shapeRepeat: number;
    shapeDetailRepeat: number;
  };
  TAKRAM_V3_MORPHOLOGY_VIEWS: ReadonlyArray<{
    id: "near-oblique" | "aerial-oblique" | "near-orbit" | "opening-orbit";
    cameraAltitudeMeters: number;
    targetDistanceMeters: number;
    targetAltitudeMeters: number;
    usesOpeningFrame: boolean;
    sphericalUv: readonly [number, number];
  }>;
  resolveTakramV3MorphologyCandidate(candidate: string | null | undefined):
    | { id: "baseline"; shapeRepeat: number; shapeDetailRepeat: number }
    | null;
  resolveTakramV3MorphologyView(view: string | null | undefined):
    | MorphologyContractModule["TAKRAM_V3_MORPHOLOGY_VIEWS"][number]
    | null;
};

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract";
const parityContractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";
const scaleAuditModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyScaleAudit";

test("freezes the V3 morphology review views and baseline contract", async () => {
  const contract = await import(modulePath) as MorphologyContractModule;
  const parityContract = await import(parityContractModulePath) as {
    resolveTakramParityRouteQuery(input: { get(name: string): string | null }):
      | { ok: true; value: Record<string, unknown> }
      | { ok: false; reason: string };
  };

  expect(contract.TAKRAM_V3_MORPHOLOGY_VIEWS).toEqual([
    {
      id: "near-oblique",
      cameraAltitudeMeters: 2_500,
      targetDistanceMeters: 80_000,
      targetAltitudeMeters: 8_000,
      usesOpeningFrame: false,
      sphericalUv: [0.076494140625, 0.73053515625]
    },
    {
      id: "aerial-oblique",
      cameraAltitudeMeters: 50_000,
      targetDistanceMeters: 180_000,
      targetAltitudeMeters: 10_000,
      usesOpeningFrame: false,
      sphericalUv: [0.076494140625, 0.73053515625]
    },
    {
      id: "near-orbit",
      cameraAltitudeMeters: 200_000,
      targetDistanceMeters: 600_000,
      targetAltitudeMeters: 12_000,
      usesOpeningFrame: false,
      sphericalUv: [0.076494140625, 0.73053515625]
    },
    {
      id: "opening-orbit",
      cameraAltitudeMeters: 3_578_429,
      targetDistanceMeters: 0,
      targetAltitudeMeters: 0,
      usesOpeningFrame: true,
      sphericalUv: [0.076494140625, 0.73053515625]
    }
  ]);
  expect(contract.TAKRAM_V3_MORPHOLOGY_BASELINE).toEqual({
    id: "baseline",
    coverage: 0.55,
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006
  });
  expect(contract.resolveTakramV3MorphologyCandidate("baseline")).toEqual({
    id: "baseline",
    coverage: 0.55,
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006
  });
  expect(contract.resolveTakramV3MorphologyCandidate("unknown")).toBeNull();
  expect(contract.resolveTakramV3MorphologyView("opening-orbit")?.usesOpeningFrame).toBe(true);
  expect(contract.resolveTakramV3MorphologyView("unknown")).toBeNull();
  expect(parityContract.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&diagnostic=cloud-raw&morphologyView=near-oblique"
  ))).toEqual({
    ok: true,
    value: {
      diagnostic: "cloud-raw",
      input: "v3",
      morphologyCandidate: "baseline",
      morphologyView: "near-oblique",
      progress: 0,
      view: "opening"
    }
  });
  expect(parityContract.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=stock&view=opening&morphologyView=near-oblique"
  ))).toEqual({ ok: false, reason: "morphology-requires-v3" });
  expect(parityContract.resolveTakramParityRouteQuery(new URLSearchParams(
    "input=v3&view=opening&morphologyCandidate=baseline"
  ))).toEqual({ ok: false, reason: "morphology-candidate-requires-view" });
});

test("audits repeat wavelengths and projected pixels in ECEF metres", async () => {
  const audit = await import(scaleAuditModulePath) as {
    wavelengthMetersFromRepeat(repeatPerMeter: number): number;
    classifyProjectedPixels(pixels: number, axis: "shape" | "detail" | "thickness"): string;
    auditMorphologyScale(input: {
      viewProjectionMatrix: readonly number[];
      ecefToWorldMatrix: readonly number[];
      originEcefMeters: readonly [number, number, number];
      viewport: { width: number; height: number };
      shapeRepeat: number;
      shapeDetailRepeat: number;
      layers: ReadonlyArray<{
        channel: "r" | "g" | "b" | "a";
        altitude: number;
        height: number;
      }>;
    }): {
      shapeWavelengthMeters: number;
      detailWavelengthMeters: number;
      pixelsPerMeter: { east: number; north: number; up: number };
      shapeProjectedPixels: number;
      detailProjectedPixels: number;
      layers: ReadonlyArray<{ projectedThicknessPixels: number }>;
    };
  };

  expect(audit.wavelengthMetersFromRepeat(0.000025)).toBe(40_000);
  expect(audit.wavelengthMetersFromRepeat(0.0006)).toBeCloseTo(1_666.6666666667, 9);
  expect(audit.wavelengthMetersFromRepeat(0.0003)).toBeCloseTo(3_333.3333333333, 9);
  expect(audit.wavelengthMetersFromRepeat(0.006)).toBeCloseTo(166.6666666667, 9);

  const projection = [
    0.01, 0, 0, 0,
    0, 0.01, 0, 0,
    0, 0, -2 / 999.9, 0,
    0, 0, -(1_000.1 / 999.9), 1
  ];
  const result = audit.auditMorphologyScale({
    viewProjectionMatrix: projection,
    ecefToWorldMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    originEcefMeters: [0, 0, -500],
    viewport: { width: 1_000, height: 1_000 },
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006,
    eastEcef: [1, 0, 0],
    northEcef: [0, 1, 0],
    upEcef: [1, 0, 0],
    layers: [
      { channel: "r", altitude: 8_000, height: 26_000 },
      { channel: "g", altitude: 10_000, height: 50_000 }
    ]
  });
  expect(result.pixelsPerMeter.east).toBeCloseTo(5, 6);
  expect(result.pixelsPerMeter.north).toBeCloseTo(5, 6);
  expect(result.pixelsPerMeter.up).toBeCloseTo(5, 6);
  expect(result.shapeProjectedPixels).toBeCloseTo(200_000, 3);
  expect(result.detailProjectedPixels).toBeCloseTo(8_333.333333333, 3);
  expect(result.layers.map((layer) => layer.projectedThicknessPixels)).toEqual([130_000, 250_000]);

  const scaledResult = audit.auditMorphologyScale({
    viewProjectionMatrix: projection,
    ecefToWorldMatrix: [
      0, 2, 0, 0,
      -2, 0, 0, 0,
      0, 0, 2, 0,
      0, 0, 0, 1
    ],
    originEcefMeters: [0, 0, -500],
    viewport: { width: 1_000, height: 1_000 },
    shapeRepeat: 0.000025,
    shapeDetailRepeat: 0.0006,
    eastEcef: [1, 0, 0],
    northEcef: [0, 1, 0],
    upEcef: [1, 0, 0],
    layers: []
  });
  expect(scaledResult.pixelsPerMeter.east).toBeCloseTo(10, 6);
  expect(scaledResult.pixelsPerMeter.north).toBeCloseTo(10, 6);
  expect(scaledResult.pixelsPerMeter.up).toBeCloseTo(10, 6);
  expect(audit.classifyProjectedPixels(1.5, "detail")).toBe("subpixel-risk");
  expect(audit.classifyProjectedPixels(32, "shape")).toBe("target");
});
