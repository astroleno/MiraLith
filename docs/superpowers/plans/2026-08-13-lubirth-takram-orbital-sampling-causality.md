# LuBirth Takram Orbital Sampling Causality Implementation Plan

**Status:** CLOSED — terminal h120 A/B published; no further implementation authorized by this plan

**Terminal evidence:** `ORBITAL_SAMPLING_CAUSALITY_CONFIRMED` at publication
commit `0976f7df6f4293d709412b7ab3cc62fb5a547a41`, scope-qualification commit
`8dc86740024db2f48cd58a0ecd0a3c9739686285`, and `OUTCOME.md` SHA-256
`4fbfcdb18cb385e4aec07686d24482315fb9d55e4ed9ceb16f0ade7fb139b670`.
This result is limited to `h120 / coverage 0.55 / vertical 1 / optical 1`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run and publish a clean, exact-frame `perspectiveStepScale=1.01` versus `1.0001` causal A/B with stock `h120 / coverage 0.55 / vertical 1 / optical 1`.

**Architecture:** A focused sampling-contract module owns the two allowed modes, numeric resolution, step estimates, and terminal causal classification. The existing orbital contract, route query, remount identity, runtime drift, native sample instrumentation, and stage readback remain authoritative; a new E2E publisher only orchestrates exact-frame captures and writes an isolated evidence package.

**Tech Stack:** TypeScript, React Three Fiber, `@takram/three-clouds`, Playwright System Chrome, Sharp, Node crypto/zlib, Vitest-style Playwright unit runner.

---

### Task 1: Add the bounded sampling contract

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingCausality.ts`
- Create: `tests/unit/lubirthTakramOrbitalSamplingCausality.spec.ts`

- [ ] **Step 1: Write failing parser, resolver, estimate, and outcome tests**

Test the exact modes and values:

```ts
expect(parseTakramOrbitalStepScaleMode("control")).toBe("control");
expect(parseTakramOrbitalStepScaleMode("treatment")).toBe("treatment");
expect(["1.01", "1.0001", "", null].map(parseTakramOrbitalStepScaleMode))
  .toEqual([null, null, null, null]);
expect(resolveTakramOrbitalStepScale("control")).toBe(1.01);
expect(resolveTakramOrbitalStepScale("treatment")).toBe(1.0001);
```

Test `resolveTakramOrbitalInitialStepMeters({ minStepSize: 50, perspectiveStepScale, rayNearMeters })` against `35_834.294...` and `407.842...` at `rayNearMeters=3_578_429.408...`.

Test the outcome resolver with four paired progress frames:

```ts
expect(resolveTakramOrbitalSamplingOutcome({ setupPass: false, frames: [] }))
  .toBe("ORBITAL_SAMPLING_SETUP_BLOCKED");
expect(resolveTakramOrbitalSamplingOutcome(confirmedInput))
  .toBe("ORBITAL_SAMPLING_CAUSALITY_CONFIRMED");
expect(resolveTakramOrbitalSamplingOutcome(partialInput))
  .toBe("ORBITAL_SAMPLING_CAUSALITY_PARTIAL_DOWNSTREAM_BLOCKED");
expect(resolveTakramOrbitalSamplingOutcome(notSupportedInput))
  .toBe("ORBITAL_SAMPLING_CAUSALITY_NOT_SUPPORTED");
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthTakramOrbitalSamplingCausality.spec.ts
```

Expected: FAIL because `TakramOrbitalSamplingCausality.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure module**

Define:

```ts
export const TAKRAM_ORBITAL_STEP_SCALE_MODES = Object.freeze([
  "control",
  "treatment"
] as const);
export const TAKRAM_ORBITAL_STEP_SCALE_VALUES = Object.freeze({
  control: 1.01,
  treatment: 1.0001
} as const);
export type TakramOrbitalStepScaleMode =
  (typeof TAKRAM_ORBITAL_STEP_SCALE_MODES)[number];
```

The outcome resolver requires exactly the four progress values `0/0.06/0.12/0.18`. `CONFIRMED` requires every frame to exceed repeat noise, increase native sampling, recover structured raw/pre-temporal signal, and retain observable downstream signal. `PARTIAL` requires the same upstream recovery but at least one downstream failure. Any missing or inconsistent upstream recovery is `NOT_SUPPORTED`; `setupPass=false` is always `SETUP_BLOCKED`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingCausality.ts tests/unit/lubirthTakramOrbitalSamplingCausality.spec.ts
git commit -m "feat(lubirth): define orbital sampling causality contract"
```

### Task 2: Thread the exact query enum into the orbital runtime contract

**Files:**
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `apps/site/components/LuBirthTakramParitySpikeClient.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Test: `tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts`
- Test: `tests/unit/lubirthTakramParityContract.spec.ts`
- Test: `tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts`
- Test: `tests/e2e/lubirth-takram-orbital-lookdev.spec.ts`

- [ ] **Step 1: Write failing contract and route-query tests**

Add `stepScaleMode?: TakramOrbitalStepScaleMode` to `TakramOrbitalLookdevInput`, defaulting to `control`. Assert that otherwise identical control/treatment contracts differ only at:

```text
stepScaleMode
clouds.perspectiveStepScale
```

Add route expectations:

```ts
resolve("...&orbitalStepScale=treatment")
// ok:true and value.orbitalStepScale === "treatment"

resolve("...&orbitalStepScale=1.0001")
// ok:false and reason === "unknown-orbital-step-scale"
```

Also assert that `orbitalStepScale` without the complete four-field orbital query returns `incomplete-orbital-lookdev`.

Before implementation, add a runtime assertion that a treatment contract reads back `clouds.perspectiveStepScale=1.0001` and reports drift when the runtime is reset to `1.01`. Add a same-document System Chrome test that switches control to treatment, waits for `data-orbital-step-scale="treatment"`, and passes the before/after allocations to `didTakramLookdevRemountAllAllocations`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts \
  --grep "step scale|orbital lookdev queries"
```

Expected: FAIL because the input/query does not expose `orbitalStepScale`.

- [ ] **Step 3: Implement minimal contract/query propagation**

Import the parser/resolver into both contracts. Include the requested step enum in the resolved contract and override only:

```ts
clouds: {
  ...clouds,
  perspectiveStepScale: resolveTakramOrbitalStepScale(stepScaleMode),
  // existing audited fields
}
```

Treat `orbitalStepScale` as a fifth optional member of the orbital query group: if present it participates in completeness/conflict validation; if absent a complete legacy four-field orbital query receives `control`.

Pass `query.orbitalStepScale` from the client into `orbitalLookdev.stepScaleMode`, publish `data-orbital-step-scale`, add it to pipeline memo dependencies, and include it in normalized query identity. The resolved contract already makes the mount key and runtime evidence epoch differ.

- [ ] **Step 4: Verify GREEN and typecheck both packages**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-lookdev.spec.ts --workers=1 \
  --grep "sampling treatment remounts"
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx apps/site/components/LuBirthTakramParitySpikeClient.tsx tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts tests/unit/lubirthTakramParityContract.spec.ts tests/e2e/lubirth-takram-orbital-lookdev.spec.ts
git commit -m "feat(lubirth): expose bounded orbital step A/B"
```

### Task 3: Build the isolated exact-frame evidence publisher

**Files:**
- Create: `tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts`
- Reuse: `tests/helpers/takramOrbitalLookdevEvidence.ts`

- [ ] **Step 1: Write a non-capture route/readback test first**

For both modes at `progress=0.06`, open the frozen query and assert:

```ts
telemetry.orbitalLookdev.requested.stepScaleMode === mode
telemetry.orbitalLookdev.readback.clouds.perspectiveStepScale === expectedValue
telemetry.orbitalLookdev.drift.length === 0
telemetry.matchedTemporalFrameCapture.frameLockPass === true
```

For `sample-count-debug`, require `sampleCountReadback`; for `stage-readback`, require pre-temporal/resolved/final buffer metadata and byte lengths.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts --workers=1 \
  --grep "publishes bounded sampling diagnostics"
```

Expected: FAIL before the new test's helpers and route contract are complete.

- [ ] **Step 3: Implement the non-capture test and formal capture path**

Use exact query values and diagnostics:

```text
mode: control / treatment
progress: 0 / 0.06 / 0.12 / 0.18
diagnostic: cloud-raw / cloud-raw-off / sample-count-debug / stage-readback
```

Repeat both modes at `progress=0.06`. Decode PNGs with Sharp; encode sample counts as gzip `uint16-le`; encode stage buffers as gzip `float32-le` or `uint8`. Reuse `analyzeTakramV3NativeSampleCountReadback`, `analyzeTakramV3StageReadback`, and morphology fragmentation metrics. Publish atomically only when:

```text
MIRALITH_TAKRAM_ORBITAL_SAMPLING_CAPTURE=1
```

The evidence directory contains `captures/`, three contact sheets, `manifest.json`, `metrics.json`, `review-template.json`, and `OUTCOME.md`. Before capture, require `git diff --name-only` to be empty; preserve untracked `.superpowers/`.

- [ ] **Step 4: Verify the non-capture test GREEN**

Run the Step 2 command. Expected: both mode diagnostics pass.

- [ ] **Step 5: Commit implementation and harness**

```bash
git add tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts
git commit -m "test(lubirth): capture orbital sampling causality"
```

### Task 4: Capture, review, classify, and publish the result

**Files:**
- Create under: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-sampling-causality/`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev/OUTCOME.md`

- [ ] **Step 1: Run the formal clean-commit capture**

```bash
MIRALITH_TAKRAM_ORBITAL_SAMPLING_CAPTURE=1 \
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts --workers=1 \
  --grep "captures orbital sampling causality A/B"
```

Expected: one capture test passes and writes the isolated evidence package.

- [ ] **Step 2: Verify every manifest hash**

Run a read-only Node SHA-256 verifier over every screenshot, binary buffer, and contact sheet referenced by `manifest.json`. Expected: reported checked count equals the manifest reference count with no mismatch.

- [ ] **Step 3: Review the contact sheets and exact metrics**

Record, for each progress, whether treatment restores structured raw signal and whether it remains observable in resolved/final output. Do not infer `CONFIRMED` from sample count alone. Feed these booleans plus the paired metrics into `resolveTakramOrbitalSamplingOutcome` and write the terminal state to `review.json` and `OUTCOME.md`.

- [ ] **Step 4: Update the prior outcome scope**

Amend the 2026-08-12 outcome to state that it completed the evidence harness but did not establish a usable cloud migration, then link the sampling-causality result without rewriting the original immutable manifests.

- [ ] **Step 5: Run full verification**

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalSamplingCausality.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts \
  tests/e2e/lubirth-takram-orbital-lookdev.spec.ts --workers=1 \
  --grep "bounded sampling diagnostics|sampling treatment remounts|orbital route publishes"
```

Expected: all commands exit `0`.

- [ ] **Step 6: Update graph and commit evidence**

```bash
graphify update .
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-sampling-causality docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev/OUTCOME.md
git commit -m "test(lubirth): publish orbital sampling causality outcome"
```
