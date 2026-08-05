#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const require = createRequire(import.meta.url);
const commandArguments = process.argv.slice(2);
if (commandArguments.some((argument) => argument !== "--verify")) {
  throw new Error("Usage: vendor-takram-parity-assets.mjs [--verify]");
}
const verifyOnly = commandArguments.includes("--verify");

const npmPackages = Object.freeze({
  "@react-three/postprocessing": "3.0.4",
  "@takram/three-atmosphere": "0.19.1",
  "@takram/three-clouds": "0.7.6",
  "@takram/three-geospatial": "0.9.1",
  postprocessing: "6.39.1"
});
const upstream = Object.freeze({
  repository: "https://github.com/takram-design-engineering/three-geospatial",
  visualReferenceCommit: "b012ad06d858fc035d88aacfd73f092f93c994e4"
});
const cloudsAssetRef = "45a1c6c1bb9fd38b3680fd120795ff4c32df68ff";
const geospatialStbnAssetRef = "9627216cc50057994c98a2118f3c4a23765d43b9";
const upstreamMediaBaseUrl =
  "https://media.githubusercontent.com/media/takram-design-engineering/three-geospatial";

const assets = Object.freeze([
  {
    byteLength: 679_653,
    dimensions: [512, 512, 1],
    format: "rgba8",
    id: "localWeather",
    localPath: "apps/site/public/assets/lubirth/takram-parity/stock/local-weather.png",
    packageAsset: "local_weather.png",
    runtimeUrl: "/assets/lubirth/takram-parity/stock/local-weather.png",
    sha256: "b84daef855dc5eebcc9b174fe832ba75a98e44b846dde201bce354417cc08031",
    sourceRef: cloudsAssetRef,
    sourceUrl: `${upstreamMediaBaseUrl}/${cloudsAssetRef}/packages/clouds/assets/local_weather.png`
  },
  {
    byteLength: 2_097_152,
    dimensions: [128, 128, 128],
    format: "r8",
    id: "shape",
    localPath: "apps/site/public/assets/lubirth/takram-parity/stock/shape.bin",
    packageAsset: "shape.bin",
    runtimeUrl: "/assets/lubirth/takram-parity/stock/shape.bin",
    sha256: "ef65cf6156894720c00bf572c49e3e254f8899c4b5158246e5a35a1922e2519c",
    sourceRef: cloudsAssetRef,
    sourceUrl: `${upstreamMediaBaseUrl}/${cloudsAssetRef}/packages/clouds/assets/shape.bin`
  },
  {
    byteLength: 32_768,
    dimensions: [32, 32, 32],
    format: "r8",
    id: "shapeDetail",
    localPath: "apps/site/public/assets/lubirth/takram-parity/stock/shape-detail.bin",
    packageAsset: "shape_detail.bin",
    runtimeUrl: "/assets/lubirth/takram-parity/stock/shape-detail.bin",
    sha256: "c09112199c6e0281b74ff5283c11c2943ae082650b9b67978cf5d59ed2956e4f",
    sourceRef: cloudsAssetRef,
    sourceUrl: `${upstreamMediaBaseUrl}/${cloudsAssetRef}/packages/clouds/assets/shape_detail.bin`
  },
  {
    byteLength: 49_691,
    dimensions: [128, 128, 1],
    format: "rgba8",
    id: "turbulence",
    localPath: "apps/site/public/assets/lubirth/takram-parity/stock/turbulence.png",
    packageAsset: "turbulence.png",
    runtimeUrl: "/assets/lubirth/takram-parity/stock/turbulence.png",
    sha256: "ec2b1b0af4a6a6104102b21e58beb300b0a3d334c0281d84fde8c91d322910f9",
    sourceRef: cloudsAssetRef,
    sourceUrl: `${upstreamMediaBaseUrl}/${cloudsAssetRef}/packages/clouds/assets/turbulence.png`
  },
  {
    byteLength: 1_048_576,
    dimensions: [128, 128, 64],
    format: "r8",
    id: "stbn",
    localPath: "apps/site/public/assets/lubirth/takram-parity/stock/stbn.bin",
    packageAsset: null,
    runtimeUrl: "/assets/lubirth/takram-parity/stock/stbn.bin",
    sha256: "51f52f21e5578384585050390821a0a486dcb81e11a716fa7b92fbb6515ba852",
    sourceRef: geospatialStbnAssetRef,
    sourceUrl: `${upstreamMediaBaseUrl}/${geospatialStbnAssetRef}/packages/core/assets/stbn.bin`
  },
  {
    byteLength: 1_728_473,
    dimensions: [1920, 1080, 1],
    format: "rgb8",
    id: "upstreamTokyo",
    localPath: "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg",
    packageAsset: null,
    runtimeUrl: null,
    sha256: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5",
    sourceRef: upstream.visualReferenceCommit,
    sourceUrl: `${upstreamMediaBaseUrl}/${upstream.visualReferenceCommit}/packages/clouds/docs/tokyo.jpg`
  }
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertAssetContents(asset, contents, source) {
  if (contents.byteLength !== asset.byteLength) {
    throw new Error(`${asset.id} from ${source} has ${contents.byteLength} bytes; expected ${asset.byteLength}.`);
  }
  const actualHash = sha256(contents);
  if (actualHash !== asset.sha256) {
    throw new Error(`${asset.id} from ${source} has sha256 ${actualHash}; expected ${asset.sha256}.`);
  }
}

function resolveCloudsPackageAsset(asset) {
  const cloudsEntry = require.resolve("@takram/three-clouds");
  const cloudsPackageRoot = path.resolve(path.dirname(cloudsEntry), "..");
  return path.join(cloudsPackageRoot, "assets", asset.packageAsset);
}

async function fetchAsset(asset) {
  const response = await fetch(asset.sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch ${asset.id} (${response.status} ${response.statusText}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function readSourceAsset(asset) {
  if (asset.packageAsset != null) {
    const packagePath = resolveCloudsPackageAsset(asset);
    return readFile(packagePath);
  }
  return fetchAsset(asset);
}

function publicManifest() {
  return {
    assets: assets.map(({ packageAsset: _packageAsset, ...asset }) => asset),
    license: "MIT",
    npmPackages,
    schemaVersion: 1,
    upstream
  };
}

async function verifyLocalAsset(asset) {
  const outputPath = path.join(repositoryRoot, asset.localPath);
  const contents = await readFile(outputPath);
  assertAssetContents(asset, contents, outputPath);
}

async function verifyManifest() {
  const manifestPath = path.join(
    repositoryRoot,
    "apps/site/public/assets/lubirth/takram-parity/stock/manifest.json"
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expected = publicManifest();
  if (JSON.stringify({
    assets: manifest.assets,
    license: manifest.license,
    npmPackages: manifest.npmPackages,
    schemaVersion: manifest.schemaVersion,
    upstream: manifest.upstream
  }) !== JSON.stringify(expected)) {
    throw new Error("Takram parity asset manifest does not match the pinned contract.");
  }
}

async function vendorAsset(asset) {
  try {
    await verifyLocalAsset(asset);
    return false;
  } catch {
    const contents = await readSourceAsset(asset);
    assertAssetContents(asset, contents, asset.sourceUrl);
    const outputPath = path.join(repositoryRoot, asset.localPath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, contents);
    await verifyLocalAsset(asset);
    return true;
  }
}

if (verifyOnly) {
  await Promise.all(assets.map(verifyLocalAsset));
  await verifyManifest();
  console.log(JSON.stringify({ verified: assets.map(({ id }) => id) }, null, 2));
} else {
  const copied = [];
  for (const asset of assets) {
    if (await vendorAsset(asset)) {
      copied.push(asset.id);
    }
  }

  const manifestPath = path.join(
    repositoryRoot,
    "apps/site/public/assets/lubirth/takram-parity/stock/manifest.json"
  );
  // A repeatable verification must not dirty the worktree just because its
  // timestamp changed. Refresh `copiedAt` only when this invocation actually
  // repaired or copied a pinned artifact.
  if (copied.length > 0) {
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify({
      ...publicManifest(),
      copiedAt: new Date().toISOString()
    }, null, 2)}\n`);
  }
  await verifyManifest();
  console.log(JSON.stringify({
    copied,
    manifest: path.relative(repositoryRoot, manifestPath),
    vendored: assets.map(({ id, localPath }) => ({ id, localPath }))
  }, null, 2));
}
