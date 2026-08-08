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
