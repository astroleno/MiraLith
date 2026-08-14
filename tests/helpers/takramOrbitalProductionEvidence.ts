import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  cpSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import type {
  TakramOrbitalGpuMeasurementMode,
  TakramOrbitalGpuProfileSnapshot
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler";
import type {
  TakramOrbitalAllocationGenerations
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevRuntime";
import type { TakramOrbitalProductionStepCandidate } from
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling";
import type {
  TakramOrbitalFeatureState,
  TakramOrbitalOutput,
  TakramParityPrimaryMarchReadback,
  TakramParitySampleCountReadback,
  TakramParityStageReadbackCapture,
  TakramParityTelemetry
} from "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract";

const STAGING_IGNORE_RULE = "/output/takram-orbital-production-staging/";
const STAGING_RELATIVE_ROOT = "output/takram-orbital-production-staging";
const MANIFEST_FILE = "artifact-manifest.json";
const REVIEW_FILE = "visual-review.json";
const RUN_FILE = "run.json";
const RESOLVER_INPUTS_FILE = "resolver-inputs.json";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const ORBITAL_PRODUCTION_STAGES = Object.freeze([
  "stage-0",
  "stage-1",
  "stage-2",
  "stage-4a",
  "stage-4b",
  "stage-4c",
  "stage-4d",
  "final-stock",
  "v3-compatibility"
] as const);
export type OrbitalProductionStage =
  (typeof ORBITAL_PRODUCTION_STAGES)[number];

export interface OrbitalEvidenceEnvironment {
  readonly browser: Readonly<{
    chromeVersion: string;
    focused: boolean;
    visibilityState: string;
  }>;
  readonly build: Readonly<{
    buildId: string;
    buildIdSha256: string;
    fingerprintSha256: string;
    mode: "production" | "development";
    productionArtifactCommit: string;
  }>;
  readonly captureCommit: string;
  readonly display: Readonly<{
    canvasHeight: number;
    canvasWidth: number;
    devicePixelRatio: number;
    innerHeight: number;
    innerWidth: number;
  }>;
  readonly gpu: Readonly<{
    renderer: string;
    vendor: string;
  }>;
  readonly hardware: Readonly<{ chip: string }>;
  readonly macOSVersion: string;
  readonly power: Readonly<{
    lowPowerMode: 0 | 1;
    source: "AC Power" | "Battery Power" | string;
  }>;
}

export interface OrbitalStageCheckpoint {
  readonly authorizedNextStage: OrbitalProductionStage | number | null;
  readonly outcome: string;
  readonly stage: string | number;
}

export interface OrbitalStagingRun {
  readonly captureCommand: string;
  readonly captureCommit: string;
  readonly createdAt: string;
  readonly environment: OrbitalEvidenceEnvironment;
  readonly formalDirectory: string;
  readonly pointerPath: string;
  readonly precedingCheckpoint: OrbitalStageCheckpoint | null;
  readonly repositoryRoot: string;
  readonly root: string;
  readonly runId: string;
  readonly schemaVersion: 1;
  readonly stage: OrbitalProductionStage;
}

export interface OrbitalArtifactRecord {
  readonly byteLength: number;
  readonly path: string;
  readonly sha256: string;
}

export interface OrbitalArtifactManifest {
  readonly artifacts: readonly OrbitalArtifactRecord[];
  readonly purpose: "capture" | "publication";
  readonly runId: string;
  readonly schemaVersion: 1;
  readonly stage: OrbitalProductionStage;
}

export interface OrbitalReviewTemplateInput {
  readonly entries: readonly Readonly<Record<string, unknown>>[];
  readonly rubric: readonly string[];
  readonly run: OrbitalStagingRun;
}

export interface OrbitalCaptureRequest {
  readonly artifactPath: string;
  readonly candidateId: string;
  readonly expectedFeatureState: TakramOrbitalFeatureState;
  readonly expectedOutput: TakramOrbitalOutput;
  readonly expectedProductionStep: TakramOrbitalProductionStepCandidate;
  readonly nativeFrame?: 32;
  readonly page: Page;
  readonly route: string;
  readonly run: OrbitalStagingRun;
}

export interface OrbitalPngCapture {
  readonly artifact: OrbitalArtifactRecord;
  readonly frame: Readonly<{
    cloudsFrame?: number;
    frameLockPass: boolean;
    height: number;
    historyEpochHash: string;
    nativeFrameCount: number;
    resolveFrame?: number;
    shadowFrame?: number;
    stbnSliceIndex?: number;
    temporalJitterIndex?: number;
    width: number;
  }>;
  readonly identity: OrbitalCaptureIdentity;
}

export interface OrbitalCaptureIdentity {
  readonly allocations: TakramOrbitalAllocationGenerations;
  readonly featureState: TakramOrbitalFeatureState;
  readonly lookdevBaseKey: string;
  readonly lookdevMountKey: string;
  readonly output: TakramOrbitalOutput;
  readonly rendererFingerprintHash: string;
  readonly runtimeEvidenceEpoch: string;
}

export interface OrbitalGpuPopulationRequest extends OrbitalCaptureRequest {
  readonly committedWinnerId: string;
  readonly measurementMode: TakramOrbitalGpuMeasurementMode;
  readonly targetSampleCount: 8 | 120;
  readonly warmupFrameCount: 8 | 120;
}

export interface OrbitalStagingRunInput {
  readonly captureCommand?: string;
  readonly environment?: OrbitalEvidenceEnvironment;
  readonly formalDirectory: string;
  readonly precedingCheckpoint?: OrbitalStageCheckpoint | null;
  readonly processEnvironment?: Readonly<Record<string, string | undefined>>;
  readonly repositoryRoot?: string;
  readonly runId?: string;
  readonly stage: OrbitalProductionStage;
}

export interface OrbitalStageResolutionInput {
  readonly currentEnvironment: OrbitalEvidenceEnvironment;
  readonly expectedArtifactManifestSha256: string;
  readonly expectedContactSheetHashes: Readonly<Record<string, string>>;
  readonly formalDirectory: string;
  readonly publicationFiles: Readonly<Record<string, Buffer | string | unknown>>;
  readonly requireHumanReview: boolean;
  readonly resolverInputs: unknown;
  readonly run: OrbitalStagingRun;
}

export interface OrbitalStagePublicationResult {
  readonly artifactManifestSha256: string;
  readonly formalDirectory: string;
  readonly published: true;
  readonly runId: string;
  readonly stage: OrbitalProductionStage;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function exactJsonEqual(left: unknown, right: unknown): boolean {
  return stableJson(left) === stableJson(right);
}

export function equalOrbitalEvidenceIdentity(
  left: unknown,
  right: unknown
): boolean {
  return exactJsonEqual(left, right);
}

function writeDurableFile(filePath: string, value: Buffer | string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
  const descriptor = openSync(filePath, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function writeJson(filePath: string, value: unknown): void {
  writeDurableFile(filePath, stableJson(value));
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function command(
  executable: string,
  args: readonly string[],
  cwd?: string
): string {
  return execFileSync(executable, [...args], {
    ...(cwd === undefined ? {} : { cwd }),
    encoding: "utf8"
  }).trim();
}

function listFiles(root: string): string[] {
  const output: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`artifact-symlink-forbidden:${absolute}`);
      }
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        output.push(path.relative(root, absolute).split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return output;
}

function fsyncTree(root: string): void {
  const entries = listFiles(root);
  for (const relative of entries) {
    const descriptor = openSync(path.join(root, relative), "r");
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
  const directories: string[] = [];
  const walk = (directory: string) => {
    directories.push(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(directory, entry.name));
    }
  };
  walk(root);
  for (const directory of directories.reverse()) {
    const descriptor = openSync(directory, "r");
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }
}

export async function hashOrbitalFile(filePath: string): Promise<string> {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function hashBytes(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeStageToken(value: string | number | null): string | null {
  if (value === null) return null;
  if (typeof value === "number") {
    if (value === 0 || value === 1 || value === 2) return `stage-${value}`;
    return String(value);
  }
  return value.toLowerCase();
}

const PRECEDING_STAGE: Readonly<Record<OrbitalProductionStage, string | null>> =
  Object.freeze({
    "stage-0": null,
    "stage-1": "stage-0",
    "stage-2": "stage-1",
    "stage-4a": "stage-3",
    "stage-4b": "stage-4a",
    "stage-4c": "stage-4b",
    "stage-4d": "stage-4c",
    "final-stock": "stage-4d",
    "v3-compatibility": "final-stock"
  });

export function assertOrbitalStageAuthorization(
  stage: OrbitalProductionStage,
  checkpoint: OrbitalStageCheckpoint | null
): void {
  const expectedPredecessor = PRECEDING_STAGE[stage];
  if (expectedPredecessor === null) {
    if (checkpoint !== null) {
      throw new Error("stage-0-must-not-have-preceding-checkpoint");
    }
    return;
  }
  if (checkpoint === null) throw new Error("preceding-checkpoint-required");
  const checkpointStage = normalizeStageToken(checkpoint.stage);
  if (checkpointStage === "stage-b") {
    throw new Error("historical-stage-b-not-authorized");
  }
  if (checkpoint.authorizedNextStage === null) {
    throw new Error("terminal-checkpoint-has-no-successor");
  }
  if (checkpointStage !== expectedPredecessor) {
    throw new Error(
      `immediately-preceding-checkpoint-required:${expectedPredecessor}`
    );
  }
  const authorized = normalizeStageToken(checkpoint.authorizedNextStage);
  if (authorized !== stage) {
    throw new Error(`checkpoint-does-not-authorize-stage:${stage}`);
  }
  if (stage === "stage-4a" &&
    checkpoint.outcome !== "ORBITAL_HEALTHY_STOCK_BASELINE_READY") {
    throw new Error("healthy-stock-baseline-checkpoint-required");
  }
  if (stage === "v3-compatibility" &&
    checkpoint.outcome !== "ORBITAL_FINAL_STOCK_REPLAY_READY") {
    throw new Error("final-stock-replay-checkpoint-required");
  }
}

export function validateOrbitalEvidenceEnvironment(
  environment: OrbitalEvidenceEnvironment
): string[] {
  const reasons: string[] = [];
  if (environment.hardware.chip !== "Apple M4") {
    reasons.push("hardware-chip-not-apple-m4");
  }
  if (environment.macOSVersion.trim() === "") reasons.push("macos-version-missing");
  if (!environment.browser.chromeVersion.startsWith("Google Chrome ")) {
    reasons.push("system-chrome-required");
  }
  if (!environment.gpu.renderer.includes("ANGLE") ||
    !environment.gpu.renderer.includes("Metal") ||
    !environment.gpu.renderer.includes("Apple M4")) {
    reasons.push("angle-metal-apple-m4-renderer-required");
  }
  if (environment.gpu.vendor.trim() === "") reasons.push("gpu-vendor-missing");
  if (environment.display.innerWidth !== 1440 ||
    environment.display.innerHeight !== 960) {
    reasons.push("css-viewport-mismatch");
  }
  if (environment.display.canvasWidth !== 1440 ||
    environment.display.canvasHeight !== 960) {
    reasons.push("physical-canvas-size-mismatch");
  }
  if (environment.display.devicePixelRatio !== 1) {
    reasons.push("device-pixel-ratio-mismatch");
  }
  if (environment.browser.visibilityState !== "visible") {
    reasons.push("page-not-visible");
  }
  if (!environment.browser.focused) reasons.push("page-not-focused");
  if (environment.power.source !== "AC Power") reasons.push("ac-power-required");
  if (environment.power.lowPowerMode !== 0) reasons.push("low-power-mode-enabled");
  if (environment.build.mode !== "production") {
    reasons.push("production-build-required");
  }
  if (environment.build.buildId.trim() === "") reasons.push("build-id-missing");
  if (!SHA256_PATTERN.test(environment.build.buildIdSha256)) {
    reasons.push("build-id-hash-invalid");
  }
  if (!SHA256_PATTERN.test(environment.build.fingerprintSha256)) {
    reasons.push("production-fingerprint-invalid");
  }
  if (!/^[0-9a-f]{40}$/.test(environment.captureCommit)) {
    reasons.push("capture-commit-invalid");
  }
  if (!/^[0-9a-f]{40}$/.test(environment.build.productionArtifactCommit)) {
    reasons.push("production-artifact-commit-invalid");
  }
  return reasons;
}

function readBuildFingerprint(repositoryRoot: string) {
  const nextRoot = path.join(repositoryRoot, "apps/site/.next");
  const buildIdPath = path.join(nextRoot, "BUILD_ID");
  if (!existsSync(buildIdPath)) throw new Error("production-build-id-missing");
  const buildIdBytes = readFileSync(buildIdPath);
  const fingerprintFiles = [
    "BUILD_ID",
    "build-manifest.json",
    "app-build-manifest.json",
    "routes-manifest.json",
    "server/app-paths-manifest.json"
  ].filter((relative) => existsSync(path.join(nextRoot, relative)));
  const fingerprint = createHash("sha256");
  for (const relative of fingerprintFiles.sort()) {
    const bytes = readFileSync(path.join(nextRoot, relative));
    fingerprint.update(relative);
    fingerprint.update("\0");
    fingerprint.update(String(bytes.byteLength));
    fingerprint.update("\0");
    fingerprint.update(bytes);
  }
  return {
    buildId: buildIdBytes.toString("utf8").trim(),
    buildIdSha256: hashBytes(buildIdBytes),
    fingerprintSha256: fingerprint.digest("hex")
  };
}

function findStringProperty(value: unknown, names: readonly string[]): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findStringProperty(entry, names);
      if (found !== null) return found;
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (names.includes(key) && typeof entry === "string") return entry;
      const found = findStringProperty(entry, names);
      if (found !== null) return found;
    }
  }
  return null;
}

function collectPowerState() {
  const battery = command("pmset", ["-g", "batt"]);
  const custom = command("pmset", ["-g", "custom"]);
  const sourceMatch = battery.match(/Now drawing from '([^']+)'/);
  const source = sourceMatch?.[1] ?? "unknown";
  const acSection = custom.match(/AC Power:\n([\s\S]*?)(?:\n\S|$)/)?.[1] ?? custom;
  const lowPowerMatch = acSection.match(/lowpowermode\s+(\d+)/);
  const lowPowerMode = Number(lowPowerMatch?.[1] ?? Number.NaN);
  return {
    lowPowerMode: lowPowerMode === 0 ? 0 as const : 1 as const,
    source
  };
}

export async function collectOrbitalEvidenceEnvironment(input: Readonly<{
  chromeExecutable?: string;
  page: Page;
  productionArtifactCommit?: string;
  repositoryRoot?: string;
}>): Promise<OrbitalEvidenceEnvironment> {
  const repositoryRoot = path.resolve(input.repositoryRoot ?? process.cwd());
  const captureCommit = command("git", ["rev-parse", "HEAD"], repositoryRoot);
  const trackedStatus = command(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    repositoryRoot
  );
  if (trackedStatus !== "") throw new Error("tracked-worktree-dirty");
  const hardware = JSON.parse(command(
    "system_profiler",
    ["SPHardwareDataType", "-json"]
  )) as unknown;
  const chip = findStringProperty(hardware, ["chip_type", "chip", "processor_name"])
    ?? "unknown";
  const macOSVersion = command("sw_vers", ["-productVersion"]);
  const chromeExecutable = input.chromeExecutable ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const chromeVersion = command(chromeExecutable, ["--version"]);
  const build = readBuildFingerprint(repositoryRoot);
  const browserState = await input.page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2");
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    return {
      canvasHeight: canvas?.height ?? 0,
      canvasWidth: canvas?.width ?? 0,
      devicePixelRatio: window.devicePixelRatio,
      focused: document.hasFocus(),
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      renderer: gl && debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
        : "",
      vendor: gl && debugInfo
        ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
        : "",
      visibilityState: document.visibilityState
    };
  });
  return Object.freeze({
    browser: Object.freeze({
      chromeVersion,
      focused: browserState.focused,
      visibilityState: browserState.visibilityState
    }),
    build: Object.freeze({
      ...build,
      mode: "production" as const,
      productionArtifactCommit: input.productionArtifactCommit ?? captureCommit
    }),
    captureCommit,
    display: Object.freeze({
      canvasHeight: browserState.canvasHeight,
      canvasWidth: browserState.canvasWidth,
      devicePixelRatio: browserState.devicePixelRatio,
      innerHeight: browserState.innerHeight,
      innerWidth: browserState.innerWidth
    }),
    gpu: Object.freeze({
      renderer: browserState.renderer,
      vendor: browserState.vendor
    }),
    hardware: Object.freeze({ chip }),
    macOSVersion,
    power: Object.freeze(collectPowerState())
  });
}

function assertExactStagingIgnore(repositoryRoot: string): void {
  const gitignorePath = path.join(repositoryRoot, ".gitignore");
  const lines = readFileSync(gitignorePath, "utf8").split(/\r?\n/);
  if (!lines.includes(STAGING_IGNORE_RULE)) {
    throw new Error("staging-ignore-rule-mismatch");
  }
  const probe = `${STAGING_RELATIVE_ROOT}/probe.json`;
  let verbose = "";
  try {
    verbose = command("git", ["check-ignore", "-v", probe], repositoryRoot);
  } catch {
    throw new Error("staging-ignore-check-failed");
  }
  if (!verbose.includes(STAGING_IGNORE_RULE)) {
    throw new Error("staging-ignore-rule-mismatch");
  }
}

function assertTrackedClean(repositoryRoot: string): string {
  const status = command(
    "git",
    ["status", "--porcelain", "--untracked-files=no"],
    repositoryRoot
  );
  if (status !== "") throw new Error("tracked-worktree-dirty");
  return command("git", ["rev-parse", "HEAD"], repositoryRoot);
}

function activePointerPath(
  repositoryRoot: string,
  stage: OrbitalProductionStage
): string {
  return path.join(
    repositoryRoot,
    STAGING_RELATIVE_ROOT,
    `active-${stage}.json`
  );
}

function validateCaptureCommand(stage: OrbitalProductionStage, value: string): void {
  const commandStage = value
    .replace(/-(capture|diagnostics|gpu|confirmation|resolve|replay|resolve-terminal|terminal-resolve)$/,
      "");
  if (commandStage !== stage) {
    throw new Error(`capture-command-stage-mismatch:${value}:${stage}`);
  }
}

export async function createOrbitalStagingRun(
  input: OrbitalStagingRunInput
): Promise<OrbitalStagingRun | null> {
  const processEnvironment = input.processEnvironment ?? process.env;
  const captureCommand = input.captureCommand ??
    processEnvironment.MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE;
  if (captureCommand === undefined || captureCommand === "") return null;
  validateCaptureCommand(input.stage, captureCommand);
  const repositoryRoot = path.resolve(input.repositoryRoot ?? process.cwd());
  const formalDirectory = path.resolve(input.formalDirectory);
  if (existsSync(formalDirectory)) throw new Error("formal-stage-already-exists");
  assertOrbitalStageAuthorization(
    input.stage,
    input.precedingCheckpoint ?? null
  );
  assertExactStagingIgnore(repositoryRoot);
  const captureCommit = assertTrackedClean(repositoryRoot);
  const build = readBuildFingerprint(repositoryRoot);
  const environment = input.environment;
  if (environment === undefined) {
    throw new Error("capture-environment-required");
  }
  const environmentReasons = validateOrbitalEvidenceEnvironment(environment);
  if (environmentReasons.length > 0) {
    throw new Error(`capture-environment-invalid:${environmentReasons.join(",")}`);
  }
  if (environment.captureCommit !== captureCommit) {
    throw new Error("capture-commit-mismatch");
  }
  if (environment.build.buildId !== build.buildId ||
    environment.build.buildIdSha256 !== build.buildIdSha256 ||
    environment.build.fingerprintSha256 !== build.fingerprintSha256) {
    throw new Error("capture-build-id-mismatch");
  }
  const runId = input.runId ?? `${Date.now()}-${randomUUID()}`;
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("invalid-staging-run-id");
  const root = path.join(
    repositoryRoot,
    STAGING_RELATIVE_ROOT,
    runId,
    input.stage
  );
  if (existsSync(root)) throw new Error("immutable-staging-run-already-exists");
  const pointerPath = activePointerPath(repositoryRoot, input.stage);
  const run: OrbitalStagingRun = Object.freeze({
    captureCommand,
    captureCommit,
    createdAt: new Date().toISOString(),
    environment,
    formalDirectory,
    pointerPath,
    precedingCheckpoint: input.precedingCheckpoint ?? null,
    repositoryRoot,
    root,
    runId,
    schemaVersion: 1 as const,
    stage: input.stage
  });
  mkdirSync(root, { recursive: true });
  writeJson(path.join(root, RUN_FILE), run);
  mkdirSync(path.dirname(pointerPath), { recursive: true });
  const pointerTemporary = `${pointerPath}.tmp-${runId}`;
  writeJson(pointerTemporary, { runId });
  renameSync(pointerTemporary, pointerPath);
  return run;
}

export function readActiveOrbitalStagingRun(
  repositoryRoot: string,
  stage: OrbitalProductionStage
): OrbitalStagingRun {
  const resolvedRoot = path.resolve(repositoryRoot);
  const pointerPath = activePointerPath(resolvedRoot, stage);
  if (!existsSync(pointerPath)) throw new Error("active-staging-pointer-missing");
  const pointer = readJson<Record<string, unknown>>(pointerPath);
  if (Object.keys(pointer).length !== 1 || typeof pointer.runId !== "string") {
    throw new Error("active-staging-pointer-invalid");
  }
  const runPath = path.join(
    resolvedRoot,
    STAGING_RELATIVE_ROOT,
    pointer.runId,
    stage,
    RUN_FILE
  );
  if (!existsSync(runPath)) throw new Error("active-staging-run-missing");
  const run = readJson<OrbitalStagingRun>(runPath);
  if (run.runId !== pointer.runId || run.stage !== stage ||
    path.resolve(run.root) !== path.dirname(runPath)) {
    throw new Error("active-staging-run-stage-mismatch");
  }
  return run;
}

export function resolveOrbitalStagingArtifactPath(
  run: OrbitalStagingRun,
  relativePath: string
): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error("artifact-path-escapes-staging-root");
  }
  const resolved = path.resolve(run.root, relativePath);
  const relative = path.relative(run.root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative) || relative === "") {
    throw new Error("artifact-path-escapes-staging-root");
  }
  return resolved;
}

export async function writeOrbitalReviewTemplate(
  input: OrbitalReviewTemplateInput
): Promise<string> {
  const reviewPath = resolveOrbitalStagingArtifactPath(input.run, REVIEW_FILE);
  if (existsSync(reviewPath)) throw new Error("review-template-already-exists");
  const review = {
    entries: input.entries.map((entry) => ({ ...entry })),
    reviewer: { name: "", reviewedAt: "" },
    rubric: [...input.rubric],
    runId: input.run.runId,
    schemaVersion: 1,
    stage: input.run.stage
  };
  assertNoVerdictKeys(review);
  writeJson(reviewPath, review);
  return reviewPath;
}

function assertNoVerdictKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoVerdictKeys);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (/^(result|outcome|pass|fail|passed|failed)$/i.test(key)) {
      throw new Error("human-review-verdict-key-forbidden");
    }
    assertNoVerdictKeys(entry);
  }
}

export function validateOrbitalHumanReview(
  value: unknown,
  run: OrbitalStagingRun
): unknown {
  assertNoVerdictKeys(value);
  if (value === null || typeof value !== "object") {
    throw new Error("human-review-schema-invalid");
  }
  const review = value as Record<string, unknown>;
  if (review.schemaVersion !== 1 || review.runId !== run.runId ||
    review.stage !== run.stage || !Array.isArray(review.entries) ||
    !Array.isArray(review.rubric)) {
    throw new Error("human-review-schema-invalid");
  }
  const reviewer = review.reviewer;
  if (reviewer === null || typeof reviewer !== "object") {
    throw new Error("human-review-incomplete");
  }
  const { name, reviewedAt } = reviewer as Record<string, unknown>;
  if (typeof name !== "string" || name.trim() === "" ||
    typeof reviewedAt !== "string" || reviewedAt.trim() === "" ||
    Number.isNaN(Date.parse(reviewedAt))) {
    throw new Error("human-review-incomplete");
  }
  return value;
}

async function buildArtifactManifest(input: Readonly<{
  purpose: "capture" | "publication";
  root: string;
  runId: string;
  stage: OrbitalProductionStage;
}>): Promise<OrbitalArtifactManifest> {
  const allowedUnlisted = input.purpose === "capture"
    ? new Set([MANIFEST_FILE, REVIEW_FILE])
    : new Set([MANIFEST_FILE]);
  const files = listFiles(input.root)
    .filter((relative) => !allowedUnlisted.has(relative));
  const artifacts = await Promise.all(files.map(async (relative) => {
    const absolute = path.join(input.root, relative);
    return {
      byteLength: statSync(absolute).size,
      path: relative,
      sha256: await hashOrbitalFile(absolute)
    };
  }));
  return Object.freeze({
    artifacts: Object.freeze(artifacts),
    purpose: input.purpose,
    runId: input.runId,
    schemaVersion: 1 as const,
    stage: input.stage
  });
}

export async function writeOrbitalArtifactManifest(
  run: OrbitalStagingRun
): Promise<OrbitalArtifactManifest> {
  const manifest = await buildArtifactManifest({
    purpose: "capture",
    root: run.root,
    runId: run.runId,
    stage: run.stage
  });
  writeJson(path.join(run.root, MANIFEST_FILE), manifest);
  return manifest;
}

export async function verifyArtifactManifest(
  root: string
): Promise<OrbitalArtifactManifest> {
  const manifestPath = path.join(root, MANIFEST_FILE);
  if (!existsSync(manifestPath)) throw new Error("artifact-manifest-missing");
  const manifest = readJson<OrbitalArtifactManifest>(manifestPath);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.artifacts) ||
    !ORBITAL_PRODUCTION_STAGES.includes(manifest.stage)) {
    throw new Error("artifact-manifest-schema-invalid");
  }
  const seen = new Set<string>();
  for (const artifact of manifest.artifacts) {
    if (seen.has(artifact.path)) throw new Error("artifact-manifest-duplicate-path");
    seen.add(artifact.path);
    const absolute = path.resolve(root, artifact.path);
    const relative = path.relative(root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative) ||
      !existsSync(absolute) || !lstatSync(absolute).isFile()) {
      throw new Error(`artifact-missing:${artifact.path}`);
    }
    const byteLength = statSync(absolute).size;
    if (byteLength !== artifact.byteLength) {
      throw new Error(`artifact-byte-length-mismatch:${artifact.path}`);
    }
    const sha256 = await hashOrbitalFile(absolute);
    if (sha256 !== artifact.sha256) {
      throw new Error(`artifact-sha256-mismatch:${artifact.path}`);
    }
  }
  const allowedUnlisted = manifest.purpose === "capture"
    ? new Set([MANIFEST_FILE, REVIEW_FILE])
    : new Set([MANIFEST_FILE]);
  for (const relative of listFiles(root)) {
    if (!allowedUnlisted.has(relative) && !seen.has(relative)) {
      throw new Error(`artifact-unmanifested:${relative}`);
    }
  }
  return manifest;
}

function writePublicationFile(filePath: string, value: unknown): void {
  if (Buffer.isBuffer(value)) {
    writeDurableFile(filePath, value);
  } else if (typeof value === "string") {
    writeDurableFile(filePath, value);
  } else {
    writeJson(filePath, value);
  }
}

function markFailedResolve(run: OrbitalStagingRun): void {
  const marker = path.join(
    run.repositoryRoot,
    STAGING_RELATIVE_ROOT,
    `failed-${run.runId}.json`
  );
  if (!existsSync(marker)) writeJson(marker, { runId: run.runId });
}

function failedResolveMarker(run: OrbitalStagingRun): string {
  return path.join(
    run.repositoryRoot,
    STAGING_RELATIVE_ROOT,
    `failed-${run.runId}.json`
  );
}

export async function resolveAndPublishStageAtomically(
  input: OrbitalStageResolutionInput
): Promise<OrbitalStagePublicationResult> {
  if (existsSync(input.formalDirectory)) {
    throw new Error("formal-stage-already-exists");
  }
  if (path.resolve(input.formalDirectory) !== path.resolve(input.run.formalDirectory)) {
    throw new Error("formal-stage-directory-mismatch");
  }
  if (existsSync(failedResolveMarker(input.run))) {
    throw new Error("failed-staging-run-cannot-be-reused");
  }
  const temporaryDirectory = path.join(
    path.dirname(input.formalDirectory),
    `.${path.basename(input.formalDirectory)}.complete-${input.run.runId}`
  );
  try {
    const activePointer = readJson<Record<string, unknown>>(input.run.pointerPath);
    if (Object.keys(activePointer).length !== 1 ||
      activePointer.runId !== input.run.runId) {
      throw new Error("active-staging-run-mismatch");
    }
    const active = readActiveOrbitalStagingRun(
      input.run.repositoryRoot,
      input.run.stage
    );
    if (active.runId !== input.run.runId) {
      throw new Error("active-staging-run-mismatch");
    }
    const persistedRun = readJson<OrbitalStagingRun>(
      path.join(input.run.root, RUN_FILE)
    );
    if (!exactJsonEqual(persistedRun, input.run)) {
      throw new Error("staging-run-metadata-mismatch");
    }
    assertTrackedClean(input.run.repositoryRoot);
    if (!exactJsonEqual(input.currentEnvironment, input.run.environment)) {
      throw new Error("capture-environment-mismatch");
    }
    const environmentReasons = validateOrbitalEvidenceEnvironment(
      input.currentEnvironment
    );
    if (environmentReasons.length > 0) {
      throw new Error(`capture-environment-invalid:${environmentReasons.join(",")}`);
    }
    const manifestPath = path.join(input.run.root, MANIFEST_FILE);
    if (await hashOrbitalFile(manifestPath) !==
      input.expectedArtifactManifestSha256) {
      throw new Error("staging-capture-manifest-hash-mismatch");
    }
    await verifyArtifactManifest(input.run.root);
    const resolverInputsPath = path.join(input.run.root, RESOLVER_INPUTS_FILE);
    if (!existsSync(resolverInputsPath) ||
      !exactJsonEqual(readJson<unknown>(resolverInputsPath), input.resolverInputs)) {
      throw new Error("resolver-inputs-mismatch");
    }
    for (const [relative, expectedSha256] of Object.entries(
      input.expectedContactSheetHashes
    )) {
      if (!SHA256_PATTERN.test(expectedSha256)) {
        throw new Error(`contact-sheet-hash-invalid:${relative}`);
      }
      const absolute = resolveOrbitalStagingArtifactPath(input.run, relative);
      if (!existsSync(absolute) || await hashOrbitalFile(absolute) !== expectedSha256) {
        throw new Error(`contact-sheet-hash-mismatch:${relative}`);
      }
    }
    const reviewPath = path.join(input.run.root, REVIEW_FILE);
    if (input.requireHumanReview) {
      if (!existsSync(reviewPath)) throw new Error("human-review-missing");
      validateOrbitalHumanReview(readJson(reviewPath), input.run);
    }
    mkdirSync(path.dirname(input.formalDirectory), { recursive: true });
    if (existsSync(temporaryDirectory)) {
      throw new Error("publication-temporary-directory-already-exists");
    }
    cpSync(input.run.root, temporaryDirectory, {
      errorOnExist: true,
      recursive: true
    });
    for (const [relative, value] of Object.entries(input.publicationFiles)) {
      if (relative === MANIFEST_FILE) {
        throw new Error("publication-manifest-is-machine-owned");
      }
      const absolute = path.resolve(temporaryDirectory, relative);
      const relativeToTemporary = path.relative(temporaryDirectory, absolute);
      if (relativeToTemporary.startsWith("..") || path.isAbsolute(relativeToTemporary)) {
        throw new Error("publication-file-escapes-temporary-root");
      }
      writePublicationFile(absolute, value);
    }
    rmSync(path.join(temporaryDirectory, MANIFEST_FILE), { force: true });
    const publicationManifest = await buildArtifactManifest({
      purpose: "publication",
      root: temporaryDirectory,
      runId: input.run.runId,
      stage: input.run.stage
    });
    writeJson(path.join(temporaryDirectory, MANIFEST_FILE), publicationManifest);
    await verifyArtifactManifest(temporaryDirectory);
    fsyncTree(temporaryDirectory);
    if (existsSync(input.formalDirectory)) {
      throw new Error("formal-stage-already-exists");
    }
    renameSync(temporaryDirectory, input.formalDirectory);
    const parentDescriptor = openSync(path.dirname(input.formalDirectory), "r");
    try {
      fsyncSync(parentDescriptor);
    } finally {
      closeSync(parentDescriptor);
    }
    return Object.freeze({
      artifactManifestSha256: await hashOrbitalFile(
        path.join(input.formalDirectory, MANIFEST_FILE)
      ),
      formalDirectory: input.formalDirectory,
      published: true as const,
      runId: input.run.runId,
      stage: input.run.stage
    });
  } catch (error) {
    rmSync(temporaryDirectory, { force: true, recursive: true });
    markFailedResolve(input.run);
    throw error;
  }
}

export function verifyFreshCompleteRemount(
  before: TakramOrbitalAllocationGenerations,
  after: TakramOrbitalAllocationGenerations
): void {
  const entries = [
    [before.clouds.current, after.clouds.current],
    [before.clouds.history, after.clouds.history],
    [before.clouds.resolve, after.clouds.resolve],
    [before.shadow.current, after.shadow.current],
    [before.shadow.history, after.shadow.history],
    [before.shadow.resolve, after.shadow.resolve]
  ];
  if (entries.some(([left, right]) => left === null || right === null ||
    left === right)) {
    throw new Error("incomplete-composer-remount");
  }
}

async function waitForExactOrbitalRoute(
  input: OrbitalCaptureRequest
): Promise<{ identity: OrbitalCaptureIdentity; telemetry: TakramParityTelemetry }> {
  const response = await input.page.goto(input.route);
  if (response === null || response.status() !== 200) {
    throw new Error(`orbital-route-navigation-failed:${response?.status() ?? "null"}`);
  }
  const route = input.page.locator("[data-takram-parity-route='true']");
  await route.waitFor({ state: "attached", timeout: 180_000 });
  const expected = {
    featureState: input.expectedFeatureState,
    output: input.expectedOutput,
    productionStep: input.expectedProductionStep
  };
  const attributes = await Promise.all([
    route.getAttribute("data-orbital-production-step"),
    route.getAttribute("data-orbital-feature-state"),
    route.getAttribute("data-orbital-output")
  ]);
  if (!exactJsonEqual(attributes, [
    expected.productionStep,
    expected.featureState,
    expected.output
  ])) {
    throw new Error("orbital-route-identity-mismatch");
  }
  await input.page.waitForFunction((expectedIdentity) => {
    const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
      TakramParityTelemetry | undefined;
    return telemetry?.active === true &&
      telemetry.nativeFrameCount >= 32 &&
      telemetry.orbitalLookdev?.readback.featureState ===
        expectedIdentity.featureState &&
      telemetry.diagnostic === expectedIdentity.output &&
      telemetry.lookdevBaseKey !== null &&
      telemetry.lookdevMountKey !== null &&
      telemetry.rendererFingerprintHash !== null &&
      telemetry.runtimeEvidenceEpoch !== null &&
      telemetry.matchedTemporalFrameCapture?.nativeFrameCount === 32 &&
      telemetry.matchedTemporalFrameCapture.frameLockPass === true;
  }, expected, { timeout: 180_000 });
  const telemetry = await input.page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramParity") as TakramParityTelemetry
  );
  const readback = telemetry.orbitalLookdev?.readback;
  if (readback === undefined || telemetry.lookdevBaseKey === null ||
    telemetry.lookdevMountKey === null ||
    telemetry.rendererFingerprintHash === null ||
    telemetry.runtimeEvidenceEpoch === null) {
    throw new Error("orbital-runtime-identity-incomplete");
  }
  return {
    identity: Object.freeze({
      allocations: readback.allocations,
      featureState: readback.featureState,
      lookdevBaseKey: telemetry.lookdevBaseKey,
      lookdevMountKey: telemetry.lookdevMountKey,
      output: input.expectedOutput,
      rendererFingerprintHash: telemetry.rendererFingerprintHash,
      runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch
    }),
    telemetry
  };
}

async function writeCaptureArtifact(
  run: OrbitalStagingRun,
  relativePath: string,
  bytes: Buffer
): Promise<OrbitalArtifactRecord> {
  const absolute = resolveOrbitalStagingArtifactPath(run, relativePath);
  if (existsSync(absolute)) throw new Error(`capture-artifact-already-exists:${relativePath}`);
  writeDurableFile(absolute, bytes);
  return Object.freeze({
    byteLength: bytes.byteLength,
    path: relativePath.split(path.sep).join("/"),
    sha256: hashBytes(bytes)
  });
}

export async function captureOrbitalPng(
  input: OrbitalCaptureRequest
): Promise<OrbitalPngCapture> {
  const ready = await waitForExactOrbitalRoute(input);
  const capture = await input.page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramMatchedTemporalFrame") as
      (Readonly<Record<string, unknown>> & { dataUrl: string }) | undefined
  );
  if (capture === undefined || typeof capture.dataUrl !== "string" ||
    !capture.dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("matched-frame-png-missing");
  }
  const bytes = Buffer.from(capture.dataUrl.split(",")[1]!, "base64");
  const artifact = await writeCaptureArtifact(input.run, input.artifactPath, bytes);
  const { dataUrl: _dataUrl, ...frame } = capture;
  return Object.freeze({
    artifact,
    frame: frame as OrbitalPngCapture["frame"],
    identity: ready.identity
  });
}

async function captureJsonReadback<T>(input: OrbitalCaptureRequest & Readonly<{
  read: () => Promise<T | undefined>;
}>): Promise<T> {
  await waitForExactOrbitalRoute(input);
  const readback = await input.read();
  if (readback === undefined) throw new Error("orbital-readback-missing");
  await writeCaptureArtifact(
    input.run,
    input.artifactPath,
    Buffer.from(stableJson(readback))
  );
  return readback;
}

export async function captureSampleCountReadback(
  input: OrbitalCaptureRequest
): Promise<TakramParitySampleCountReadback> {
  return await captureJsonReadback({
    ...input,
    read: async () => await input.page.evaluate(() =>
      (Reflect.get(window, "__MiraLithTakramParity") as
        TakramParityTelemetry | undefined)?.sampleCountReadback ?? undefined
    )
  });
}

export async function capturePrimaryMarchReadback(
  input: OrbitalCaptureRequest
): Promise<TakramParityPrimaryMarchReadback> {
  return await captureJsonReadback({
    ...input,
    read: async () => await input.page.evaluate(() =>
      Reflect.get(window, "__MiraLithTakramPrimaryMarch") as
        TakramParityPrimaryMarchReadback | undefined
    )
  });
}

export async function captureStageReadback(
  input: OrbitalCaptureRequest
): Promise<TakramParityStageReadbackCapture> {
  return await captureJsonReadback({
    ...input,
    read: async () => await input.page.evaluate(() =>
      Reflect.get(window, "__MiraLithTakramStageReadback") as
        TakramParityStageReadbackCapture | undefined
    )
  });
}

export async function captureTemporalFrames(
  input: OrbitalCaptureRequest & Readonly<{
    nativeFrames: readonly [1, 2, 4, 8, 16, 32];
  }>
): Promise<readonly OrbitalPngCapture[]> {
  if (!exactJsonEqual(input.nativeFrames, [1, 2, 4, 8, 16, 32])) {
    throw new Error("temporal-frame-sequence-mismatch");
  }
  const captures: OrbitalPngCapture[] = [];
  for (const nativeFrame of input.nativeFrames) {
    const captureSlot = `__MiraLithTakramTemporalCapture${nativeFrame}`;
    await input.page.addInitScript(({ slot, targetFrame }) => {
      const observe = () => {
        const telemetry = Reflect.get(window, "__MiraLithTakramParity") as
          TakramParityTelemetry | undefined;
        const canvas = document.querySelector("canvas");
        if (Reflect.get(window, slot) === undefined && canvas !== null &&
          telemetry?.active === true &&
          telemetry.nativeFrameCount === targetFrame &&
          telemetry.lookdevBaseKey !== null &&
          telemetry.lookdevMountKey !== null &&
          telemetry.rendererFingerprintHash !== null &&
          telemetry.runtimeEvidenceEpoch !== null &&
          telemetry.orbitalLookdev !== null) {
          Reflect.set(window, slot, {
            dataUrl: canvas.toDataURL("image/png"),
            height: canvas.height,
            historyEpochHash: telemetry.historyEpochHash,
            identity: {
              allocations: telemetry.orbitalLookdev.readback.allocations,
              featureState: telemetry.orbitalLookdev.readback.featureState,
              lookdevBaseKey: telemetry.lookdevBaseKey,
              lookdevMountKey: telemetry.lookdevMountKey,
              output: telemetry.diagnostic,
              rendererFingerprintHash: telemetry.rendererFingerprintHash,
              runtimeEvidenceEpoch: telemetry.runtimeEvidenceEpoch
            },
            nativeFrameCount: telemetry.nativeFrameCount,
            width: canvas.width
          });
          return;
        }
        requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
    }, { slot: captureSlot, targetFrame: nativeFrame });
    const response = await input.page.goto(input.route);
    if (response === null || response.status() !== 200) {
      throw new Error(`orbital-route-navigation-failed:${response?.status() ?? "null"}`);
    }
    await input.page.waitForFunction((slot) =>
      Reflect.get(window, slot) !== undefined,
    captureSlot, { timeout: 180_000 });
    const temporalCapture = await input.page.evaluate((slot) =>
      structuredClone(Reflect.get(window, slot)) as Readonly<{
        dataUrl: string;
        height: number;
        historyEpochHash: string;
        identity: OrbitalCaptureIdentity;
        nativeFrameCount: number;
        width: number;
      }>, captureSlot);
    if (temporalCapture.nativeFrameCount !== nativeFrame ||
      temporalCapture.identity.featureState !== input.expectedFeatureState ||
      temporalCapture.identity.output !== input.expectedOutput ||
      !temporalCapture.dataUrl.startsWith("data:image/png;base64,")) {
      throw new Error(`temporal-frame-identity-mismatch:${nativeFrame}`);
    }
    const relative = input.artifactPath.replace(
      /(\.png)$/,
      `-frame-${nativeFrame}$1`
    );
    const bytes = Buffer.from(temporalCapture.dataUrl.split(",")[1]!, "base64");
    const artifact = await writeCaptureArtifact(input.run, relative, bytes);
    captures.push(Object.freeze({
      artifact,
      frame: Object.freeze({
        frameLockPass: true,
        height: temporalCapture.height,
        historyEpochHash: temporalCapture.historyEpochHash,
        nativeFrameCount: nativeFrame,
        width: temporalCapture.width
      }),
      identity: temporalCapture.identity
    }));
  }
  return Object.freeze(captures);
}

export async function runGpuPopulation(
  input: OrbitalGpuPopulationRequest
): Promise<TakramOrbitalGpuProfileSnapshot> {
  if (input.expectedOutput !== "full") {
    throw new Error("gpu-population-requires-full-output");
  }
  const ready = await waitForExactOrbitalRoute(input);
  const start = await input.page.evaluate((request) => {
    const starter = Reflect.get(window, "__MiraLithStartTakramGpuProfile") as
      ((value: typeof request) => Readonly<{
        accepted: boolean;
        reason: string | null;
      }>) | undefined;
    return starter?.(request) ?? {
      accepted: false,
      reason: "production-profiler-api-missing"
    };
  }, {
    candidateId: input.expectedProductionStep,
    committedWinnerId: input.committedWinnerId,
    featureState: input.expectedFeatureState as "native" | "light-shafts-off",
    lookdevMountKey: ready.identity.lookdevMountKey,
    measurementMode: input.measurementMode,
    runtimeEvidenceEpoch: ready.identity.runtimeEvidenceEpoch,
    targetSampleCount: input.targetSampleCount,
    warmupFrameCount: input.warmupFrameCount
  });
  if (!start.accepted) throw new Error(`gpu-population-rejected:${start.reason}`);
  await input.page.waitForFunction(() => {
    const snapshot = Reflect.get(window, "__MiraLithTakramGpuProfile") as
      TakramOrbitalGpuProfileSnapshot | undefined;
    return snapshot?.state === "complete" || snapshot?.state === "unsupported";
  }, undefined, { timeout: 300_000 });
  const snapshot = await input.page.evaluate(() =>
    Reflect.get(window, "__MiraLithTakramGpuProfile") as
      TakramOrbitalGpuProfileSnapshot
  );
  await writeCaptureArtifact(
    input.run,
    input.artifactPath,
    Buffer.from(stableJson(snapshot))
  );
  return snapshot;
}
