import type { CloudsEffect } from "@takram/three-clouds";
import { deepFreeze, type DeepReadonly } from "./TakramCloudScaleDefaults";
import { readTakramMipDistanceRuntime } from "./TakramCloudScaleRuntime";
import type { TakramCloudScaleDensityProfile } from "./TakramCloudScaleContract";
import type {
  TakramOrbitalLightingContract,
  TakramOrbitalLookdevContract,
  TakramOrbitalRendererContract
} from "./TakramOrbitalLookdevContract";

interface RuntimeVector2 {
  set(x: number, y: number): void;
  x: number;
  y: number;
}

interface RuntimeVector3 {
  setScalar(value: number): void;
  x: number;
  y: number;
  z: number;
}

interface RuntimeDensityProfile extends TakramCloudScaleDensityProfile {
  copy?(value: TakramCloudScaleDensityProfile): void;
}

type RuntimeLayer = Omit<TakramOrbitalLookdevContract["layers"][number],
  "densityProfile"> & { densityProfile: RuntimeDensityProfile };
type NumericRecord = Record<string, number | boolean | string | undefined>;
type RenderTargetRecord = object | null | undefined;

interface RuntimePassTargets {
  currentRenderTarget?: RenderTargetRecord;
  historyRenderTarget?: RenderTargetRecord;
  resolveRenderTarget?: RenderTargetRecord;
}

interface TakramOrbitalRuntimeTarget {
  cloudLayers: RuntimeLayer[];
  clouds: NumericRecord;
  cloudsPass?: RuntimePassTargets & {
    currentMaterial?: {
      fragmentShader?: string;
      uniforms?: Record<string, { value?: unknown } | undefined>;
    };
  };
  coverage: number;
  globalWeatherMapping?: boolean;
  localWeatherOffset: RuntimeVector2;
  localWeatherRepeat: RuntimeVector2;
  shadow: NumericRecord & {
    mapSize?: RuntimeVector2 | readonly [number, number];
  };
  shadowPass?: RuntimePassTargets;
  shapeDetailRepeat: RuntimeVector3;
  shapeRepeat: RuntimeVector3;
  turbulenceDisplacement: number;
  turbulenceRepeat: RuntimeVector2;
}

export interface TakramOrbitalRuntimeAdapterExpectation {
  readonly globalWeatherMapping: boolean;
  readonly localWeatherOffset: readonly [number, number];
  readonly localWeatherRepeat: readonly [number, number];
}

function nativeAdapterExpectation(
  contract: TakramOrbitalLookdevContract
): TakramOrbitalRuntimeAdapterExpectation {
  return {
    globalWeatherMapping: false,
    localWeatherOffset: [0, 0],
    localWeatherRepeat: contract.localWeatherRepeat
  };
}

export interface TakramOrbitalAllocationGenerations {
  readonly clouds: Readonly<{
    current: number | null;
    history: number | null;
    resolve: number | null;
  }>;
  readonly shadow: Readonly<{
    current: number | null;
    history: number | null;
    resolve: number | null;
  }>;
}

export interface TakramOrbitalLookdevRuntimeReadback {
  readonly allocations: TakramOrbitalAllocationGenerations;
  readonly classification: TakramOrbitalLookdevContract["classification"];
  readonly clouds: Readonly<Record<string, boolean | number | string | undefined>>;
  readonly coverage: number;
  readonly effectiveTurbulenceRepeat: readonly [number, number];
  readonly globalWeatherMapping: boolean | undefined;
  readonly layers: TakramOrbitalLookdevContract["layers"];
  readonly lighting: TakramOrbitalLightingContract;
  readonly localWeatherOffset: readonly [number, number];
  readonly localWeatherRepeat: readonly [number, number];
  readonly mipDistancePatch: ReturnType<typeof readTakramMipDistanceRuntime>;
  readonly opticalDepthScale: TakramOrbitalLookdevContract["opticalDepthScale"];
  readonly preset: TakramOrbitalLookdevContract["preset"];
  readonly renderer: TakramOrbitalRendererContract;
  readonly schemaVersion: TakramOrbitalLookdevContract["schemaVersion"];
  readonly shadow: Readonly<Record<
    string,
    boolean | number | string | readonly [number, number] | undefined
  >>;
  readonly shapeDetailRepeat: readonly [number, number, number];
  readonly shapeRepeat: readonly [number, number, number];
  readonly turbulenceDisplacement: number;
  readonly turbulenceRepeat: readonly [number, number];
  readonly verticalScale: TakramOrbitalLookdevContract["verticalScale"];
}

export interface TakramOrbitalLookdevRuntimeDrift {
  readonly actual: unknown;
  readonly expected: unknown;
  readonly path: string;
}

const allocationGenerations = new WeakMap<object, number>();
const appliedQualityPresets = new WeakMap<
  object,
  TakramOrbitalRendererContract["qualityPreset"]
>();
let nextAllocationGeneration = 1;

function allocationGeneration(target: RenderTargetRecord) {
  if (target === null || target === undefined) return null;
  const existing = allocationGenerations.get(target);
  if (existing !== undefined) return existing;
  const generation = nextAllocationGeneration;
  nextAllocationGeneration += 1;
  allocationGenerations.set(target, generation);
  return generation;
}

function asRuntimeTarget(
  clouds: CloudsEffect | TakramOrbitalRuntimeTarget
): TakramOrbitalRuntimeTarget {
  return clouds as unknown as TakramOrbitalRuntimeTarget;
}

function isRuntimeVector2(
  value: RuntimeVector2 | readonly [number, number] | undefined
): value is RuntimeVector2 {
  return value !== undefined && !Array.isArray(value) &&
    typeof (value as RuntimeVector2).set === "function";
}

function assignDensityProfile(
  target: RuntimeLayer,
  source: TakramCloudScaleDensityProfile
) {
  if (typeof target.densityProfile?.copy === "function") {
    target.densityProfile.copy(source);
  } else {
    target.densityProfile = { ...source };
  }
}

function readLayer(layer: RuntimeLayer) {
  return {
    altitude: layer?.altitude,
    channel: layer?.channel,
    coverageFilterWidth: layer?.coverageFilterWidth,
    densityProfile: {
      constantTerm: layer?.densityProfile?.constantTerm,
      exponent: layer?.densityProfile?.exponent,
      expTerm: layer?.densityProfile?.expTerm,
      linearTerm: layer?.densityProfile?.linearTerm
    },
    densityScale: layer?.densityScale,
    height: layer?.height,
    shadow: layer?.shadow,
    shapeAlteringBias: layer?.shapeAlteringBias,
    shapeAmount: layer?.shapeAmount,
    shapeDetailAmount: layer?.shapeDetailAmount,
    weatherExponent: layer?.weatherExponent
  };
}

function readRecord(
  target: NumericRecord,
  keys: readonly string[]
): Record<string, boolean | number | string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, target[key]]));
}

function readLighting(target: TakramOrbitalRuntimeTarget) {
  const values = target as unknown as NumericRecord;
  const keys = [
    "absorptionCoefficient",
    "groundBounceScale",
    "powderExponent",
    "powderScale",
    "scatterAnisotropy1",
    "scatterAnisotropy2",
    "scatterAnisotropyMix",
    "scatteringCoefficient",
    "skyLightScale"
  ] as const;
  return Object.fromEntries(keys.map((key) => [key, values[key]])) as unknown as
    TakramOrbitalLightingContract;
}

function readRenderer(target: TakramOrbitalRuntimeTarget) {
  const values = target as unknown as NumericRecord;
  const keys = [
    "accuratePhaseFunction",
    "accurateSunSkyLight",
    "haze",
    "lightShafts",
    "multiScatteringOctaves",
    "resolutionScale",
    "shapeDetail",
    "temporalUpscale",
    "turbulence"
  ] as const;
  return {
    ...Object.fromEntries(keys.map((key) => [key, values[key]])),
    // Takram exposes qualityPreset as a setter-only macro. Record its applied
    // provenance while the materialized fields remain the drift authority.
    qualityPreset: values.qualityPreset ?? appliedQualityPresets.get(target)
  } as unknown as TakramOrbitalRendererContract;
}

export function readTakramOrbitalAllocationGenerations(
  clouds: CloudsEffect | TakramOrbitalRuntimeTarget
): DeepReadonly<TakramOrbitalAllocationGenerations> {
  const target = asRuntimeTarget(clouds);
  const readPass = (pass: RuntimePassTargets | undefined) => ({
    current: allocationGeneration(pass?.currentRenderTarget),
    history: allocationGeneration(pass?.historyRenderTarget),
    resolve: allocationGeneration(pass?.resolveRenderTarget)
  });
  return deepFreeze({
    clouds: readPass(target.cloudsPass),
    shadow: readPass(target.shadowPass)
  });
}

/** Apply the resolved public contract after Takram's native high preset. */
export function applyTakramOrbitalLookdevRuntime(
  clouds: CloudsEffect | TakramOrbitalRuntimeTarget,
  contract: TakramOrbitalLookdevContract,
  adapter: TakramOrbitalRuntimeAdapterExpectation = nativeAdapterExpectation(contract)
): void {
  const target = asRuntimeTarget(clouds);
  target.coverage = contract.coverage;
  target.globalWeatherMapping = adapter.globalWeatherMapping;
  target.localWeatherOffset.set(...adapter.localWeatherOffset);
  target.localWeatherRepeat.set(...adapter.localWeatherRepeat);
  target.shapeRepeat.setScalar(contract.shapeRepeat);
  target.shapeDetailRepeat.setScalar(contract.shapeDetailRepeat);
  target.turbulenceRepeat.set(...contract.turbulenceRepeat);
  target.turbulenceDisplacement = contract.turbulenceDisplacement;

  Object.assign(target, contract.lighting, contract.renderer);
  appliedQualityPresets.set(target, contract.renderer.qualityPreset);
  // Takram's qualityPreset setter reapplies its stock clouds/shadow values.
  // Apply the resolved experiment contract after that macro setter so bounded
  // per-field overrides remain authoritative in the materialized runtime.
  Object.assign(target.clouds, contract.clouds);
  for (const [key, value] of Object.entries(contract.shadow)) {
    if (key !== "mapSize") target.shadow[key] = value as number;
  }
  const mapSize = target.shadow.mapSize;
  if (isRuntimeVector2(mapSize)) {
    mapSize.set(...contract.shadow.mapSize);
  } else {
    target.shadow.mapSize = [...contract.shadow.mapSize];
  }

  for (const [index, source] of contract.layers.entries()) {
    const targetLayer = target.cloudLayers[index];
    if (!targetLayer) continue;
    const { densityProfile, ...properties } = source;
    Object.assign(targetLayer, properties);
    assignDensityProfile(targetLayer, densityProfile);
  }
}

export function readTakramOrbitalLookdevRuntime(
  clouds: CloudsEffect | TakramOrbitalRuntimeTarget,
  contract: TakramOrbitalLookdevContract
): DeepReadonly<TakramOrbitalLookdevRuntimeReadback> {
  const target = asRuntimeTarget(clouds);
  const mapSize = target.shadow.mapSize;
  const mapSizeTuple: [number, number] | undefined = isRuntimeVector2(mapSize)
    ? [mapSize.x, mapSize.y]
    : mapSize === undefined
      ? undefined
      : [...mapSize];
  const localWeatherRepeat = [
    target.localWeatherRepeat.x,
    target.localWeatherRepeat.y
  ] as [number, number];
  const turbulenceRepeat = [
    target.turbulenceRepeat.x,
    target.turbulenceRepeat.y
  ] as [number, number];

  return deepFreeze({
    allocations: readTakramOrbitalAllocationGenerations(target),
    classification: contract.classification,
    clouds: readRecord(target.clouds, Object.keys(contract.clouds)),
    coverage: target.coverage,
    effectiveTurbulenceRepeat: [
      localWeatherRepeat[0] * turbulenceRepeat[0],
      localWeatherRepeat[1] * turbulenceRepeat[1]
    ],
    globalWeatherMapping: target.globalWeatherMapping,
    layers: target.cloudLayers.map(readLayer),
    lighting: readLighting(target),
    localWeatherOffset: [target.localWeatherOffset.x, target.localWeatherOffset.y],
    localWeatherRepeat,
    mipDistancePatch: readTakramMipDistanceRuntime(target),
    opticalDepthScale: contract.opticalDepthScale,
    preset: contract.preset,
    renderer: readRenderer(target),
    schemaVersion: contract.schemaVersion,
    shadow: {
      ...readRecord(target.shadow, Object.keys(contract.shadow).filter(
        (key) => key !== "mapSize"
      )),
      mapSize: mapSizeTuple
    },
    shapeDetailRepeat: [
      target.shapeDetailRepeat.x,
      target.shapeDetailRepeat.y,
      target.shapeDetailRepeat.z
    ],
    shapeRepeat: [
      target.shapeRepeat.x,
      target.shapeRepeat.y,
      target.shapeRepeat.z
    ],
    turbulenceDisplacement: target.turbulenceDisplacement,
    turbulenceRepeat,
    verticalScale: contract.verticalScale
  });
}

function collectDrift(
  path: string,
  expected: unknown,
  actual: unknown,
  output: TakramOrbitalLookdevRuntimeDrift[]
) {
  if (Array.isArray(expected)) {
    for (let index = 0; index < expected.length; index += 1) {
      collectDrift(`${path}.${index}`, expected[index],
        Array.isArray(actual) ? actual[index] : undefined, output);
    }
    return;
  }
  if (expected !== null && typeof expected === "object") {
    for (const key of Object.keys(expected as Record<string, unknown>).sort()) {
      collectDrift(path ? `${path}.${key}` : key,
        (expected as Record<string, unknown>)[key],
        actual !== null && typeof actual === "object"
          ? (actual as Record<string, unknown>)[key]
          : undefined,
        output);
    }
    return;
  }
  if (!Object.is(expected, actual)) {
    output.push({ actual, expected, path });
  }
}

export function diffTakramOrbitalLookdevRuntime(
  contract: TakramOrbitalLookdevContract,
  readback: TakramOrbitalLookdevRuntimeReadback,
  adapter: TakramOrbitalRuntimeAdapterExpectation = nativeAdapterExpectation(contract)
): DeepReadonly<readonly TakramOrbitalLookdevRuntimeDrift[]> {
  const expected = {
    classification: contract.classification,
    clouds: contract.clouds,
    coverage: contract.coverage,
    effectiveTurbulenceRepeat: [
      adapter.localWeatherRepeat[0] * contract.turbulenceRepeat[0],
      adapter.localWeatherRepeat[1] * contract.turbulenceRepeat[1]
    ],
    globalWeatherMapping: adapter.globalWeatherMapping,
    layers: contract.layers,
    lighting: contract.lighting,
    localWeatherOffset: adapter.localWeatherOffset,
    localWeatherRepeat: adapter.localWeatherRepeat,
    mipDistancePatch: {
      active: false,
      classification: "native-hardcoded",
      scale: 1
    },
    opticalDepthScale: contract.opticalDepthScale,
    preset: contract.preset,
    renderer: contract.renderer,
    schemaVersion: contract.schemaVersion,
    shadow: contract.shadow,
    shapeDetailRepeat: [
      contract.shapeDetailRepeat,
      contract.shapeDetailRepeat,
      contract.shapeDetailRepeat
    ],
    shapeRepeat: [contract.shapeRepeat, contract.shapeRepeat, contract.shapeRepeat],
    turbulenceDisplacement: contract.turbulenceDisplacement,
    turbulenceRepeat: contract.turbulenceRepeat,
    verticalScale: contract.verticalScale
  };
  const drift: TakramOrbitalLookdevRuntimeDrift[] = [];
  collectDrift("", expected, readback, drift);
  return deepFreeze(drift.sort((left, right) => left.path.localeCompare(right.path)));
}
