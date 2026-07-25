import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPostCoScrollProductionMediaIsolation,
  postCoScrollMediaResolverOptionsFromEnvironment
} from "./lib/media/resolvePostCoScrollMediaManifest.server";

const siteDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(siteDir, "../..");

assertPostCoScrollProductionMediaIsolation(
  postCoScrollMediaResolverOptionsFromEnvironment(siteDir)
);

const nextConfig: NextConfig = {
  transpilePackages: [
    "@miralith/lubirth-hero",
    "@miralith/visual-core",
    "@miralith/radio-gaga-scene"
  ],
  turbopack: {
    root: repoRoot
  },
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  images: {
    qualities: [70, 75]
  }
};

export default nextConfig;
