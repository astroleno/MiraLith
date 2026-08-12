# LuBirth Takram Orbital Lookdev Tuning Implementation Plan

**Status:** TERMINATED AFTER STAGE B — historical execution record only; superseded for future authorization

**Terminal evidence:** `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED` at
scope-qualification commit `8dc86740024db2f48cd58a0ecd0a3c9739686285`, with
`OUTCOME.md` SHA-256
`723c3b11924adde7b499a9ea33534510227ed11d7f55abadf47b28a8e729a374`.
Stages C–F may not be resumed from this plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and execute the query-only Takram orbital lookdev funnel, preserving the native renderer while producing one auditable stock winner or an explicit bounded terminal result.

**Architecture:** Add focused pure modules for the immutable orbital parameter contract, runtime application/readback, mount/evidence identity, and stage/evidence rules. Thread the resolved contract through the existing parity query and native `CloudsEffect → temporal resolve → AerialPerspectiveEffect` pipeline, key-remounting the complete composer subtree for every stable pre-mount identity change or single permitted drift recovery. Keep capture, visual-review, stage authorization, reference verification, and GPU evidence in a gated Playwright runner so normal regression runs never write formal artifacts.

**Tech Stack:** TypeScript, React Three Fiber, Three.js, `@takram/three-clouds@0.7.6`, `@takram/three-atmosphere`, Playwright test runner, Sharp, WebGL2 timer queries.

---

### Task 1: Immutable orbital parameter contract

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts`
- Create: `tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts`

- [ ] **Step 1: Write failing tests for the approved value domains and exact morphology table**

```ts
expect(parseTakramOrbitalPreset("h80")).toBe("h80");
expect(parseTakramOrbitalPreset("h160")).toBeNull();
expect(resolveTakramOrbitalLookdevContract({
  preset: "h80", coverage: 0.3, verticalScale: 1, opticalDepthScale: 1
})).toMatchObject({
  classification: "TAKRAM_ORBITAL_PARAMETER_LOOKDEV",
  presentationScale: 80,
  shapeRepeat: 0.00000375,
  shapeDetailRepeat: 0.000075,
  localWeatherRepeat: [1.25, 1.25],
  turbulenceRepeat: [20, 20],
  effectiveTurbulenceRepeat: [25, 25]
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevContract.spec.ts`

Expected: FAIL because `TakramOrbitalLookdevContract.ts` does not exist.

- [ ] **Step 3: Implement parsers and `resolveTakramOrbitalLookdevContract()`**

The module exports the exact union domains (`native|h40|h80|h120`, `0.3|0.4|0.45|0.55`, `1|2|4`, `0.75|1|1.5`), a frozen preset table, the complete explicit R/G/B/A layer array, native cloud/shadow/light fields, `classifyTakramOrbitalCubeFaceDiagnostic()`, and a deeply frozen resolver result. Vertical tuning applies `height × V`, `densityScale ÷ V`, and both extinction thresholds `÷ V`; optical tuning then multiplies density and both extinction thresholds by `O`.

- [ ] **Step 4: Verify exact invariants GREEN**

Assert the 20:1 shape/detail hierarchy, effective turbulence products, native Stage A ray/step/light values, `height × densityScale` invariance, cloud tops below 60 km, unchanged altitudes, and hard-artifact classification for non-finite UV or confirmed seams.

- [ ] **Step 5: Commit the contract**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts
git commit -m "feat(lubirth): add orbital lookdev contract"
```

### Task 2: Route parsing and conflict rejection

**Files:**
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `apps/site/components/LuBirthTakramParitySpikeClient.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx`
- Modify: `tests/unit/lubirthTakramParityContract.spec.ts`

- [ ] **Step 1: Add failing route tests**

```ts
expect(resolveTakramParityRouteQuery(new URLSearchParams(
  "input=stock&view=opening&orbitalPreset=h80&orbitalCoverage=0.45&verticalScale=2&opticalDepthScale=1.5"
))).toMatchObject({ ok: true, value: {
  orbitalPreset: "h80", orbitalCoverage: 0.45, verticalScale: 2, opticalDepthScale: 1.5
}});
```

Reject unknown orbital values, non-opening use, partial orbital tuples, `cloudScale`, `morphologyCandidate`, or stock similarity combined with orbital lookdev. Preserve every historical query result byte-for-byte when no orbital field is present.

- [ ] **Step 2: Run route tests and verify RED**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramParityContract.spec.ts`

- [ ] **Step 3: Parse one complete orbital tuple and thread it through route props**

Add the four typed fields to `TakramParityRouteQuery`, expose `data-orbital-*` attributes, and pass a single `orbitalLookdev` object into the opening scene. Do not add orbital props to the control route or production scene.

- [ ] **Step 4: Run route tests and typecheck GREEN**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramParityContract.spec.ts && pnpm --filter @miralith/lubirth-hero typecheck && pnpm --filter @miralith/site typecheck`

- [ ] **Step 5: Commit route support**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts apps/site/components/LuBirthTakramParitySpikeClient.tsx packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx tests/unit/lubirthTakramParityContract.spec.ts
git commit -m "feat(lubirth): parse orbital lookdev queries"
```

### Task 3: Runtime application, readback, and renderer fingerprint

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevRuntime.ts`
- Create: `tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`

- [ ] **Step 1: Write a fake runtime and failing apply/readback tests**

Test that apply sets coverage, isotropic ECEF repeats, stock local-weather repeat, explicit layers, cloud/shadow extinction, and leaves turbulence repeat, displacement, ray/step distances, light fields, BSM, temporal, render formats, and mip behavior native.

- [ ] **Step 2: Verify RED**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevRuntime.spec.ts`

- [ ] **Step 3: Implement `apply/read/diffTakramOrbitalLookdevRuntime()`**

Runtime readback includes every tuned field, complete layers, raw and effective turbulence repeats, native fixed fields, shader/build hashes, adapter fields, and allocation generations for cloud current/resolve/history plus shadow current/resolve/history. Drift entries use canonical dotted paths and retain canonical expected/actual values.

- [ ] **Step 4: Extend the fingerprint without weakening historical fingerprints**

Add optional `orbitalLookdev` readback and the shadow render targets to the new schema version. Existing unscaled and legacy cloud-scale fingerprints retain their prior schema/output.

- [ ] **Step 5: Verify RED→GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevRuntime.spec.ts lubirthTakramParityContract.spec.ts
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevRuntime.ts packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts
git commit -m "feat(lubirth): audit orbital lookdev runtime"
```

### Task 4: Stable identity, drift ledger, and complete composer remount

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevIdentity.ts`
- Create: `tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`

- [ ] **Step 1: Write failing pure identity tests**

Cover `buildTakramLookdevBaseKey()`, `buildTakramLookdevMountKey()`, `buildTakramRuntimeEvidenceEpoch()`, canonical `driftSignature`, and `resolveTakramDriftRecovery()`. Every query/resource/context/viewport/visibility generation changes the base and mount keys; nonce changes only the mount key; runtime matrices/fingerprint change only the runtime evidence epoch; sorted drift order hashes identically; one `(base, drift)` attempt remounts once then blocks.

- [ ] **Step 2: Verify RED and implement the pure identity module**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevIdentity.spec.ts`

- [ ] **Step 3: Add lifecycle generations and key the entire composer subtree**

Track WebGL context restoration, canvas physical-size changes, and document visibility transitions. Compute `lookdevBaseKey` before mount from normalized query/contract, adapter manifest ID, progress/view/diagnostic, asset/atmosphere/context/viewport/visibility generations. Render `<EffectComposer key={lookdevMountKey}>` containing both `<Clouds>` and `<AerialPerspective>`.

- [ ] **Step 4: Replace temporal toggle reset with one drift-audited remount**

On first stable runtime drift, invalidate the evidence epoch and increment `resetNonce` once for `(lookdevBaseKey, driftSignature)`. Persistent drift after that remount publishes `ORBITAL_LOOKDEV_SETUP_BLOCKED` and never increments again. A new base key starts at nonce zero with a fresh audit.

- [ ] **Step 5: Verify all allocation and frame epochs restart together**

Use actual object-identity allocation generation readback and cloud/resolve/shadow frame metadata. Readiness requires all six render-target allocations to belong to the new mount and the three frame counters to begin one epoch before the 32-frame convergence count.

- [ ] **Step 6: Commit identity/remount support**

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevIdentity.spec.ts lubirthTakramOrbitalLookdevRuntime.spec.ts
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevIdentity.ts packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts
git commit -m "feat(lubirth): remount complete orbital composer"
```

### Task 5: Stage authorization, visual review, baseline parity, and evidence schema

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts`
- Create: `tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts`
- Create: `tests/helpers/takramOrbitalLookdevEvidence.ts`

- [ ] **Step 1: Write failing tests for stage transitions and terminal states**

Encode Stage 0 setup gates, Stage A hard-artifact handling, Stage B one-coverage-per-preset and two-survivor cap, Stage C one overall winner, Stage D one optical winner, Stage E stock-winner authorization, and Stage F winner-only diagnostics/timing.

- [ ] **Step 2: Write failing review/ranking tests**

Validate schema `takram-orbital-lookdev-visual-review/v1`, six integer dimensions per frame, hard-flag failure, all-four-frame pass, exact tie-break order, and prohibition on using total score to rescue a failing frame.

- [ ] **Step 3: Write failing normalized-baseline/noise-floor tests**

`normalizeTakramOrbitalBaselineFingerprint()` removes only schema/classification/resolver wrapper. `resolveTakramOrbitalRepeatNoiseFloor()` consumes four full-frame RGBA masked differences and requires both paired cross-route MAEs not to exceed the measured same-route maximum.

- [ ] **Step 4: Implement evidence functions and atomic publisher**

The manifest records clean commit, query, requested/readback contracts, fingerprint, base/mount/runtime identities, nonce/ledger result, package/shader/patch hashes, reference and screenshot hashes, review, ranking, stop/unlock state, raw diagnostic population references, and explicit setup/timer invalid reasons.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevEvidence.spec.ts
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts tests/helpers/takramOrbitalLookdevEvidence.ts
git commit -m "feat(lubirth): enforce orbital evidence funnel"
```

### Task 6: Browser identity verification and bounded capture runner

**Files:**
- Create: `tests/e2e/lubirth-takram-orbital-lookdev.spec.ts`
- Create: `packages/lubirth-hero/scripts/create-takram-orbital-lookdev-contact-sheet.mjs`
- Modify: `packages/lubirth-hero/package.json`

- [ ] **Step 1: Add query/readback browser tests**

Verify native control parity, exact requested/readback equality, stable renderer fingerprint, base/mount/runtime identity publication, full composer remount on each pre-mount generation change, one nonce recovery followed by block, and no bootstrap remount from post-mount evidence publication.

- [ ] **Step 2: Add capture-mode Stage 0**

Verify the two frozen reference hashes, capture `legacyA/legacyB/lookdevA/lookdevB` at native frame 32, decode full-frame RGBA, compute the measured noise floor, require both cross pairs within it, and atomically publish the baseline manifest.

- [ ] **Step 3: Add the exact Stage A–D candidate funnel**

Capture `0.00/0.06/0.12/0.18`, cloud-off controls, and non-native cube-face diagnostics at 1440×960 DPR 1. Persist fixed-size contact sheets and blank review templates, enforce committed review/checkpoint authorization, and refuse later stages after a terminal result.

- [ ] **Step 4: Add Stage E and winner-only Stage F captures**

For V3, force the winner's explicit official layers and renderer contract while allowing only texture/mapping/repeat/offset/wrap/channel adapter fields. For the winner, capture cloud on/off, BSM off, raw, pre-temporal, history, AerialPerspective input, and final composite at the exact frame.

- [ ] **Step 5: Verify non-capture browser tests and commit**

```bash
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts tests/e2e/lubirth-takram-orbital-lookdev.spec.ts --grep "route|identity|authorization"
git add tests/e2e/lubirth-takram-orbital-lookdev.spec.ts packages/lubirth-hero/scripts/create-takram-orbital-lookdev-contact-sheet.mjs packages/lubirth-hero/package.json
git commit -m "test(lubirth): capture orbital lookdev funnel"
```

### Task 7: Winner-only native GPU profiler

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts`
- Create: `tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `tests/e2e/lubirth-takram-orbital-lookdev.spec.ts`

- [ ] **Step 1: Write failing timer-population tests**

Cover 120 warmup frames, 120 valid non-disjoint samples, disjoint epoch invalidation, pending-query disposal, total-only versus stage-only sequential populations, same-frame stage summation before percentile calculation, raw sample preservation, no-op/copy baselines, timestamp bits/mode, and p95 classification thresholds.

- [ ] **Step 2: Implement a non-nesting WebGL2 timer profiler**

Use public runtime boundaries where available. If a hook is required, expose instrumentation-only begin/end callbacks around existing submissions and include the patch/build hashes; do not change GLSL, defines, uniforms, pass order, targets, or output.

- [ ] **Step 3: Gate profiling behind the committed visual winner**

The production-build System Chrome run starts only after renderer/assets/coordinates/HDR/visibility/history gates. Unsupported valid timing remains an explicit incomplete state, not a visual failure.

- [ ] **Step 4: Verify and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalGpuProfiler.spec.ts
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts tests/e2e/lubirth-takram-orbital-lookdev.spec.ts
git commit -m "feat(lubirth): profile native orbital winner"
```

### Task 8: Execute the funnel and publish the terminal evidence

**Files:**
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev/**`
- Modify: `docs/superpowers/specs/2026-08-12-lubirth-takram-orbital-lookdev-tuning-design.md`

- [ ] **Step 1: Run all unit, type, build, and route verification**

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramOrbitalLookdevContract.spec.ts lubirthTakramOrbitalLookdevRuntime.spec.ts lubirthTakramOrbitalLookdevIdentity.spec.ts lubirthTakramOrbitalLookdevEvidence.spec.ts lubirthTakramOrbitalGpuProfiler.spec.ts lubirthTakramParityContract.spec.ts
pnpm typecheck
pnpm build
```

- [ ] **Step 2: Run capture mode sequentially through the authorized funnel**

Run the System Chrome capture command with `MIRALITH_TAKRAM_ORBITAL_LOOKDEV_CAPTURE=1`. Inspect every full-size source frame against both frozen references, write the review schema with integer scores/hard flags, commit each stage checkpoint, and proceed only when the evidence module authorizes it.

- [ ] **Step 3: Run V3 compatibility and formal winner diagnostics**

Record `V3_WEATHER_ADAPTER_PASS/FAIL` without invalidating the stock winner. Persist raw winner diagnostics and the production-build GPU population or explicit unsupported/incomplete timing state.

- [ ] **Step 4: Record exactly one completion-boundary result**

Update the design status and evidence README with `ORBITAL_LOOKDEV_WINNER` plus V3/cost classification, or the observed bounded Stage A/B/C/D terminal result. Do not promote parameters to the homepage.

- [ ] **Step 5: Refresh the graph and run the final regression suite**

```bash
graphify --update
pnpm exec playwright test -c playwright.unit.config.ts
pnpm typecheck
pnpm build
git status --short
```

- [ ] **Step 6: Commit final evidence**

```bash
git add docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev docs/superpowers/specs/2026-08-12-lubirth-takram-orbital-lookdev-tuning-design.md graphify-out
git commit -m "test(lubirth): publish orbital lookdev evidence"
```
