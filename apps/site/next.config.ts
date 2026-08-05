import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertPostCoScrollProductionMediaIsolation,
  postCoScrollMediaResolverOptionsFromEnvironment
} from "./lib/media/resolvePostCoScrollMediaManifest.server";
import { resolveChapterPreviewScope } from "./lib/chapter-preview/resolveChapterPreviewScope";

const siteDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(siteDir, "../..");

assertPostCoScrollProductionMediaIsolation(
  postCoScrollMediaResolverOptionsFromEnvironment(siteDir)
);

function readGitValue(args: string[]) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

const buildRevision =
  process.env.NEXT_PUBLIC_MIRALITH_BUILD_REVISION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  readGitValue(["rev-parse", "HEAD"]) ||
  "unknown";
const buildDirty =
  process.env.NEXT_PUBLIC_MIRALITH_BUILD_DIRTY ??
  (readGitValue(["status", "--porcelain"]).length > 0 ? "true" : "false");
const chapterPreviewScope = resolveChapterPreviewScope({
  repoRoot,
  override: process.env.MIRALITH_CHAPTER_PREVIEW_SCOPE
});

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_MIRALITH_BUILD_DIRTY: buildDirty,
    NEXT_PUBLIC_MIRALITH_BUILD_REVISION: buildRevision,
    NEXT_PUBLIC_MIRALITH_CHAPTER_PREVIEW_SCOPE: chapterPreviewScope
  },
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
