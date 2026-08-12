import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import sharp from "../../packages/lubirth-hero/node_modules/sharp";
import {
  createTakramOrbitalEvidenceManifest,
  normalizeTakramOrbitalBaselineFingerprint,
  resolveTakramOrbitalStageA,
  resolveTakramOrbitalStageB,
  resolveTakramOrbitalStageC,
  resolveTakramOrbitalStageD,
  resolveTakramOrbitalRepeatNoiseFloor,
  resolveTakramOrbitalStage0
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence";
import { didTakramLookdevRemountAllAllocations } from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevIdentity";
import { writeTakramOrbitalLookdevEvidenceAtomically } from
  "../helpers/takramOrbitalLookdevEvidence";

test.setTimeout(900_000);

const captureEnabled =
  process.env.MIRALITH_TAKRAM_ORBITAL_LOOKDEV_CAPTURE === "1";
const captureStage = process.env.MIRALITH_TAKRAM_ORBITAL_LOOKDEV_STAGE ?? "";
const evidenceRoot = path.resolve(
  process.cwd(),
  "docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev"
);
const referenceHashes = {
  nasa: "d1bf3d7478969acf7910ccb0688554a8074650df60f528ca91b84d91a04120eb",
  takram: "843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5"
} as const;
const referencePaths = {
  nasa: path.resolve(
    process.cwd(),
    "screenshots/current-vs-nasa-20260501/comparison-current-day-aurora.png"
  ),
  takram: path.resolve(
    process.cwd(),
    "docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg"
  )
} as const;
const progresses = [0, 0.06, 0.12, 0.18] as const;
const contactSheetScript = path.resolve(
  process.cwd(),
  "packages/lubirth-hero/scripts/create-takram-orbital-lookdev-contact-sheet.mjs"
);

type OrbitalPreset = "native" | "h40" | "h80" | "h120";
type OrbitalCoverage = 0.3 | 0.4 | 0.45 | 0.55;
type VerticalScale = 1 | 2 | 4;
type OpticalDepthScale = 0.75 | 1 | 1.5;

type OrbitalCandidate = {
  coverage: OrbitalCoverage;
  opticalDepthScale: OpticalDepthScale;
  preset: OrbitalPreset;
  verticalScale: VerticalScale;
};

type ExactCapture = {
  buffer: Buffer;
  metadata: {
    cloudsFrame: number;
    frameLockPass: boolean;
    height: number;
    historyEpochHash: string;
    nativeFrameCount: number;
    resolveFrame: number;
    shadowFrame: number;
    stbnSliceIndex: number;
    temporalJitterIndex: number;
    width: number;
  };
};

type CaptureRecord = {
  candidateId: string;
  capture: ExactCapture["metadata"];
  diagnostic: string;
  file: string;
  input: "stock" | "v3";
  progress: number;
  query: string;
  screenshotSha256: string;
  telemetry: any;
};

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function fileSha256(filePath: string) {
  return sha256(readFileSync(filePath));
}

function gitCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function expectTrackedWorktreeClean() {
  expect(execFileSync("git", ["diff", "--name-only"], { encoding: "utf8" }).trim())
    .toBe("");
  expect(execFileSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8"
  }).trim()).toBe("");
}

function candidateId(candidate: OrbitalCandidate) {
  return `${candidate.preset}-c${candidate.coverage}-v${candidate.verticalScale}` +
    `-o${candidate.opticalDepthScale}`;
}

function orbitalRoute(
  candidate: OrbitalCandidate,
  progress: number,
  diagnostic = "full",
  input: "stock" | "v3" = "stock",
  explicitWeatherAdapter = false
) {
  return "/lubirth-takram-parity-spike" +
    `?input=${input}&view=opening&progress=${progress}` +
    `&orbitalPreset=${candidate.preset}&orbitalCoverage=${candidate.coverage}` +
    `&verticalScale=${candidate.verticalScale}` +
    `&opticalDepthScale=${candidate.opticalDepthScale}` +
    `&diagnostic=${diagnostic}&visualTest=pixels` +
    (explicitWeatherAdapter ? "&weatherAdapterComparison=explicit" : "");
}

function legacyRoute(progress: number, diagnostic = "full") {
  return "/lubirth-takram-parity-spike" +
    `?input=stock&view=opening&progress=${progress}` +
    `&diagnostic=${diagnostic}&visualTest=pixels`;
}

async function openReadyRoute(
  page: Page,
  route: string,
  navigation: "document" | "same-document" = "document"
) {
  if (navigation === "document") {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
  } else {
    await page.evaluate((url) => window.history.pushState({}, "", url), route);
    const expectedPreset = new URL(route, "http://localhost").searchParams
      .get("orbitalPreset") ?? "none";
    await expect(page.locator("[data-takram-parity-route='true']"))
      .toHaveAttribute("data-orbital-preset", expectedPreset);
  }
  await expect(page.locator("[data-takram-parity-route='true']"))
    .toHaveAttribute("data-runtime", "ready", { timeout: 180_000 });
  await expect(page.locator("canvas")).toHaveCount(1);
  const telemetry = await page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramParity")
  );
  expect(telemetry).toMatchObject({ active: true });
  return telemetry as any;
}

async function readExactCapture(page: Page): Promise<ExactCapture> {
  const capture = await page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramMatchedTemporalFrame")
  ) as (ExactCapture["metadata"] & { dataUrl: string }) | undefined;
  expect(capture).toMatchObject({
    cloudsFrame: 32,
    frameLockPass: true,
    height: 960,
    nativeFrameCount: 32,
    resolveFrame: 32,
    shadowFrame: 32,
    width: 1440
  });
  expect(capture?.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  const { dataUrl, ...metadata } = capture!;
  return {
    buffer: Buffer.from(dataUrl.split(",")[1]!, "base64"),
    metadata
  };
}

async function captureRoute(input: {
  candidateId: string;
  diagnostic: string;
  input?: "stock" | "v3";
  page: Page;
  progress: number;
  route: string;
  navigation?: "document" | "same-document";
}): Promise<{ frame: Buffer; record: CaptureRecord }> {
  const telemetry = await openReadyRoute(
    input.page,
    input.route,
    input.navigation
  );
  const capture = await readExactCapture(input.page);
  const file = `${input.input ?? "stock"}-${input.candidateId}-p${Math.round(input.progress * 100)
    .toString().padStart(3, "0")}-${input.diagnostic}.png`;
  return {
    frame: capture.buffer,
    record: {
      candidateId: input.candidateId,
      capture: capture.metadata,
      diagnostic: input.diagnostic,
      file: `captures/${file}`,
      input: input.input ?? "stock",
      progress: input.progress,
      query: input.route,
      screenshotSha256: sha256(capture.buffer),
      telemetry
    }
  };
}

async function decodeRgba(buffer: Buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  expect(info).toMatchObject({ width: 1440, height: 960, channels: 4 });
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

function writeJson(filePath: string, value: unknown) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeContactSheet(input: {
  columns: number;
  directory: string;
  name: string;
  panels: Array<{ label: string; path: string }>;
}) {
  const descriptionPath = path.join(input.directory, `${input.name}.sheet.json`);
  writeJson(descriptionPath, {
    columns: input.columns,
    output: `${input.name}.png`,
    panels: input.panels
  });
  execFileSync(process.execPath, [contactSheetScript, "--input", descriptionPath], {
    stdio: "inherit"
  });
  return {
    path: `${input.name}.png`,
    sha256: fileSha256(path.join(input.directory, `${input.name}.png`))
  };
}

function baselineFingerprint(telemetry: any, kind: "legacy" | "orbital") {
  const rendererFingerprint = structuredClone(telemetry.rendererFingerprint);
  const schemaVersion = rendererFingerprint.schemaVersion;
  delete rendererFingerprint.schemaVersion;
  return {
    classification: kind === "legacy"
      ? "legacy-unscaled-stock"
      : "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
    resolver: {
      kind,
      value: {
        adapter: telemetry.adapter,
        rendererFingerprint
      }
    },
    schemaVersion
  };
}

function emptyVisualReview(candidate: {
  candidateId: string;
  cleanCommit: string;
}) {
  return {
    schema: "takram-orbital-lookdev-visual-review/v1",
    reviewer: null,
    cleanCommit: candidate.cleanCommit,
    candidateId: candidate.candidateId,
    nativeFrame: 32,
    viewport: { width: 1440, height: 960, dpr: 1 },
    referenceHashes,
    frames: progresses.map((progress) => ({
      progress,
      hardFlags: [],
      scores: {
        macroCoherence: null,
        cloudGroundSeparation: null,
        depthLayering: null,
        lightingBsmRead: null,
        openingIdentityStability: null,
        artifactFreedom: null
      }
    }))
  };
}

async function captureCandidateMatrix(input: {
  candidates: readonly OrbitalCandidate[];
  diagnostics?: readonly string[];
  explicitWeatherAdapter?: boolean;
  input?: "stock" | "v3";
  page: Page;
}) {
  const diagnostics = input.diagnostics ?? ["full", "cloud-raw-off"];
  const frames = new Map<string, Buffer>();
  const records: CaptureRecord[] = [];
  for (const candidate of input.candidates) {
    const id = candidateId(candidate);
    for (const progress of progresses) {
      for (const diagnostic of diagnostics) {
        const captured = await captureRoute({
          candidateId: id,
          diagnostic,
          input: input.input,
          page: input.page,
          progress,
          route: orbitalRoute(
            candidate,
            progress,
            diagnostic,
            input.input,
            input.explicitWeatherAdapter
          )
        });
        expect(captured.record.telemetry).toMatchObject({
          driftAttemptLedgerOutcome: "none",
          orbitalLookdev: { drift: [] },
          resetNonce: 0
        });
        frames.set(`${id}:${progress}:${diagnostic}:${input.input ?? "stock"}`, captured.frame);
        records.push(captured.record);
      }
    }
  }
  return { diagnostics, frames, records };
}

async function publishCandidateStage(input: {
  candidates: readonly OrbitalCandidate[];
  cleanCommit: string;
  diagnostics: readonly string[];
  frames: ReadonlyMap<string, Buffer>;
  records: readonly CaptureRecord[];
  stage: "B" | "C" | "D" | "E";
}) {
  const finalDirectory = path.join(evidenceRoot, `stage-${input.stage.toLowerCase()}`);
  await writeTakramOrbitalLookdevEvidenceAtomically({
    build: async (directory) => {
      mkdirSync(path.join(directory, "captures"), { recursive: true });
      for (const record of input.records) {
        const key = `${record.candidateId}:${record.progress}:${record.diagnostic}:${record.input}`;
        writeFileSync(path.join(directory, record.file), input.frames.get(key)!);
      }
      const contactSheets = Object.fromEntries(input.diagnostics.map((diagnostic) => [
        diagnostic,
        writeContactSheet({
          columns: progresses.length,
          directory,
          name: `stage-${input.stage.toLowerCase()}-${diagnostic}`,
          panels: input.records.filter((record) => record.diagnostic === diagnostic)
            .map((record) => ({
              label: `${record.input} · ${record.candidateId} · p=${record.progress.toFixed(2)}`,
              path: record.file
            }))
        })
      ]));
      writeJson(path.join(directory, "manifest.json"), {
        schema: "takram-orbital-lookdev-stage-capture/v1",
        stage: input.stage,
        cleanCommit: input.cleanCommit,
        generatedAt: new Date().toISOString(),
        referenceHashes,
        contactSheets,
        records: input.records
      });
      writeJson(path.join(directory, "review-template.json"), {
        schema: "takram-orbital-lookdev-stage-review/v1",
        stage: input.stage,
        cleanCommit: input.cleanCommit,
        candidates: input.candidates.map((candidate) => ({
          candidateId: candidateId(candidate),
          candidate,
          review: emptyVisualReview({
            candidateId: candidateId(candidate),
            cleanCommit: input.cleanCommit
          })
        }))
      });
      writeJson(path.join(directory, "checkpoint.json"), {
        state: `ORBITAL_STAGE_${input.stage}_REVIEW_PENDING`,
        authorizedNextStage: null
      });
    },
    enabled: captureEnabled,
    finalDirectory
  });
}

const openingQuery = (
  coverage: 0.3 | 0.4 = 0.3,
  stepScaleMode: "control" | "treatment" = "control"
) =>
  "/lubirth-takram-parity-spike?input=stock&view=opening&progress=0.06" +
  `&orbitalPreset=h80&orbitalCoverage=${coverage}` +
  `&orbitalStepScale=${stepScaleMode}` +
  "&verticalScale=1&opticalDepthScale=1&diagnostic=full&visualTest=pixels";

async function waitForOrbitalReady(
  page: Page,
  coverage: 0.3 | 0.4,
  stepScaleMode: "control" | "treatment" = "control"
) {
  const root = page.locator("[data-takram-parity-route='true']");
  await expect(root).toHaveAttribute("data-orbital-preset", "h80");
  await expect(root).toHaveAttribute("data-orbital-coverage", String(coverage));
  await expect(root).toHaveAttribute("data-orbital-step-scale", stepScaleMode);
  await expect(root).toHaveAttribute("data-vertical-scale", "1");
  await expect(root).toHaveAttribute("data-optical-depth-scale", "1");
  await expect(root).toHaveAttribute("data-runtime", "ready", { timeout: 120_000 });
  return page.evaluate(() => Reflect.get(window, "__MiraLithTakramParity")) as Promise<any>;
}

test("orbital route publishes audited identity and remounts the complete native composer", async ({ page }) => {
  const response = await page.goto(openingQuery());
  expect(response?.status()).toBe(200);
  const first = await waitForOrbitalReady(page, 0.3);

  expect(first).toMatchObject({
    active: true,
    driftAttemptLedgerOutcome: "none",
    driftSignature: null,
    lookdevSetupState: "ORBITAL_LOOKDEV_RUNTIME_READY",
    presentationPreset: "orbital-parameter-lookdev",
    resetNonce: 0,
    rendererFingerprint: { schemaVersion: 6 },
    orbitalLookdev: {
      drift: [],
      requested: {
        classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
        coverage: 0.3,
        opticalDepthScale: 1,
        preset: "h80",
        verticalScale: 1
      },
      readback: {
        coverage: 0.3,
        effectiveTurbulenceRepeat: [25, 25],
        localWeatherRepeat: [1.25, 1.25],
        shapeDetailRepeat: [0.000075, 0.000075, 0.000075],
        shapeRepeat: [0.00000375, 0.00000375, 0.00000375],
        turbulenceRepeat: [20, 20]
      }
    }
  });
  expect(first.nativeFrameCount).toBeGreaterThanOrEqual(32);
  expect(first.matchedTemporalFrameCapture.nativeFrameCount).toBe(32);
  expect(first.lookdevBaseKey).toMatch(/^takram-lookdev-base:/);
  expect(first.lookdevMountKey).toBe(JSON.stringify([first.lookdevBaseKey, 0]));
  expect(first.runtimeEvidenceEpoch).toMatch(/^takram-runtime-evidence:/);
  const firstAllocations = [
    ...Object.values(first.orbitalLookdev.readback.allocations.clouds),
    ...Object.values(first.orbitalLookdev.readback.allocations.shadow)
  ] as number[];
  expect(firstAllocations).toHaveLength(6);
  expect(new Set(firstAllocations).size).toBe(6);

  await page.evaluate((url) => window.history.pushState({}, "", url), openingQuery(0.4));
  const second = await waitForOrbitalReady(page, 0.4);
  expect(second.lookdevBaseKey).not.toBe(first.lookdevBaseKey);
  expect(second.lookdevMountKey).not.toBe(first.lookdevMountKey);
  expect(second.resetNonce).toBe(0);
  expect(second.orbitalLookdev.requested.coverage).toBe(0.4);
  expect(second.orbitalLookdev.drift).toEqual([]);
  const secondAllocations = [
    ...Object.values(second.orbitalLookdev.readback.allocations.clouds),
    ...Object.values(second.orbitalLookdev.readback.allocations.shadow)
  ] as number[];
  expect(secondAllocations.every((value) => !firstAllocations.includes(value))).toBe(true);

  await page.waitForTimeout(250);
  const stable = await page.evaluate(() => Reflect.get(window, "__MiraLithTakramParity"));
  expect(stable.lookdevBaseKey).toBe(second.lookdevBaseKey);
  expect(stable.lookdevMountKey).toBe(second.lookdevMountKey);
  expect(stable.resetNonce).toBe(0);
});

test("sampling treatment remounts all six native allocations in the same document", async ({
  page
}) => {
  const response = await page.goto(openingQuery(0.3, "control"));
  expect(response?.status()).toBe(200);
  const control = await waitForOrbitalReady(page, 0.3, "control");

  await page.evaluate(
    (url) => window.history.pushState({}, "", url),
    openingQuery(0.3, "treatment")
  );
  const treatment = await waitForOrbitalReady(page, 0.3, "treatment");

  expect(treatment.lookdevBaseKey).not.toBe(control.lookdevBaseKey);
  expect(treatment.lookdevMountKey).not.toBe(control.lookdevMountKey);
  expect(treatment.orbitalLookdev.requested.stepScaleMode).toBe("treatment");
  expect(treatment.orbitalLookdev.readback.clouds.perspectiveStepScale)
    .toBe(1.0001);
  expect(treatment.orbitalLookdev.drift).toEqual([]);
  expect(didTakramLookdevRemountAllAllocations(
    control.orbitalLookdev.readback.allocations,
    treatment.orbitalLookdev.readback.allocations
  )).toBe(true);
});

test("Stage 0 baseline transition retains full runtime evidence and changes all allocations", async ({
  page
}) => {
  const legacy = await openReadyRoute(page, legacyRoute(0.06));
  expect(legacy.rendererFingerprint).toMatchObject({
    schemaVersion: 6,
    orbitalBaseline: {
      layers: expect.arrayContaining([
        expect.objectContaining({
          channel: "r",
          densityProfile: expect.any(Object),
          shapeAlteringBias: expect.any(Number)
        })
      ])
    },
    orbitalRenderTargets: {
      clouds: { history: expect.objectContaining({ present: true }) },
      shadow: { history: expect.objectContaining({ present: true }) }
    }
  });
  const previous = Object.values(legacy.orbitalBaselineReadback.allocations.clouds)
    .concat(Object.values(legacy.orbitalBaselineReadback.allocations.shadow));

  const native: OrbitalCandidate = {
    coverage: 0.3,
    opticalDepthScale: 1,
    preset: "native",
    verticalScale: 1
  };
  const nextRoute = orbitalRoute(native, 0.06);
  await page.evaluate((url) => window.history.pushState({}, "", url), nextRoute);
  await expect(page.locator("[data-takram-parity-route='true']"))
    .toHaveAttribute("data-orbital-preset", "native");
  await expect(page.locator("[data-takram-parity-route='true']"))
    .toHaveAttribute("data-runtime", "ready", { timeout: 120_000 });
  const lookdev = await page.evaluate(() => Reflect.get(
    window,
    "__MiraLithTakramParity"
  )) as any;
  const next = Object.values(lookdev.orbitalBaselineReadback.allocations.clouds)
    .concat(Object.values(lookdev.orbitalBaselineReadback.allocations.shadow));
  expect(next).toHaveLength(6);
  expect(next.every((value) => !previous.includes(value))).toBe(true);
  expect(lookdev.rendererFingerprint.orbitalBaseline)
    .toEqual(legacy.rendererFingerprint.orbitalBaseline);
});

test("winner-only profiler collects a non-nested total population or explicit unsupported state", async ({
  page
}) => {
  await openReadyRoute(page, openingQuery());
  const rejected = await page.evaluate(() => {
    const telemetry = Reflect.get(window, "__MiraLithTakramParity");
    return Reflect.get(window, "__MiraLithStartTakramGpuProfile")({
      candidateId: "loser",
      committedWinnerId: "winner",
      lookdevMountKey: telemetry.lookdevMountKey,
      runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch
    });
  });
  expect(rejected).toEqual({
    accepted: false,
    reason: "candidate-is-not-committed-stock-winner"
  });

  const accepted = await page.evaluate(() => {
    const telemetry = Reflect.get(window, "__MiraLithTakramParity");
    return Reflect.get(window, "__MiraLithStartTakramGpuProfile")({
      candidateId: "winner",
      committedWinnerId: "winner",
      lookdevMountKey: telemetry.lookdevMountKey,
      runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch
    });
  });
  expect(accepted).toEqual({ accepted: true, reason: null });
  await page.waitForFunction(() => {
    const profile = Reflect.get(window, "__MiraLithTakramGpuProfile");
    return profile?.state === "complete" || profile?.state === "unsupported";
  }, undefined, { timeout: 180_000 });
  const profile = await page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramGpuProfile")
  );
  if (profile.state === "complete") {
    expect(profile).toMatchObject({
      measurementMode: "total-only-time-elapsed",
      copyOnlySamplesMilliseconds: { length: 120 },
      rawSamplesMilliseconds: { length: 120 },
      noopSamplesMilliseconds: { length: 120 },
      targetSampleCount: 120,
      validSampleCount: 120,
      warmupFrameCount: 120,
      warmupFramesCompleted: 120
    });
    expect(profile.p95Milliseconds).toBeGreaterThanOrEqual(0);
    expect(profile.timestampBits).toBeGreaterThan(0);
  } else {
    expect(profile).toMatchObject({
      classification: null,
      invalidReasons: expect.arrayContaining([
        expect.stringMatching(/unavailable/)
      ]),
      state: "unsupported"
    });
  }
});

test("Stage 0 captures and authorizes the explicit native orbital baseline", async ({
  browser,
  page
}) => {
  test.skip(!captureEnabled || captureStage !== "0", "requires explicit Stage 0 capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  expect(fileSha256(referencePaths.nasa)).toBe(referenceHashes.nasa);
  expect(fileSha256(referencePaths.takram)).toBe(referenceHashes.takram);

  const nativeCandidate: OrbitalCandidate = {
    coverage: 0.3,
    opticalDepthScale: 1,
    preset: "native",
    verticalScale: 1
  };
  const routes = {
    legacyA: legacyRoute(0.06),
    legacyB: legacyRoute(0.06),
    lookdevA: orbitalRoute(nativeCandidate, 0.06),
    lookdevB: orbitalRoute(nativeCandidate, 0.06)
  } as const;
  const frames = new Map<string, Buffer>();
  const records: CaptureRecord[] = [];
  const remountComparisons: Array<{
    next: any;
    pair: "A" | "B";
    pass: boolean;
    previous: any;
  }> = [];
  for (const pair of ["A", "B"] as const) {
    const legacyId = `legacy${pair}` as "legacyA" | "legacyB";
    const lookdevId = `lookdev${pair}` as "lookdevA" | "lookdevB";
    const legacyCapture = await captureRoute({
      candidateId: legacyId,
      diagnostic: "full",
      page,
      progress: 0.06,
      route: routes[legacyId]
    });
    frames.set(legacyId, legacyCapture.frame);
    records.push(legacyCapture.record);
    const lookdevCapture = await captureRoute({
      candidateId: lookdevId,
      diagnostic: "full",
      navigation: "same-document",
      page,
      progress: 0.06,
      route: routes[lookdevId]
    });
    frames.set(lookdevId, lookdevCapture.frame);
    records.push(lookdevCapture.record);
    const previous = legacyCapture.record.telemetry.orbitalBaselineReadback
      .allocations;
    const next = lookdevCapture.record.telemetry.orbitalBaselineReadback
      .allocations;
    remountComparisons.push({
      next,
      pair,
      pass: didTakramLookdevRemountAllAllocations(previous, next),
      previous
    });
  }

  const baselinePairs = (["A", "B"] as const).map((pair) => {
    const legacyTelemetry = records.find(
      ({ candidateId }) => candidateId === `legacy${pair}`
    )!.telemetry;
    const lookdevTelemetry = records.find(
      ({ candidateId }) => candidateId === `lookdev${pair}`
    )!.telemetry;
    const normalizedLegacy = normalizeTakramOrbitalBaselineFingerprint(
      baselineFingerprint(legacyTelemetry, "legacy")
    );
    const normalizedLookdev = normalizeTakramOrbitalBaselineFingerprint(
      baselineFingerprint(lookdevTelemetry, "orbital")
    );
    expect(normalizedLookdev).toEqual(normalizedLegacy);
    expect(lookdevTelemetry).toMatchObject({
      driftAttemptLedgerOutcome: "none",
      driftSignature: null,
      lookdevSetupState: "ORBITAL_LOOKDEV_RUNTIME_READY",
      orbitalLookdev: { drift: [] },
      resetNonce: 0
    });
    expect(lookdevTelemetry.orbitalLookdev.readback.layers)
      .toEqual(lookdevTelemetry.orbitalLookdev.requested.layers);
    return { normalizedLookdev, lookdevTelemetry };
  });
  const [{ normalizedLookdev, lookdevTelemetry }] = baselinePairs;

  const decoded = Object.fromEntries(await Promise.all(
    Array.from(frames, async ([id, frame]) => [id, await decodeRgba(frame)] as const)
  ));
  const mask = new Uint8Array(1440 * 960).fill(1);
  const repeatNoiseFloor = resolveTakramOrbitalRepeatNoiseFloor({
    legacyA: decoded.legacyA!,
    legacyB: decoded.legacyB!,
    lookdevA: decoded.lookdevA!,
    lookdevB: decoded.lookdevB!,
    mask
  });
  expect(repeatNoiseFloor.pass).toBe(true);

  const checkpoint = resolveTakramOrbitalStage0({
    cleanCommit: true,
    coordinateHdrReady: lookdevTelemetry.coordinateMode === "lubirth-bridge" &&
      lookdevTelemetry.transformFallback === null,
    fingerprintParity: true,
    fullComposerRemount: remountComparisons.length === 2 &&
      remountComparisons.every(({ pass }) => pass),
    nativeFrameLock: records.every(({ capture }) =>
      capture.frameLockPass && capture.nativeFrameCount === 32 &&
      capture.cloudsFrame === 32 && capture.resolveFrame === 32 &&
      capture.shadowFrame === 32
    ),
    referencesValid: true,
    repeatNoiseFloorPass: repeatNoiseFloor.pass,
    runtimeReadbackMatch: baselinePairs.every(({ lookdevTelemetry: telemetry }) =>
      telemetry.orbitalLookdev.drift.length === 0
    )
  });
  expect(checkpoint.state).toBe("ORBITAL_STAGE_A_UNLOCKED");

  const manifest = createTakramOrbitalEvidenceManifest({
    checkpointState: checkpoint.state,
    cleanCommit,
    hashes: {
      packages: lookdevTelemetry.rendererFingerprint.packageVersions,
      patches: lookdevTelemetry.orbitalLookdev.readback.mipDistancePatch
        .auditedArtifacts,
      references: referenceHashes,
      screenshots: Object.fromEntries(records.map((record) => [
        record.candidateId,
        record.screenshotSha256
      ])),
      shaders: {
        clouds: lookdevTelemetry.orbitalLookdev.readback.mipDistancePatch
          .runtimeFragmentShaderFnv1a64
      }
    },
    identities: {
      driftAttemptLedgerOutcome: lookdevTelemetry.driftAttemptLedgerOutcome,
      lookdevBaseKey: lookdevTelemetry.lookdevBaseKey,
      lookdevMountKey: lookdevTelemetry.lookdevMountKey,
      resetNonce: lookdevTelemetry.resetNonce,
      runtimeEvidenceEpoch: lookdevTelemetry.runtimeEvidenceEpoch
    },
    query: JSON.stringify(routes),
    ranking: [],
    rawDiagnostics: null,
    rendererFingerprint: lookdevTelemetry.rendererFingerprint,
    requestedContract: lookdevTelemetry.orbitalLookdev.requested,
    review: null,
    runtimeReadback: lookdevTelemetry.orbitalLookdev.readback,
    setupInvalidReasons: checkpoint.invalidReasons,
    timer: null,
    winnerId: null,
    browser: { version: browser.version() },
    normalizedBaselineFingerprint: normalizedLookdev,
    remountComparisons,
    repeatNoiseFloor,
    records
  });

  await writeTakramOrbitalLookdevEvidenceAtomically({
    build: async (directory) => {
      const captures = path.join(directory, "captures");
      mkdirSync(captures, { recursive: true });
      for (const record of records) {
        writeFileSync(
          path.join(directory, record.file),
          frames.get(record.candidateId)!
        );
      }
      const panels = records.map((record) => ({
        label: `${record.candidateId} · frame 32`,
        path: record.file
      }));
      const contactSheet = writeContactSheet({
        columns: 2,
        directory,
        name: "stage-0-native-baseline",
        panels
      });
      writeJson(path.join(directory, "manifest.json"), {
        ...manifest,
        contactSheet
      });
      writeJson(path.join(directory, "checkpoint.json"), checkpoint);
      writeFileSync(
        path.join(directory, "README.md"),
        "# Takram orbital lookdev — Stage 0\n\n" +
        "Explicit native lookdev matches the legacy stock opening at frame 32.\n"
      );
    },
    enabled: captureEnabled,
    finalDirectory: path.join(evidenceRoot, "stage-0")
  });
});

test("Stage A captures the bounded morphology domain and review templates", async ({
  page
}) => {
  test.skip(!captureEnabled || captureStage !== "A", "requires explicit Stage A capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  const stage0 = readJson<{ state: string; invalidReasons: string[] }>(
    path.join(evidenceRoot, "stage-0/checkpoint.json")
  );
  expect(stage0).toEqual({ invalidReasons: [], state: "ORBITAL_STAGE_A_UNLOCKED" });

  const candidates = (["h40", "h80", "h120"] as const).map((preset) => ({
    coverage: 0.3 as const,
    opticalDepthScale: 1 as const,
    preset,
    verticalScale: 1 as const
  }));
  const diagnostics = ["full", "cloud-raw-off", "uv-debug"] as const;
  const frames = new Map<string, Buffer>();
  const records: CaptureRecord[] = [];
  for (const candidate of candidates) {
    const id = candidateId(candidate);
    for (const progress of progresses) {
      for (const diagnostic of diagnostics) {
        const captured = await captureRoute({
          candidateId: id,
          diagnostic,
          page,
          progress,
          route: orbitalRoute(candidate, progress, diagnostic)
        });
        frames.set(`${id}:${progress}:${diagnostic}`, captured.frame);
        records.push(captured.record);
        expect(captured.record.telemetry).toMatchObject({
          driftAttemptLedgerOutcome: "none",
          orbitalLookdev: { drift: [] },
          resetNonce: 0
        });
      }
    }
  }

  await writeTakramOrbitalLookdevEvidenceAtomically({
    build: async (directory) => {
      mkdirSync(path.join(directory, "captures"), { recursive: true });
      for (const record of records) {
        writeFileSync(
          path.join(directory, record.file),
          frames.get(`${record.candidateId}:${record.progress}:${record.diagnostic}`)!
        );
      }
      const contactSheets = Object.fromEntries(diagnostics.map((diagnostic) => [
        diagnostic,
        writeContactSheet({
          columns: progresses.length,
          directory,
          name: `stage-a-${diagnostic}`,
          panels: records.filter((record) => record.diagnostic === diagnostic)
            .map((record) => ({
              label: `${record.candidateId} · p=${record.progress.toFixed(2)}`,
              path: record.file
            }))
        })
      ]));
      writeJson(path.join(directory, "manifest.json"), {
        schema: "takram-orbital-lookdev-stage-capture/v1",
        stage: "A",
        cleanCommit,
        generatedAt: new Date().toISOString(),
        referenceHashes,
        contactSheets,
        records
      });
      writeJson(path.join(directory, "review-template.json"), {
        schema: "takram-orbital-lookdev-stage-a-review/v1",
        cleanCommit,
        candidates: candidates.map((candidate) => ({
          candidateId: candidateId(candidate),
          candidate,
          decision: null,
          notes: null,
          visualReview: emptyVisualReview({
            candidateId: candidateId(candidate),
            cleanCommit
          })
        }))
      });
      writeJson(path.join(directory, "checkpoint.json"), {
        state: "ORBITAL_STAGE_A_REVIEW_PENDING",
        authorizedNextStage: null
      });
    },
    enabled: captureEnabled,
    finalDirectory: path.join(evidenceRoot, "stage-a")
  });
});

test("Stage B captures the authorized coverage matrix", async ({ page }) => {
  test.skip(!captureEnabled || captureStage !== "B", "requires explicit Stage B capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  const stageAReview = readJson<{
    candidates: Array<{
      candidateId: string;
      candidate: OrbitalCandidate;
      decision: "TOPOLOGY_PASS" | "TOPOLOGY_AMBIGUOUS" |
        "TOPOLOGY_UNOBSERVABLE" | "HARD_ARTIFACT_FAIL";
    }>;
  }>(path.join(evidenceRoot, "stage-a/review.json"));
  const transition = resolveTakramOrbitalStageA(stageAReview.candidates.map((entry) => ({
    candidateId: entry.candidateId,
    decision: entry.decision
  })));
  expect(transition.state).toBe("ORBITAL_STAGE_B_UNLOCKED");

  const candidates = stageAReview.candidates
    .filter((entry) => transition.survivorIds.includes(entry.candidateId))
    .flatMap((entry) => ([0.3, 0.4, 0.45, 0.55] as const).map((coverage) => ({
      ...entry.candidate,
      coverage
    })));
  const capture = await captureCandidateMatrix({ candidates, page });
  await publishCandidateStage({
    candidates,
    cleanCommit,
    diagnostics: capture.diagnostics,
    frames: capture.frames,
    records: capture.records,
    stage: "B"
  });
});

test("Stage C captures vertical separation for at most two authorized survivors", async ({
  page
}) => {
  test.skip(!captureEnabled || captureStage !== "C", "requires explicit Stage C capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  const stageBReview = readJson<{
    candidates: Array<{
      candidateId: string;
      candidate: OrbitalCandidate;
      review: any;
    }>;
  }>(path.join(evidenceRoot, "stage-b/review.json"));
  const transition = resolveTakramOrbitalStageB(stageBReview.candidates.map((entry) => ({
    ...entry.candidate,
    candidateId: entry.candidateId,
    review: entry.review
  })));
  expect(transition.state).toBe("ORBITAL_STAGE_C_UNLOCKED");
  expect(transition.survivorIds.length).toBeLessThanOrEqual(2);

  const candidates = stageBReview.candidates
    .filter((entry) => transition.survivorIds.includes(entry.candidateId))
    .flatMap((entry) => ([1, 2, 4] as const).map((verticalScale) => ({
      ...entry.candidate,
      verticalScale
    })));
  const capture = await captureCandidateMatrix({ candidates, page });
  await publishCandidateStage({
    candidates,
    cleanCommit,
    diagnostics: capture.diagnostics,
    frames: capture.frames,
    records: capture.records,
    stage: "C"
  });
});

test("Stage D captures the bounded optical finish for one authorized vertical winner", async ({
  page
}) => {
  test.skip(!captureEnabled || captureStage !== "D", "requires explicit Stage D capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  const stageCReview = readJson<{
    candidates: Array<{
      candidateId: string;
      candidate: OrbitalCandidate;
      review: any;
    }>;
  }>(path.join(evidenceRoot, "stage-c/review.json"));
  const transition = resolveTakramOrbitalStageC(stageCReview.candidates.map((entry) => ({
    ...entry.candidate,
    candidateId: entry.candidateId,
    review: entry.review
  })));
  expect(transition).toMatchObject({
    state: "ORBITAL_STAGE_D_UNLOCKED",
    winnerId: expect.any(String)
  });

  const winner = stageCReview.candidates.find(
    (entry) => entry.candidateId === transition.winnerId
  )!;
  const candidates = ([0.75, 1, 1.5] as const).map((opticalDepthScale) => ({
    ...winner.candidate,
    opticalDepthScale
  }));
  const capture = await captureCandidateMatrix({ candidates, page });
  await publishCandidateStage({
    candidates,
    cleanCommit,
    diagnostics: capture.diagnostics,
    frames: capture.frames,
    records: capture.records,
    stage: "D"
  });
});

test("Stage E captures V3 compatibility for the committed stock winner only", async ({
  page
}) => {
  test.skip(!captureEnabled || captureStage !== "E", "requires explicit Stage E capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  const stageDReview = readJson<{
    candidates: Array<{
      candidateId: string;
      candidate: OrbitalCandidate;
      review: any;
    }>;
  }>(path.join(evidenceRoot, "stage-d/review.json"));
  const transition = resolveTakramOrbitalStageD(stageDReview.candidates.map((entry) => ({
    ...entry.candidate,
    candidateId: entry.candidateId,
    review: entry.review
  })));
  expect(transition).toMatchObject({
    state: "ORBITAL_LOOKDEV_WINNER",
    winnerId: expect.any(String)
  });
  const winner = stageDReview.candidates.find(
    (entry) => entry.candidateId === transition.winnerId
  )!;

  const stock = await captureCandidateMatrix({
    candidates: [winner.candidate],
    diagnostics: ["full"],
    explicitWeatherAdapter: true,
    input: "stock",
    page
  });
  const v3 = await captureCandidateMatrix({
    candidates: [winner.candidate],
    diagnostics: ["full"],
    explicitWeatherAdapter: true,
    input: "v3",
    page
  });
  for (const progress of progresses) {
    const stockTelemetry = stock.records.find((record) => record.progress === progress)!
      .telemetry;
    const v3Telemetry = v3.records.find((record) => record.progress === progress)!.telemetry;
    expect(v3Telemetry.orbitalLookdev.requested)
      .toEqual(stockTelemetry.orbitalLookdev.requested);
    expect(v3Telemetry.orbitalLookdev.readback.layers)
      .toEqual(stockTelemetry.orbitalLookdev.readback.layers);
    expect(v3Telemetry.orbitalLookdev.readback.turbulenceRepeat)
      .toEqual(stockTelemetry.orbitalLookdev.readback.turbulenceRepeat);
    expect(v3Telemetry.adapter).toMatchObject({
      disableDefaultLayers: true,
      globalWeatherMapping: true,
      localWeatherSource: "v3"
    });
    expect(stockTelemetry.adapter).toMatchObject({
      disableDefaultLayers: true,
      globalWeatherMapping: false,
      localWeatherSource: "stock"
    });
  }
  await publishCandidateStage({
    candidates: [winner.candidate],
    cleanCommit,
    diagnostics: ["full"],
    frames: new Map([...stock.frames, ...v3.frames]),
    records: [...stock.records, ...v3.records],
    stage: "E"
  });
});

test("Stage F captures winner-only native stages and production GPU cost", async ({
  page
}) => {
  test.skip(!captureEnabled || captureStage !== "F", "requires explicit Stage F capture");
  expectTrackedWorktreeClean();
  const cleanCommit = gitCommit();
  const stageDReview = readJson<{
    candidates: Array<{
      candidateId: string;
      candidate: OrbitalCandidate;
      review: any;
    }>;
  }>(path.join(evidenceRoot, "stage-d/review.json"));
  const winnerTransition = resolveTakramOrbitalStageD(
    stageDReview.candidates.map((entry) => ({
      ...entry.candidate,
      candidateId: entry.candidateId,
      review: entry.review
    }))
  );
  expect(winnerTransition).toMatchObject({
    state: "ORBITAL_LOOKDEV_WINNER",
    winnerId: expect.any(String)
  });
  const winner = stageDReview.candidates.find(
    (entry) => entry.candidateId === winnerTransition.winnerId
  )!;
  const stageEReview = readJson<{
    committedWinnerId: string;
    state: "V3_WEATHER_ADAPTER_PASS" | "V3_WEATHER_ADAPTER_FAIL";
  }>(path.join(evidenceRoot, "stage-e/review.json"));
  expect(stageEReview.committedWinnerId).toBe(winner.candidateId);
  expect(["V3_WEATHER_ADAPTER_PASS", "V3_WEATHER_ADAPTER_FAIL"])
    .toContain(stageEReview.state);

  const diagnostics = [
    "full",
    "cloud-raw-off",
    "bsm-off",
    "cloud-raw",
    "stage-readback",
    "aerial-final"
  ] as const;
  const capture = await captureCandidateMatrix({
    candidates: [winner.candidate],
    diagnostics,
    page
  });
  const nativeStageBuffers: Array<{
    byteLength: number;
    data: Buffer;
    encoding: string;
    file: string;
    origin: string;
    precision: string;
    progress: number;
    scalar: string;
    source: string;
  }> = [];
  for (const progress of progresses) {
    await openReadyRoute(page, orbitalRoute(
      winner.candidate,
      progress,
      "stage-readback"
    ));
    const readback = await page.evaluate(() =>
      Reflect.get(window, "__MiraLithTakramStageReadback")
    ) as any;
    expect(readback).toMatchObject({
      nativeFrameCount: 32,
      temporalFrame: {
        cloudsFrame: 32,
        frameLockPass: true,
        resolveFrame: 32,
        shadowFrame: 32
      }
    });
    for (const key of ["preTemporal", "resolvedHistory", "finalOutput"] as const) {
      const buffer = readback[key];
      const data = Buffer.from(buffer.dataBase64, "base64");
      expect(data.byteLength).toBe(buffer.byteLength);
      nativeStageBuffers.push({
        byteLength: buffer.byteLength,
        data,
        encoding: buffer.encoding,
        file: `raw/p${Math.round(progress * 100).toString().padStart(3, "0")}` +
          `-${key}.bin`,
        origin: buffer.origin,
        precision: buffer.precision,
        progress,
        scalar: buffer.scalar,
        source: buffer.source
      });
    }
  }

  const telemetry = await openReadyRoute(
    page,
    orbitalRoute(winner.candidate, 0.06, "full")
  );
  const startResult = await page.evaluate(({ committedWinnerId }) => {
    const current = Reflect.get(window, "__MiraLithTakramParity");
    return Reflect.get(window, "__MiraLithStartTakramGpuProfile")({
      candidateId: committedWinnerId,
      committedWinnerId,
      lookdevMountKey: current.lookdevMountKey,
      runtimeEvidenceEpoch: current.runtimeEvidenceEpoch
    });
  }, { committedWinnerId: winner.candidateId });
  expect(startResult).toEqual({ accepted: true, reason: null });
  await page.waitForFunction(() => {
    const profile = Reflect.get(window, "__MiraLithTakramGpuProfile");
    return profile?.state === "complete" || profile?.state === "unsupported";
  }, undefined, { timeout: 180_000 });
  const timerProfile = await page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramGpuProfile")
  );
  if (timerProfile.state === "complete") {
    expect(timerProfile).toMatchObject({
      copyOnlySamplesMilliseconds: { length: 120 },
      measurementMode: "total-only-time-elapsed",
      noopSamplesMilliseconds: { length: 120 },
      rawSamplesMilliseconds: { length: 120 },
      validSampleCount: 120,
      warmupFramesCompleted: 120
    });
  }

  const rawReferences = nativeStageBuffers.map(({ data: _data, ...record }) => record);
  const manifest = createTakramOrbitalEvidenceManifest({
    checkpointState: winnerTransition.state,
    cleanCommit,
    hashes: {
      packages: telemetry.rendererFingerprint.packageVersions,
      patches: telemetry.orbitalLookdev.readback.mipDistancePatch.auditedArtifacts,
      references: referenceHashes,
      screenshots: Object.fromEntries(capture.records.map((record) => [
        `${record.progress}:${record.diagnostic}`,
        record.screenshotSha256
      ])),
      shaders: {
        clouds: telemetry.orbitalLookdev.readback.mipDistancePatch
          .runtimeFragmentShaderFnv1a64
      }
    },
    identities: {
      driftAttemptLedgerOutcome: telemetry.driftAttemptLedgerOutcome,
      lookdevBaseKey: telemetry.lookdevBaseKey,
      lookdevMountKey: telemetry.lookdevMountKey,
      resetNonce: telemetry.resetNonce,
      runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch
    },
    query: orbitalRoute(winner.candidate, 0.06, "full"),
    ranking: winnerTransition.ordering,
    rawDiagnostics: {
      candidateId: winner.candidateId,
      references: rawReferences.map(({ file }) => file)
    },
    rendererFingerprint: telemetry.rendererFingerprint,
    requestedContract: telemetry.orbitalLookdev.requested,
    review: winner.review,
    runtimeReadback: telemetry.orbitalLookdev.readback,
    setupInvalidReasons: [],
    timer: {
      candidateId: winner.candidateId,
      invalidReasons: timerProfile.invalidReasons,
      rawPopulationReferences: timerProfile.state === "complete"
        ? ["gpu/profile.json"]
        : [],
      state: timerProfile.state
    },
    winnerId: winner.candidateId,
    diagnosticRecords: capture.records,
    gpuProfile: timerProfile,
    nativeStageBuffers: rawReferences,
    v3WeatherAdapterState: stageEReview.state
  });

  await writeTakramOrbitalLookdevEvidenceAtomically({
    build: async (directory) => {
      mkdirSync(path.join(directory, "captures"), { recursive: true });
      mkdirSync(path.join(directory, "raw"), { recursive: true });
      mkdirSync(path.join(directory, "gpu"), { recursive: true });
      for (const record of capture.records) {
        const key = `${record.candidateId}:${record.progress}:${record.diagnostic}:${record.input}`;
        writeFileSync(path.join(directory, record.file), capture.frames.get(key)!);
      }
      for (const record of nativeStageBuffers) {
        writeFileSync(path.join(directory, record.file), record.data);
      }
      writeJson(path.join(directory, "gpu/profile.json"), timerProfile);
      const contactSheets = Object.fromEntries(diagnostics.map((diagnostic) => [
        diagnostic,
        writeContactSheet({
          columns: progresses.length,
          directory,
          name: `winner-${diagnostic}`,
          panels: capture.records.filter((record) => record.diagnostic === diagnostic)
            .map((record) => ({
              label: `${winner.candidateId} · p=${record.progress.toFixed(2)}`,
              path: record.file
            }))
        })
      ]));
      writeJson(path.join(directory, "manifest.json"), {
        ...manifest,
        contactSheets
      });
      writeJson(path.join(directory, "checkpoint.json"), {
        winnerId: winner.candidateId,
        state: winnerTransition.state,
        v3WeatherAdapterState: stageEReview.state,
        gpuState: timerProfile.state,
        gpuClassification: timerProfile.classification
      });
      writeFileSync(
        path.join(directory, "README.md"),
        `# Takram orbital lookdev winner\n\n` +
        `Winner: ${winner.candidateId}\n\n` +
        `V3: ${stageEReview.state}\n\n` +
        `GPU: ${timerProfile.classification ?? timerProfile.state}\n`
      );
    },
    enabled: captureEnabled,
    finalDirectory: path.join(evidenceRoot, "winner")
  });
});
