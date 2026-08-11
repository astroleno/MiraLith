import type { CloudsEffect } from "@takram/three-clouds";
import { deepFreeze } from "./TakramCloudScaleDefaults";
import type {
  TakramCloudScaleContract,
  TakramCloudScaleDensityProfile,
  TakramCloudScaleLayer
} from "./TakramCloudScaleContract";

interface RuntimeVector3 {
  setScalar(value: number): void;
  x: number;
  y: number;
  z: number;
}

interface RuntimeVector2 {
  set(x: number, y: number): void;
  x: number;
  y: number;
}

interface RuntimeDensityProfile extends TakramCloudScaleDensityProfile {
  copy?(value: TakramCloudScaleDensityProfile): void;
}

interface RuntimeLayer extends Omit<TakramCloudScaleLayer, "densityProfile"> {
  densityProfile: RuntimeDensityProfile;
}

type RuntimeNumericRecord = Record<string, number | undefined>;

interface TakramCloudScaleRuntimeTarget {
  cloudLayers: RuntimeLayer[];
  clouds: RuntimeNumericRecord;
  coverage: number;
  shadow: RuntimeNumericRecord & {
    mapSize?: RuntimeVector2 | readonly [number, number];
  };
  shapeDetailRepeat: RuntimeVector3;
  shapeRepeat: RuntimeVector3;
  turbulenceDisplacement: number;
}

export interface TakramCloudScaleRuntimeReadback {
  readonly classification: TakramCloudScaleContract["classification"];
  readonly clouds: Readonly<Record<string, number | undefined>>;
  readonly coverage: number;
  readonly coverageMode: TakramCloudScaleContract["coverageMode"];
  readonly layers: readonly TakramCloudScaleLayer[];
  readonly mipDistancePatch: TakramCloudScaleContract["mipDistancePatch"];
  readonly scale: TakramCloudScaleContract["scale"];
  readonly schemaVersion: TakramCloudScaleContract["schemaVersion"];
  readonly shadow: Readonly<Record<string, number | readonly [number, number] | undefined>>;
  readonly shapeDetailRepeat: readonly [number, number, number];
  readonly shapeRepeat: readonly [number, number, number];
  readonly turbulenceDisplacement: number;
}

export interface TakramCloudScaleRuntimeDrift {
  readonly actual: unknown;
  readonly expected: unknown;
  readonly path: string;
}

function asRuntimeTarget(clouds: CloudsEffect | TakramCloudScaleRuntimeTarget) {
  return clouds as unknown as TakramCloudScaleRuntimeTarget;
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

/** Apply the complete resolved public contract after the native high preset. */
export function applyTakramCloudScaleRuntime(
  clouds: CloudsEffect | TakramCloudScaleRuntimeTarget,
  contract: TakramCloudScaleContract
): void {
  const target = asRuntimeTarget(clouds);
  target.coverage = contract.coverage;
  target.shapeRepeat.setScalar(contract.shapeRepeat);
  target.shapeDetailRepeat.setScalar(contract.shapeDetailRepeat);
  target.turbulenceDisplacement = contract.turbulenceDisplacement;

  Object.assign(target.clouds, contract.clouds);
  for (const [key, value] of Object.entries(contract.shadow)) {
    if (key !== "mapSize") {
      target.shadow[key] = value as number;
    }
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

function readLayer(layer: RuntimeLayer): TakramCloudScaleLayer {
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

function readNumericRecord(
  target: RuntimeNumericRecord,
  keys: readonly string[]
): Record<string, number | undefined> {
  return Object.fromEntries(keys.map((key) => [key, target[key]]));
}

/** Read actual native state; missing fields remain visible as undefined. */
export function readTakramCloudScaleRuntime(
  clouds: CloudsEffect | TakramCloudScaleRuntimeTarget,
  contract: TakramCloudScaleContract
): Readonly<TakramCloudScaleRuntimeReadback> {
  const target = asRuntimeTarget(clouds);
  const mapSize = target.shadow.mapSize;
  const mapSizeTuple: [number, number] | undefined = isRuntimeVector2(mapSize)
    ? [mapSize.x, mapSize.y]
    : mapSize !== undefined
      ? [mapSize[0], mapSize[1]]
      : undefined;

  return deepFreeze({
    classification: contract.classification,
    clouds: readNumericRecord(target.clouds, Object.keys(contract.clouds)),
    coverage: target.coverage,
    coverageMode: contract.coverageMode,
    layers: contract.layers.map((_, index) => readLayer(target.cloudLayers[index])),
    mipDistancePatch: { ...contract.mipDistancePatch },
    scale: contract.scale,
    schemaVersion: contract.schemaVersion,
    shadow: {
      ...readNumericRecord(
        target.shadow,
        Object.keys(contract.shadow).filter((key) => key !== "mapSize")
      ),
      mapSize: mapSizeTuple
    },
    shapeDetailRepeat: [
      target.shapeDetailRepeat.x,
      target.shapeDetailRepeat.y,
      target.shapeDetailRepeat.z
    ] as [number, number, number],
    shapeRepeat: [
      target.shapeRepeat.x,
      target.shapeRepeat.y,
      target.shapeRepeat.z
    ] as [number, number, number],
    turbulenceDisplacement: target.turbulenceDisplacement
  });
}

function expectedRuntimeReadback(
  contract: TakramCloudScaleContract
): Readonly<TakramCloudScaleRuntimeReadback> {
  return deepFreeze({
    ...contract,
    shapeDetailRepeat: [
      contract.shapeDetailRepeat,
      contract.shapeDetailRepeat,
      contract.shapeDetailRepeat
    ] as [number, number, number],
    shapeRepeat: [
      contract.shapeRepeat,
      contract.shapeRepeat,
      contract.shapeRepeat
    ] as [number, number, number]
  });
}

function collectDrift(
  expected: unknown,
  actual: unknown,
  path: string,
  result: TakramCloudScaleRuntimeDrift[]
) {
  if (Object.is(expected, actual)) return;
  if (expected !== null && actual !== null &&
    typeof expected === "object" && typeof actual === "object") {
    const keys = Array.from(new Set([
      ...Object.keys(expected),
      ...Object.keys(actual)
    ])).sort();
    for (const key of keys) {
      collectDrift(
        (expected as Record<string, unknown>)[key],
        (actual as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key,
        result
      );
    }
    return;
  }
  result.push({ actual, expected, path });
}

export function diffTakramCloudScaleRuntime(
  expected: TakramCloudScaleContract,
  actual: TakramCloudScaleRuntimeReadback
): readonly TakramCloudScaleRuntimeDrift[] {
  const result: TakramCloudScaleRuntimeDrift[] = [];
  collectDrift(expectedRuntimeReadback(expected), actual, "", result);
  return deepFreeze(result);
}
