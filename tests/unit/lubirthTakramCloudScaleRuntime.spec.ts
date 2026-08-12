import { expect, test } from "@playwright/test";

const contractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleContract";
const runtimeModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleRuntime";

function createScalarVector(value: number) {
  return {
    x: value,
    y: value,
    z: value,
    setScalar(next: number) {
      this.x = next;
      this.y = next;
      this.z = next;
    }
  };
}

function createMapSize(x: number, y: number) {
  return {
    x,
    y,
    set(nextX: number, nextY: number) {
      this.x = nextX;
      this.y = nextY;
    }
  };
}

function createRuntime(defaults: any) {
  return {
    cloudLayers: defaults.layers.map((layer: any) => ({
      ...layer,
      densityProfile: {
        ...layer.densityProfile,
        copy(next: any) {
          Object.assign(this, next);
        }
      }
    })),
    clouds: { ...defaults.clouds },
    cloudsPass: {
      currentMaterial: {
        fragmentShader:
          "float mipLevel = log2(max(1.0, rayStartTexelsPerPixel + rayDistance * 1e-5));",
        uniforms: {}
      }
    },
    coverage: 0.3,
    shadow: {
      ...defaults.shadow,
      mapSize: createMapSize(...defaults.shadow.mapSize)
    },
    shapeDetailRepeat: createScalarVector(defaults.shapeDetailRepeat),
    shapeRepeat: createScalarVector(defaults.shapeRepeat),
    turbulenceDisplacement: defaults.turbulenceDisplacement
  };
}

test("applies and reads back the complete public-parameter similarity contract", async () => {
  const contractModule = await import(contractModulePath);
  const runtimeModule = await import(runtimeModulePath);
  const contract = contractModule.resolveTakramCloudScaleContract({
    coverageMode: "presentation",
    scale: 120
  });
  const runtime = createRuntime(contractModule.TAKRAM_CLOUD_SCALE_DEFAULTS);

  runtimeModule.applyTakramCloudScaleRuntime(runtime, contract);
  const readback = runtimeModule.readTakramCloudScaleRuntime(runtime, contract);

  expect(readback).toMatchObject({
    classification: "PUBLIC_PARAMETER_SIMILARITY",
    clouds: contract.clouds,
    coverage: 0.55,
    coverageMode: "presentation",
    layers: contract.layers,
    mipDistancePatch: {
      active: false,
      classification: "native-hardcoded",
      scale: 1,
      nativeCoefficientOccurrences: 1,
      patchedCoefficientOccurrences: 0,
      runtimeFragmentShaderFnv1a64: expect.stringMatching(/^fnv1a-64:[0-9a-f]{16}$/),
      auditedArtifacts: {
        installedBuildSharedSha256: "c2115702324e01760429187faf6203c2a118812c508429edbebe37e2e1d7c018",
        installedCloudsFragmentSha256: "b29eeac1f5edc205cc578edf2a711aa2ffc8b50e1ea835e8b1abb50de68b77ff",
        packagePatchSha256: "2bfa2dd78d4e9ac82c82eddba1273f9d2f95e932b7021584ce840f497b4f745c"
      }
    },
    scale: 120,
    schemaVersion: 1,
    shadow: contract.shadow,
    shapeDetailRepeat: [contract.shapeDetailRepeat, contract.shapeDetailRepeat, contract.shapeDetailRepeat],
    shapeRepeat: [contract.shapeRepeat, contract.shapeRepeat, contract.shapeRepeat],
    turbulenceDisplacement: 350 * 120
  });
  expect(runtimeModule.diffTakramCloudScaleRuntime(contract, readback)).toEqual([]);
  expect(Object.isFrozen(readback)).toBe(true);
  expect(Object.isFrozen(readback.layers)).toBe(true);
});

test("derives mip patch state from the actual runtime shader and uniform", async () => {
  const contractModule = await import(contractModulePath);
  const runtimeModule = await import(runtimeModulePath);
  const contract = contractModule.resolveTakramCloudScaleContract({
    coverageMode: "parity",
    scale: 80
  });
  const runtime = createRuntime(contractModule.TAKRAM_CLOUD_SCALE_DEFAULTS);
  runtimeModule.applyTakramCloudScaleRuntime(runtime, contract);

  runtime.cloudsPass.currentMaterial.fragmentShader = [
    "uniform float mipDistanceScale;",
    "float mipLevel = log2(max(1.0, rayStartTexelsPerPixel +",
    "  rayDistance * 1e-5 * mipDistanceScale));"
  ].join("\n");
  runtime.cloudsPass.currentMaterial.uniforms.mipDistanceScale = { value: 1 / 80 };
  const patched = runtimeModule.readTakramCloudScaleRuntime(runtime, contract);
  expect(patched.mipDistancePatch).toMatchObject({
    active: true,
    classification: "uniform-patched",
    nativeCoefficientOccurrences: 1,
    patchedCoefficientOccurrences: 1,
    scale: 1 / 80
  });
  expect(runtimeModule.diffTakramCloudScaleRuntime(contract, patched).map(
    (entry: { path: string }) => entry.path
  )).toEqual([
    "mipDistancePatch.active",
    "mipDistancePatch.classification",
    "mipDistancePatch.scale"
  ]);

  runtime.cloudsPass.currentMaterial.fragmentShader = "void main() {}";
  delete runtime.cloudsPass.currentMaterial.uniforms.mipDistanceScale;
  const unknown = runtimeModule.readTakramCloudScaleRuntime(runtime, contract);
  expect(unknown.mipDistancePatch).toMatchObject({
    active: null,
    classification: "unknown",
    nativeCoefficientOccurrences: 0,
    patchedCoefficientOccurrences: 0,
    scale: null
  });
});

test("applies both extinction thresholds while preserving fixed density and iteration fields", async () => {
  const contractModule = await import(contractModulePath);
  const runtimeModule = await import(runtimeModulePath);
  const contract = contractModule.resolveTakramCloudScaleContract({
    coverageMode: "parity",
    scale: 80
  });
  const runtime = createRuntime(contractModule.TAKRAM_CLOUD_SCALE_DEFAULTS);

  runtime.clouds.minDensity = 99;
  runtime.clouds.maxIterationCount = 99;
  runtime.clouds.secondaryStepScale = 99;
  runtime.shadow.minDensity = 99;
  runtime.shadow.maxIterationCount = 99;
  runtimeModule.applyTakramCloudScaleRuntime(runtime, contract);

  expect(runtime.clouds.minExtinction).toBeCloseTo(1e-5 / 80);
  expect(runtime.shadow.minExtinction).toBeCloseTo(1e-5 / 80);
  expect(runtime.clouds.minDensity).toBe(1e-5);
  expect(runtime.shadow.minDensity).toBe(1e-5);
  expect(runtime.clouds.maxIterationCount).toBe(500);
  expect(runtime.shadow.maxIterationCount).toBe(50);
  expect(runtime.clouds.secondaryStepScale).toBe(2);
  expect(runtime.shadow.cascadeCount).toBe(3);
  expect([runtime.shadow.mapSize.x, runtime.shadow.mapSize.y]).toEqual([512, 512]);
});

test("reports every non-adapter runtime drift instead of hiding missing fields", async () => {
  const contractModule = await import(contractModulePath);
  const runtimeModule = await import(runtimeModulePath);
  const contract = contractModule.resolveTakramCloudScaleContract({
    coverageMode: "parity",
    scale: 160
  });
  const runtime = createRuntime(contractModule.TAKRAM_CLOUD_SCALE_DEFAULTS);
  runtimeModule.applyTakramCloudScaleRuntime(runtime, contract);

  runtime.clouds.maxRayDistance += 1;
  runtime.shadow.minExtinction = undefined;
  runtime.cloudLayers[2].densityScale *= 2;
  runtime.shapeDetailRepeat.y *= 2;
  const drift = runtimeModule.diffTakramCloudScaleRuntime(
    contract,
    runtimeModule.readTakramCloudScaleRuntime(runtime, contract)
  );

  expect(drift.map((entry: { path: string }) => entry.path)).toEqual([
    "clouds.maxRayDistance",
    "layers.2.densityScale",
    "shadow.minExtinction",
    "shapeDetailRepeat.1"
  ]);
  expect(drift.find((entry: { path: string }) => entry.path === "shadow.minExtinction"))
    .toMatchObject({ actual: undefined, expected: 1e-5 / 160 });
});
