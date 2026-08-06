import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  normalizePostCoScrollMediaManifest,
  type NormalizedPostCoScrollMediaManifest,
  type NormalizedPostCoScrollMediaItem,
  type PostCoScrollMediaDiagnostic
} from "../../content/postCoScrollMedia";

export type PostCoScrollMediaMode = "off" | "local-preview";

export interface PostCoScrollMediaResolverOptions {
  mode: PostCoScrollMediaMode;
  nodeEnv: string;
  publicRoot: string;
}

export type PostCoScrollMediaResolverResult =
  | {
      status: "ready" | "degraded";
      manifest: NormalizedPostCoScrollMediaManifest;
      diagnostics: PostCoScrollMediaDiagnostic[];
    }
  | {
      status: "disabled" | "invalid";
      manifest: null;
      diagnostics: PostCoScrollMediaDiagnostic[];
    };

const PREVIEW_ROOT_RELATIVE = "media/post-coscroll";
const PREVIEW_MANIFEST_RELATIVE = `${PREVIEW_ROOT_RELATIVE}/manifest.preview.json`;

export function assertPostCoScrollProductionMediaIsolation(
  options: PostCoScrollMediaResolverOptions
): void {
  if (options.nodeEnv !== "production") return;
  if (options.mode === "local-preview") {
    throw new Error(
      "Post-CoScroll local-preview mode is forbidden in production. Unset MIRALITH_POST_COSCROLL_MEDIA_MODE."
    );
  }

  const previewRoot = join(options.publicRoot, PREVIEW_ROOT_RELATIVE);
  if (existsSync(previewRoot)) {
    throw new Error("Post-CoScroll preview media residue is forbidden in production.");
  }
}

function diagnostic(
  code: string,
  message: string,
  mediaId?: string,
  field?: string
): PostCoScrollMediaDiagnostic {
  return { code, message, ...(mediaId ? { mediaId } : {}), ...(field ? { field } : {}) };
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });
}

function isWithinRoot(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

async function verifyLocalFile(
  publicRoot: string,
  file: { assetKey: string; bytes: number; sha256: string },
  mediaId: string,
  field: string
): Promise<PostCoScrollMediaDiagnostic | null> {
  const mediaRoot = resolve(publicRoot, "media");
  const candidate = resolve(mediaRoot, file.assetKey);
  if (!isWithinRoot(mediaRoot, candidate)) {
    return diagnostic(
      "LOCAL_FILE_OUTSIDE_ROOT",
      `${mediaId} ${field} resolves outside the public media root.`,
      mediaId,
      field
    );
  }

  let canonicalRoot: string;
  let canonicalCandidate: string;
  try {
    canonicalRoot = await realpath(mediaRoot);
    canonicalCandidate = await realpath(candidate);
  } catch {
    return diagnostic(
      "LOCAL_FILE_MISSING",
      `${mediaId} ${field} is missing from the local preview output.`,
      mediaId,
      field
    );
  }
  if (!isWithinRoot(canonicalRoot, canonicalCandidate)) {
    return diagnostic(
      "LOCAL_FILE_OUTSIDE_ROOT",
      `${mediaId} ${field} escapes the public media root through a symlink.`,
      mediaId,
      field
    );
  }

  const metadata = await stat(canonicalCandidate);
  if (!metadata.isFile()) {
    return diagnostic(
      "LOCAL_FILE_NOT_REGULAR",
      `${mediaId} ${field} is not a regular file.`,
      mediaId,
      field
    );
  }
  if (metadata.size !== file.bytes) {
    return diagnostic(
      "LOCAL_FILE_BYTES_MISMATCH",
      `${mediaId} ${field} byte size does not match manifest.`,
      mediaId,
      field
    );
  }
  if ((await sha256File(canonicalCandidate)) !== file.sha256) {
    return diagnostic(
      "LOCAL_FILE_HASH_MISMATCH",
      `${mediaId} ${field} SHA-256 does not match manifest.`,
      mediaId,
      field
    );
  }
  return null;
}

async function verifyItem(
  publicRoot: string,
  item: NormalizedPostCoScrollMediaItem
): Promise<PostCoScrollMediaDiagnostic[]> {
  if (item.availability !== "ready") return [];
  const diagnostics: PostCoScrollMediaDiagnostic[] = [];

  if (item.poster) {
    const issue = await verifyLocalFile(publicRoot, item.poster, item.id, "poster");
    if (issue) diagnostics.push(issue);
  }
  if (item.variants) {
    for (const variantName of ["desktop", "mobile"] as const) {
      const issue = await verifyLocalFile(
        publicRoot,
        item.variants[variantName],
        item.id,
        variantName
      );
      if (issue) diagnostics.push(issue);
    }
  }
  return diagnostics;
}

function degradeManifest(
  manifest: NormalizedPostCoScrollMediaManifest,
  diagnostics: PostCoScrollMediaDiagnostic[]
): NormalizedPostCoScrollMediaManifest {
  const failedIds = new Set(diagnostics.flatMap((issue) => (issue.mediaId ? [issue.mediaId] : [])));
  const items = Object.fromEntries(
    Object.entries(manifest.items).map(([id, item]) => {
      if (!failedIds.has(id) || item.availability !== "ready") return [id, item];
      const posterFailed = diagnostics.some(
        (issue) => issue.mediaId === id && issue.field === "poster"
      );
      return [
        id,
        {
          ...item,
          availability: "fallback" as const,
          poster: posterFailed ? null : item.poster,
          variants: null
        }
      ];
    })
  );
  return { ...manifest, items };
}

export async function resolvePostCoScrollMediaManifest(
  options: PostCoScrollMediaResolverOptions
): Promise<PostCoScrollMediaResolverResult> {
  try {
    assertPostCoScrollProductionMediaIsolation(options);
  } catch (error) {
    return {
      status: "invalid",
      manifest: null,
      diagnostics: [
        diagnostic(
          "PRODUCTION_PREVIEW_ISOLATION_FAILED",
          error instanceof Error ? error.message : String(error)
        )
      ]
    };
  }

  if (options.mode === "off") {
    return { status: "disabled", manifest: null, diagnostics: [] };
  }

  const manifestPath = join(options.publicRoot, PREVIEW_MANIFEST_RELATIVE);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return {
      status: "invalid",
      manifest: null,
      diagnostics: [
        diagnostic(
          "LOCAL_PREVIEW_MANIFEST_UNREADABLE",
          "The local preview manifest could not be read."
        )
      ]
    };
  }

  const normalized = normalizePostCoScrollMediaManifest(parsed, { assetBaseUrl: "/media/" });
  if (!normalized.ok) {
    return { status: "invalid", manifest: null, diagnostics: normalized.diagnostics };
  }

  const fileDiagnostics = (
    await Promise.all(
      Object.values(normalized.manifest.items).map((item) =>
        verifyItem(options.publicRoot, item)
      )
    )
  ).flat();

  if (fileDiagnostics.length === 0) {
    return { status: "ready", manifest: normalized.manifest, diagnostics: [] };
  }
  return {
    status: "degraded",
    manifest: degradeManifest(normalized.manifest, fileDiagnostics),
    diagnostics: fileDiagnostics
  };
}

export function postCoScrollMediaResolverOptionsFromEnvironment(
  siteDirectory: string
): PostCoScrollMediaResolverOptions {
  const rawMode = process.env.MIRALITH_POST_COSCROLL_MEDIA_MODE ?? "off";
  if (rawMode !== "off" && rawMode !== "local-preview") {
    throw new Error(
      `Invalid MIRALITH_POST_COSCROLL_MEDIA_MODE=${rawMode}; expected off or local-preview.`
    );
  }
  return {
    mode: rawMode,
    nodeEnv: process.env.NODE_ENV ?? "development",
    publicRoot: join(siteDirectory, "public")
  };
}

export const POST_COSCROLL_PREVIEW_MANIFEST_RELATIVE_PATH = PREVIEW_MANIFEST_RELATIVE;
