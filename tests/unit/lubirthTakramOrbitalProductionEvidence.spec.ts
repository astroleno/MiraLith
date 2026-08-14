import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertOrbitalStageAuthorization,
  createOrbitalStagingRun,
  equalOrbitalEvidenceIdentity,
  hashOrbitalFile,
  readActiveOrbitalStagingRun,
  resolveAndPublishStageAtomically,
  resolveOrbitalStagingArtifactPath,
  validateOrbitalEvidenceEnvironment,
  validateOrbitalHumanReview,
  verifyArtifactManifest,
  verifyFreshCompleteRemount,
  writeOrbitalArtifactManifest,
  writeOrbitalReviewTemplate,
  type OrbitalEvidenceEnvironment,
  type OrbitalStagingRun
} from "../helpers/takramOrbitalProductionEvidence";

const VALID_ENVIRONMENT: OrbitalEvidenceEnvironment = Object.freeze({
  browser: Object.freeze({
    chromeVersion: "Google Chrome 140.0.7339.0",
    focused: true,
    visibilityState: "visible"
  }),
  build: Object.freeze({
    buildId: "production-build-id",
    buildIdSha256: "a".repeat(64),
    fingerprintSha256: "b".repeat(64),
    mode: "production" as const,
    productionArtifactCommit: "1".repeat(40)
  }),
  captureCommit: "1".repeat(40),
  display: Object.freeze({
    canvasHeight: 960,
    canvasWidth: 1440,
    devicePixelRatio: 1,
    innerHeight: 960,
    innerWidth: 1440
  }),
  gpu: Object.freeze({
    renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)",
    vendor: "Google Inc. (Apple)"
  }),
  hardware: Object.freeze({ chip: "Apple M4" }),
  macOSVersion: "15.6",
  power: Object.freeze({ lowPowerMode: 0 as const, source: "AC Power" as const })
});

function initializeRepository() {
  const root = mkdtempSync(path.join(tmpdir(), "miralith-orbital-evidence-"));
  mkdirSync(path.join(root, "apps/site/.next"), { recursive: true });
  writeFileSync(path.join(root, ".gitignore"),
    "/output/takram-orbital-production-staging/\n");
  writeFileSync(path.join(root, "tracked.txt"), "clean\n");
  writeFileSync(path.join(root, "apps/site/.next/BUILD_ID"),
    "production-build-id\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Evidence Test"], { cwd: root });
  execFileSync("git", ["add", ".gitignore", "tracked.txt"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const buildIdBytes = Buffer.from("production-build-id\n");
  const buildIdSha256 = createHash("sha256").update(buildIdBytes).digest("hex");
  const fingerprint = createHash("sha256");
  fingerprint.update("BUILD_ID");
  fingerprint.update("\0");
  fingerprint.update(String(buildIdBytes.byteLength));
  fingerprint.update("\0");
  fingerprint.update(buildIdBytes);
  return { root, environment: {
    ...VALID_ENVIRONMENT,
    build: {
      ...VALID_ENVIRONMENT.build,
      buildIdSha256,
      fingerprintSha256: fingerprint.digest("hex"),
      productionArtifactCommit: commit
    },
    captureCommit: commit
  } };
}

async function createRun(input: {
  root: string;
  environment: OrbitalEvidenceEnvironment;
  runId?: string;
  stage?: "stage-0" | "stage-1";
}) {
  return await createOrbitalStagingRun({
    captureCommand: input.stage ?? "stage-1-capture",
    environment: input.environment,
    formalDirectory: path.join(input.root, "formal", input.stage ?? "stage-1"),
    precedingCheckpoint: input.stage === "stage-0"
      ? null
      : {
          authorizedNextStage: "stage-1",
          outcome: "STAGE_0_READY",
          stage: "stage-0"
        },
    repositoryRoot: input.root,
    runId: input.runId,
    stage: input.stage ?? "stage-1"
  }) as OrbitalStagingRun;
}

async function prepareResolvableRun(runId: string) {
  const { root, environment } = initializeRepository();
  const run = await createRun({ root, environment, runId });
  const capture = resolveOrbitalStagingArtifactPath(run, "captures/frame.bin");
  const contact = resolveOrbitalStagingArtifactPath(run, "contact.png");
  mkdirSync(path.dirname(capture), { recursive: true });
  writeFileSync(capture, Buffer.from("capture"));
  writeFileSync(contact, Buffer.from("contact"));
  writeFileSync(resolveOrbitalStagingArtifactPath(run, "resolver-inputs.json"),
    `${JSON.stringify({ candidateId: "confirmed" })}\n`);
  const reviewPath = await writeOrbitalReviewTemplate({
    entries: [{ candidateId: "confirmed", progress: 0.06 }],
    rubric: ["coherentDensityField"],
    run
  });
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  writeFileSync(reviewPath, `${JSON.stringify({
    ...review,
    reviewer: { name: "Aito", reviewedAt: "2026-08-13T10:00:00.000Z" }
  }, null, 2)}\n`);
  await writeOrbitalArtifactManifest(run);
  return {
    environment,
    manifestSha256: await hashOrbitalFile(
      path.join(run.root, "artifact-manifest.json")
    ),
    run,
    contactSha256: await hashOrbitalFile(contact)
  };
}

test("compares evidence identity independently of JSON object key order", async () => {
  expect(equalOrbitalEvidenceIdentity(
    { "cloud-raw-off": "off", "cloud-raw": "raw" },
    { "cloud-raw": "raw", "cloud-raw-off": "off" }
  )).toBe(true);
  expect(equalOrbitalEvidenceIdentity(
    { "cloud-raw": "raw" },
    { "cloud-raw": "changed" }
  )).toBe(false);
});

test("capture is inert without the production capture variable", async () => {
  const { root, environment } = initializeRepository();
  const run = await createOrbitalStagingRun({
    environment,
    formalDirectory: path.join(root, "formal/stage-0"),
    processEnvironment: {},
    repositoryRoot: root,
    stage: "stage-0"
  });
  expect(run).toBeNull();
  expect(() => readActiveOrbitalStagingRun(root, "stage-0")).toThrow();
});

test("requires the exact ignored root and a tracked-clean capture commit", async () => {
  const { root, environment } = initializeRepository();
  mkdirSync(path.join(root, ".superpowers"));
  writeFileSync(path.join(root, ".superpowers/user-state"), "untouched");
  await expect(createRun({ root, environment, runId: "clean-run" }))
    .resolves.toMatchObject({ runId: "clean-run" });

  writeFileSync(path.join(root, "tracked.txt"), "dirty\n");
  await expect(createRun({ root, environment, runId: "dirty-run" }))
    .rejects.toThrow("tracked-worktree-dirty");

  const wrongRoot = initializeRepository();
  writeFileSync(path.join(wrongRoot.root, ".gitignore"), "/output/\n");
  execFileSync("git", ["add", ".gitignore"], { cwd: wrongRoot.root });
  execFileSync("git", ["commit", "-qm", "wrong ignore"], { cwd: wrongRoot.root });
  await expect(createRun({
    root: wrongRoot.root,
    environment: {
      ...wrongRoot.environment,
      captureCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: wrongRoot.root,
        encoding: "utf8"
      }).trim()
    },
    runId: "wrong-ignore"
  })).rejects.toThrow("staging-ignore-rule-mismatch");
});

test("pins the ignored staging root and headed prebuilt System Chrome config", () => {
  const repositoryRoot = path.resolve(__dirname, "../..");
  const gitignore = readFileSync(path.join(repositoryRoot, ".gitignore"), "utf8");
  expect(gitignore.split(/\r?\n/))
    .toContain("/output/takram-orbital-production-staging/");
  const ignoredBy = execFileSync("git", [
    "check-ignore",
    "-v",
    "output/takram-orbital-production-staging/probe.json"
  ], { cwd: repositoryRoot, encoding: "utf8" });
  expect(ignoredBy).toContain("/output/takram-orbital-production-staging/");

  const config = readFileSync(path.join(
    repositoryRoot,
    "playwright.takram-orbital-production-system-chrome.config.ts"
  ), "utf8");
  expect(config).toContain('headless: false');
  expect(config).toContain('deviceScaleFactor: 1');
  expect(config).toContain('trace: "off"');
  expect(config).toContain('video: "off"');
  expect(config).toContain('reuseExistingServer: false');
  expect(config).toContain(
    'command: "pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3117"'
  );
  expect(config).not.toMatch(/command:[\s\S]{0,160}pnpm build/);
  const packageJson = JSON.parse(readFileSync(
    path.join(repositoryRoot, "package.json"),
    "utf8"
  ));
  expect(packageJson.scripts["capture:takram-orbital-production"]).toBe(
    "playwright test -c playwright.takram-orbital-production-system-chrome.config.ts " +
    "tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts --workers=1"
  );
});

test("creates one immutable run root and a pointer containing only its run ID", async () => {
  const { root, environment } = initializeRepository();
  const run = await createRun({ root, environment, runId: "run-001" });
  expect(run.root).toBe(path.join(
    root,
    "output/takram-orbital-production-staging/run-001/stage-1"
  ));
  expect(JSON.parse(readFileSync(run.pointerPath, "utf8")))
    .toEqual({ runId: "run-001" });
  expect(readActiveOrbitalStagingRun(root, "stage-1"))
    .toMatchObject({ runId: "run-001", environment });
  expect(resolveOrbitalStagingArtifactPath(run, "captures/frame.png"))
    .toBe(path.join(run.root, "captures/frame.png"));
  expect(() => resolveOrbitalStagingArtifactPath(run, "../formal/frame.png"))
    .toThrow("artifact-path-escapes-staging-root");
});

test("keeps the clean evidence commit separate from the reused production artifact", async () => {
  const { root, environment } = initializeRepository();
  writeFileSync(path.join(root, "tracked.txt"), "evidence commit\n");
  execFileSync("git", ["add", "tracked.txt"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "publish evidence"], { cwd: root });
  const evidenceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  const run = await createRun({
    root,
    environment: {
      ...environment,
      captureCommit: evidenceCommit
    },
    runId: "separate-build-commit"
  });
  expect(run.captureCommit).toBe(evidenceCommit);
  expect(run.environment.build.productionArtifactCommit)
    .toBe(environment.build.productionArtifactCommit);
});

test("writes a blank bounded review and requires human identity without verdict keys", async () => {
  const { root, environment } = initializeRepository();
  const run = await createRun({ root, environment, runId: "review-run" });
  const reviewPath = await writeOrbitalReviewTemplate({
    entries: [{ candidateId: "confirmed", progress: 0.06 }],
    rubric: ["coherentDensityField", "isolatedFragments"],
    run
  });
  const blank = JSON.parse(readFileSync(reviewPath, "utf8"));
  expect(JSON.stringify(blank)).not.toMatch(/result|outcome|pass|fail/i);
  expect(() => validateOrbitalHumanReview(blank, run)).toThrow(
    "human-review-incomplete"
  );
  const reviewed = {
    ...blank,
    reviewer: { name: "Aito", reviewedAt: "2026-08-13T10:00:00.000Z" },
    entries: [{
      candidateId: "confirmed",
      coherentDensityField: 2,
      isolatedFragments: false,
      notes: "coherent",
      progress: 0.06
    }]
  };
  expect(validateOrbitalHumanReview(reviewed, run)).toEqual(reviewed);
  expect(() => validateOrbitalHumanReview({ ...reviewed, result: true }, run))
    .toThrow("human-review-verdict-key-forbidden");
});

test("hashes every artifact, verifies lengths, and detects capture tampering", async () => {
  const { root, environment } = initializeRepository();
  const run = await createRun({ root, environment, runId: "hash-run" });
  const artifact = resolveOrbitalStagingArtifactPath(run, "captures/frame.bin");
  mkdirSync(path.dirname(artifact), { recursive: true });
  writeFileSync(artifact, Buffer.from([1, 2, 3, 4]));
  const manifest = await writeOrbitalArtifactManifest(run);
  expect(manifest.artifacts).toContainEqual({
    byteLength: 4,
    path: "captures/frame.bin",
    sha256: await hashOrbitalFile(artifact)
  });
  await expect(verifyArtifactManifest(run.root)).resolves.toEqual(manifest);
  writeFileSync(artifact, Buffer.from([1, 2, 3]));
  await expect(verifyArtifactManifest(run.root)).rejects.toThrow(
    "artifact-byte-length-mismatch"
  );
});

test("verifies published manifest and uses one non-overwriting rename", async () => {
  const { root, environment } = initializeRepository();
  const run = await createRun({ root, environment, runId: "publish-run" });
  const capture = resolveOrbitalStagingArtifactPath(run, "captures/frame.bin");
  mkdirSync(path.dirname(capture), { recursive: true });
  writeFileSync(capture, Buffer.from("immutable capture"));
  const reviewPath = await writeOrbitalReviewTemplate({
    entries: [{ candidateId: "confirmed", progress: 0.06 }],
    rubric: ["coherentDensityField"],
    run
  });
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  writeFileSync(reviewPath, `${JSON.stringify({
    ...review,
    reviewer: { name: "Aito", reviewedAt: "2026-08-13T10:00:00.000Z" }
  }, null, 2)}\n`);
  writeFileSync(resolveOrbitalStagingArtifactPath(run, "resolver-inputs.json"),
    `${JSON.stringify({ candidateId: "confirmed" })}\n`);
  const manifest = await writeOrbitalArtifactManifest(run);
  const result = await resolveAndPublishStageAtomically({
    currentEnvironment: environment,
    expectedArtifactManifestSha256: await hashOrbitalFile(
      path.join(run.root, "artifact-manifest.json")
    ),
    expectedContactSheetHashes: {},
    formalDirectory: run.formalDirectory,
    publicationFiles: {
      "checkpoint.json": { authorizedNextStage: "stage-2", stage: "stage-1" },
      "OUTCOME.md": "# Stage 1\n"
    },
    requireHumanReview: true,
    resolverInputs: { candidateId: "confirmed" },
    run
  });
  expect(result).toMatchObject({ published: true, runId: run.runId });
  expect(readFileSync(path.join(run.formalDirectory, "captures/frame.bin"),
    "utf8")).toBe("immutable capture");
  await expect(verifyArtifactManifest(run.formalDirectory)).resolves.toMatchObject({
    artifacts: expect.arrayContaining([...manifest.artifacts])
  });
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: environment,
    expectedArtifactManifestSha256: "0".repeat(64),
    expectedContactSheetHashes: {},
    formalDirectory: run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: true,
    resolverInputs: { candidateId: "confirmed" },
    run
  })).rejects.toThrow("formal-stage-already-exists");
});

test("rejects pointer, run, build, environment, review, sheet, and resolver drift", async () => {
  const { root, environment } = initializeRepository();
  const run = await createRun({ root, environment, runId: "drift-run" });
  writeFileSync(resolveOrbitalStagingArtifactPath(run, "resolver-inputs.json"),
    `${JSON.stringify({ candidateId: "confirmed" })}\n`);
  await writeOrbitalArtifactManifest(run);
  writeFileSync(run.pointerPath, '{"runId":"other-run"}\n');
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: environment,
    expectedArtifactManifestSha256: await hashOrbitalFile(
      path.join(run.root, "artifact-manifest.json")
    ),
    expectedContactSheetHashes: { "contact.png": "f".repeat(64) },
    formalDirectory: run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: false,
    resolverInputs: { candidateId: "coarse" },
    run
  })).rejects.toThrow("active-staging-run-mismatch");
});

test("rejects capture manifest, environment, review, contact-sheet, and resolver drift", async () => {
  const manifestCase = await prepareResolvableRun("manifest-drift");
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: manifestCase.environment,
    expectedArtifactManifestSha256: "0".repeat(64),
    expectedContactSheetHashes: { "contact.png": manifestCase.contactSha256 },
    formalDirectory: manifestCase.run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: true,
    resolverInputs: { candidateId: "confirmed" },
    run: manifestCase.run
  })).rejects.toThrow("staging-capture-manifest-hash-mismatch");

  const environmentCase = await prepareResolvableRun("environment-drift");
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: {
      ...environmentCase.environment,
      macOSVersion: "different"
    },
    expectedArtifactManifestSha256: environmentCase.manifestSha256,
    expectedContactSheetHashes: {
      "contact.png": environmentCase.contactSha256
    },
    formalDirectory: environmentCase.run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: true,
    resolverInputs: { candidateId: "confirmed" },
    run: environmentCase.run
  })).rejects.toThrow("capture-environment-mismatch");

  const reviewCase = await prepareResolvableRun("review-drift");
  const reviewPath = path.join(reviewCase.run.root, "visual-review.json");
  const review = JSON.parse(readFileSync(reviewPath, "utf8"));
  writeFileSync(reviewPath, `${JSON.stringify({
    ...review,
    reviewer: { name: "", reviewedAt: "" }
  })}\n`);
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: reviewCase.environment,
    expectedArtifactManifestSha256: reviewCase.manifestSha256,
    expectedContactSheetHashes: { "contact.png": reviewCase.contactSha256 },
    formalDirectory: reviewCase.run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: true,
    resolverInputs: { candidateId: "confirmed" },
    run: reviewCase.run
  })).rejects.toThrow("human-review-incomplete");

  const sheetCase = await prepareResolvableRun("sheet-drift");
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: sheetCase.environment,
    expectedArtifactManifestSha256: sheetCase.manifestSha256,
    expectedContactSheetHashes: { "contact.png": "f".repeat(64) },
    formalDirectory: sheetCase.run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: true,
    resolverInputs: { candidateId: "confirmed" },
    run: sheetCase.run
  })).rejects.toThrow("contact-sheet-hash-mismatch");

  const resolverCase = await prepareResolvableRun("resolver-drift");
  await expect(resolveAndPublishStageAtomically({
    currentEnvironment: resolverCase.environment,
    expectedArtifactManifestSha256: resolverCase.manifestSha256,
    expectedContactSheetHashes: { "contact.png": resolverCase.contactSha256 },
    formalDirectory: resolverCase.run.formalDirectory,
    publicationFiles: {},
    requireHumanReview: true,
    resolverInputs: { candidateId: "coarse" },
    run: resolverCase.run
  })).rejects.toThrow("resolver-inputs-mismatch");
});

test("permits a fresh retry only before formal publication", async () => {
  const { root, environment } = initializeRepository();
  const first = await createRun({ root, environment, runId: "retry-1" });
  const second = await createRun({ root, environment, runId: "retry-2" });
  expect(second.runId).not.toBe(first.runId);
  expect(readActiveOrbitalStagingRun(root, "stage-1").runId).toBe("retry-2");
  mkdirSync(second.formalDirectory, { recursive: true });
  await expect(createRun({ root, environment, runId: "retry-3" }))
    .rejects.toThrow("formal-stage-already-exists");
});

test("requires the immediately preceding checkpoint and rejects historical Stage B", () => {
  expect(() => assertOrbitalStageAuthorization("stage-1", null)).toThrow(
    "preceding-checkpoint-required"
  );
  expect(() => assertOrbitalStageAuthorization("stage-1", {
    authorizedNextStage: "stage-1",
    outcome: "STAGE_0_READY",
    stage: "stage-0"
  })).not.toThrow();
  expect(() => assertOrbitalStageAuthorization("stage-4a", {
    authorizedNextStage: "stage-4a",
    outcome: "ORBITAL_HEALTHY_STOCK_BASELINE_READY",
    stage: "stage-b"
  })).toThrow("historical-stage-b-not-authorized");
  expect(() => assertOrbitalStageAuthorization("stage-2", {
    authorizedNextStage: null,
    outcome: "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL",
    stage: "stage-1"
  })).toThrow("terminal-checkpoint-has-no-successor");
  expect(() => assertOrbitalStageAuthorization("v3-compatibility", {
    authorizedNextStage: "v3-compatibility",
    outcome: "ORBITAL_FINAL_STOCK_REPLAY_READY",
    stage: "final-stock"
  })).not.toThrow();
});

test("validates the complete M4 System Chrome production environment", () => {
  expect(validateOrbitalEvidenceEnvironment(VALID_ENVIRONMENT)).toEqual([]);
  expect(validateOrbitalEvidenceEnvironment({
    ...VALID_ENVIRONMENT,
    build: { ...VALID_ENVIRONMENT.build, mode: "development" },
    display: { ...VALID_ENVIRONMENT.display, devicePixelRatio: 2 },
    hardware: { chip: "Apple M3" },
    power: { lowPowerMode: 1, source: "Battery Power" }
  })).toEqual(expect.arrayContaining([
    "hardware-chip-not-apple-m4",
    "production-build-required",
    "device-pixel-ratio-mismatch",
    "ac-power-required",
    "low-power-mode-enabled"
  ]));
});

test("requires all six allocation generations to change", () => {
  const before = {
    clouds: { current: 1, history: 2, resolve: 3 },
    shadow: { current: 4, history: 5, resolve: 6 }
  };
  expect(() => verifyFreshCompleteRemount(before, {
    clouds: { current: 7, history: 8, resolve: 9 },
    shadow: { current: 10, history: 11, resolve: 12 }
  })).not.toThrow();
  expect(() => verifyFreshCompleteRemount(before, {
    ...before,
    clouds: { ...before.clouds, current: 7 }
  }))
    .toThrow("incomplete-composer-remount");
});
