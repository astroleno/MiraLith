import type { TakramOrbitalAllocationGenerations } from "./TakramOrbitalLookdevRuntime";

type CanonicalRecord = Record<string, unknown>;

export interface TakramLookdevDriftEntry {
  readonly actual: unknown;
  readonly expected: unknown;
  readonly path: string;
}

export type TakramLookdevDriftAttemptLedger = Readonly<Record<string, 1>>;
export type TakramLookdevSetupState =
  | "ORBITAL_LOOKDEV_RUNTIME_READY"
  | "ORBITAL_LOOKDEV_RECOVERY_REMOUNT"
  | "ORBITAL_LOOKDEV_SETUP_BLOCKED";

export interface TakramLookdevProductionRouteIdentity {
  readonly candidate: string;
  readonly featureState: string;
  readonly output: string;
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return { $type: "undefined" };
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { $type: "number", value: String(value) };
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as CanonicalRecord).sort().map((key) => [
        key,
        canonicalize((value as CanonicalRecord)[key])
      ])
    );
  }
  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function hashFnv1a64(value: string) {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return `fnv1a-64:${hash.toString(16).padStart(16, "0")}`;
}

export function buildTakramLookdevBaseKey(input: {
  adapterManifestId: string;
  assetGeneration: number;
  atmosphereGeneration: number;
  contextGeneration: number;
  diagnostic: string;
  normalizedQuery: unknown;
  progress: number;
  productionRoute?: TakramLookdevProductionRouteIdentity;
  resolvedContract: unknown;
  view: string;
  viewport: { dpr: number; height: number; width: number };
  viewportGeneration: number;
  visibilityGeneration: number;
}) {
  return `takram-lookdev-base:${hashFnv1a64(stableStringify(input))}`;
}

export function buildTakramLookdevMountKey(
  lookdevBaseKey: string,
  resetNonce: number
) {
  return JSON.stringify([lookdevBaseKey, resetNonce]);
}

export function initializeTakramLookdevMountState(input: {
  nextBaseKey: string;
  previousBaseKey: string | null;
  resetNonce: number;
}) {
  return {
    lookdevBaseKey: input.nextBaseKey,
    resetNonce: input.previousBaseKey === input.nextBaseKey
      ? input.resetNonce
      : 0
  };
}

export function buildTakramRuntimeEvidenceEpoch(input: {
  adapterRuntime: unknown;
  allocations: TakramOrbitalAllocationGenerations;
  cameraMatrixWorld: readonly number[];
  cameraProjectionMatrix: readonly number[];
  earthMatrixWorld: readonly number[];
  lookdevMountKey: string;
  rendererFingerprint: unknown;
}) {
  return `takram-runtime-evidence:${hashFnv1a64(stableStringify(input))}`;
}

export function buildTakramLookdevDriftSignature(
  drift: readonly TakramLookdevDriftEntry[]
) {
  const entries = [...drift]
    .map((entry) => ({
      path: entry.path,
      expected: canonicalize(entry.expected),
      actual: canonicalize(entry.actual)
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return `takram-lookdev-drift:${hashFnv1a64(stableStringify(entries))}`;
}

export function resolveTakramLookdevDriftRecovery(input: {
  attemptedLedger: TakramLookdevDriftAttemptLedger;
  drift: readonly TakramLookdevDriftEntry[];
  lookdevBaseKey: string;
  resetNonce: number;
}): {
  action: "ready" | "remount" | "block";
  attemptedLedger: TakramLookdevDriftAttemptLedger;
  driftSignature: string | null;
  nextResetNonce: number;
  setupState: TakramLookdevSetupState;
} {
  if (input.drift.length === 0) {
    return {
      action: "ready",
      attemptedLedger: input.attemptedLedger,
      driftSignature: null,
      nextResetNonce: input.resetNonce,
      setupState: "ORBITAL_LOOKDEV_RUNTIME_READY"
    };
  }

  const driftSignature = buildTakramLookdevDriftSignature(input.drift);
  const ledgerKey = stableStringify([input.lookdevBaseKey, driftSignature]);
  if (input.attemptedLedger[ledgerKey] === 1) {
    return {
      action: "block",
      attemptedLedger: input.attemptedLedger,
      driftSignature,
      nextResetNonce: input.resetNonce,
      setupState: "ORBITAL_LOOKDEV_SETUP_BLOCKED"
    };
  }
  return {
    action: "remount",
    attemptedLedger: { ...input.attemptedLedger, [ledgerKey]: 1 },
    driftSignature,
    nextResetNonce: input.resetNonce + 1,
    setupState: "ORBITAL_LOOKDEV_RECOVERY_REMOUNT"
  };
}

function allocationValues(allocations: TakramOrbitalAllocationGenerations) {
  return [
    allocations.clouds.current,
    allocations.clouds.resolve,
    allocations.clouds.history,
    allocations.shadow.current,
    allocations.shadow.resolve,
    allocations.shadow.history
  ];
}

export function didTakramLookdevRemountAllAllocations(
  previous: TakramOrbitalAllocationGenerations | null,
  next: TakramOrbitalAllocationGenerations
) {
  const nextValues = allocationValues(next);
  if (nextValues.some((value) => value === null) ||
    new Set(nextValues).size !== nextValues.length) {
    return false;
  }
  if (previous === null) return true;
  const previousValues = new Set(allocationValues(previous));
  return nextValues.every((value) => !previousValues.has(value));
}

export function isTakramLookdevHistoryEpochReady(input: {
  allocationsChanged: boolean;
  cloudsFrame: number;
  resolveFrame: number;
  shadowFrame: number;
}) {
  return input.allocationsChanged &&
    Number.isFinite(input.cloudsFrame) &&
    input.cloudsFrame >= 0 &&
    input.cloudsFrame === input.resolveFrame &&
    input.cloudsFrame === input.shadowFrame;
}
