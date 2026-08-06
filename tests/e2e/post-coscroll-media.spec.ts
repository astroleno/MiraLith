import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  POST_COSCROLL_MEDIA_SOURCE_SPEC,
  POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256
} from "../../apps/site/content/postCoScrollMediaSource";
import {
  normalizePostCoScrollMediaManifest,
  validatePostCoScrollMediaSourceSpec
} from "../../apps/site/content/postCoScrollMedia";
import {
  assertPostCoScrollProductionMediaIsolation,
  resolvePostCoScrollMediaManifest
} from "../../apps/site/lib/media/resolvePostCoScrollMediaManifest.server";
import { resolvePostCoScrollMediaUrl } from "../../apps/site/lib/media/resolvePostCoScrollMediaUrl";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function expectedDurationSeconds(clipId: string) {
  const clip = POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.find((candidate) => candidate.id === clipId)!;
  const source = POST_COSCROLL_MEDIA_SOURCE_SPEC.sources.find(
    (candidate) => candidate.id === clip.sourceId
  );
  if (!source?.sourceTimeBase) return 0;
  const [numerator, denominator] = source.sourceTimeBase.split("/").map(Number);
  const sourceDuration = clip.sourceSegments.reduce(
    (total, segment) =>
      total + ((segment.endPTSExclusive - segment.startPTS) * numerator) / denominator,
    0
  );
  return clip.id === "artbreeze-first-sequence" ? sourceDuration + 3 / 30 : sourceDuration;
}

function previewManifestFixture() {
  const items = POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.map((clip) => {
    if (clip.availability !== "available") {
      return {
        id: clip.id,
        workId: clip.workId,
        availability: clip.availability,
        mode: clip.mode,
        sourceSegments: clip.sourceSegments,
        poster: null,
        variants: null,
        fallback: clip.fallback
      };
    }

    const firstFrameMd5 = clip.sourceSegments[0].firstFrameMd5;
    const lastIncludedFrameMd5 =
      clip.sourceSegments[clip.sourceSegments.length - 1].lastIncludedFrameMd5;
    const poster = {
      assetKey: `post-coscroll/${clip.id}/poster.webp`,
      bytes: 100,
      sha256: SHA_A,
      format: "webp",
      width: 960,
      height: 540,
      sourceFrameMd5: firstFrameMd5
    };

    return {
      id: clip.id,
      workId: clip.workId,
      availability: "ready",
      mode: clip.mode,
      sourceSegments: clip.sourceSegments,
      poster,
      variants:
        clip.mode === "frame-hold"
          ? null
          : {
              desktop: {
                assetKey: `post-coscroll/${clip.id}/desktop.mp4`,
                bytes: 1_000,
                sha256: SHA_A,
                container: "mp4",
                codec: "h264",
                pixelFormat: "yuv420p",
                width: 1_920,
                height: 1_080,
                durationSeconds: expectedDurationSeconds(clip.id),
                frameRate: "30/1",
                fastStart: true,
                firstFrameMd5,
                lastIncludedFrameMd5,
                outputFirstFrameMd5: "c".repeat(32),
                outputLastFrameMd5: "d".repeat(32)
              },
              mobile: {
                assetKey: `post-coscroll/${clip.id}/mobile.mp4`,
                bytes: 500,
                sha256: SHA_B,
                container: "mp4",
                codec: "h264",
                pixelFormat: "yuv420p",
                width: 960,
                height: 540,
                durationSeconds: expectedDurationSeconds(clip.id),
                frameRate: "30/1",
                fastStart: true,
                firstFrameMd5,
                lastIncludedFrameMd5,
                outputFirstFrameMd5: "e".repeat(32),
                outputLastFrameMd5: "f".repeat(32)
              }
            },
      fallback: clip.fallback
    };
  });

  return {
    kind: "miralith-post-coscroll-media-manifest",
    version: 1,
    channel: "local-preview",
    generatedAt: "2026-07-25T00:00:00.000Z",
    sourceSpecSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256,
    editorialFreezeSha256: POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze.sha256,
    toolchain: {
      ffmpegVersion: "ffmpeg version 8.1",
      ffprobeVersion: "ffprobe version 8.1"
    },
    items
  };
}

async function writePreviewFixture() {
  const root = await mkdtemp(join(tmpdir(), "miralith-post-coscroll-media-"));
  const publicRoot = join(root, "public");
  const manifest = previewManifestFixture();

  for (const item of manifest.items) {
    for (const file of [
      item.poster,
      item.variants?.desktop ?? null,
      item.variants?.mobile ?? null
    ]) {
      if (!file) continue;
      const contents = Buffer.from(`${item.id}:${file.assetKey}`);
      file.bytes = contents.byteLength;
      file.sha256 = createHash("sha256").update(contents).digest("hex");
      const output = join(publicRoot, "media", file.assetKey);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, contents);
    }
  }

  const manifestPath = join(publicRoot, "media/post-coscroll/manifest.preview.json");
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { root, publicRoot, manifest, manifestPath };
}

test("Unit 1 keeps a committed post-CoScroll media source spec", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  expect(
    existsSync(resolve(process.cwd(), "apps/site/content/postCoScrollMediaSource.ts"))
  ).toBe(true);
});

test("the ArtBreeze first sequence is bound to the exact CP0.4 B v9 freeze", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  expect(POST_COSCROLL_MEDIA_SOURCE_SPEC.editorialFreeze).toEqual({
    version: "cp0.4-b-ring-first-v9-2026-07-25",
    sha256: "d906937cc0b885b12fc942f91ce50e9af919878142cead5c0b36d8bd648140a1",
    selectedLinearSha256:
      "803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e"
  });

  const firstSequence = POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.find(
    (clip) => clip.id === "artbreeze-first-sequence"
  );
  expect(firstSequence?.sourceSegments).toEqual([
    {
      startPTS: 1_065_000,
      endPTSExclusive: 1_668_000,
      firstFrameMd5: "9fb23e4d30cf5d743e46e7ad012a94ca",
      lastIncludedFrameMd5: "49301f8b7a26c5f371c0673252cbb59f"
    },
    {
      startPTS: 12_000,
      endPTSExclusive: 1_065_000,
      firstFrameMd5: "575222c1865ec8a9d036b416d1306f6f",
      lastIncludedFrameMd5: "63c8775a4e1ed3f714bb9adf48bd5484"
    }
  ]);
  expect(firstSequence?.editorial).toMatchObject({
    order: "B-ring-first-v9",
    omitSourceFrameRangeHalfOpen: [0, 4],
    returnTransitionFrames: 4,
    restartSilenceSeconds: 0.1,
    sourceAudioFadeSeconds: 0.012
  });
});

test("the spec keeps exact adjacent PTS boundaries and honest asset availability", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  const clip = (id: string) => {
    const result = POST_COSCROLL_MEDIA_SOURCE_SPEC.clips.find((candidate) => candidate.id === id);
    expect(result, `missing clip ${id}`).toBeTruthy();
    return result!;
  };

  expect(clip("aescape-scrub").sourceSegments[0].endPTSExclusive).toBe(
    clip("aescape-showcase").sourceSegments[0].startPTS
  );
  expect(clip("cosmic-threshold").sourceSegments[0]).toMatchObject({
    startPTS: 6_057_000,
    endPTSExclusive: 6_681_000,
    lastIncludedFrameMd5: "883976454a19b26a4cc1aee70e28cfe9"
  });
  expect(clip("cosmic-threshold").excludedSourceSentinel).toEqual({
    sourceFrame: 2_229,
    pts: 6_687_000,
    frameMd5: "1c5a1273fd86147413419ff2757d6aed",
    content: "first-pool-frame"
  });

  expect(
    POST_COSCROLL_MEDIA_SOURCE_SPEC.sources.find((source) => source.id === "dulwich")
  ).toEqual({
    id: "dulwich",
    workId: "dulwich",
    availability: "available",
    sourceFileLabel: "dulwich-homepage-video-2026.mp4",
    sourceSha256: "a197358cf11b240ea8d9ed4cdf9cafa05d686d044eb523b64ac1b772045c17be",
    sourceBytes: 2_910_645,
    sourceTimeBase: "1/15360",
    sourceFrameRate: "30/1",
    frameStepPTS: 512,
    durationPTS: 257_536,
    video: { codec: "h264", width: 1_280, height: 720 },
    audio: { codec: "aac", sampleRate: 44_100, channels: 2 }
  });
  expect(clip("dulwich-film")).toMatchObject({
    availability: "available",
    sourceId: "dulwich",
    sourceSegments: [
      {
        startPTS: 0,
        endPTSExclusive: 257_536,
        firstFrameMd5: "3d30ffbff1bf8d66cf7b5e148bd0f032",
        lastIncludedFrameMd5: "a485c10eb970552246a62f75eeaaea39"
      }
    ],
    mode: "autoplay",
    poster: { kind: "source-frame", sourcePTS: 0 }
  });
  expect(clip("li-delivery")).toMatchObject({ availability: "pending", sourceSegments: [] });
  expect(clip("ugcflow-delivery")).toMatchObject({ availability: "pending", sourceSegments: [] });
});

test("the shared facade validates the source contract and preserves unavailable states", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  expect(validatePostCoScrollMediaSourceSpec(POST_COSCROLL_MEDIA_SOURCE_SPEC)).toEqual({
    errors: [],
    missingRequiredIds: [],
    pendingIds: ["li-delivery", "ugcflow-delivery"]
  });

  const result = normalizePostCoScrollMediaManifest(previewManifestFixture(), {
    assetBaseUrl: "/media/"
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.manifest.items["artbreeze-first-sequence"]).toMatchObject({
    availability: "ready",
    mode: "scrub",
    poster: {
      src: "/media/post-coscroll/artbreeze-first-sequence/poster.webp"
    },
    variants: {
      desktop: {
        src: "/media/post-coscroll/artbreeze-first-sequence/desktop.mp4"
      }
    }
  });
  expect(result.manifest.items["li-delivery"]).toMatchObject({
    availability: "pending",
    poster: null,
    variants: null,
    fallback: { kind: "dossier", dossierId: "li" }
  });
});

test("manifest validation fails closed for stale identity, unsafe paths, and byte overruns", ({
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  const stale = previewManifestFixture();
  stale.sourceSpecSha256 = SHA_A;
  expect(normalizePostCoScrollMediaManifest(stale, { assetBaseUrl: "/media/" })).toMatchObject({
    ok: false,
    diagnostics: [{ code: "SOURCE_SPEC_HASH_MISMATCH" }]
  });

  const unsafe = previewManifestFixture();
  const unsafeItem = unsafe.items.find((item) => item.id === "artbreeze-first-sequence")!;
  if (unsafeItem.variants) unsafeItem.variants.desktop.assetKey = "../private/master.mp4";
  expect(normalizePostCoScrollMediaManifest(unsafe, { assetBaseUrl: "/media/" })).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({ code: "UNSAFE_ASSET_KEY", mediaId: "artbreeze-first-sequence" })
    ])
  });

  const oversized = previewManifestFixture();
  const oversizedItem = oversized.items.find((item) => item.id === "artbreeze-first-sequence")!;
  if (oversizedItem.variants) oversizedItem.variants.desktop.bytes = 8_000_001;
  expect(normalizePostCoScrollMediaManifest(oversized, { assetBaseUrl: "/media/" })).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      expect.objectContaining({
        code: "MEDIA_BUDGET_EXCEEDED",
        mediaId: "artbreeze-first-sequence",
        overByBytes: 1
      })
    ])
  });
});

test("the local-preview server resolver verifies real files and degrades to a real poster", async ({
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const fixture = await writePreviewFixture();

  try {
    const ready = await resolvePostCoScrollMediaManifest({
      mode: "local-preview",
      nodeEnv: "development",
      publicRoot: fixture.publicRoot
    });
    expect(ready).toMatchObject({
      status: "ready",
      manifest: {
        items: {
          "artbreeze-first-sequence": {
            availability: "ready",
            variants: {
              desktop: {
                src: "/media/post-coscroll/artbreeze-first-sequence/desktop.mp4",
                outputFirstFrameMd5: "c".repeat(32),
                outputLastFrameMd5: "d".repeat(32)
              }
            }
          }
        }
      }
    });

    await rm(
      join(
        fixture.publicRoot,
        "media/post-coscroll/artbreeze-first-sequence/desktop.mp4"
      )
    );
    const degraded = await resolvePostCoScrollMediaManifest({
      mode: "local-preview",
      nodeEnv: "development",
      publicRoot: fixture.publicRoot
    });
    expect(degraded).toMatchObject({
      status: "degraded",
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "LOCAL_FILE_MISSING",
          mediaId: "artbreeze-first-sequence",
          field: "desktop"
        })
      ]),
      manifest: {
        items: {
          "artbreeze-first-sequence": {
            availability: "fallback",
            poster: {
              src: "/media/post-coscroll/artbreeze-first-sequence/poster.webp"
            },
            variants: null
          }
        }
      }
    });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("the local-preview resolver never exposes its filesystem path in client-safe diagnostics", async ({
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const emptyRoot = await mkdtemp(join(tmpdir(), "miralith-post-coscroll-diagnostic-"));

  try {
    const result = await resolvePostCoScrollMediaManifest({
      mode: "local-preview",
      nodeEnv: "development",
      publicRoot: emptyRoot
    });
    expect(result).toMatchObject({
      status: "invalid",
      diagnostics: [expect.objectContaining({ code: "LOCAL_PREVIEW_MANIFEST_UNREADABLE" })]
    });
    expect(JSON.stringify(result.diagnostics)).not.toContain(emptyRoot);
  } finally {
    await rm(emptyRoot, { recursive: true, force: true });
  }
});

test("production rejects both the local-preview flag and preview residue", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const emptyRoot = await mkdtemp(join(tmpdir(), "miralith-post-coscroll-production-"));
  const fixture = await writePreviewFixture();

  try {
    expect(() =>
      assertPostCoScrollProductionMediaIsolation({
        mode: "local-preview",
        nodeEnv: "production",
        publicRoot: emptyRoot
      })
    ).toThrow(/local-preview mode is forbidden/i);

    expect(() =>
      assertPostCoScrollProductionMediaIsolation({
        mode: "off",
        nodeEnv: "production",
        publicRoot: fixture.publicRoot
      })
    ).toThrow(/preview media residue/i);

    const productionResidue = await resolvePostCoScrollMediaManifest({
      mode: "off",
      nodeEnv: "production",
      publicRoot: fixture.publicRoot
    });
    expect(productionResidue).toMatchObject({
      status: "invalid",
      diagnostics: [expect.objectContaining({ code: "PRODUCTION_PREVIEW_ISOLATION_FAILED" })]
    });
    expect(JSON.stringify(productionResidue.diagnostics)).not.toContain(fixture.publicRoot);

    await expect(
      resolvePostCoScrollMediaManifest({
        mode: "off",
        nodeEnv: "development",
        publicRoot: emptyRoot
      })
    ).resolves.toEqual({ status: "disabled", manifest: null, diagnostics: [] });
  } finally {
    await rm(emptyRoot, { recursive: true, force: true });
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("production ArtBreeze direct entry is a deterministic unpublished fallback with no local video", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The production route boundary only needs one browser profile.");

  await page.goto("/artbreeze");
  const route = page.locator("[data-post-coscroll-route='artbreeze']");
  await expect(route).toBeVisible();
  await expect(route).toHaveAttribute("data-post-coscroll-resolver-status", "disabled");
  await expect(route).toHaveAttribute("data-post-coscroll-fallback", "true");
  await expect(route.locator("video")).toHaveCount(0);
  await expect(page.locator("a[aria-label^='01 LuBirth']")).toBeVisible();
  await expect(page.locator("a[aria-label^='02 Radio Gaga']")).toBeVisible();
  await expect(page.locator("a[aria-label^='03 CoScroll']")).toBeVisible();
  await expect(page.locator("a[aria-label^='04 ArtBreeze']")).toHaveCount(0);
  await expect(page.locator("a[aria-label^='05 Floating Constellation']")).toHaveCount(0);
  await expect(page.locator("a[aria-label^='06 Client Works']")).toHaveCount(0);
  await expect(page.locator("a[aria-label^='07 Now Building']")).toHaveCount(0);
  await expect(page.locator("[data-chapter-transition-layer]")).toHaveAttribute("data-state", "idle");
});

test("the URL resolver accepts only trusted bases and stable relative media keys", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  expect(
    resolvePostCoScrollMediaUrl(
      "/media/",
      "post-coscroll/artbreeze-first-sequence/desktop.mp4"
    )
  ).toBe("/media/post-coscroll/artbreeze-first-sequence/desktop.mp4");
  expect(() =>
    resolvePostCoScrollMediaUrl("/media/", "post-coscroll/%2e%2e/private.mp4")
  ).toThrow(/unsafe/i);
  expect(() =>
    resolvePostCoScrollMediaUrl("http://cdn.example.test/", "post-coscroll/safe.mp4")
  ).toThrow(/https/i);
});

test("the committed source-spec digest is reproducible", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");

  expect(
    createHash("sha256")
      .update(JSON.stringify(POST_COSCROLL_MEDIA_SOURCE_SPEC))
      .digest("hex")
  ).toBe(POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256);
});

test("the toolchain check records versions and diagnoses a missing binary", ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const siteDir = resolve(process.cwd(), "apps/site");
  const script = resolve(siteDir, "scripts/check-post-coscroll-media-toolchain.mjs");

  const healthy = spawnSync(process.execPath, [script, "--json"], {
    cwd: siteDir,
    encoding: "utf8"
  });
  expect(healthy.status, healthy.stderr).toBe(0);
  expect(JSON.parse(healthy.stdout)).toMatchObject({
    ok: true,
    ffmpegVersion: expect.stringMatching(/^ffmpeg version /),
    ffprobeVersion: expect.stringMatching(/^ffprobe version /)
  });

  const missing = spawnSync(
    process.execPath,
    [script, "--ffmpeg", "/definitely/missing/ffmpeg", "--json"],
    { cwd: siteDir, encoding: "utf8" }
  );
  expect(missing.status).not.toBe(0);
  expect(`${missing.stdout}\n${missing.stderr}`).toMatch(/FFMPEG_UNAVAILABLE/);
});

test("prepare fails before transcoding for missing roots, missing ids, and stale freeze evidence", async ({
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const siteDir = resolve(process.cwd(), "apps/site");
  const script = resolve(siteDir, "scripts/prepare-post-coscroll-media.mjs");
  const fixtureRoot = await mkdtemp(join(tmpdir(), "miralith-post-coscroll-prepare-"));
  const emptySourceRoot = join(fixtureRoot, "empty-source");
  const outputRoot = join(fixtureRoot, "output");
  const staleFreeze = join(fixtureRoot, "stale-freeze.json");
  await mkdir(emptySourceRoot, { recursive: true });
  await writeFile(staleFreeze, "{}\n");

  try {
    const missingRoot = spawnSync(
      process.execPath,
      [
        script,
        "--source-root",
        join(fixtureRoot, "does-not-exist"),
        "--output-root",
        outputRoot,
        "--check-only"
      ],
      { cwd: siteDir, encoding: "utf8" }
    );
    expect(missingRoot.status).not.toBe(0);
    expect(`${missingRoot.stdout}\n${missingRoot.stderr}`).toMatch(/SOURCE_ROOT_MISSING/);

    const unsafeOutput = spawnSync(
      process.execPath,
      [
        script,
        "--source-root",
        emptySourceRoot,
        "--output-root",
        join(emptySourceRoot, "generated/post-coscroll"),
        "--check-only"
      ],
      { cwd: siteDir, encoding: "utf8" }
    );
    expect(unsafeOutput.status).not.toBe(0);
    expect(`${unsafeOutput.stdout}\n${unsafeOutput.stderr}`).toMatch(/OUTPUT_ROOT_UNSAFE/);

    const missingSources = spawnSync(
      process.execPath,
      [
        script,
        "--source-root",
        emptySourceRoot,
        "--output-root",
        outputRoot,
        "--check-only"
      ],
      { cwd: siteDir, encoding: "utf8" }
    );
    expect(missingSources.status).not.toBe(0);
    expect(`${missingSources.stdout}\n${missingSources.stderr}`).toMatch(
      /MISSING_SOURCE_IDS.*artbreeze.*dulwich/s
    );

    const stale = spawnSync(
      process.execPath,
      [
        script,
        "--source-root",
        emptySourceRoot,
        "--output-root",
        outputRoot,
        "--editorial-freeze-file",
        staleFreeze,
        "--check-only"
      ],
      { cwd: siteDir, encoding: "utf8" }
    );
    expect(stale.status).not.toBe(0);
    expect(`${stale.stdout}\n${stale.stderr}`).toMatch(/EDITORIAL_FREEZE_HASH_MISMATCH/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("prepare accepts an explicit per-source file without persisting its absolute path", async ({
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const siteDir = resolve(process.cwd(), "apps/site");
  const script = resolve(siteDir, "scripts/prepare-post-coscroll-media.mjs");
  const fixtureRoot = await mkdtemp(join(tmpdir(), "miralith-post-coscroll-source-file-"));
  const sourceRoot = join(fixtureRoot, "source");
  const outputRoot = join(fixtureRoot, "output");
  const dulwichPath = join(fixtureRoot, "private", "dulwich.mp4");
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(dirname(dulwichPath), { recursive: true });
  await writeFile(dulwichPath, "fixture");

  try {
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--source-root",
        sourceRoot,
        "--source-file",
        `dulwich=${dulwichPath}`,
        "--output-root",
        outputRoot,
        "--check-only"
      ],
      { cwd: siteDir, encoding: "utf8" }
    );

    expect(result.status).not.toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toMatch(/MISSING_SOURCE_IDS/);
    expect(output).not.toMatch(/MISSING_SOURCE_IDS:[^\n]*dulwich/);

    const plan = spawnSync(
      process.execPath,
      [script, "--print-plan", "--source-file", `dulwich=${dulwichPath}`],
      {
        cwd: siteDir,
        encoding: "utf8"
      }
    );
    expect(plan.status, plan.stderr).toBe(0);
    expect(plan.stdout).not.toContain(fixtureRoot);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("the deterministic transcode plan preserves the frozen reorder and half-open boundaries", ({
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The source contract only needs one project.");
  const siteDir = resolve(process.cwd(), "apps/site");
  const script = resolve(siteDir, "scripts/prepare-post-coscroll-media.mjs");
  const result = spawnSync(process.execPath, [script, "--print-plan"], {
    cwd: siteDir,
    encoding: "utf8"
  });
  expect(result.status, result.stderr).toBe(0);
  const plan = JSON.parse(result.stdout);
  const first = plan.clips.find(
    (clip: { id: string }) => clip.id === "artbreeze-first-sequence"
  );
  expect(first).toMatchObject({
    mode: "scrub",
    expectedFrameCount: 555,
    expectedDurationSeconds: 18.5,
    video: {
      kind: "ring-first-reorder",
      sourceFrameRangesHalfOpen: [
        [355, 556],
        [4, 355]
      ],
      transitionFrames: 4,
      outputOrder: ["source[355,556)", "blend(n555,n4)[1/4…4/4]", "source[5,355)"]
    },
    audio: {
      sourceRangesSecondsHalfOpen: [
        [11.833333333, 18.533333333],
        [0.133333333, 11.833333333]
      ],
      restartSilenceSeconds: 0.1,
      fadeSeconds: 0.012
    }
  });

  const aescapeScrub = plan.clips.find((clip: { id: string }) => clip.id === "aescape-scrub");
  const aescapeShowcase = plan.clips.find(
    (clip: { id: string }) => clip.id === "aescape-showcase"
  );
  expect(aescapeScrub.sourceSegments[0].endPTSExclusive).toBe(
    aescapeShowcase.sourceSegments[0].startPTS
  );

  const cycle = plan.clips.find((clip: { id: string }) => clip.id === "artbreeze-cycle");
  expect(cycle.variantEncoding).toMatchObject({
    desktop: {
      rateControl: "two-pass-abr",
      targetVideoBitrateBitsPerSecond: 2_800_000,
      outputPixelFormat: "yuv420p",
      outputColorRange: "tv"
    },
    mobile: {
      rateControl: "two-pass-abr",
      targetVideoBitrateBitsPerSecond: 1_400_000
    }
  });

  const prompt = plan.clips.find((clip: { id: string }) => clip.id === "artbreeze-prompt");
  expect(prompt.variantEncoding.mobile).toMatchObject({
    rateControl: "two-pass-abr",
    targetVideoBitrateBitsPerSecond: 1_354_000
  });
});
