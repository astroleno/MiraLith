import {
  deepFreeze,
  TAKRAM_CLOUD_SCALE_COVERAGE,
  TAKRAM_CLOUD_SCALE_DEFAULTS,
  TAKRAM_CLOUD_SCALE_VALUES
} from "./TakramCloudScaleDefaults";

export {
  TAKRAM_CLOUD_SCALE_COVERAGE,
  TAKRAM_CLOUD_SCALE_DEFAULTS,
  TAKRAM_CLOUD_SCALE_VALUES
} from "./TakramCloudScaleDefaults";

export type TakramCloudScale = (typeof TAKRAM_CLOUD_SCALE_VALUES)[number];
export type TakramCloudCoverageMode = keyof typeof TAKRAM_CLOUD_SCALE_COVERAGE;
export type TakramCloudScaleClassification = "PUBLIC_PARAMETER_SIMILARITY";
export type TakramCloudScaleChannel = "r" | "g" | "b" | "a";
export type TakramStockWeatherControlMode = "unscaled" | "similarity";
export type TakramStockWeatherControlClassification =
  | "UNSCALED_STOCK_WEATHER_CONTROL"
  | "SCALED_STOCK_WEATHER_CONTROL";

export interface TakramStockWeatherControlContract {
  readonly classification: TakramStockWeatherControlClassification;
  readonly mode: TakramStockWeatherControlMode;
  readonly repeat: readonly [number, number];
  readonly scale: TakramCloudScale;
  readonly sourceRepeat: readonly [100, 100];
}

export interface TakramCloudScaleDensityProfile {
  readonly constantTerm: number;
  readonly exponent: number;
  readonly expTerm: number;
  readonly linearTerm: number;
}

export interface TakramCloudScaleLayer {
  readonly altitude: number;
  readonly channel: TakramCloudScaleChannel;
  readonly coverageFilterWidth: number;
  readonly densityProfile: TakramCloudScaleDensityProfile;
  readonly densityScale: number;
  readonly height: number;
  readonly shadow: boolean;
  readonly shapeAlteringBias: number;
  readonly shapeAmount: number;
  readonly shapeDetailAmount: number;
  readonly weatherExponent: number;
}

export interface TakramCloudScaleContract {
  readonly classification: TakramCloudScaleClassification;
  readonly clouds: Readonly<{
    maxIterationCount: number;
    maxIterationCountToGround: number;
    maxIterationCountToSun: number;
    maxRayDistance: number;
    maxShadowFilterRadius: number;
    maxShadowLengthIterationCount: number;
    maxShadowLengthRayDistance: number;
    maxStepSize: number;
    minDensity: number;
    minExtinction: number;
    minSecondaryStepSize: number;
    minShadowLengthStepSize: number;
    minStepSize: number;
    minTransmittance: number;
    perspectiveStepScale: number;
    secondaryStepScale: number;
  }>;
  readonly coverage: number;
  readonly coverageMode: TakramCloudCoverageMode;
  readonly layers: readonly TakramCloudScaleLayer[];
  readonly mipDistancePatch: Readonly<{
    active: false;
    scale: 1;
  }>;
  readonly scale: TakramCloudScale;
  readonly schemaVersion: 1;
  readonly shadow: Readonly<{
    cascadeCount: number;
    mapSize: readonly [number, number];
    maxIterationCount: number;
    maxStepSize: number;
    minDensity: number;
    minExtinction: number;
    minStepSize: number;
    minTransmittance: number;
  }>;
  readonly shapeDetailRepeat: number;
  readonly shapeRepeat: number;
  readonly turbulenceDisplacement: number;
}

export interface TakramCloudScaleAtmosphereDomain {
  readonly atmosphereHeight: number;
  readonly layersExceedingAtmosphere: readonly TakramCloudScaleChannel[];
  readonly physicalAerialPerspectiveParityClaim: false;
  readonly presentationDomain: "artistic-orbital";
}

export function parseTakramCloudScale(value: string | null): TakramCloudScale | null {
  if (value === null || !/^(80|120|160)$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return TAKRAM_CLOUD_SCALE_VALUES.includes(parsed as TakramCloudScale)
    ? parsed as TakramCloudScale
    : null;
}

export function parseTakramCloudCoverageMode(
  value: string | null
): TakramCloudCoverageMode | null {
  return value === "parity" || value === "presentation" ? value : null;
}

export function parseTakramStockWeatherControlMode(
  value: string | null
): TakramStockWeatherControlMode | null {
  return value === "unscaled" || value === "similarity" ? value : null;
}

export function resolveTakramStockWeatherControl(input: {
  mode: TakramStockWeatherControlMode;
  scale: TakramCloudScale;
}): Readonly<TakramStockWeatherControlContract> {
  const repeat = input.mode === "similarity" ? 100 / input.scale : 100;
  return deepFreeze({
    classification: input.mode === "similarity"
      ? "SCALED_STOCK_WEATHER_CONTROL"
      : "UNSCALED_STOCK_WEATHER_CONTROL",
    mode: input.mode,
    repeat: [repeat, repeat] as [number, number],
    scale: input.scale,
    sourceRepeat: [100, 100] as [100, 100]
  });
}

export function resolveTakramCloudScaleContract(input: {
  coverageMode: TakramCloudCoverageMode;
  scale: TakramCloudScale;
}): Readonly<TakramCloudScaleContract> {
  const { scale, coverageMode } = input;
  const layers = TAKRAM_CLOUD_SCALE_DEFAULTS.layers.map((layer) => ({
    ...layer,
    densityProfile: { ...layer.densityProfile },
    densityScale: layer.densityScale / scale,
    height: layer.height * scale
  }));
  const clouds = TAKRAM_CLOUD_SCALE_DEFAULTS.clouds;
  const shadow = TAKRAM_CLOUD_SCALE_DEFAULTS.shadow;

  return deepFreeze({
    classification: "PUBLIC_PARAMETER_SIMILARITY",
    clouds: {
      ...clouds,
      maxRayDistance: clouds.maxRayDistance * scale,
      maxShadowLengthRayDistance: clouds.maxShadowLengthRayDistance * scale,
      maxStepSize: clouds.maxStepSize * scale,
      minExtinction: clouds.minExtinction / scale,
      minSecondaryStepSize: clouds.minSecondaryStepSize * scale,
      minShadowLengthStepSize: clouds.minShadowLengthStepSize * scale,
      minStepSize: clouds.minStepSize * scale
    },
    coverage: TAKRAM_CLOUD_SCALE_COVERAGE[coverageMode],
    coverageMode,
    layers,
    mipDistancePatch: {
      active: false,
      scale: 1
    },
    scale,
    schemaVersion: 1,
    shadow: {
      ...shadow,
      mapSize: [...shadow.mapSize] as [number, number],
      maxStepSize: shadow.maxStepSize * scale,
      minExtinction: shadow.minExtinction / scale,
      minStepSize: shadow.minStepSize * scale
    },
    shapeDetailRepeat: TAKRAM_CLOUD_SCALE_DEFAULTS.shapeDetailRepeat / scale,
    shapeRepeat: TAKRAM_CLOUD_SCALE_DEFAULTS.shapeRepeat / scale,
    turbulenceDisplacement: TAKRAM_CLOUD_SCALE_DEFAULTS.turbulenceDisplacement * scale
  });
}

export function resolveTakramCloudScaleAtmosphereDomain(input: {
  bottomRadius: number;
  contract: TakramCloudScaleContract;
  topRadius: number;
}): Readonly<TakramCloudScaleAtmosphereDomain> {
  const atmosphereHeight = Math.max(0, input.topRadius - input.bottomRadius);
  const layersExceedingAtmosphere = input.contract.layers
    .filter((layer) => layer.height > 0 && layer.altitude + layer.height > atmosphereHeight)
    .map((layer) => layer.channel);

  return deepFreeze({
    atmosphereHeight,
    layersExceedingAtmosphere,
    physicalAerialPerspectiveParityClaim: false,
    presentationDomain: "artistic-orbital"
  });
}
