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
  TAKRAM_V3_MORPHOLOGY_HORIZONTAL_CANDIDATES: Readonly<Record<string, {
    id: string;
    shapeRepeat: number;
    shapeDetailRepeat: number;
    sourceViews: readonly string[];
    targetShapePixels: number;
    targetDetailPixels: number;
  }>>;
  resolveTakramV3MorphologyCandidate(candidate: string | null | undefined):
    | { id: string; shapeRepeat: number; shapeDetailRepeat: number }
    | null;
  resolveTakramV3MorphologyView(view: string | null | undefined):
    | MorphologyContractModule["TAKRAM_V3_MORPHOLOGY_VIEWS"][number]
    | null;
  buildTakramV3MorphologyCandidates(inputs: ReadonlyArray<{
    view: "near-oblique" | "aerial-oblique" | "near-orbit" | "opening-orbit";
    pixelsPerMeter: { east: number; north: number };
  }>): ReadonlyArray<{
    view: string;
    targetShapePixels: number;
    targetDetailPixels: number;
    shapeRepeat: number;
    shapeDetailRepeat: number;
    physicalRangePass: boolean;
  }>;
  resolveTakramV3MorphologyReviewFrame(
    view: MorphologyContractModule["TAKRAM_V3_MORPHOLOGY_VIEWS"][number],
    planetRadiusMeters: number
  ): {
    cameraEcefMeters: readonly [number, number, number];
    targetEcefMeters: readonly [number, number, number];
    targetRadialEcef: readonly [number, number, number];
    eastEcef: readonly [number, number, number];
    northEcef: readonly [number, number, number];
    upEcef: readonly [number, number, number];
  };
  resolveTakramV3MorphologyCommonRepeatInterval(
    inputs: ReadonlyArray<{
      view: "near-oblique" | "aerial-oblique" | "near-orbit" | "opening-orbit";
      pixelsPerMeter: { east: number; north: number };
    }>,
    kind: "shape" | "detail"
  ): {
    feasible: boolean;
    minimum: number;
    maximum: number;
  };
  resolveTakramV3HorizontalMorphologyCheckpoint(input: {
    audits: ReadonlyArray<{
      view: "near-oblique" | "aerial-oblique" | "near-orbit";
      pixelsPerMeter: { east: number; north: number };
      originScreenPixels: readonly [number, number] | null;
      viewport: { width: number; height: number };
    }>;
    metricCandidateCount: number;
    passingMetricCandidateCount: number;
  }): {
    id: string;
    task3Unlocked: boolean;
  };
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
  expect(Object.keys(contract.TAKRAM_V3_MORPHOLOGY_HORIZONTAL_CANDIDATES)).toHaveLength(10);
  expect(contract.resolveTakramV3MorphologyCandidate("horizontal-near-oblique-shape-32-detail-4"))
    .toMatchObject({
      id: "horizontal-near-oblique-shape-32-detail-4",
      shapeRepeat: 0.010238030809047992 / 32,
      shapeDetailRepeat: 0.010238030809047992 / 4,
      sourceViews: ["near-oblique"],
      targetShapePixels: 32,
      targetDetailPixels: 4
    });
  expect(contract.resolveTakramV3MorphologyCandidate("horizontal-aerial-oblique-shape-48-detail-8"))
    .toMatchObject({
      shapeRepeat: 0.004512678951320542 / 48,
      shapeDetailRepeat: 0.004512678951320542 / 8
    });
  expect(contract.resolveTakramV3MorphologyView("opening-orbit")?.usesOpeningFrame).toBe(true);
  expect(contract.resolveTakramV3MorphologyView("unknown")).toBeNull();
  const generated = contract.buildTakramV3MorphologyCandidates([
    { view: "near-oblique", pixelsPerMeter: { east: 0.001, north: 0.001 } },
    { view: "near-orbit", pixelsPerMeter: { east: 0.00025, north: 0.00025 } }
  ]);
  expect(generated).toHaveLength(18);
  expect(generated.filter((candidate) => candidate.physicalRangePass)).toHaveLength(2);
  expect(generated.find((candidate) =>
    candidate.view === "near-orbit" &&
    candidate.targetShapePixels === 16 &&
    candidate.targetDetailPixels === 4
  )).toMatchObject({
    shapeRepeat: 0.000015625,
    shapeDetailRepeat: 0.0000625,
    physicalRangePass: true
  });
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
    classifyProjectedPixels(
      pixels: number,
      axis: "shape" | "detail" | "thickness",
      view?: "near-oblique" | "aerial-oblique" | "near-orbit" | "opening-orbit"
    ): string;
    auditMorphologyScale(input: {
      viewProjectionMatrix: readonly number[];
      ecefToWorldMatrix: readonly number[];
      originEcefMeters: readonly [number, number, number];
      viewport: { width: number; height: number };
      view: "near-oblique" | "aerial-oblique" | "near-orbit" | "opening-orbit";
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
      shapeProjectedPixelsByAxis: { east: number; north: number };
      detailProjectedPixelsByAxis: { east: number; north: number };
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
    view: "near-oblique",
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
  expect(result.shapeProjectedPixelsByAxis).toEqual({ east: 200_000, north: 200_000 });
  expect(result.detailProjectedPixelsByAxis.east).toBeCloseTo(8_333.333333333, 3);
  expect(result.detailProjectedPixelsByAxis.north).toBeCloseTo(8_333.333333333, 3);
  expect(result.shapeProjectedPixels).toBeCloseTo(200_000, 3);
  expect(result.detailProjectedPixels).toBeCloseTo(8_333.333333333, 3);
  expect(result.layers.map((layer) => layer.projectedThicknessPixels)).toEqual([130_000, 250_000]);

  const scaledResult = audit.auditMorphologyScale({
    view: "near-oblique",
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
  expect(audit.classifyProjectedPixels(4, "thickness", "near-orbit")).toBe("target");
  expect(audit.classifyProjectedPixels(4, "thickness", "near-oblique")).toBe("fragment-risk");
  expect(audit.classifyProjectedPixels(2, "thickness", "opening-orbit")).toBe("target");
});

test("constructs morphology targets on the requested spherical arc", async () => {
  const contract = await import(modulePath) as MorphologyContractModule;
  const radius = 6_360_000;
  const expectedTargetUv = contract.TAKRAM_V3_MORPHOLOGY_VIEWS[0]!.sphericalUv;
  for (const view of contract.TAKRAM_V3_MORPHOLOGY_VIEWS.filter(
    (candidate) => !candidate.usesOpeningFrame
  )) {
    const frame = contract.resolveTakramV3MorphologyReviewFrame(view, radius);
    const targetRadius = Math.hypot(...frame.targetEcefMeters);
    expect(targetRadius - radius).toBeCloseTo(view.targetAltitudeMeters, 6);

    const cameraRadial = frame.cameraEcefMeters.map((value) =>
      value / Math.hypot(...frame.cameraEcefMeters)
    );
    const targetRadial = frame.targetRadialEcef;
    const targetPhi = Math.atan2(targetRadial[1], targetRadial[0]);
    const targetUv = [
      targetPhi / (Math.PI * 2) + 0.5,
      Math.asin(targetRadial[2]) / Math.PI + 0.5
    ];
    expect(targetUv[0]).toBeCloseTo(expectedTargetUv[0], 12);
    expect(targetUv[1]).toBeCloseTo(expectedTargetUv[1], 12);
    const centralAngle = Math.acos(Math.max(-1, Math.min(1,
      cameraRadial[0]! * targetRadial[0]!
      + cameraRadial[1]! * targetRadial[1]!
      + cameraRadial[2]! * targetRadial[2]!
    )));
    expect(centralAngle * radius).toBeCloseTo(view.targetDistanceMeters, 5);
    expect(Math.hypot(...frame.targetRadialEcef)).toBeCloseTo(1, 12);
    expect(Math.hypot(...frame.eastEcef)).toBeCloseTo(1, 12);
    expect(Math.hypot(...frame.northEcef)).toBeCloseTo(1, 12);
    expect(Math.hypot(...frame.upEcef)).toBeCloseTo(1, 12);
    expect(
      frame.targetRadialEcef[0] * frame.eastEcef[0]
      + frame.targetRadialEcef[1] * frame.eastEcef[1]
      + frame.targetRadialEcef[2] * frame.eastEcef[2]
    ).toBeCloseTo(0, 12);
  }
});

test("derives the common repeat interval and checkpoint from audit evidence", async () => {
  const contract = await import(modulePath) as MorphologyContractModule;
  const feasibleAudits = [
    { view: "near-oblique" as const, pixelsPerMeter: { east: 0.001, north: 0.0012 } },
    { view: "aerial-oblique" as const, pixelsPerMeter: { east: 0.0015, north: 0.0014 } },
    { view: "near-orbit" as const, pixelsPerMeter: { east: 0.002, north: 0.0018 } }
  ];
  expect(contract.resolveTakramV3MorphologyCommonRepeatInterval(feasibleAudits, "shape"))
    .toMatchObject({ feasible: true, minimum: 0.000041666666666666665, maximum: 0.0000625 });
  expect(contract.resolveTakramV3MorphologyCommonRepeatInterval(feasibleAudits, "detail"))
    .toMatchObject({ feasible: true, minimum: 0.0002, maximum: 0.0003333333333333333 });

  const onscreenAudits = feasibleAudits.map((audit) => ({
    ...audit,
    originScreenPixels: [720, 480] as const,
    viewport: { width: 1440, height: 960 }
  }));
  expect(contract.resolveTakramV3HorizontalMorphologyCheckpoint({
    audits: onscreenAudits,
    metricCandidateCount: 3,
    passingMetricCandidateCount: 1
  })).toEqual({
    id: "HORIZONTAL_MORPHOLOGY_VISUAL_REVIEW_REQUIRED",
    task3Unlocked: false
  });

  expect(contract.resolveTakramV3HorizontalMorphologyCheckpoint({
    audits: onscreenAudits.map((audit, index) => index === 0
      ? { ...audit, originScreenPixels: [720, -1] as const }
      : audit),
    metricCandidateCount: 3,
    passingMetricCandidateCount: 1
  })).toEqual({
    id: "MORPHOLOGY_SCALE_EVIDENCE_INVALID",
    task3Unlocked: false
  });

  expect(contract.resolveTakramV3HorizontalMorphologyCheckpoint({
    audits: [
      { ...onscreenAudits[0]!, pixelsPerMeter: { east: 0.0001, north: 0.00135 } },
      { ...onscreenAudits[1]!, pixelsPerMeter: { east: 0.001, north: 0.001 } },
      { ...onscreenAudits[2]!, pixelsPerMeter: { east: 0.01, north: 0.01 } }
    ],
    metricCandidateCount: 3,
    passingMetricCandidateCount: 1
  })).toEqual({
    id: "HORIZONTAL_MORPHOLOGY_SCALE_FAIL",
    task3Unlocked: false
  });

  const anisotropicAudit = [{
    view: "near-oblique" as const,
    pixelsPerMeter: { east: 0.001, north: 0.0135 }
  }];
  expect(contract.resolveTakramV3MorphologyCommonRepeatInterval(anisotropicAudit, "shape"))
    .toMatchObject({ feasible: false });
  expect(contract.resolveTakramV3MorphologyCommonRepeatInterval(anisotropicAudit, "detail"))
    .toMatchObject({ feasible: false });
});

test("captures temporal history only on the exact first native frame", async () => {
  const parityContract = await import(parityContractModulePath) as {
    shouldCaptureTakramHistoryFirstFrame(input: {
      diagnostic: string;
      nativeFrameCount: number;
      alreadyCaptured: boolean;
    }): boolean;
  };
  expect(parityContract.shouldCaptureTakramHistoryFirstFrame({
    diagnostic: "history-reset-first",
    nativeFrameCount: 1,
    alreadyCaptured: false
  })).toBe(true);
  expect(parityContract.shouldCaptureTakramHistoryFirstFrame({
    diagnostic: "history-reset-first",
    nativeFrameCount: 2,
    alreadyCaptured: false
  })).toBe(false);
  expect(parityContract.shouldCaptureTakramHistoryFirstFrame({
    diagnostic: "history-reset-first",
    nativeFrameCount: 1,
    alreadyCaptured: true
  })).toBe(false);
  expect(parityContract.shouldCaptureTakramHistoryFirstFrame({
    diagnostic: "full",
    nativeFrameCount: 1,
    alreadyCaptured: false
  })).toBe(false);
});
