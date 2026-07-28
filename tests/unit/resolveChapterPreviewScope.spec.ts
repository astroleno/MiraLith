import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  resolveChapterPreviewScope
} from "../../apps/site/lib/chapter-preview/resolveChapterPreviewScope";

const fixedGitEnvironment = {
  ...process.env,
  GIT_AUTHOR_NAME: "MiraLith Fixture",
  GIT_AUTHOR_EMAIL: "fixture@miralith.local",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z",
  GIT_COMMITTER_NAME: "MiraLith Fixture",
  GIT_COMMITTER_EMAIL: "fixture@miralith.local",
  GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z"
};

const fixtureFiles = [
  ["apps/site/app/page.tsx", "export default function Page() { return null; }\n"],
  ["apps/site/components/Chapter.tsx", "export const Chapter = null;\n"],
  ["apps/site/content/chapters.ts", "export const chapters = [];\n"],
  ["apps/site/lib/access.ts", "export const access = true;\n"],
  ["apps/site/next.config.ts", "export default {};\n"],
  ["apps/site/package.json", "{\"name\":\"@fixture/site\"}\n"],
  ["package.json", "{\"name\":\"fixture\"}\n"],
  ["pnpm-lock.yaml", "lockfileVersion: '9.0'\n"],
  [".gitignore", "apps/site/content/ignored.ts\n"]
] as const;

function git(repoRoot: string, ...args: string[]) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    env: fixedGitEnvironment
  }).trim();
}

async function writeFixtureFile(repoRoot: string, relativePath: string, contents: string) {
  const absolutePath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

async function createFixtureRepository(writeOrder = fixtureFiles.map(([relativePath]) => relativePath)) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), "miralith-preview-scope-"));
  git(repoRoot, "init", "--quiet");

  for (const relativePath of writeOrder) {
    const entry = fixtureFiles.find(([candidate]) => candidate === relativePath);
    if (!entry) {
      throw new Error(`Missing fixture entry for ${relativePath}`);
    }
    await writeFixtureFile(repoRoot, entry[0], entry[1]);
  }

  git(repoRoot, "add", ".");
  git(repoRoot, "commit", "--quiet", "-m", "fixture");
  return repoRoot;
}

async function withFixture<T>(callback: (repoRoot: string) => Promise<T>) {
  const repoRoot = await createFixtureRepository();
  try {
    return await callback(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

test("creates a stable scope when identical selected files are created in a different order", async () => {
  const first = await createFixtureRepository();
  const second = await createFixtureRepository([...fixtureFiles.map(([relativePath]) => relativePath)].reverse());

  try {
    expect(git(first, "rev-parse", "HEAD")).toBe(git(second, "rev-parse", "HEAD"));
    expect(resolveChapterPreviewScope({ repoRoot: first })).toBe(resolveChapterPreviewScope({ repoRoot: second }));
  } finally {
    await Promise.all([
      rm(first, { recursive: true, force: true }),
      rm(second, { recursive: true, force: true })
    ]);
  }
});

test("changes scope for selected content and non-ignored untracked selected files", async () => {
  await withFixture(async (repoRoot) => {
    const initialScope = resolveChapterPreviewScope({ repoRoot });

    await writeFixtureFile(repoRoot, "apps/site/content/chapters.ts", "export const chapters = ['changed'];\n");
    const changedContentScope = resolveChapterPreviewScope({ repoRoot });
    expect(changedContentScope).not.toBe(initialScope);

    await writeFixtureFile(repoRoot, "apps/site/lib/local-preview.ts", "export const localPreview = true;\n");
    expect(resolveChapterPreviewScope({ repoRoot })).not.toBe(changedContentScope);
  });
});

test("excludes ignored untracked selected files", async () => {
  await withFixture(async (repoRoot) => {
    const initialScope = resolveChapterPreviewScope({ repoRoot });
    await writeFixtureFile(repoRoot, "apps/site/content/ignored.ts", "export const ignored = true;\n");
    expect(resolveChapterPreviewScope({ repoRoot })).toBe(initialScope);
  });
});

test("rejects malformed overrides", async () => {
  await withFixture(async (repoRoot) => {
    expect(() => resolveChapterPreviewScope({ repoRoot, override: "not-a-scope" })).toThrow(/64.*hex/i);
    expect(() => resolveChapterPreviewScope({ repoRoot, override: "A".repeat(64) })).toThrow(/64.*hex/i);
  });
});

test("fails closed when Git or selected source reads are unavailable", async () => {
  await withFixture(async (repoRoot) => {
    expect(() => resolveChapterPreviewScope({
      repoRoot,
      adapters: {
        runGit: () => {
          throw new Error("Git unavailable");
        }
      }
    })).toThrow(/git/i);
    expect(() => resolveChapterPreviewScope({
      repoRoot,
      adapters: {
        readFile: () => {
          throw new Error("Source unreadable");
        }
      }
    })).toThrow(/read|source/i);
  });
});
