import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { CloudsEffect } from "@takram/three-clouds";

type MappingAwareCloudsEffect = CloudsEffect & {
  globalWeatherMapping: boolean;
  cloudsPass: CloudsEffect["cloudsPass"] & {
    currentMaterial: CloudsEffect["cloudsPass"]["currentMaterial"] & {
      defines: Record<string, string | undefined>;
    };
  };
  shadowPass: CloudsEffect["shadowPass"] & {
    currentMaterial: CloudsEffect["shadowPass"]["currentMaterial"] & {
      defines: Record<string, string | undefined>;
    };
  };
};

interface TakramParityV3AdapterModule {
  TAKRAM_PARITY_V3_ADAPTER: {
    clearAirThreshold: number;
    flipU: true;
    flipY: true;
    globalWeatherMapping: true;
    offset: readonly [-0.045, 0.018];
    orientation: "equirectangular-y-up-source-to-z-up-ecef";
    repeat: readonly [1, 1];
    runtimeUrl: string;
  };
  TAKRAM_PARITY_V3_PATCH_AUDIT: {
    patchedSourceHashes: Record<string, string>;
    upstreamSourceHashes: Record<string, string>;
  };
  adaptTakramParityV3WeatherPixel(input: readonly number[]): Uint8Array;
  resolveTakramParityAdapter(input: "stock" | "v3"): {
    disableDefaultLayers: boolean;
    globalWeatherMapping: boolean;
    localWeatherOffset: readonly [number, number];
    localWeatherRepeat: readonly [number, number];
    localWeatherSource: "stock" | "v3";
  };
}

interface TakramParityV3LayersModule {
  TAKRAM_PARITY_V3_LAYERS: ReadonlyArray<{
    altitude: number;
    channel: "r" | "g" | "b" | "a";
    coverageFilterWidth: number;
    densityScale: number;
    height: number;
    shadow?: boolean;
    shapeAmount: number;
    shapeDetailAmount: number;
    weatherExponent?: number;
  }>;
}

const adapterModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityV3Adapter";
const layersModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityV3Layers";
const cloudsRoot = path.join(
  process.cwd(),
  "packages/lubirth-hero/node_modules/@takram/three-clouds"
);
const patchPath = path.join(
  process.cwd(),
  "patches/@takram__three-clouds@0.7.6.patch"
);
const v3ManifestPath = path.join(
  process.cwd(),
  "apps/site/public/assets/lubirth/takram-parity/v3/manifest.json"
);
const v3WeatherPath = path.join(
  process.cwd(),
  "apps/site/public/assets/lubirth/takram-parity/v3/weather.png"
);

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

async function importAdapter(): Promise<TakramParityV3AdapterModule | null> {
  try {
    return await import(adapterModulePath) as TakramParityV3AdapterModule;
  } catch {
    return null;
  }
}

async function importLayers(): Promise<TakramParityV3LayersModule | null> {
  try {
    return await import(layersModulePath) as TakramParityV3LayersModule;
  } catch {
    return null;
  }
}

test("keeps stock cube-sphere UVs while the narrow V3 patch enables spherical UVs", async () => {
  const adapter = await importAdapter();
  expect(adapter).not.toBeNull();

  const [sourceCloudsEffect, sourceR3fClouds, sourceCloudsGlsl, bundledShader, patch] =
    await Promise.all([
      readFile(path.join(cloudsRoot, "src/CloudsEffect.ts"), "utf8"),
      readFile(path.join(cloudsRoot, "src/r3f/Clouds.tsx"), "utf8"),
      readFile(path.join(cloudsRoot, "src/shaders/clouds.glsl"), "utf8"),
      readFile(path.join(cloudsRoot, "build/shared.js"), "utf8"),
      readFile(patchPath, "utf8")
    ]);

  expect(adapter?.TAKRAM_PARITY_V3_PATCH_AUDIT.upstreamSourceHashes).toEqual({
    "build/shared.js": "cb1b4ec2400f873c1fe8cac6a00331a3972c9b7cdbc6349496e3c2de06886804",
    "src/CloudsEffect.ts": "db3800833dfb13e96ec292a631f9a782f7637909fb167c9443cd64583c9b43c3",
    "src/r3f/Clouds.tsx": "5a05e9c5fe97386be85b54dec588ba84237f857bb21404726179c53f018d4e53",
    "src/shaders/clouds.glsl": "bbb3f037e55aed6c989d77d197af33f44ee5565b0ca7988eab44f52ddd509eb5"
  });
  expect(adapter?.TAKRAM_PARITY_V3_PATCH_AUDIT.patchedSourceHashes).toEqual({
    "build/shared.js": "45c5046fdd58e062e98b87098ab35fbfaad77bd81946ce687c82be0b638fae49",
    "src/CloudsEffect.ts": "ccc1d0db7627e5d2e13e81748619e5e6c52a96ceb2d2ba8f34a43a03e2778cff",
    "src/r3f/Clouds.tsx": "5a05e9c5fe97386be85b54dec588ba84237f857bb21404726179c53f018d4e53",
    "src/shaders/clouds.glsl": "1fc4a4de4927c12dea23bf0590b24babf7251a0e6a6a442ac141d43c60caae19"
  });
  expect(adapter?.TAKRAM_PARITY_V3_PATCH_AUDIT.patchedSourceHashes).toEqual({
    "build/shared.js": sha256(bundledShader),
    "src/CloudsEffect.ts": sha256(sourceCloudsEffect),
    "src/r3f/Clouds.tsx": sha256(sourceR3fClouds),
    "src/shaders/clouds.glsl": sha256(sourceCloudsGlsl)
  });

  const mappingHunk = `vec2 getGlobeUv(const vec3 position) {\n#ifdef GLOBAL_WEATHER_MAPPING\n  return getSphericalUv(position);\n#else\n  return getCubeSphereUv(position);\n#endif\n}`;
  expect(sourceCloudsGlsl).toContain(mappingHunk);
  expect(bundledShader).toContain(mappingHunk);
  expect(patch).toContain("+#ifdef GLOBAL_WEATHER_MAPPING");
  expect(patch).toContain("+  return getSphericalUv(position);");
  expect(patch).toContain("+#else");
  expect(patch).toContain("+#endif");
  expect(patch).toContain("globalWeatherMapping");
  expect(Array.from(patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm), (match) => match[1]))
    .toEqual([
      "build/shared.cjs",
      "build/shared.js",
      "src/CloudsEffect.ts",
      "src/CloudsMaterial.ts",
      "src/ShadowMaterial.ts",
      "src/shaders/clouds.glsl",
      "types/CloudsEffect.d.ts",
      "types/CloudsMaterial.d.ts",
      "types/ShadowMaterial.d.ts"
    ]);

  const effect = new CloudsEffect() as MappingAwareCloudsEffect;
  expect(effect.globalWeatherMapping).toBe(false);
  expect(effect.cloudsPass.currentMaterial.defines.GLOBAL_WEATHER_MAPPING).toBeUndefined();
  expect(effect.shadowPass.currentMaterial.defines.GLOBAL_WEATHER_MAPPING).toBeUndefined();
  effect.globalWeatherMapping = true;
  expect(effect.cloudsPass.currentMaterial.defines.GLOBAL_WEATHER_MAPPING).toBe("1");
  expect(effect.shadowPass.currentMaterial.defines.GLOBAL_WEATHER_MAPPING).toBe("1");
  effect.dispose();
});

test("adapts V3 weather deterministically and never creates clear-air coverage", async () => {
  const adapter = await importAdapter();
  expect(adapter).not.toBeNull();
  expect(adapter?.TAKRAM_PARITY_V3_ADAPTER).toEqual({
    clearAirThreshold: 0.05,
    flipU: true,
    flipY: true,
    globalWeatherMapping: true,
    localWeatherSha256: "ff2b7715cc59a4031a7eb6ff7e77ce52a730996c9dfe9d529dfa25aa01481a9b",
    offset: [-0.045, 0.018],
    orientation: "equirectangular-y-up-source-to-z-up-ecef",
    repeat: [1, 1],
    runtimeUrl: "/assets/lubirth/takram-parity/v3/weather.png"
  });
  expect(adapter?.resolveTakramParityAdapter("stock")).toEqual({
    disableDefaultLayers: false,
    globalWeatherMapping: false,
    localWeatherOffset: [0, 0],
    localWeatherRepeat: [100, 100],
    localWeatherSource: "stock"
  });
  expect(adapter?.resolveTakramParityAdapter("v3")).toEqual({
    disableDefaultLayers: true,
    globalWeatherMapping: true,
    localWeatherOffset: [-0.045, 0.018],
    localWeatherRepeat: [1, 1],
    localWeatherSource: "v3"
  });
  expect(Array.from(adapter?.adaptTakramParityV3WeatherPixel([12, 255, 255, 255]) ?? [])).toEqual([
    0, 0, 0, 0
  ]);
  expect(Array.from(adapter?.adaptTakramParityV3WeatherPixel([128, 64, 255, 32]) ?? [])).toEqual([
    128, 32, 128, 16
  ]);

  execFileSync(
    "pnpm",
    ["--filter", "@miralith/lubirth-hero", "generate:takram-parity-v3-weather"],
    { cwd: process.cwd(), stdio: "pipe" }
  );
  const firstWeatherHash = sha256(await readFile(v3WeatherPath));
  const firstManifest = JSON.parse(await readFile(v3ManifestPath, "utf8"));
  execFileSync(
    "pnpm",
    ["--filter", "@miralith/lubirth-hero", "generate:takram-parity-v3-weather"],
    { cwd: process.cwd(), stdio: "pipe" }
  );
  const secondWeatherHash = sha256(await readFile(v3WeatherPath));
  const secondManifest = JSON.parse(await readFile(v3ManifestPath, "utf8"));

  expect(secondWeatherHash).toBe(firstWeatherHash);
  expect(secondManifest).toEqual(firstManifest);
  expect(adapter?.TAKRAM_PARITY_V3_ADAPTER.localWeatherSha256).toBe(
    secondManifest.output.sha256
  );
  expect(secondManifest).toMatchObject({
    clearAirThreshold: 0.05,
    flipU: true,
    flipY: true,
    offset: [-0.045, 0.018],
    orientation: "equirectangular-y-up-source-to-z-up-ecef",
    output: { sha256: firstWeatherHash },
    repeat: [1, 1],
    source: {
      layout: "v3-r-depth-g-height-b-morphology-a-concavity",
      sha256: "39c70e34b99ecf550f557327a1b97dcc0d2cae9f3be03242911c067622bb0a1c"
    },
    outputLayoutId: "takram-v1-r-base-g-tower-b-structure-a-wisp"
  });
});

test("freezes the four V3 layer signals as weather-gated adapter data", async () => {
  const layersModule = await importLayers();
  expect(layersModule).not.toBeNull();
  const layers = layersModule?.TAKRAM_PARITY_V3_LAYERS ?? [];
  expect(layers).toEqual([
    {
      channel: "r",
      altitude: 8_000,
      height: 26_000,
      densityScale: 0.18,
      shapeAmount: 0.7,
      shapeDetailAmount: 0.45,
      coverageFilterWidth: 0.6,
      shadow: true
    },
    {
      channel: "g",
      altitude: 10_000,
      height: 50_000,
      densityScale: 0.11,
      shapeAmount: 0.85,
      shapeDetailAmount: 0.7,
      weatherExponent: 1.15,
      coverageFilterWidth: 0.52,
      shadow: true
    },
    {
      channel: "b",
      altitude: 8_000,
      height: 36_000,
      densityScale: 0.06,
      shapeAmount: 0.9,
      shapeDetailAmount: 0.85,
      weatherExponent: 1.2,
      coverageFilterWidth: 0.45
    },
    {
      channel: "a",
      altitude: 18_000,
      height: 20_000,
      densityScale: 0.035,
      shapeAmount: 0.55,
      shapeDetailAmount: 0.25,
      weatherExponent: 1.4,
      coverageFilterWidth: 0.5
    }
  ]);
  expect(Math.max(...layers.map((layer) => layer.altitude + layer.height))).toBe(60_000);
  expect(layers.find((layer) => layer.channel === "a")?.height).toBeGreaterThan(0);
  expect(layers.filter((layer) => layer.channel === "r" || layer.channel === "g")).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ channel: "r", shadow: true }),
      expect.objectContaining({ channel: "g", shadow: true })
    ])
  );
});
