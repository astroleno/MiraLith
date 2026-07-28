import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const CHAPTER_PREVIEW_SCOPE_VERSION = "chapter-preview-scope-v1";

const CHAPTER_PREVIEW_SCOPE_INPUTS = [
  "apps/site/app",
  "apps/site/components",
  "apps/site/content",
  "apps/site/lib",
  "apps/site/next.config.ts",
  "apps/site/package.json",
  "package.json",
  "pnpm-lock.yaml"
] as const;

export interface ChapterPreviewScopeAdapters {
  runGit?: (args: readonly string[], repoRoot: string) => string;
  readFile?: (absolutePath: string) => Buffer;
}

export interface ResolveChapterPreviewScopeOptions {
  repoRoot: string;
  override?: string | undefined;
  adapters?: ChapterPreviewScopeAdapters | undefined;
}

export function isChapterPreviewScope(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function defaultRunGit(args: readonly string[], repoRoot: string) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function readGitOutput(
  args: readonly string[],
  repoRoot: string,
  runGit: NonNullable<ChapterPreviewScopeAdapters["runGit"]>
) {
  try {
    return runGit(args, repoRoot);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to resolve chapter preview scope because Git failed: ${detail}`);
  }
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function resolveChapterPreviewScope({
  repoRoot,
  override,
  adapters = {}
}: ResolveChapterPreviewScopeOptions) {
  if (override !== undefined) {
    if (!isChapterPreviewScope(override)) {
      throw new Error("MIRALITH_CHAPTER_PREVIEW_SCOPE must be a lower-case 64-character hex digest.");
    }
    return override;
  }

  const runGit = adapters.runGit ?? defaultRunGit;
  const readFile = adapters.readFile ?? readFileSync;
  const gitHead = readGitOutput(["rev-parse", "HEAD"], repoRoot, runGit).trim();
  const listedFiles = readGitOutput(
    ["ls-files", "-co", "--exclude-standard", "--deduplicate", "-z", "--", ...CHAPTER_PREVIEW_SCOPE_INPUTS],
    repoRoot,
    runGit
  );
  const normalizedRoot = path.resolve(repoRoot);
  const files = listedFiles
    .split("\0")
    .filter(Boolean)
    .map(normalizeRelativePath)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const digest = createHash("sha256");

  digest.update(`${CHAPTER_PREVIEW_SCOPE_VERSION}\n`);
  digest.update(`${gitHead}\n`);

  for (const relativePath of files) {
    const absolutePath = path.resolve(normalizedRoot, relativePath);
    if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error(`Unable to resolve chapter preview scope: invalid selected path ${relativePath}.`);
    }

    let content: Buffer;
    try {
      content = readFile(absolutePath);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to resolve chapter preview scope because selected source cannot be read (${relativePath}): ${detail}`);
    }
    digest.update(relativePath);
    digest.update("\0");
    digest.update(sha256(content));
    digest.update("\n");
  }

  return digest.digest("hex");
}
