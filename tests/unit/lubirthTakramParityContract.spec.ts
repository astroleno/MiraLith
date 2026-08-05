import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

interface TakramParityContractModule {
  TAKRAM_PARITY_DEFAULTS: {
    haze: boolean;
    lightShafts: boolean;
    qualityPreset: "high";
    resolutionScale: number;
    shapeDetail: boolean;
    temporalUpscale: boolean;
    turbulence: boolean;
  };
  TAKRAM_PARITY_LICENSE: "MIT";
  TAKRAM_PARITY_NPM_PACKAGES: Record<string, string>;
  TAKRAM_PARITY_STOCK_ASSETS: ReadonlyArray<{
    byteLength: number;
    dimensions: readonly [number, number, number];
    format: "rgba8" | "r8" | "rgb8";
    id: "localWeather" | "shape" | "shapeDetail" | "stbn" | "turbulence" | "upstreamTokyo";
    localPath: string;
    runtimeUrl: string | null;
    sha256: string;
    sourceRef: string;
    sourceUrl: string;
  }>;
  TAKRAM_PARITY_UPSTREAM: {
    repository: "https://github.com/takram-design-engineering/three-geospatial";
    visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4";
  };
  isTakramParityLocalAssetUrl(value: string): boolean;
}

const contractModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";

async function loadTakramParityContract(): Promise<TakramParityContractModule | null> {
  try {
    return await import(contractModulePath) as TakramParityContractModule;
  } catch {
    return null;
  }
}

async function readLuBirthHeroPackageDependencies() {
  const { readFile } = await import("node:fs/promises");
  const packageJson = JSON.parse(await readFile(
    `${process.cwd()}/packages/lubirth-hero/package.json`,
    "utf8"
  )) as {
    dependencies?: Record<string, string>;
  };
  return packageJson.dependencies ?? {};
}

async function readTakramParityStockManifest() {
  const { readFile } = await import("node:fs/promises");
  const manifestPath = `${process.cwd()}/apps/site/public/assets/lubirth/takram-parity/stock/manifest.json`;
  return JSON.parse(await readFile(manifestPath, "utf8")) as {
    assets: TakramParityContractModule["TAKRAM_PARITY_STOCK_ASSETS"];
    license: string;
    npmPackages: Record<string, string>;
    schemaVersion: number;
    upstream: TakramParityContractModule["TAKRAM_PARITY_UPSTREAM"];
  };
}

test("pins the official stock Takram contract to auditable local assets", async () => {
  const contract = await loadTakramParityContract();

  expect(contract).not.toBeNull();
  expect(contract?.TAKRAM_PARITY_NPM_PACKAGES).toEqual({
    "@react-three/postprocessing": "3.0.4",
    "@takram/three-atmosphere": "0.19.1",
    "@takram/three-clouds": "0.7.6",
    "@takram/three-geospatial": "0.9.1",
    postprocessing: "6.39.1"
  });
  expect(await readLuBirthHeroPackageDependencies()).toMatchObject(
    contract?.TAKRAM_PARITY_NPM_PACKAGES
  );
  expect(contract?.TAKRAM_PARITY_LICENSE).toBe("MIT");
  expect(contract?.TAKRAM_PARITY_UPSTREAM).toEqual({
    repository: "https://github.com/takram-design-engineering/three-geospatial",
    visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4"
  });
  expect(contract?.TAKRAM_PARITY_DEFAULTS).toEqual({
    haze: true,
    lightShafts: true,
    qualityPreset: "high",
    resolutionScale: 1,
    shapeDetail: true,
    temporalUpscale: true,
    turbulence: true
  });

  expect(contract?.TAKRAM_PARITY_STOCK_ASSETS).toEqual([
    {
      byteLength: 679_653,
      dimensions: [512, 512, 1],
      format: "rgba8",
      id: "localWeather",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/local-weather.png",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/local-weather.png",
      sha256: "b84daef855dc5eebcc9b174fe832ba75a98e44b846dde201bce354417cc08031",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/local_weather.png"
    },
    {
      byteLength: 2_097_152,
      dimensions: [128, 128, 128],
      format: "r8",
      id: "shape",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/shape.bin",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/shape.bin",
      sha256: "ef65cf6156894720c00bf572c49e3e254f8899c4b5158246e5a35a1922e2519c",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/shape.bin"
    },
    {
      byteLength: 32_768,
      dimensions: [32, 32, 32],
      format: "r8",
      id: "shapeDetail",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/shape-detail.bin",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/shape-detail.bin",
      sha256: "c09112199c6e0281b74ff5283c11c2943ae082650b9b67978cf5d59ed2956e4f",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/shape_detail.bin"
    },
    {
      byteLength: 49_691,
      dimensions: [128, 128, 1],
      format: "rgba8",
      id: "turbulence",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/turbulence.png",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/turbulence.png",
      sha256: "ec2b1b0af4a6a6104102b21e58beb300b0a3d334c0281d84fde8c91d322910f9",
      sourceRef: "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/turbulence.png"
    },
    {
      byteLength: 1_048_576,
      dimensions: [128, 128, 64],
      format: "r8",
      id: "stbn",
      localPath: "apps/site/public/assets/lubirth/takram-parity/stock/stbn.bin",
      runtimeUrl: "/assets/lubirth/takram-parity/stock/stbn.bin",
      sha256: "51f52f21e5578384585050390821a0a486dcb81e11a716fa7b92fbb6515ba852",
      sourceRef: "9627216cc50057994c98a2118f3c4a23765d43b9",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/9627216cc50057994c98a2118f3c4a23765d43b9/packages/core/assets/stbn.bin"
    },
    {
      byteLength: 1_728_473,
      dimensions: [1920, 1080, 1],
      format: "rgb8",
      id: "upstreamTokyo",
      localPath: "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg",
      runtimeUrl: null,
      sha256: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5",
      sourceRef: "b012ad06d858fc035d88aacfd73f092f93c994e4",
      sourceUrl: "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/b012ad06d858fc035d88aacfd73f092f93c994e4/packages/clouds/docs/tokyo.jpg"
    }
  ]);
  expect(contract?.isTakramParityLocalAssetUrl(
    "/assets/lubirth/takram-parity/stock/local-weather.png"
  )).toBe(true);
  expect(contract?.isTakramParityLocalAssetUrl(
    "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial/45a1c6c1bb9fd38b3680fd120795ff4c32df68ff/packages/clouds/assets/local_weather.png"
  )).toBe(false);
});

test("vendors byte-identical local stock assets and an audit manifest", async () => {
  const contract = await loadTakramParityContract();

  expect(contract).not.toBeNull();
  execFileSync(
    "node",
    ["packages/lubirth-hero/scripts/vendor-takram-parity-assets.mjs"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  const { readFile, stat } = await import("node:fs/promises");
  const heroPackage = JSON.parse(await readFile(
    `${process.cwd()}/packages/lubirth-hero/package.json`,
    "utf8"
  )) as { scripts?: Record<string, string> };
  expect(heroPackage.scripts?.["vendor:takram-parity-assets"]).toBe(
    "node scripts/vendor-takram-parity-assets.mjs"
  );

  const manifest = await readTakramParityStockManifest();
  expect(manifest).toMatchObject({
    assets: contract?.TAKRAM_PARITY_STOCK_ASSETS,
    license: "MIT",
    npmPackages: contract?.TAKRAM_PARITY_NPM_PACKAGES,
    schemaVersion: 1,
    upstream: contract?.TAKRAM_PARITY_UPSTREAM
  });

  for (const asset of contract?.TAKRAM_PARITY_STOCK_ASSETS ?? []) {
    const contents = await readFile(`${process.cwd()}/${asset.localPath}`);
    expect((await stat(`${process.cwd()}/${asset.localPath}`)).size).toBe(asset.byteLength);
    expect(createHash("sha256").update(contents).digest("hex")).toBe(asset.sha256);
  }
});
