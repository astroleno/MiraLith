import { expect, test } from "@playwright/test";

const contractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract";
const runtimeModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevRuntime";

async function loadModules() {
  const [contract, runtime] = await Promise.all([
    import(contractModulePath),
    import(runtimeModulePath)
  ]);
  return { contract, runtime };
}

function vector2(x: number, y = x) {
  return {
    x,
    y,
    set(nextX: number, nextY: number) {
      this.x = nextX;
      this.y = nextY;
    }
  };
}

function vector3(value: number) {
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

function createRuntime(resolveTakramOrbitalLookdevContract: any) {
  const native = resolveTakramOrbitalLookdevContract({
    preset: "native",
    coverage: 0.3,
    verticalScale: 1,
    opticalDepthScale: 1
  });
  const target = (name: string) => ({ name, texture: { name: `${name}.texture` } });
  return {
    ...native.renderer,
    ...native.lighting,
    cloudLayers: native.layers.map((layer) => ({
      ...layer,
      densityProfile: {
        ...layer.densityProfile,
        copy(next: Record<string, number>) {
          Object.assign(this, next);
        }
      }
    })),
    clouds: { ...native.clouds },
    shadow: {
      ...native.shadow,
      mapSize: vector2(...native.shadow.mapSize)
    },
    coverage: native.coverage,
    globalWeatherMapping: false,
    localWeatherOffset: vector2(0, 0),
    localWeatherRepeat: vector2(...native.localWeatherRepeat),
    shapeDetailRepeat: vector3(native.shapeDetailRepeat),
    shapeRepeat: vector3(native.shapeRepeat),
    turbulenceDisplacement: native.turbulenceDisplacement,
    turbulenceRepeat: vector2(...native.turbulenceRepeat),
    cloudsPass: {
      currentMaterial: {
        fragmentShader:
          "float mipLevel = log2(max(1.0, rayStartTexelsPerPixel + rayDistance * 1e-5));",
        uniforms: {}
      },
      currentRenderTarget: target("cloud-current"),
      resolveRenderTarget: target("cloud-resolve"),
      historyRenderTarget: target("cloud-history")
    },
    shadowPass: {
      currentRenderTarget: target("shadow-current"),
      resolveRenderTarget: target("shadow-resolve"),
      historyRenderTarget: target("shadow-history")
    }
  };
}

test("applies and reads the complete bounded orbital contract without scaling native ray fields", async () => {
  const { contract: contractModule, runtime: runtimeModule } = await loadModules();
  const { resolveTakramOrbitalLookdevContract } = contractModule;
  const {
    applyTakramOrbitalLookdevRuntime,
    diffTakramOrbitalLookdevRuntime,
    readTakramOrbitalLookdevRuntime
  } = runtimeModule;
  const contract = resolveTakramOrbitalLookdevContract({
    preset: "h80",
    coverage: 0.45,
    verticalScale: 2,
    opticalDepthScale: 1.5
  });
  const runtime = createRuntime(resolveTakramOrbitalLookdevContract);

  applyTakramOrbitalLookdevRuntime(runtime, contract);
  const readback = readTakramOrbitalLookdevRuntime(runtime, contract);

  expect(readback).toMatchObject({
    classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
    schemaVersion: 1,
    preset: "h80",
    coverage: 0.45,
    verticalScale: 2,
    opticalDepthScale: 1.5,
    shapeRepeat: [0.00000375, 0.00000375, 0.00000375],
    shapeDetailRepeat: [0.000075, 0.000075, 0.000075],
    localWeatherRepeat: [1.25, 1.25],
    turbulenceRepeat: [20, 20],
    effectiveTurbulenceRepeat: [25, 25],
    turbulenceDisplacement: 350,
    clouds: contract.clouds,
    shadow: contract.shadow,
    lighting: contract.lighting,
    renderer: contract.renderer,
    layers: contract.layers,
    mipDistancePatch: {
      active: false,
      classification: "native-hardcoded",
      scale: 1,
      runtimeFragmentShaderFnv1a64: expect.stringMatching(/^fnv1a-64:[0-9a-f]{16}$/)
    },
    allocations: {
      clouds: {
        current: expect.any(Number),
        resolve: expect.any(Number),
        history: expect.any(Number)
      },
      shadow: {
        current: expect.any(Number),
        resolve: expect.any(Number),
        history: expect.any(Number)
      }
    }
  });
  expect(readback.clouds.maxRayDistance).toBe(200_000);
  expect(readback.clouds.minStepSize).toBe(50);
  expect(readback.shadow.maxStepSize).toBe(1_000);
  expect(diffTakramOrbitalLookdevRuntime(contract, readback)).toEqual([]);
  expect(Object.isFrozen(readback)).toBe(true);
  expect(Object.isFrozen(readback.allocations.clouds)).toBe(true);
});

test("keeps adapter-owned V3 repeat explicit while preserving the renderer contract", async () => {
  const { contract: contractModule, runtime: runtimeModule } = await loadModules();
  const { resolveTakramOrbitalLookdevContract } = contractModule;
  const {
    applyTakramOrbitalLookdevRuntime,
    diffTakramOrbitalLookdevRuntime,
    readTakramOrbitalLookdevRuntime
  } = runtimeModule;
  const contract = resolveTakramOrbitalLookdevContract({
    preset: "h120",
    coverage: 0.55,
    verticalScale: 4,
    opticalDepthScale: 0.75
  });
  const runtime = createRuntime(resolveTakramOrbitalLookdevContract);
  const adapter = { localWeatherRepeat: [1, 1] as const };

  applyTakramOrbitalLookdevRuntime(runtime, contract, adapter);
  const readback = readTakramOrbitalLookdevRuntime(runtime, contract);

  expect(readback.localWeatherRepeat).toEqual([1, 1]);
  expect(readback.effectiveTurbulenceRepeat).toEqual([20, 20]);
  expect(readback.shapeRepeat).toEqual([
    contract.shapeRepeat,
    contract.shapeRepeat,
    contract.shapeRepeat
  ]);
  expect(diffTakramOrbitalLookdevRuntime(contract, readback, adapter)).toEqual([]);
});

test("assigns stable allocation generations and changes all six for a fresh composer", async () => {
  const { contract: contractModule, runtime: runtimeModule } = await loadModules();
  const { resolveTakramOrbitalLookdevContract } = contractModule;
  const {
    applyTakramOrbitalLookdevRuntime,
    readTakramOrbitalLookdevRuntime
  } = runtimeModule;
  const contract = resolveTakramOrbitalLookdevContract({
    preset: "h40",
    coverage: 0.3,
    verticalScale: 1,
    opticalDepthScale: 1
  });
  const firstRuntime = createRuntime(resolveTakramOrbitalLookdevContract);
  applyTakramOrbitalLookdevRuntime(firstRuntime, contract);
  const first = readTakramOrbitalLookdevRuntime(firstRuntime, contract);
  const repeated = readTakramOrbitalLookdevRuntime(firstRuntime, contract);
  expect(repeated.allocations).toEqual(first.allocations);

  const remountedRuntime = createRuntime(resolveTakramOrbitalLookdevContract);
  applyTakramOrbitalLookdevRuntime(remountedRuntime, contract);
  const remounted = readTakramOrbitalLookdevRuntime(remountedRuntime, contract);
  const previous = [
    ...Object.values(first.allocations.clouds),
    ...Object.values(first.allocations.shadow)
  ];
  const next = [
    ...Object.values(remounted.allocations.clouds),
    ...Object.values(remounted.allocations.shadow)
  ];
  expect(next.every((generation) => !previous.includes(generation))).toBe(true);
});

test("reports canonical drift for every tuned or frozen renderer field", async () => {
  const { contract: contractModule, runtime: runtimeModule } = await loadModules();
  const { resolveTakramOrbitalLookdevContract } = contractModule;
  const {
    applyTakramOrbitalLookdevRuntime,
    diffTakramOrbitalLookdevRuntime,
    readTakramOrbitalLookdevRuntime
  } = runtimeModule;
  const contract = resolveTakramOrbitalLookdevContract({
    preset: "h40",
    coverage: 0.4,
    verticalScale: 2,
    opticalDepthScale: 1
  });
  const runtime = createRuntime(resolveTakramOrbitalLookdevContract);
  applyTakramOrbitalLookdevRuntime(runtime, contract);
  runtime.clouds.maxRayDistance += 1;
  runtime.cloudLayers[1].densityScale *= 2;
  runtime.localWeatherRepeat.y *= 2;
  runtime.shapeRepeat.z *= 2;
  runtime.turbulenceRepeat.x = 21;
  runtime.skyLightScale = 0.5;

  const drift = diffTakramOrbitalLookdevRuntime(
    contract,
    readTakramOrbitalLookdevRuntime(runtime, contract)
  );
  expect(drift.map((entry) => entry.path)).toEqual([
    "clouds.maxRayDistance",
    "effectiveTurbulenceRepeat.0",
    "effectiveTurbulenceRepeat.1",
    "layers.1.densityScale",
    "lighting.skyLightScale",
    "localWeatherRepeat.1",
    "shapeRepeat.2",
    "turbulenceRepeat.0"
  ]);
  expect(drift.find((entry) => entry.path === "clouds.maxRayDistance"))
    .toEqual({ actual: 200_001, expected: 200_000, path: "clouds.maxRayDistance" });
});
