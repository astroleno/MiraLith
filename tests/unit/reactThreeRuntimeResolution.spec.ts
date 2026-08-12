import fs from "node:fs";
import module from "node:module";
import path from "node:path";
import { expect, test } from "@playwright/test";

const repositoryRoot = process.cwd();

const consumerManifests = {
  site: "apps/site/package.json",
  radioGaga: "packages/radio-gaga-scene/package.json",
  coScroll: "packages/coscroll-scene/package.json",
  luBirth: "packages/lubirth-hero/package.json"
} as const;

const sharedRuntimes = [
  "@react-three/fiber",
  "@react-three/drei",
  "react",
  "react-dom"
] as const;

function resolveRuntimeFromConsumer(manifestPath: string, runtime: string) {
  const consumerRequire = module.createRequire(path.resolve(repositoryRoot, manifestPath));
  return fs.realpathSync(consumerRequire.resolve(runtime));
}

for (const runtime of sharedRuntimes) {
  test(`${runtime} resolves to one physical runtime across every React Three consumer`, () => {
    const resolutions = Object.fromEntries(
      Object.entries(consumerManifests).map(([consumer, manifestPath]) => [
        consumer,
        resolveRuntimeFromConsumer(manifestPath, runtime)
      ])
    );

    expect(new Set(Object.values(resolutions)).size, resolutions).toBe(1);
  });
}
