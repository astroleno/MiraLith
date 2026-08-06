#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const clearAirThreshold = 0.05;
const generatorVersion = "takram-parity-v3-weather/v2";
// These are the frozen Task 0V equivalents of homeCloudField.ts. The adapter
// is intentionally static during parity capture, so homeCloudOffset.current
// is zero and the runtime offset is exactly [-x, y].
const homeCloudFieldOffsetX = 0.045;
const homeCloudFieldOffsetY = 0.018;
const localWeatherOffset = [-homeCloudFieldOffsetX, homeCloudFieldOffsetY];
const outputLayoutId = "takram-v1-r-base-g-tower-b-structure-a-wisp";
const orientation = "equirectangular-y-up-source-to-z-up-ecef";
const sourceRelativePath =
  "apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png";
const outputRelativePath =
  "apps/site/public/assets/lubirth/takram-parity/v3/weather.png";
const manifestRelativePath =
  "apps/site/public/assets/lubirth/takram-parity/v3/manifest.json";
const cloudsRoot = path.join(
  repositoryRoot,
  "packages/lubirth-hero/node_modules/@takram/three-clouds"
);

const upstreamSourceHashes = Object.freeze({
  "build/shared.js": "cb1b4ec2400f873c1fe8cac6a00331a3972c9b7cdbc6349496e3c2de06886804",
  "src/CloudsEffect.ts": "db3800833dfb13e96ec292a631f9a782f7637909fb167c9443cd64583c9b43c3",
  "src/r3f/Clouds.tsx": "5a05e9c5fe97386be85b54dec588ba84237f857bb21404726179c53f018d4e53",
  "src/shaders/clouds.glsl": "bbb3f037e55aed6c989d77d197af33f44ee5565b0ca7988eab44f52ddd509eb5"
});
const expectedPatchedSourceHashes = Object.freeze({
  "build/shared.cjs": "b099d176aa70e9c938b0599fece0180aeb33af4b3b81936f40092c9ae89ed602",
  "build/shared.js": "c2115702324e01760429187faf6203c2a118812c508429edbebe37e2e1d7c018",
  "src/CloudsEffect.ts": "ccc1d0db7627e5d2e13e81748619e5e6c52a96ceb2d2ba8f34a43a03e2778cff",
  "src/r3f/Clouds.tsx": "5a05e9c5fe97386be85b54dec588ba84237f857bb21404726179c53f018d4e53",
  "src/shaders/clouds.glsl": "1fc4a4de4927c12dea23bf0590b24babf7251a0e6a6a442ac141d43c60caae19"
});
const mappingHunk = `vec2 getGlobeUv(const vec3 position) {
#ifdef GLOBAL_WEATHER_MAPPING
  return getSphericalUv(position);
#else
  return getCubeSphereUv(position);
#endif
}`;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedByte(value) {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

function adaptPixel(source, target, sourceIndex, targetIndex) {
  const sourceCoverage = source[sourceIndex] / 255;
  if (sourceCoverage < clearAirThreshold) {
    target[targetIndex] = 0;
    target[targetIndex + 1] = 0;
    target[targetIndex + 2] = 0;
    target[targetIndex + 3] = 0;
    return;
  }
  // The V3 channels are semantic controls, not four independent coverage
  // layers. G/B/A may sculpt only the R footprint, so their output is always
  // premultiplied by source coverage before Takram samples the layer channel.
  target[targetIndex] = normalizedByte(sourceCoverage);
  target[targetIndex + 1] = normalizedByte(
    sourceCoverage * (source[sourceIndex + 1] / 255)
  );
  target[targetIndex + 2] = normalizedByte(
    sourceCoverage * (source[sourceIndex + 2] / 255)
  );
  target[targetIndex + 3] = normalizedByte(
    sourceCoverage * (source[sourceIndex + 3] / 255)
  );
}

async function readPatchedSourceHashes() {
  const entries = await Promise.all(Object.keys(expectedPatchedSourceHashes).map(async (relativePath) => {
    const actualHash = sha256(await readFile(path.join(cloudsRoot, relativePath)));
    const expectedHash = expectedPatchedSourceHashes[relativePath];
    if (actualHash !== expectedHash) {
      throw new Error(
        `Takram patch source drifted at ${relativePath}: ${actualHash}; expected ${expectedHash}.`
      );
    }
    return [relativePath, actualHash];
  }));
  return Object.fromEntries(entries);
}

async function readSphericalMappingHash() {
  const source = await readFile(path.join(cloudsRoot, "src/shaders/clouds.glsl"), "utf8");
  const match = source.match(/vec2 getSphericalUv\(const vec3 position\) \{[\s\S]*?\n\}/);
  if (!match) {
    throw new Error("Unable to locate Takram getSphericalUv source.");
  }
  return sha256(match[0]);
}

const sourcePath = path.join(repositoryRoot, sourceRelativePath);
const outputPath = path.join(repositoryRoot, outputRelativePath);
const manifestPath = path.join(repositoryRoot, manifestRelativePath);
const sourceFile = await readFile(sourcePath);
const { data: sourceRgba, info } = await sharp(sourceFile)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

if (info.width !== info.height * 2 || info.channels !== 4) {
  throw new Error(
    `Takram V3 weather requires 2:1 RGBA input; received ${info.width}x${info.height}x${info.channels}.`
  );
}

const outputRgba = new Uint8Array(sourceRgba.byteLength);
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    // getSphericalUv's longitude increases in the inverse direction from the
    // source equirectangular V3 field. Bake the required flipU into the
    // deterministic weather image while retaining repeat=[1, 1].
    const sourceIndex = (y * info.width + (info.width - 1 - x)) * 4;
    const targetIndex = (y * info.width + x) * 4;
    adaptPixel(sourceRgba, outputRgba, sourceIndex, targetIndex);
  }
}
const encodedWeather = await sharp(outputRgba, {
  raw: { width: info.width, height: info.height, channels: 4 }
}).png({
  adaptiveFiltering: false,
  compressionLevel: 9,
  palette: false
}).toBuffer();
const patchedSourceHashes = await readPatchedSourceHashes();
const patchContents = await readFile(
  path.join(repositoryRoot, "patches/@takram__three-clouds@0.7.6.patch")
);
const packageJson = await readFile(path.join(cloudsRoot, "package.json"));
const manifest = {
  clearAirThreshold,
  flipU: true,
  flipY: true,
  generatorVersion,
  localWeatherVelocity: [0, 0],
  offset: localWeatherOffset,
  orientation,
  output: {
    byteLength: encodedWeather.byteLength,
    dimensions: [info.width, info.height, 1],
    format: "rgba8",
    path: outputRelativePath,
    runtimeUrl: "/assets/lubirth/takram-parity/v3/weather.png",
    sha256: sha256(encodedWeather)
  },
  outputLayoutId,
  patch: {
    hunkSha256: sha256(mappingHunk),
    package: "@takram/three-clouds@0.7.6",
    packageJsonSha256: sha256(packageJson),
    patchSha256: sha256(patchContents),
    patchedSourceHashes,
    upstreamSourceHashes
  },
  repeat: [1, 1],
  schemaVersion: 1,
  source: {
    dimensions: [info.width, info.height, 1],
    layout: "v3-r-depth-g-height-b-morphology-a-concavity",
    path: sourceRelativePath,
    sha256: sha256(sourceFile)
  },
  sourceLayoutId: "v3-r-depth-g-height-b-morphology-a-concavity",
  sphericalMappingSha256: await readSphericalMappingHash()
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, encodedWeather);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  output: manifest.output,
  source: manifest.source,
  version: generatorVersion
}, null, 2));
