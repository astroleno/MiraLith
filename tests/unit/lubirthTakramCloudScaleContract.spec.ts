import { expect, test } from "@playwright/test";

type CloudScale = 80 | 120 | 160;
type CoverageMode = "parity" | "presentation";

interface CloudLayerContract {
  altitude: number;
  channel: "r" | "g" | "b" | "a";
  coverageFilterWidth: number;
  densityProfile: {
    constantTerm: number;
    exponent: number;
    expTerm: number;
    linearTerm: number;
  };
  densityScale: number;
  height: number;
  shadow: boolean;
  shapeAlteringBias: number;
  shapeAmount: number;
  shapeDetailAmount: number;
  weatherExponent: number;
}

interface CloudScaleContract {
  classification: "PUBLIC_PARAMETER_SIMILARITY";
  clouds: Record<string, number>;
  coverage: number;
  coverageMode: CoverageMode;
  layers: readonly CloudLayerContract[];
  mipDistancePatch: {
    active: false;
    scale: 1;
  };
  scale: CloudScale;
  schemaVersion: 1;
  shadow: Record<string, number | readonly [number, number]>;
  shapeDetailRepeat: number;
  shapeRepeat: number;
  turbulenceDisplacement: number;
}

interface CloudScaleContractModule {
  TAKRAM_CLOUD_SCALE_DEFAULTS: {
    clouds: Record<string, number>;
    layers: readonly CloudLayerContract[];
    shadow: Record<string, number | readonly [number, number]>;
    shapeDetailRepeat: number;
    shapeRepeat: number;
    source: {
      package: "@takram/three-clouds";
      qualityPreset: "high";
      version: "0.7.6";
    };
    turbulenceDisplacement: number;
  };
  parseTakramCloudCoverageMode(value: string | null): CoverageMode | null;
  parseTakramCloudScale(value: string | null): CloudScale | null;
  parseTakramStockWeatherControlMode(value: string | null): "unscaled" | "similarity" | null;
  resolveTakramCloudScaleAtmosphereDomain(input: {
    bottomRadius: number;
    contract: CloudScaleContract;
    topRadius: number;
  }): {
    atmosphereHeight: number;
    presentationDomain: "artistic-orbital";
    physicalAerialPerspectiveParityClaim: false;
    layersExceedingAtmosphere: readonly ("r" | "g" | "b" | "a")[];
  };
  resolveTakramCloudScaleContract(input: {
    coverageMode: CoverageMode;
    scale: CloudScale;
  }): CloudScaleContract;
  resolveTakramStockWeatherControl(input: {
    mode: "unscaled" | "similarity";
    scale: CloudScale;
  }): {
    classification: "UNSCALED_STOCK_WEATHER_CONTROL" | "SCALED_STOCK_WEATHER_CONTROL";
    mode: "unscaled" | "similarity";
    repeat: readonly [number, number];
    scale: CloudScale;
    sourceRepeat: readonly [100, 100];
  };
}

const contractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleContract";

async function loadContract(): Promise<CloudScaleContractModule | null> {
  try {
    return await import(contractModulePath) as CloudScaleContractModule;
  } catch {
    return null;
  }
}

test("freezes the complete Takram 0.7.6 high source contract", async () => {
  const module = await loadContract();

  expect(module).not.toBeNull();
  const defaults = module!.TAKRAM_CLOUD_SCALE_DEFAULTS;
  expect(defaults.source).toEqual({
    package: "@takram/three-clouds",
    qualityPreset: "high",
    version: "0.7.6"
  });
  expect(defaults.shapeRepeat).toBe(0.0003);
  expect(defaults.shapeDetailRepeat).toBe(0.006);
  expect(defaults.turbulenceDisplacement).toBe(350);
  expect(defaults.layers).toEqual([
    {
      altitude: 750,
      channel: "r",
      coverageFilterWidth: 0.6,
      densityProfile: { constantTerm: 0.25, exponent: 0, expTerm: 0, linearTerm: 0.75 },
      densityScale: 0.2,
      height: 650,
      shadow: true,
      shapeAlteringBias: 0.35,
      shapeAmount: 1,
      shapeDetailAmount: 1,
      weatherExponent: 1
    },
    {
      altitude: 1_000,
      channel: "g",
      coverageFilterWidth: 0.6,
      densityProfile: { constantTerm: 0.25, exponent: 0, expTerm: 0, linearTerm: 0.75 },
      densityScale: 0.2,
      height: 1_200,
      shadow: true,
      shapeAlteringBias: 0.35,
      shapeAmount: 1,
      shapeDetailAmount: 1,
      weatherExponent: 1
    },
    {
      altitude: 7_500,
      channel: "b",
      coverageFilterWidth: 0.5,
      densityProfile: { constantTerm: 0.25, exponent: 0, expTerm: 0, linearTerm: 0.75 },
      densityScale: 0.003,
      height: 500,
      shadow: false,
      shapeAlteringBias: 0.35,
      shapeAmount: 0.4,
      shapeDetailAmount: 0,
      weatherExponent: 1
    },
    {
      altitude: 0,
      channel: "a",
      coverageFilterWidth: 0.6,
      densityProfile: { constantTerm: 0.25, exponent: 0, expTerm: 0, linearTerm: 0.75 },
      densityScale: 0.2,
      height: 0,
      shadow: false,
      shapeAlteringBias: 0.35,
      shapeAmount: 1,
      shapeDetailAmount: 1,
      weatherExponent: 1
    }
  ]);
  expect(defaults.clouds).toMatchObject({
    maxIterationCount: 500,
    maxIterationCountToGround: 3,
    maxIterationCountToSun: 2,
    maxRayDistance: 200_000,
    maxShadowLengthIterationCount: 500,
    maxShadowLengthRayDistance: 200_000,
    maxStepSize: 1_000,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minSecondaryStepSize: 100,
    minShadowLengthStepSize: 50,
    minStepSize: 50,
    minTransmittance: 1e-2,
    perspectiveStepScale: 1.01,
    secondaryStepScale: 2
  });
  expect(defaults.shadow).toMatchObject({
    cascadeCount: 3,
    mapSize: [512, 512],
    maxIterationCount: 50,
    maxStepSize: 1_000,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minStepSize: 100,
    minTransmittance: 1e-4
  });
  expect(Object.isFrozen(defaults)).toBe(true);
  expect(Object.isFrozen(defaults.layers)).toBe(true);
  expect(Object.isFrozen(defaults.layers[0].densityProfile)).toBe(true);
});

test("parses only the approved scales and coverage modes", async () => {
  const module = await loadContract();

  expect(module).not.toBeNull();
  expect(["80", "120", "160"].map((value) => module!.parseTakramCloudScale(value)))
    .toEqual([80, 120, 160]);
  expect([null, "", "0", "79", "81", "120.0", "160x"].map(
    (value) => module!.parseTakramCloudScale(value)
  )).toEqual([null, null, null, null, null, null, null]);
  expect(module!.parseTakramCloudCoverageMode("parity")).toBe("parity");
  expect(module!.parseTakramCloudCoverageMode("presentation")).toBe("presentation");
  expect(module!.parseTakramCloudCoverageMode("legacy")).toBeNull();
  expect(module!.parseTakramCloudCoverageMode(null)).toBeNull();
  expect(module!.parseTakramStockWeatherControlMode("unscaled")).toBe("unscaled");
  expect(module!.parseTakramStockWeatherControlMode("similarity")).toBe("similarity");
  expect(module!.parseTakramStockWeatherControlMode("scaled")).toBeNull();
  expect(module!.parseTakramStockWeatherControlMode(null)).toBeNull();
});

test("scales only the stock local weather repeat for the Stage A1 health control", async () => {
  const module = await loadContract();

  expect(module).not.toBeNull();
  for (const scale of [80, 120, 160] as const) {
    expect(module!.resolveTakramStockWeatherControl({ mode: "unscaled", scale }))
      .toEqual({
        classification: "UNSCALED_STOCK_WEATHER_CONTROL",
        mode: "unscaled",
        repeat: [100, 100],
        scale,
        sourceRepeat: [100, 100]
      });
    expect(module!.resolveTakramStockWeatherControl({ mode: "similarity", scale }))
      .toEqual({
        classification: "SCALED_STOCK_WEATHER_CONTROL",
        mode: "similarity",
        repeat: [100 / scale, 100 / scale],
        scale,
        sourceRepeat: [100, 100]
      });
  }
});

test("resolves every dimensional and fixed field from one public scale", async () => {
  const module = await loadContract();

  expect(module).not.toBeNull();
  const defaults = module!.TAKRAM_CLOUD_SCALE_DEFAULTS;
  for (const scale of [80, 120, 160] as const) {
    const resolved = module!.resolveTakramCloudScaleContract({
      coverageMode: "parity",
      scale
    });

    expect(resolved.schemaVersion).toBe(1);
    expect(resolved.classification).toBe("PUBLIC_PARAMETER_SIMILARITY");
    expect(resolved.scale).toBe(scale);
    expect(resolved.coverageMode).toBe("parity");
    expect(resolved.coverage).toBe(0.3);
    expect(resolved.shapeRepeat).toBeCloseTo(0.0003 / scale);
    expect(resolved.shapeDetailRepeat).toBeCloseTo(0.006 / scale);
    expect((1 / resolved.shapeRepeat) / (1 / resolved.shapeDetailRepeat)).toBeCloseTo(20);
    expect(resolved.turbulenceDisplacement).toBe(350 * scale);
    expect(resolved.mipDistancePatch).toEqual({ active: false, scale: 1 });

    expect(resolved.clouds).toMatchObject({
      maxIterationCount: 500,
      maxIterationCountToGround: 3,
      maxIterationCountToSun: 2,
      maxRayDistance: 200_000 * scale,
      maxShadowLengthIterationCount: 500,
      maxShadowLengthRayDistance: 200_000 * scale,
      maxStepSize: 1_000 * scale,
      minDensity: 1e-5,
      minExtinction: 1e-5 / scale,
      minSecondaryStepSize: 100 * scale,
      minShadowLengthStepSize: 50 * scale,
      minStepSize: 50 * scale,
      minTransmittance: 1e-2,
      perspectiveStepScale: 1.01,
      secondaryStepScale: 2
    });
    expect(resolved.shadow).toMatchObject({
      cascadeCount: 3,
      mapSize: [512, 512],
      maxIterationCount: 50,
      maxStepSize: 1_000 * scale,
      minDensity: 1e-5,
      minExtinction: 1e-5 / scale,
      minStepSize: 100 * scale,
      minTransmittance: 1e-4
    });

    expect(resolved.layers.map((layer) => layer.channel)).toEqual(["r", "g", "b", "a"]);
    for (const [index, layer] of resolved.layers.entries()) {
      const source = defaults.layers[index];
      expect(layer.altitude).toBe(source.altitude);
      expect(layer.height).toBe(source.height * scale);
      expect(layer.densityScale).toBeCloseTo(source.densityScale / scale);
      expect(layer.height * layer.densityScale).toBeCloseTo(
        source.height * source.densityScale
      );
      expect(layer.densityProfile).toEqual(source.densityProfile);
      expect(layer.shapeAmount).toBe(source.shapeAmount);
      expect(layer.shapeDetailAmount).toBe(source.shapeDetailAmount);
      expect(layer.weatherExponent).toBe(source.weatherExponent);
      expect(layer.shapeAlteringBias).toBe(source.shapeAlteringBias);
      expect(layer.coverageFilterWidth).toBe(source.coverageFilterWidth);
      expect(layer.shadow).toBe(source.shadow);
    }
    expect(resolved.layers[3].height).toBe(0);
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.layers)).toBe(true);
    expect(Object.isFrozen(resolved.clouds)).toBe(true);
    expect(Object.isFrozen(resolved.shadow)).toBe(true);
  }
});

test("resolves presentation coverage without changing the scale contract", async () => {
  const module = await loadContract();

  expect(module).not.toBeNull();
  const parity = module!.resolveTakramCloudScaleContract({
    coverageMode: "parity",
    scale: 120
  });
  const presentation = module!.resolveTakramCloudScaleContract({
    coverageMode: "presentation",
    scale: 120
  });

  expect(presentation.coverage).toBe(0.55);
  expect({ ...presentation, coverage: parity.coverage, coverageMode: parity.coverageMode })
    .toEqual(parity);
});

test("reports the artistic atmosphere overflow independently of renderer parity", async () => {
  const module = await loadContract();

  expect(module).not.toBeNull();
  const exceedingByScale = new Map<CloudScale, readonly string[]>([
    [80, ["g"]],
    [120, ["r", "g", "b"]],
    [160, ["r", "g", "b"]]
  ]);
  for (const scale of [80, 120, 160] as const) {
    const domain = module!.resolveTakramCloudScaleAtmosphereDomain({
      bottomRadius: 6_360_000,
      contract: module!.resolveTakramCloudScaleContract({
        coverageMode: "parity",
        scale
      }),
      topRadius: 6_420_000
    });

    expect(domain).toEqual({
      atmosphereHeight: 60_000,
      layersExceedingAtmosphere: exceedingByScale.get(scale),
      physicalAerialPerspectiveParityClaim: false,
      presentationDomain: "artistic-orbital"
    });
    expect(Object.isFrozen(domain)).toBe(true);
    expect(Object.isFrozen(domain.layersExceedingAtmosphere)).toBe(true);
  }
});
