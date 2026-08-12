import { expect, test } from "@playwright/test";
import {
  classifyTakramOrbitalCubeFaceDiagnostic,
  parseTakramOrbitalCoverage,
  parseTakramOrbitalOpticalDepthScale,
  parseTakramOrbitalPreset,
  parseTakramOrbitalVerticalScale,
  resolveTakramOrbitalLookdevContract
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract";

test("parses only the bounded orbital lookdev domains", () => {
  expect(["native", "h40", "h80", "h120"].map(parseTakramOrbitalPreset))
    .toEqual(["native", "h40", "h80", "h120"]);
  expect(["h160", "40", "", null].map(parseTakramOrbitalPreset))
    .toEqual([null, null, null, null]);

  expect(["0.3", "0.4", "0.45", "0.55"].map(parseTakramOrbitalCoverage))
    .toEqual([0.3, 0.4, 0.45, 0.55]);
  expect(["0.30", "0.5", "1", null].map(parseTakramOrbitalCoverage))
    .toEqual([null, null, null, null]);

  expect(["1", "2", "4"].map(parseTakramOrbitalVerticalScale))
    .toEqual([1, 2, 4]);
  expect(["0", "3", "8", null].map(parseTakramOrbitalVerticalScale))
    .toEqual([null, null, null, null]);

  expect(["0.75", "1", "1.5"].map(parseTakramOrbitalOpticalDepthScale))
    .toEqual([0.75, 1, 1.5]);
  expect(["0.750", "1.0", "2", null].map(parseTakramOrbitalOpticalDepthScale))
    .toEqual([null, null, null, null]);
});

test("resolves the exact orbital morphology table and effective turbulence domain", () => {
  const expected = {
    native: {
      presentationScale: 1,
      shapeRepeat: 0.0003,
      shapeDetailRepeat: 0.006,
      localWeatherRepeat: [100, 100],
      effectiveTurbulenceRepeat: [2000, 2000]
    },
    h40: {
      presentationScale: 40,
      shapeRepeat: 0.0000075,
      shapeDetailRepeat: 0.00015,
      localWeatherRepeat: [2.5, 2.5],
      effectiveTurbulenceRepeat: [50, 50]
    },
    h80: {
      presentationScale: 80,
      shapeRepeat: 0.00000375,
      shapeDetailRepeat: 0.000075,
      localWeatherRepeat: [1.25, 1.25],
      effectiveTurbulenceRepeat: [25, 25]
    },
    h120: {
      presentationScale: 120,
      shapeRepeat: 0.0000025,
      shapeDetailRepeat: 0.00005,
      localWeatherRepeat: [0.8333333333333334, 0.8333333333333334],
      effectiveTurbulenceRepeat: [16.666666666666668, 16.666666666666668]
    }
  } as const;

  for (const preset of ["native", "h40", "h80", "h120"] as const) {
    const contract = resolveTakramOrbitalLookdevContract({
      preset,
      coverage: 0.3,
      verticalScale: 1,
      opticalDepthScale: 1
    });
    expect(contract).toMatchObject({
      classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
      schemaVersion: 1,
      preset,
      coverage: 0.3,
      turbulenceRepeat: [20, 20],
      turbulenceDisplacement: 350,
      ...expected[preset]
    });
    expect(contract.shapeDetailRepeat / contract.shapeRepeat).toBeCloseTo(20, 12);
    expect(contract.shapeWavelengthMeters).toBeCloseTo(
      1 / contract.shapeRepeat,
      8
    );
    expect(contract.shapeDetailWavelengthMeters).toBeCloseTo(
      1 / contract.shapeDetailRepeat,
      8
    );
  }
});

test("keeps Stage A ray, step, lighting, turbulence, and layer fields native", () => {
  const contract = resolveTakramOrbitalLookdevContract({
    preset: "h120",
    coverage: 0.3,
    verticalScale: 1,
    opticalDepthScale: 1
  });

  expect(contract.clouds).toMatchObject({
    maxIterationCount: 500,
    minStepSize: 50,
    maxStepSize: 1000,
    maxRayDistance: 200_000,
    perspectiveStepScale: 1.01,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minTransmittance: 1e-2,
    maxIterationCountToGround: 3,
    maxIterationCountToSun: 2,
    minSecondaryStepSize: 100,
    secondaryStepScale: 2,
    maxShadowFilterRadius: 6,
    maxShadowLengthIterationCount: 500,
    minShadowLengthStepSize: 50,
    maxShadowLengthRayDistance: 200_000
  });
  expect(contract.shadow).toMatchObject({
    cascadeCount: 3,
    mapSize: [512, 512],
    maxIterationCount: 50,
    minStepSize: 100,
    maxStepSize: 1000,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minTransmittance: 1e-4
  });
  expect(contract.lighting).toEqual({
    absorptionCoefficient: 0,
    groundBounceScale: 1,
    powderExponent: 150,
    powderScale: 0.8,
    scatterAnisotropy1: 0.7,
    scatterAnisotropy2: -0.2,
    scatterAnisotropyMix: 0.5,
    scatteringCoefficient: 1,
    skyLightScale: 1
  });
  expect(contract.renderer).toEqual({
    accuratePhaseFunction: false,
    accurateSunSkyLight: true,
    haze: true,
    lightShafts: true,
    multiScatteringOctaves: 8,
    qualityPreset: "high",
    resolutionScale: 1,
    shapeDetail: true,
    temporalUpscale: true,
    turbulence: true
  });
  expect(contract.layers.map((layer) => ({
    altitude: layer.altitude,
    channel: layer.channel,
    densityScale: layer.densityScale,
    height: layer.height,
    shadow: layer.shadow
  }))).toEqual([
    { altitude: 750, channel: "r", densityScale: 0.2, height: 650, shadow: true },
    { altitude: 1000, channel: "g", densityScale: 0.2, height: 1200, shadow: true },
    { altitude: 7500, channel: "b", densityScale: 0.003, height: 500, shadow: false },
    { altitude: 0, channel: "a", densityScale: 0.2, height: 0, shadow: false }
  ]);
});

test("preserves vertical optical depth before applying the bounded optical finish", () => {
  const native = resolveTakramOrbitalLookdevContract({
    preset: "h80",
    coverage: 0.45,
    verticalScale: 1,
    opticalDepthScale: 1
  });

  for (const verticalScale of [1, 2, 4] as const) {
    const contract = resolveTakramOrbitalLookdevContract({
      preset: "h80",
      coverage: 0.45,
      verticalScale,
      opticalDepthScale: 1
    });
    for (const [index, layer] of contract.layers.entries()) {
      const source = native.layers[index]!;
      expect(layer.altitude).toBe(source.altitude);
      expect(layer.height * layer.densityScale)
        .toBeCloseTo(source.height * source.densityScale, 12);
      if (source.height > 0) {
        expect(layer.altitude + layer.height).toBeLessThan(60_000);
      }
    }
    expect(contract.clouds.minExtinction).toBeCloseTo(1e-5 / verticalScale, 16);
    expect(contract.shadow.minExtinction).toBeCloseTo(1e-5 / verticalScale, 16);
  }

  const finished = resolveTakramOrbitalLookdevContract({
    preset: "h80",
    coverage: 0.45,
    verticalScale: 2,
    opticalDepthScale: 1.5
  });
  expect(finished.layers[0]!.densityScale).toBeCloseTo(0.2 / 2 * 1.5, 12);
  expect(finished.clouds.minExtinction).toBeCloseTo(1e-5 / 2 * 1.5, 16);
  expect(finished.shadow.minExtinction).toBeCloseTo(1e-5 / 2 * 1.5, 16);
});

test("deep-freezes the contract and classifies only confirmed cube-face artifacts as hard failures", () => {
  const contract = resolveTakramOrbitalLookdevContract({
    preset: "h40",
    coverage: 0.55,
    verticalScale: 4,
    opticalDepthScale: 0.75
  });
  expect(Object.isFrozen(contract)).toBe(true);
  expect(Object.isFrozen(contract.layers)).toBe(true);
  expect(Object.isFrozen(contract.layers[0])).toBe(true);
  expect(Object.isFrozen(contract.localWeatherRepeat)).toBe(true);

  expect(classifyTakramOrbitalCubeFaceDiagnostic({
    finiteUv: true,
    faceBoundaryVisible: false,
    wrapDiscontinuityVisible: false
  })).toBe("CUBE_FACE_DIAGNOSTIC_PASS");
  expect(classifyTakramOrbitalCubeFaceDiagnostic({
    finiteUv: false,
    faceBoundaryVisible: false,
    wrapDiscontinuityVisible: false
  })).toBe("HARD_ARTIFACT_FAIL");
  expect(classifyTakramOrbitalCubeFaceDiagnostic({
    finiteUv: true,
    faceBoundaryVisible: true,
    wrapDiscontinuityVisible: false
  })).toBe("HARD_ARTIFACT_FAIL");
  expect(classifyTakramOrbitalCubeFaceDiagnostic({
    finiteUv: true,
    faceBoundaryVisible: false,
    wrapDiscontinuityVisible: true
  })).toBe("HARD_ARTIFACT_FAIL");
});
