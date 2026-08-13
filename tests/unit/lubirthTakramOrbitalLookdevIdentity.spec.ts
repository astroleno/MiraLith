import { expect, test } from "@playwright/test";

const identityModulePath =
  "../../packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevIdentity";

async function loadIdentity() {
  return import(identityModulePath);
}

function baseInput() {
  return {
    adapterManifestId: "stock:local-weather:sha256",
    assetGeneration: 2,
    atmosphereGeneration: 3,
    contextGeneration: 4,
    diagnostic: "full",
    normalizedQuery: {
      input: "stock",
      view: "opening",
      progress: 0.06,
      orbitalPreset: "h80",
      orbitalCoverage: 0.45,
      orbitalFeatureState: "native",
      orbitalOutput: "full",
      orbitalProductionStep: "confirmed",
      verticalScale: 2,
      opticalDepthScale: 1
    },
    progress: 0.06,
    resolvedContract: {
      classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
      coverage: 0.45,
      preset: "h80",
      shapeRepeat: 0.00000375
    },
    view: "opening",
    viewport: { dpr: 1, height: 960, width: 1440 },
    viewportGeneration: 5,
    visibilityGeneration: 6
  };
}

test("builds a canonical base key from every pre-mount query and generation field", async () => {
  const { buildTakramLookdevBaseKey } = await loadIdentity();
  const baseline = baseInput();
  const key = buildTakramLookdevBaseKey(baseline);
  expect(key).toMatch(/^takram-lookdev-base:fnv1a-64:[0-9a-f]{16}$/);
  expect(buildTakramLookdevBaseKey({
    ...baseline,
    normalizedQuery: Object.fromEntries(
      Object.entries(baseline.normalizedQuery).reverse()
    ),
    resolvedContract: Object.fromEntries(
      Object.entries(baseline.resolvedContract).reverse()
    )
  })).toBe(key);

  const variants = [
    { ...baseline, adapterManifestId: "v3:weather:sha256" },
    { ...baseline, assetGeneration: 3 },
    { ...baseline, atmosphereGeneration: 4 },
    { ...baseline, contextGeneration: 5 },
    { ...baseline, diagnostic: "cloud-raw" },
    { ...baseline, progress: 0.12 },
    { ...baseline, view: "control" },
    { ...baseline, viewport: { ...baseline.viewport, width: 1439 } },
    { ...baseline, viewportGeneration: 6 },
    { ...baseline, visibilityGeneration: 7 },
    {
      ...baseline,
      normalizedQuery: { ...baseline.normalizedQuery, orbitalCoverage: 0.55 }
    },
    {
      ...baseline,
      normalizedQuery: {
        ...baseline.normalizedQuery,
        orbitalProductionStep: "coarse"
      }
    },
    {
      ...baseline,
      normalizedQuery: {
        ...baseline.normalizedQuery,
        orbitalFeatureState: "light-shafts-off"
      }
    },
    {
      ...baseline,
      normalizedQuery: {
        ...baseline.normalizedQuery,
        orbitalOutput: "stage-readback"
      }
    },
    {
      ...baseline,
      resolvedContract: { ...baseline.resolvedContract, shapeRepeat: 0.0000025 }
    }
  ];
  for (const variant of variants) {
    expect(buildTakramLookdevBaseKey(variant)).not.toBe(key);
  }
});

test("separates stable base identity, nonce-bearing mount identity, and post-mount evidence", async () => {
  const {
    buildTakramLookdevBaseKey,
    buildTakramLookdevMountKey,
    buildTakramRuntimeEvidenceEpoch,
    initializeTakramLookdevMountState
  } = await loadIdentity();
  const baseKey = buildTakramLookdevBaseKey(baseInput());
  const mount0 = buildTakramLookdevMountKey(baseKey, 0);
  const mount1 = buildTakramLookdevMountKey(baseKey, 1);
  expect(mount0).toBe(JSON.stringify([baseKey, 0]));
  expect(mount1).not.toBe(mount0);

  const runtime = {
    adapterRuntime: { localWeatherRepeat: [1.25, 1.25] },
    allocations: {
      clouds: { current: 1, resolve: 2, history: 3 },
      shadow: { current: 4, resolve: 5, history: 6 }
    },
    cameraMatrixWorld: [1, 0, 0, 1],
    cameraProjectionMatrix: [2, 0, 0, 2],
    earthMatrixWorld: [3, 0, 0, 3],
    lookdevMountKey: mount0,
    rendererFingerprint: { schemaVersion: 6, shader: "a" }
  };
  const epoch = buildTakramRuntimeEvidenceEpoch(runtime);
  expect(epoch).toMatch(/^takram-runtime-evidence:fnv1a-64:[0-9a-f]{16}$/);
  expect(buildTakramRuntimeEvidenceEpoch({
    ...runtime,
    rendererFingerprint: { schemaVersion: 6, shader: "b" }
  })).not.toBe(epoch);
  expect(buildTakramRuntimeEvidenceEpoch({
    ...runtime,
    cameraMatrixWorld: [9, 0, 0, 1]
  })).not.toBe(epoch);
  expect(buildTakramLookdevMountKey(baseKey, 0)).toBe(mount0);

  expect(initializeTakramLookdevMountState({
    previousBaseKey: baseKey,
    nextBaseKey: baseKey,
    resetNonce: 1
  })).toEqual({ lookdevBaseKey: baseKey, resetNonce: 1 });
  expect(initializeTakramLookdevMountState({
    previousBaseKey: "old-base",
    nextBaseKey: baseKey,
    resetNonce: 1
  })).toEqual({ lookdevBaseKey: baseKey, resetNonce: 0 });
});

test("canonicalizes drift order and permits one recovery remount per base/signature", async () => {
  const {
    buildTakramLookdevDriftSignature,
    resolveTakramLookdevDriftRecovery
  } = await loadIdentity();
  const drift = [
    { path: "shapeRepeat.2", expected: 1, actual: 2 },
    { path: "clouds.minExtinction", expected: 0.1, actual: undefined }
  ];
  const reversed = [...drift].reverse();
  const signature = buildTakramLookdevDriftSignature(drift);
  expect(signature).toBe(buildTakramLookdevDriftSignature(reversed));
  expect(signature).toMatch(/^takram-lookdev-drift:fnv1a-64:[0-9a-f]{16}$/);

  const first = resolveTakramLookdevDriftRecovery({
    attemptedLedger: {},
    lookdevBaseKey: "base-a",
    resetNonce: 0,
    drift
  });
  expect(first).toMatchObject({
    action: "remount",
    driftSignature: signature,
    nextResetNonce: 1,
    setupState: "ORBITAL_LOOKDEV_RECOVERY_REMOUNT"
  });
  const second = resolveTakramLookdevDriftRecovery({
    attemptedLedger: first.attemptedLedger,
    lookdevBaseKey: "base-a",
    resetNonce: 1,
    drift: reversed
  });
  expect(second).toMatchObject({
    action: "block",
    nextResetNonce: 1,
    setupState: "ORBITAL_LOOKDEV_SETUP_BLOCKED"
  });
  const newBase = resolveTakramLookdevDriftRecovery({
    attemptedLedger: second.attemptedLedger,
    lookdevBaseKey: "base-b",
    resetNonce: 0,
    drift
  });
  expect(newBase).toMatchObject({ action: "remount", nextResetNonce: 1 });
  expect(resolveTakramLookdevDriftRecovery({
    attemptedLedger: newBase.attemptedLedger,
    lookdevBaseKey: "base-b",
    resetNonce: 1,
    drift: []
  })).toMatchObject({
    action: "ready",
    driftSignature: null,
    nextResetNonce: 1,
    setupState: "ORBITAL_LOOKDEV_RUNTIME_READY"
  });
});

test("requires all cloud and shadow allocations to change for a complete remount", async () => {
  const {
    didTakramLookdevRemountAllAllocations,
    isTakramLookdevHistoryEpochReady
  } = await loadIdentity();
  const previous = {
    clouds: { current: 1, resolve: 2, history: 3 },
    shadow: { current: 4, resolve: 5, history: 6 }
  };
  const next = {
    clouds: { current: 7, resolve: 8, history: 9 },
    shadow: { current: 10, resolve: 11, history: 12 }
  };
  expect(didTakramLookdevRemountAllAllocations(previous, next)).toBe(true);
  expect(didTakramLookdevRemountAllAllocations(previous, {
    ...next,
    shadow: { ...next.shadow, history: 6 }
  })).toBe(false);
  expect(isTakramLookdevHistoryEpochReady({
    allocationsChanged: true,
    cloudsFrame: 0,
    resolveFrame: 0,
    shadowFrame: 0
  })).toBe(true);
  expect(isTakramLookdevHistoryEpochReady({
    allocationsChanged: true,
    cloudsFrame: 0,
    resolveFrame: 1,
    shadowFrame: 0
  })).toBe(false);
  expect(isTakramLookdevHistoryEpochReady({
    allocationsChanged: false,
    cloudsFrame: 0,
    resolveFrame: 0,
    shadowFrame: 0
  })).toBe(false);
});
