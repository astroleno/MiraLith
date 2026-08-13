import { expect, test } from "@playwright/test";

const modulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling";

async function loadSampling() {
  return import(modulePath);
}

test("defines and parses only the exact production step candidates", async () => {
  const {
    parseTakramOrbitalProductionStepCandidate,
    resolveTakramOrbitalProductionStepScale,
    TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES,
    TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES
  } = await loadSampling();

  expect(TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES).toEqual([
    "control",
    "fine",
    "confirmed",
    "coarse"
  ]);
  expect([
    "control",
    "fine",
    "confirmed",
    "coarse",
    "1.0001",
    "",
    null
  ].map(parseTakramOrbitalProductionStepCandidate)).toEqual([
    "control",
    "fine",
    "confirmed",
    "coarse",
    null,
    null,
    null
  ]);
  expect(TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES).toEqual({
    control: 1.01,
    fine: 1.00005,
    confirmed: 1.0001,
    coarse: 1.0002
  });
  expect(TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES.map(
    resolveTakramOrbitalProductionStepScale
  )).toEqual([1.01, 1.00005, 1.0001, 1.0002]);
  expect(Object.isFrozen(TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES)).toBe(true);
  expect(Object.isFrozen(TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES)).toBe(true);
});

test("estimates the documented near-nadir and two-height initial steps", async () => {
  const {
    estimateTakramOrbitalInitialStepMeters,
    resolveTakramOrbitalProductionStepScale,
    TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES
  } = await loadSampling();
  const cameraHeightEstimateMeters = 3_578_429.408265641;
  const documentedEstimates = {
    control: [35_834.29408265644, 71_618.58816531288],
    fine: [228.92147041319833, 407.84294082639666],
    confirmed: [407.8429408265247, 765.6858816530494],
    coarse: [765.6858816530494, 1_481.3717633060987]
  } as const;

  for (const candidate of TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES) {
    const perspectiveStepScale = resolveTakramOrbitalProductionStepScale(
      candidate
    );
    const nearNadirEstimate = estimateTakramOrbitalInitialStepMeters({
      minStepSizeMeters: 50,
      perspectiveStepScale,
      rayNearEstimateMeters: cameraHeightEstimateMeters
    });
    const twoHeightEstimate = estimateTakramOrbitalInitialStepMeters({
      minStepSizeMeters: 50,
      perspectiveStepScale,
      rayNearEstimateMeters: cameraHeightEstimateMeters * 2
    });

    expect(Math.abs(
      nearNadirEstimate - documentedEstimates[candidate][0]
    )).toBeLessThanOrEqual(1);
    expect(Math.abs(
      twoHeightEstimate - documentedEstimates[candidate][1]
    )).toBeLessThanOrEqual(1);
  }
});
