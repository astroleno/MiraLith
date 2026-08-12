import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const instrumentationPath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramMipDiagnosticInstrumentation";
const diagnosticPath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramMipDiagnostic";
const readbackPath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramMipDiagnosticReadback";

test("installs a reversible per-primary-sample mip probe on the pinned shader", async () => {
  const instrumentation = await import(instrumentationPath);
  const originalShader = readFileSync(
    "packages/lubirth-hero/node_modules/@takram/three-clouds/src/shaders/clouds.frag",
    "utf8"
  );
  const material = {
    fragmentShader: originalShader,
    needsUpdate: false,
    uniforms: {},
    userData: {}
  };

  const restore = instrumentation.installTakramMipDiagnosticInstrumentation(material);
  const installedShaderIdentity = instrumentation.readTakramMipDiagnosticShaderIdentity(material);
  expect(installedShaderIdentity).toMatch(/^fnv1a-64:[0-9a-f]{16}$/);
  expect(installedShaderIdentity).not.toBe(instrumentation.hashTakramMipDiagnosticShader(originalShader));
  expect(material.fragmentShader).toContain("uniform int mipDiagnosticMode;");
  expect(material.fragmentShader).toContain("uniform int mipDiagnosticSampleOrdinal;");
  expect(material.fragmentShader).toContain(
    "mipDiagnosticRayDistanceKilometers = rayDistance * 0.001;"
  );
  expect(material.fragmentShader).toContain(
    "mipDiagnosticActualMip = mipLevel;"
  );
  expect(material.fragmentShader).toContain(
    "mipDiagnosticWeatherHit = any(greaterThan(weather.density, vec4(minDensity))) ? 1.0 : 0.0;"
  );
  expect(material.fragmentShader).toContain(
    "mipDiagnosticPrimaryHit = 1.0;"
  );
  expect(material.fragmentShader).toContain(
    "outputDepthVelocity = vec3(mipDiagnosticValid, mipDiagnosticWeatherHit, mipDiagnosticPrimaryHit);"
  );
  expect(material.fragmentShader).toContain(
    "outputShadowLength = 1.0 - mipDiagnosticRawTransmittance;"
  );
  expect(material.fragmentShader).toContain("rayDistance * 1e-5");
  expect(material.fragmentShader).not.toContain("mipDistanceScale");
  expect(material.uniforms.mipDiagnosticMode.value).toBe(0);
  expect(material.uniforms.mipDiagnosticSampleOrdinal.value).toBe(0);

  instrumentation.configureTakramMipDiagnosticSample(material, 7);
  expect(material.uniforms.mipDiagnosticMode.value).toBe(1);
  expect(material.uniforms.mipDiagnosticSampleOrdinal.value).toBe(7);
  instrumentation.disableTakramMipDiagnosticSample(material);
  expect(material.uniforms.mipDiagnosticMode.value).toBe(0);

  restore();
  expect(material.fragmentShader).toBe(originalShader);
  expect(instrumentation.hashTakramMipDiagnosticShader(material.fragmentShader))
    .toBe(instrumentation.hashTakramMipDiagnosticShader(originalShader));
  expect(material.uniforms.mipDiagnosticMode).toBeUndefined();
  expect(material.uniforms.mipDiagnosticSampleOrdinal).toBeUndefined();
});

type SampleInput = {
  scale: 1 | 80 | 120 | 160;
  mipExcess: number;
  weatherHit?: boolean;
  primaryHit?: boolean;
  opacity?: number;
};

function createPopulation({
  scale,
  mipExcess,
  weatherHit = true,
  primaryHit = true,
  opacity = 0.2
}: SampleInput) {
  const records = new Float32Array(4096 * 9);
  const rayStartTexelsPerPixel = 1;
  for (let index = 0; index < 4096; index += 1) {
    const offset = index * 9;
    const pixelIndex = index % 512;
    const ordinal = Math.floor(index / 512);
    const rayDistanceMeters = 100_000 + index;
    const counterfactualMip = Math.log2(Math.max(
      1,
      rayStartTexelsPerPixel + (rayDistanceMeters / scale) * 1e-5
    ));
    records[offset] = pixelIndex;
    records[offset + 1] = ordinal;
    records[offset + 2] = rayDistanceMeters;
    records[offset + 3] = rayStartTexelsPerPixel;
    records[offset + 4] = counterfactualMip + mipExcess;
    records[offset + 5] = counterfactualMip;
    records[offset + 6] = weatherHit ? 0.5 : 0;
    records[offset + 7] = 1 + (weatherHit ? 2 : 0) + (primaryHit ? 4 : 0);
    records[offset + 8] = opacity;
  }
  return {
    frames: [
      { nativeFrame: 16, records },
      { nativeFrame: 32, records: new Float32Array(0) },
      { nativeFrame: 48, records: new Float32Array(0) }
    ],
    scale
  } as const;
}

test("accepts mip causality only for the frozen healthy and scaled thresholds", async () => {
  const diagnostic = await import(diagnosticPath);
  expect(diagnostic.TAKRAM_MIP_DIAGNOSTIC_TARGET_FRAMES).toEqual([16, 32, 48]);
  expect(diagnostic.TAKRAM_MIP_DIAGNOSTIC_RECORD_STRIDE).toBe(9);

  const result = diagnostic.evaluateTakramMipDiagnostic({
    healthy: createPopulation({ scale: 1, mipExcess: 0, opacity: 0.2 }),
    candidates: [
      createPopulation({ scale: 80, mipExcess: 1.2 }),
      createPopulation({ scale: 120, mipExcess: 1.4 }),
      createPopulation({ scale: 160, mipExcess: 0.2 })
    ]
  });

  expect(result.decision).toBe("MIP_CAUSAL_THRESHOLD_PASS_PATCH_A_B_REQUIRES_AUTHORIZATION");
  expect(result.patchAuthorized).toBe(false);
  expect(result.healthy.valid).toBe(true);
  expect(result.candidates.find((candidate) => candidate.scale === 120)).toMatchObject({
    mipExcessAtLeastOneFraction: 1,
    prematureMipThresholdPass: true,
    roughWeatherHitFraction: 1
  });
  expect(result.candidates.find((candidate) => candidate.scale === 120)?.mipExcessP50)
    .toBeCloseTo(1.4, 5);
  expect(result.qualifyingSecondaryScale).toBe(80);
});

test("rejects correlation when scaled mip excess or weather population is insufficient", async () => {
  const diagnostic = await import(diagnosticPath);
  const result = diagnostic.evaluateTakramMipDiagnostic({
    healthy: createPopulation({ scale: 1, mipExcess: 0, opacity: 0.2 }),
    candidates: [
      createPopulation({ scale: 80, mipExcess: 0.8 }),
      createPopulation({ scale: 120, mipExcess: 1.2, weatherHit: false }),
      createPopulation({ scale: 160, mipExcess: 0.4 })
    ]
  });

  expect(result.decision).toBe("MIP_CAUSAL_HYPOTHESIS_REJECTED");
  expect(result.patchAuthorized).toBe(false);
  expect(result.qualifyingSecondaryScale).toBeNull();
});

test("stops on an invalid healthy reference or empty candidate population", async () => {
  const diagnostic = await import(diagnosticPath);
  const invalidHealthy = diagnostic.evaluateTakramMipDiagnostic({
    healthy: createPopulation({ scale: 1, mipExcess: 0, weatherHit: false, opacity: 0.01 }),
    candidates: [
      createPopulation({ scale: 80, mipExcess: 1.2 }),
      createPopulation({ scale: 120, mipExcess: 1.2 }),
      createPopulation({ scale: 160, mipExcess: 1.2 })
    ]
  });
  expect(invalidHealthy.decision).toBe("MIP_DIAGNOSTIC_INVALID_HEALTHY_REFERENCE");

  const empty = createPopulation({ scale: 80, mipExcess: 1.2 });
  empty.frames[0].records.fill(0);
  const emptyCandidate = diagnostic.evaluateTakramMipDiagnostic({
    healthy: createPopulation({ scale: 1, mipExcess: 0, opacity: 0.2 }),
    candidates: [
      empty,
      createPopulation({ scale: 120, mipExcess: 1.2 }),
      createPopulation({ scale: 160, mipExcess: 1.2 })
    ]
  });
  expect(emptyCandidate.decision).toBe("MIP_DIAGNOSTIC_INCONCLUSIVE_EMPTY_POPULATION");
});

test("packs only valid jointly indexed GPU samples and derives counterfactual mip", async () => {
  const readback = await import(readbackPath);
  const records = readback.packTakramMipDiagnosticOrdinal({
    scale: 80,
    sampleOrdinal: 3,
    color: Float32Array.from([
      100, 1.5, 2.25, 0.4,
      200, 2, 3, 0.1
    ]),
    depthVelocity: Float32Array.from([
      1, 1, 0, 1,
      0, 0, 0, 1
    ]),
    opacity: Float32Array.from([0.3, 0.6]),
    width: 2,
    height: 1
  });

  expect(records).toHaveLength(9);
  expect(Array.from(records.slice(0, 5))).toEqual([0, 3, 100_000, 1.5, 2.25]);
  expect(records[5]).toBeCloseTo(
    Math.log2(Math.max(1, 1.5 + (100_000 / 80) * 1e-5)),
    5
  );
  expect(records[6]).toBeCloseTo(0.4, 5);
  expect(records[7]).toBe(3);
  expect(records[8]).toBeCloseTo(0.3, 5);
});
