# LuBirth Takram Orbital Production Sampling and Lookdev Implementation Plan

**Status:** Ready for implementation

**Source spec:** `docs/superpowers/specs/2026-08-13-lubirth-takram-orbital-production-sampling-and-lookdev-design.md` at approved content commit `cfa815c`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select one evidence-backed public `perspectiveStepScale` policy for the stock orbital opening, build a healthy sampling baseline, execute a fresh bounded lookdev, and publish one spec-authorized stock/V3 terminal outcome without changing the homepage or production Takram shader API.

**Architecture:** Keep the historical two-arm causal resolver immutable and add a separate production candidate contract. Build capture-only primary-march instrumentation, exact BSM-to-final GPU submission timing, numeric metric extraction, and pure policy/lookdev/V3 resolvers as focused modules; the query-only parity pipeline only applies those contracts and publishes raw telemetry. Formal System Chrome publishers consume staging evidence stage-by-stage from tracked-clean commits, skip every downstream capture after the first terminal gate, and route all outcomes through the common verification/closure task.

**Tech Stack:** TypeScript, React Three Fiber, Three.js, `@takram/three-clouds@0.7.6`, `postprocessing@6.39.1`, WebGL2 `EXT_disjoint_timer_query_webgl2`, Playwright with headed installed System Chrome, Sharp, Node crypto/zlib, macOS `system_profiler`/`pmset`.

---

## Execution invariants

- Do not modify `TakramOrbitalSamplingCausality.ts`, production `EarthMoonScene`, the on-disk `@takram/three-clouds` shader, or package patch artifacts.
- `orbitalStepScale=control|treatment` remains the historical causal query. `orbitalProductionStep=control|fine|confirmed|coarse` is a separate exact enum and cannot be combined with it.
- `featureState=native|light-shafts-off|bsm-off` and `output=full|cloud-raw|cloud-raw-off|sample-count-debug|primary-march-debug|stage-readback|aerial-final` are orthogonal in runtime identity even if the URL serializes `output` through the existing `diagnostic` field.
- Only `output=full` may start GPU populations. Capture-only shader instrumentation may run only for `sample-count-debug` and `primary-march-debug` and must restore the original fragment shader byte-for-byte on teardown.
- A setup/evidence/structural failure always resolves before sampling health. A sampling-health failure always resolves before human visual scoring.
- No Stage 4 capture is authorized until `ORBITAL_HEALTHY_STOCK_BASELINE_READY` exists in the new production-policy evidence root.
- No V3 capture is authorized until a Stage 4D visual winner passes a fresh final-stock setup/evidence and sampling-health replay.
- A formal publisher may run only from a tracked-clean commit. Each completed stage is committed before the next formal capture begins.
- Capture commands write only to an ignored, run-specific `output/takram-orbital-production-staging/<run-id>/<stage>/` tree. Human review edits only the staging `visual-review.json`. A resolve command validates the complete staging package and performs the stage's one and only atomic rename into the formal evidence root; formal directories are never partially created or overwritten.
- Any terminal outcome skips the remaining capture tasks, records them as `not-authorized-after-terminal`, and jumps to the outcome-aware Task 16 for final evidence verification and plan closure. Only `ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING` authorizes a separate shader-policy design; this plan does not implement that fallback.

## File structure

| File | Responsibility |
| --- | --- |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling.ts` | Exact production candidate enum, values, estimates, and parsing. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts` | Discriminated historical/production sampling policy inside the immutable orbital contract. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts` | Exact production-step, feature-state, and output query validation. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramPrimaryMarchInstrumentation.ts` | Audited capture-only entry/loop/cap/hit shader injection and byte-for-byte restoration. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramSampleCountInstrumentation.ts` | Audited outer and inner `out -> inout` repair for sample-count diagnostics. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics.ts` | Lossless buffer validation, structural audits, sampling/signal metrics, and machine decisions. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuSubmissionInstrumentation.ts` | Exact combined `EffectPass` discovery and non-nested total/stage submission hooks. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts` | Disjoint-safe total/stage populations, same-frame stage summaries, and p95 calculations. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy.ts` | Stage 0/1/2/3 pure policy resolver, environment gate, ranking, confirmation, and terminal outcomes. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts` | Preserve historical exports; add V2 stage-specific visual schemas, setup/sampling precedence, ranking, final-stock classification, and V3 authorization. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalV3Compatibility.ts` | V3 setup, per-progress metric decision, bounded visual schema, and pure terminal resolver. |
| `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx` | Apply exact runtime state and expose raw diagnostic, identity, readback, and profiler telemetry. |
| `tests/helpers/takramOrbitalProductionEvidence.ts` | Shared capture decoding, environment collection, hashing, atomic publication, and authorization checks. |
| `tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts` | System Chrome smoke, capture matrices, formal stage publishers, and terminal publication. |
| `playwright.takram-orbital-production-system-chrome.config.ts` | Headed installed-Chrome execution against one prebuilt production artifact. |

## Task 1: Define the exact production sampling contract

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling.ts`
- Create: `tests/unit/lubirthTakramOrbitalProductionSampling.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts`
- Modify: `tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts`

- [ ] **Step 1: Write failing candidate, value, estimate, and contract tests**

Add exact parser/value expectations:

```ts
expect(TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES).toEqual([
  "control", "fine", "confirmed", "coarse"
]);
expect(["control", "fine", "confirmed", "coarse", "1.0001", "", null]
  .map(parseTakramOrbitalProductionStepCandidate))
  .toEqual(["control", "fine", "confirmed", "coarse", null, null, null]);
expect(TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES).toEqual({
  control: 1.01,
  fine: 1.00005,
  confirmed: 1.0001,
  coarse: 1.0002
});
```

Assert `estimateTakramOrbitalInitialStepMeters()` uses `50 + (scale - 1) * rayNearMeters`, returns the four documented near-nadir and `2x-height` estimates within `1 m`, and labels every value as an estimate rather than measured ray data.

Add contract tests for the new discriminated sampling input while retaining the current causal compatibility fields:

```ts
resolveTakramOrbitalLookdevContract({
  coverage: 0.55,
  opticalDepthScale: 1,
  preset: "h120",
  samplingPolicy: { kind: "production", candidate: "confirmed" },
  verticalScale: 1
}).samplingPolicy
// => { kind: "production", candidate: "confirmed", perspectiveStepScale: 1.0001 }
```

Also prove the historical default and explicit causal treatment still resolve to `1.01` and `1.0001` through the unchanged functions in `TakramOrbitalSamplingCausality.ts`.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionSampling.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts
```

Expected: FAIL because the production module and `samplingPolicy` contract do not exist.

- [ ] **Step 3: Implement the pure candidate module**

Define the public surface exactly:

```ts
export const TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES = Object.freeze([
  "control", "fine", "confirmed", "coarse"
] as const);

export const TAKRAM_ORBITAL_PRODUCTION_STEP_VALUES = Object.freeze({
  control: 1.01,
  fine: 1.00005,
  confirmed: 1.0001,
  coarse: 1.0002
} as const);

export type TakramOrbitalProductionStepCandidate =
  (typeof TAKRAM_ORBITAL_PRODUCTION_STEP_CANDIDATES)[number];

export function parseTakramOrbitalProductionStepCandidate(
  value: string | null
): TakramOrbitalProductionStepCandidate | null;

export function resolveTakramOrbitalProductionStepScale(
  candidate: TakramOrbitalProductionStepCandidate
): number;

export function estimateTakramOrbitalInitialStepMeters(input: Readonly<{
  minStepSizeMeters: number;
  perspectiveStepScale: number;
  rayNearEstimateMeters: number;
}>): number;
```

Use frozen exact tables; do not accept numeric strings or clamp unknown values.

- [ ] **Step 4: Add the discriminated sampling policy as a backward-compatible extension**

Add `samplingPolicy` alongside the existing optional `stepScaleMode` input:

```ts
export type TakramOrbitalLookdevSamplingPolicyInput =
  | Readonly<{ kind: "causal"; mode: TakramOrbitalStepScaleMode }>
  | Readonly<{
      kind: "production";
      candidate: TakramOrbitalProductionStepCandidate;
    }>;

export interface TakramOrbitalLookdevInput {
  coverage: TakramOrbitalCoverage;
  opticalDepthScale: TakramOrbitalOpticalDepthScale;
  preset: TakramOrbitalPreset;
  samplingPolicy?: TakramOrbitalLookdevSamplingPolicyInput;
  /** Historical causal compatibility; rejected when samplingPolicy is present. */
  stepScaleMode?: TakramOrbitalStepScaleMode;
  verticalScale: TakramOrbitalVerticalScale;
}
```

Resolution precedence is exact: simultaneous `samplingPolicy` and `stepScaleMode` throws a contract conflict; `samplingPolicy` resolves directly; otherwise `stepScaleMode` maps to `{ kind: "causal", mode }`; absence of both maps to causal control. Publish `contract.samplingPolicy` but retain the current resolved `contract.stepScaleMode` causal alias through Task 8 so `TakramStockParityPipeline.tsx` and historical consumers still typecheck unchanged. A production policy sets the compatibility alias to `"control"` only as a deprecated field that no production identity or runtime decision may consume. Task 9 migrates all consumers to `samplingPolicy` and then removes that resolved alias in the same commit. Keep all morphology, layer, renderer, and lighting values byte-equivalent to the current contract.

- [ ] **Step 5: Run tests and both package typechecks**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionSampling.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
```

Expected: all pass; existing pipeline/site consumers typecheck without modification and the historical causal module has no diff.

- [ ] **Step 6: Commit**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts \
  tests/unit/lubirthTakramOrbitalProductionSampling.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts
git commit -m "feat(lubirth): define orbital production step policy"
```

## Task 2: Parse exact production feature/output routes and identity

**Files:**
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevIdentity.ts`
- Modify: `apps/site/components/LuBirthTakramParitySpikeClient.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx`
- Test: `tests/unit/lubirthTakramParityContract.spec.ts`
- Test: `tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts`

- [ ] **Step 1: Write failing route-domain tests**

Add these exact domains:

```ts
type TakramOrbitalFeatureState = "native" | "light-shafts-off" | "bsm-off";
type TakramOrbitalOutput =
  | "full"
  | "cloud-raw"
  | "cloud-raw-off"
  | "sample-count-debug"
  | "primary-march-debug"
  | "stage-readback"
  | "aerial-final";
```

Test a valid production route:

```text
input=stock&view=opening&progress=0.06
&orbitalPreset=h120&orbitalCoverage=0.55&verticalScale=1&opticalDepthScale=1
&orbitalProductionStep=confirmed&orbitalFeatureState=light-shafts-off
&diagnostic=stage-readback
```

Assert failures for arbitrary production values, a production step combined with `orbitalStepScale`, missing orbital lookdev tuple fields, legacy `cloudScale`, unsupported feature/output pairs, `aerial-final` outside native, and any GPU request outside `output=full`.

Preserve every legacy route result when none of the new fields is present, including historical `diagnostic=bsm-off` captures.

- [ ] **Step 2: Write failing identity tests**

For otherwise identical contracts, assert every change in production candidate, feature state, or output changes `lookdevBaseKey` and `lookdevMountKey`. Assert runtime-only evidence changes do not change the pre-mount base key.

- [ ] **Step 3: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramParityContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts \
  --grep "production step|feature state|output identity"
```

Expected: FAIL because the new fields and `primary-march-debug` output are unknown.

- [ ] **Step 4: Implement parsing and conflict rejection**

Add `orbitalProductionStep?: TakramOrbitalProductionStepCandidate` and `orbitalFeatureState?: TakramOrbitalFeatureState` to `TakramParityRouteQuery`. Keep `diagnostic` as the serialized output field, but normalize production routes into `{ featureState, output }` before building identity. Production routes default to `featureState=native`; legacy routes retain their current diagnostic semantics.

Return explicit reasons:

```ts
| "unknown-orbital-production-step"
| "unknown-orbital-feature-state"
| "conflicting-orbital-sampling-policies"
| "unsupported-orbital-feature-output"
```

Do not add a free-form numeric fallback.

- [ ] **Step 5: Thread the normalized fields through client and scene props**

Construct:

```ts
samplingPolicy: query.orbitalProductionStep === undefined
  ? { kind: "causal", mode: query.orbitalStepScale ?? "control" }
  : { kind: "production", candidate: query.orbitalProductionStep }
```

Publish `data-orbital-production-step`, `data-orbital-feature-state`, and `data-orbital-output`. Pass one typed `orbitalFeatureState` prop into `LuBirthTakramParityScene` and the stock pipeline.

- [ ] **Step 6: Verify GREEN and typecheck**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramParityContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevIdentity.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx \
  apps/site/components/LuBirthTakramParitySpikeClient.tsx \
  tests/unit/lubirthTakramParityContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts
git commit -m "feat(lubirth): add orbital production diagnostic routes"
```

## Task 3: Add audited sample-count and primary-march instrumentation

**Files:**
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramSampleCountInstrumentation.ts`
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramPrimaryMarchInstrumentation.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Test: `tests/unit/lubirthTakramSampleCountInstrumentation.spec.ts`
- Create: `tests/unit/lubirthTakramPrimaryMarchInstrumentation.spec.ts`

- [ ] **Step 1: Replace the current false-pass sample-count test with two-anchor RED tests**

Use an audited shader fixture containing both signatures:

```ts
const SAMPLE_MEDIA_OUT_ANCHOR = [
  "  const float jitter,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec4 density = weather.density;"
].join("\n");
const MARCH_CLOUDS_OUT_ANCHOR = [
  "  const float rayStartTexelsPerPixel,",
  "  out float frontDepth,",
  "  out ivec3 sampleCount",
  ") {",
  "  vec3 radianceIntegral = vec3(0.0);"
].join("\n");
```

Require both to become `inout`, require the caller's `ivec3 sampleCount = ivec3(0)` to remain unchanged, require exactly one match for each anchor, and require restore to equal the original source byte-for-byte. A fixture with only one signature must throw setup drift.

- [ ] **Step 2: Write RED tests for direct-value march instrumentation**

Test that the injected shader:

- initializes `primaryMarchDebug = vec4(0.0)` before the intersection branch;
- sets entry on `marchClouds` function entry;
- increments `loopIterationCount` as the first loop-body statement;
- marks both audited early-break sites as `terminatedBeforeCap=true`;
- sets cap only for entry + exact runtime `maxIterationCount` + no early break;
- writes `vec4(float(loopIterationCount), entered, capReached, marchedFrontDepth >= 0.0)` under one exact `DEBUG_SHOW_PRIMARY_MARCH` branch;
- records upstream, injected, restored, and instrumentation hashes;
- throws if an anchor is absent or duplicated;
- restores the original shader and define byte-for-byte.

- [ ] **Step 3: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramSampleCountInstrumentation.spec.ts \
  tests/unit/lubirthTakramPrimaryMarchInstrumentation.spec.ts
```

- [ ] **Step 4: Add an audited installer without changing the existing callback API**

Keep `installTakramSampleCountInstrumentation(material): () => void` byte-compatible for the existing pipeline and historical tests. Add a new API for successor diagnostics:

```ts
export interface TakramShaderInstrumentationInstallation {
  readonly audit: Readonly<{
    injectedSourceFnv1a64: string;
    instrumentationFnv1a64: string;
    sourceAnchorCounts: Readonly<Record<string, number>>;
    upstreamSourceFnv1a64: string;
  }>;
  restore(): Readonly<{ restoredSourceFnv1a64: string }>;
}

export function installAuditedTakramSampleCountInstrumentation(
  material: TakramSampleCountMaterial
): TakramShaderInstrumentationInstallation;
```

Both installers use the same two-anchor patch implementation. The audited installer publishes hashes; the compatibility installer returns only `() => installation.restore()` so Task 3's focused tests and `@miralith/lubirth-hero` typecheck pass before Task 9 migrates the pipeline. Patch the `marchClouds` outer parameter and the debug `sampleMedia` parameter independently. Never use a broad global `out ivec3` replacement.

- [ ] **Step 5: Implement primary-march injection with exact anchors**

Use explicit string anchors for the function signature, loop header, two `break` statements, caller initialization/call, and debug output block. Store loop counts directly in `RGBA16F`; do not normalize the lossless buffer. The visible PNG may normalize only `R` by runtime `maxIterationCount` in a separate display branch.

- [ ] **Step 6: Extend telemetry readback types**

Add `TakramParityPrimaryMarchReadback` with:

```ts
{
  width: number;
  height: number;
  precision: "half-float";
  source: "native-cloud-current-render-target-primary-march-v1";
  origin: "bottom-left";
  encoding: "rgba16f-loop-entry-cap-hit-direct";
  maxIterationCount: 500;
  values: readonly number[];
  instrumentationAudit: TakramShaderInstrumentationAudit;
}
```

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramSampleCountInstrumentation.spec.ts \
  tests/unit/lubirthTakramPrimaryMarchInstrumentation.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramSampleCountInstrumentation.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramPrimaryMarchInstrumentation.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts \
  tests/unit/lubirthTakramSampleCountInstrumentation.spec.ts \
  tests/unit/lubirthTakramPrimaryMarchInstrumentation.spec.ts
git commit -m "feat(lubirth): instrument orbital primary march health"
```

Expected: the new audited APIs and readback types are available, while the unchanged stock pipeline still compiles against the legacy callback installer. Task 9 performs the consumer migration.

## Task 4: Derive structural and sampling metrics from raw buffers

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics.ts`
- Create: `tests/unit/lubirthTakramOrbitalSamplingMetrics.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics.ts`
- Modify: `tests/unit/lubirthTakramV3MorphologyMetrics.spec.ts`

- [ ] **Step 1: Write RED structural-audit tests**

Define lossless buffer inputs with explicit width, height, channels, precision, origin, encoding, and flat values. Cover:

```text
primary march:
  integer R in [0,500]
  binary G/B/A
  G=0 -> R=B=A=0
  G=1 -> R>=1
  B=1 -> G=1 and R=500
  A=1 -> G=1

sample count:
  finite reconstructed counts satisfy 0 <= detail <= shape <= primary <= 500
  shape/detail encoded values may exceed 1 because 5/5 are scale factors, not accumulated-count ceilings
  native hit -> primary > 0
```

Prove an all-zero primary-march buffer passes the structural audit but produces `enteredPrimaryMarchPixelCount=0`. Prove a primary-march texel with `R=500,G=1,B=1,A=0` contributes to both cap metrics even when its separate rough-weather sample-count `R` decodes below `500`; an entered ray with rough-weather primary count `0` remains in the denominator.

Assert both formulas directly:

```text
primaryCapSaturationFraction =
  count(G >= 0.5 and B >= 0.5) / count(G >= 0.5)

noHitPrimaryCapSaturationFraction =
  count(G >= 0.5 and B >= 0.5 and A < 0.5) / count(G >= 0.5)
```

`noHitPrimaryCapSaturationFraction` is always published as a diagnostic and never changes a terminal decision independently of `primaryCapSaturationFraction`.

- [ ] **Step 2: Write RED Stage 1 threshold-boundary tests**

Exercise exact pass/fail boundaries for native hit `0.20`, pre-temporal signal `0.20`, small fragments `0.10`, signal retention `[0.90,1.10]`, luma retention `[0.80,1.20]`, paired change strictly above the same-progress repeat floor, entry count `>0`, and cap saturation `<=0.01`. Add explicit no-hit fixtures for `0`, exactly `0.01`, and above `0.01` to prove the value is derived and serialized while only the overall cap fraction controls health.

Also test `cloudMask` uses max absolute RGB byte delta `>8`, ignores alpha, and four-neighbour components of size `<=3` feed `smallFragmentFraction`.

- [ ] **Step 3: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalSamplingMetrics.spec.ts \
  tests/unit/lubirthTakramV3MorphologyMetrics.spec.ts
```

- [ ] **Step 4: Implement focused metric APIs**

Expose:

```ts
export function auditTakramPrimaryMarchReadback(
  input: TakramPrimaryMarchReadbackInput
): TakramPrimaryMarchStructuralAudit;

export function analyzeTakramPrimaryMarchReadback(
  input: TakramPrimaryMarchReadbackInput
): TakramPrimaryMarchMetrics;

export function auditTakramSampleCountReadback(
  input: TakramNativeSampleCountReadbackInput
): TakramSampleCountStructuralAudit;

export function analyzeTakramOrbitalSamplingProgress(
  input: TakramOrbitalSamplingProgressInput
): TakramOrbitalSamplingProgressMetrics;

export function resolveTakramOrbitalSamplingProgressDecision(
  input: TakramOrbitalSamplingProgressMetrics
): Readonly<{
  evidenceValid: boolean;
  samplingHealthy: boolean;
  setupInvalidReasons: readonly string[];
  samplingFailureReasons: readonly string[];
}>;
```

`TakramPrimaryMarchMetrics` contains at minimum `enteredPrimaryMarchPixelCount`, `primaryCapSaturationFraction`, `noHitPrimaryCapSaturationFraction`, direct loop-count summary statistics, cap count, no-hit cap count, and hit count.

Validate unclamped decoded values before rounding. Reject dimension/channel/precision/origin mismatches and every non-finite lossless value as setup evidence. Never read cap, entry, or `noHitPrimaryCapSaturationFraction` from sample-count channels.

- [ ] **Step 5: Reuse morphology primitives without changing old V3 outcomes**

Export the existing four-neighbour component and mask calculations through named functions or call them from the new module. Keep current `TakramV3MorphologyMetrics` classifications byte-compatible for historical tests; only add the primary-march metrics needed by the successor V3 resolver.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalSamplingMetrics.spec.ts \
  tests/unit/lubirthTakramV3MorphologyMetrics.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyMetrics.ts \
  tests/unit/lubirthTakramOrbitalSamplingMetrics.spec.ts \
  tests/unit/lubirthTakramV3MorphologyMetrics.spec.ts
git commit -m "feat(lubirth): derive orbital sampling health metrics"
```

## Task 5: Move GPU timing onto the exact native submissions

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuSubmissionInstrumentation.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts`
- Modify: `tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts`
- Create: `tests/unit/lubirthTakramOrbitalGpuSubmissionInstrumentation.spec.ts`

- [ ] **Step 1: Write RED population tests for the normative five stages**

Define:

```ts
export const TAKRAM_ORBITAL_GPU_STAGE_NAMES = Object.freeze([
  "bsm-current",
  "bsm-resolve",
  "cloud-current",
  "cloud-resolve",
  "final-effect"
] as const);
```

Test that a stage frame is retained only when all five unique samples and its empty-query baseline exist. Assert:

- duplicate, missing, unknown, negative, or non-finite stages invalidate the frame;
- disjoint invalidates pending and completed samples from the entire epoch;
- frame sums are computed before nearest-rank p95;
- BSM combined p95 is computed from each frame's `bsm-current + bsm-resolve`, not by adding independent p95 values;
- stage-only and total-only populations cannot be active on the same frame;
- `3` and `4 ms` are inclusive boundaries, but classification remains a resolver concern rather than a profiler-written winner boolean.

- [ ] **Step 2: Write RED exact-boundary hook tests with fake passes**

Build fake objects for one combined effect pass, its ordered `[cloudsEffect, aerialPerspectiveEffect]`, `shadowPass.currentPass`, `shadowPass.resolvePass`, `cloudsPass.currentPass`, and `cloudsPass.resolvePass`. Record events and assert:

```text
total-only:
  unrelated RenderPass.render
  unrelated NormalPass.render
  begin-total
  bsm-current
  bsm-resolve
  cloud-current
  cloud-resolve
  combined-final-render
  end-total

stage-only:
  begin/end around each of the first four submissions
  begin/end final-effect only around combined fullscreen renderer.render
```

Reject zero or multiple matching combined effect passes, wrong effect order, a second total begin, missing end, nested stage/total queries, an exception without `finally` cleanup, or wrapping the whole `EffectPass.render` as `final-effect`.

- [ ] **Step 3: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuSubmissionInstrumentation.spec.ts
```

- [ ] **Step 4: Add an explicit-submission profiler without breaking the current frame profiler**

Keep the existing `TakramOrbitalWebGl2TimerProfiler` and `createTakramOrbitalWebGl2TimerProfiler()` signatures unchanged through Task 8 so the current pipeline typechecks. Add the successor mode-bound API under distinct names:

```ts
export interface TakramOrbitalSubmissionTimerProfiler {
  beginFrame(): Readonly<{ frameId: number; measure: boolean }>;
  beginTotal(frameId: number): void;
  endTotal(frameId: number): void;
  beginStage(frameId: number, stage: TakramOrbitalGpuStageName): void;
  endStage(frameId: number, stage: TakramOrbitalGpuStageName): void;
  finishFrame(frameId: number, copyOnlySubmission?: () => void): void;
  poll(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
  snapshot(): DeepReadonly<TakramOrbitalGpuProfileSnapshot>;
  dispose(): void;
}

export function createTakramOrbitalSubmissionTimerProfiler(
  gl: WebGL2RenderingContext,
  options: TakramOrbitalSubmissionTimerProfilerOptions
): TakramOrbitalSubmissionTimerProfiler;
```

`finishFrame` emits no-op/copy baselines for total-only and one empty-query baseline for stage-only. It does not subtract baselines. A disjoint event drops the complete epoch and continues until the configured valid-frame target is reached.

- [ ] **Step 5: Implement and fingerprint the submission hook**

Expose:

```ts
export function installTakramOrbitalGpuSubmissionInstrumentation(input: Readonly<{
  aerialPerspectiveEffect: object;
  cloudsEffect: object;
  composer: object;
  profiler: TakramOrbitalSubmissionTimerProfiler;
}>): Readonly<{
  audit: TakramOrbitalGpuSubmissionAudit;
  restore(): void;
}>;
```

Discover exactly one combined `EffectPass` whose effect order is Clouds then AerialPerspective. Wrap the four native pass submissions. Scope a temporary `renderer.render` interceptor only during that exact combined pass and wrap only the pass's own fullscreen `scene/camera` draw as `final-effect`. In total-only mode, arm when the combined pass enters the expected Clouds update, begin immediately before BSM current, and close after the combined pass returns in `finally`.

The audit records pass identities/order, installed package hashes, original/wrapped method hashes, and hook source hash. `restore()` restores every method identity exactly.

The legacy frame-priority profiler remains covered by its historical tests but is labelled non-authoritative and cannot be consumed by the new production-policy resolver. Task 9 migrates the pipeline to `TakramOrbitalSubmissionTimerProfiler` and removes the old priority wrapper in the same commit.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuSubmissionInstrumentation.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuSubmissionInstrumentation.ts \
  tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuSubmissionInstrumentation.spec.ts
git commit -m "feat(lubirth): time exact orbital GPU submissions"
```

Expected: the new submission profiler tests pass and the existing pipeline continues to typecheck against the legacy profiler until Task 9.

## Task 6: Implement the production-policy environment gate and pure resolver

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy.ts`
- Create: `tests/unit/lubirthTakramOrbitalProductionPolicy.spec.ts`

- [ ] **Step 1: Write RED environment and Stage 0 tests**

Define the authoritative environment input:

```ts
export interface TakramOrbitalPerformanceEnvironment {
  readonly build: "production";
  readonly browser: "headed-system-chrome";
  readonly browserVersion: string;
  readonly chip: string;
  readonly gpuRenderer: string;
  readonly gpuVendor: string;
  readonly macOSVersion: string;
  readonly viewport: Readonly<{
    cssWidth: 1440;
    cssHeight: 960;
    physicalWidth: 1440;
    physicalHeight: 960;
    dpr: 1;
  }>;
  readonly visible: boolean;
  readonly focused: boolean;
  readonly acPower: boolean;
  readonly lowPowerMode: false;
  readonly commit: string;
  readonly productionAssetFingerprint: string;
}
```

Require Apple M4, one exact recorded macOS version, ANGLE Metal identity, production build, headed System Chrome, `1440x960` CSS pixels, `1440x960` physical canvas pixels, DPR `1`, visible/focused page, AC power, and Low Power Mode disabled. A missing or mismatched field fails Stage 0. Initial, ranking, final-winner, and confirmation populations compare every environment field—including macOS and physical dimensions—for exact equality. Also require exactly `93` verified causal artifacts, causal outcome, causal contract/commit readability, query/runtime/fingerprint/camera parity, and independent `8+8` total/stage smoke populations.

- [ ] **Step 2: Write RED Stage 1 and Stage 2 outcome tests**

Create typed fixtures for four progresses per candidate and cover:

```ts
type TakramOrbitalProductionPolicyOutcome =
  | "ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED"
  | "ORBITAL_PUBLIC_STEP_POLICY_WINNER"
  | "ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING"
  | "ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL"
  | "ORBITAL_PUBLIC_STEP_POLICY_OVER_BUDGET"
  | "ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED";
```

Assert precedence:

1. invalid setup/evidence/timer population blocks;
2. no sampling-healthy non-control candidate gives quality fail;
3. valid full `<=4 ms` candidates rank by production-eligible first, lowest maximum full p95, coarsest scale on exact tie, then `confirmed` on the remaining exact tie;
4. decoupling requires unchanged primary evidence, `full>4` at one or more matching progresses, `light-shafts-off<=4` everywhere, and a second independent population reproducing the complete predicate;
5. failed confirmation gives `PERF_BLOCKED`, not decoupling;
6. general over-budget without that predicate gives `OVER_BUDGET`;
7. `control` can provide noise evidence but can never win.

- [ ] **Step 3: Write RED primary-signal parity tests**

For `native`, `light-shafts-off`, and `bsm-off`, require byte-identical primary-march buffers and bound native-hit mismatch plus pre-temporal opacity MAE by the same candidate/progress Stage 1 repeat floors. Prove that comparison uses feature state names and never treats `full` as a feature state.

- [ ] **Step 4: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionPolicy.spec.ts
```

- [ ] **Step 5: Implement pure validation, ranking, and terminal resolution**

Expose separate functions so evidence code cannot handwrite outcomes:

```ts
validateTakramOrbitalPerformanceEnvironment(
  input: TakramOrbitalPerformanceEnvironment
): TakramOrbitalPerformanceEnvironmentDecision;
resolveTakramOrbitalProductionStage0(
  input: TakramOrbitalProductionStage0Input
): TakramOrbitalProductionStage0Decision;
resolveTakramOrbitalProductionStage1(
  input: TakramOrbitalProductionStage1Input
): TakramOrbitalProductionStage1Decision;
resolveTakramOrbitalPrimarySignalParity(
  input: TakramOrbitalPrimarySignalParityInput
): TakramOrbitalPrimarySignalParityDecision;
resolveTakramOrbitalProductionPolicy(
  input: TakramOrbitalProductionPolicyInput
): TakramOrbitalProductionPolicyDecision;
createTakramOrbitalHealthyBaselineContract(
  input: TakramOrbitalHealthyBaselineInput
): TakramOrbitalHealthyBaselineContract;
```

`createTakramOrbitalHealthyBaselineContract()` may run only for the exact winner and publishes `ORBITAL_HEALTHY_STOCK_BASELINE_READY`, the resolved query/value, complete frozen render/layer contract, all four identities/metrics, all feature comparisons, GPU populations, machine decision, and the bounded coherence/observability review.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionPolicy.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy.ts \
  tests/unit/lubirthTakramOrbitalProductionPolicy.spec.ts
git commit -m "feat(lubirth): resolve orbital production sampling policy"
```

## Task 7: Add the V2 lookdev and final-stock pure resolver

**Files:**
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts`
- Modify: `tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts`

- [ ] **Step 1: Write RED setup-before-sampling tests**

Preserve every historical v1 export and test. Add V2 types with stages `4A|4B|4C|4D|final-stock` and assert the shared resolver priority:

```text
invalid setup/evidence/finite/source/hash/structural audit
  -> ORBITAL_LOOKDEV_V2_SETUP_BLOCKED
valid evidence + entered=0 or cap>0.01
  -> candidate sampling-health failure
valid evidence + entered>0 and cap<=0.01
  -> stage-specific visual gate
```

An invalid required candidate stops the whole stage and cannot be removed to let another candidate win. Only evidence-valid sampling failures are filtered. If all evidence-valid candidates fail sampling, emit `ORBITAL_LOOKDEV_V2_SAMPLING_HEALTH_FAIL` with exact `failedStage`, entered counts, progresses, and raw cap fractions.

The stage-specific no-winner terminals are exact: `ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL`, `ORBITAL_LOOKDEV_V2_COVERAGE_FAIL`, `ORBITAL_LOOKDEV_V2_VERTICAL_FAIL`, and `ORBITAL_LOOKDEV_V2_OPTICAL_FAIL`.

Add separate Stage 4A/4B machine signal-presence fixtures after the shared setup/sampling resolver:

```text
Stage 4A and Stage 4B, every candidate/progress:
  nativeHitPixelCount > 0
  preTemporalSignalPixelFraction > 0
```

Test exact zero and smallest-positive boundaries independently for both fields. A sampling-healthy candidate with either value equal to zero is rejected by the stage-specific machine gate before human review and records `native-hit-absent` or `pre-temporal-signal-absent`; it is not relabelled as sampling-health or setup failure. If no candidate remains after this stage-specific gate, resolve the corresponding `MORPHOLOGY_FAIL` or `COVERAGE_FAIL` with machine reasons and no fabricated visual scores.

- [ ] **Step 2: Write RED stage-specific visual and ranking tests**

Define V2 visual reviews with no PASS/FAIL field and these dimensions:

```ts
const STAGE_DIMENSIONS = {
  "4A": ["macroCoherence", "openingIdentityStability", "artifactFreedom"],
  "4B": ["macroCoherence", "coverageUsability", "openingIdentityStability", "artifactFreedom"],
  "4C": ["macroCoherence", "cloudGroundSeparation", "depthLayering", "openingIdentityStability", "artifactFreedom"],
  "4D": ["macroCoherence", "cloudGroundSeparation", "depthLayering", "lightingBsmRead", "openingIdentityStability", "artifactFreedom"]
} as const;
```

Require every scored dimension `>=1` at every progress and no enumerated hard artifact. Prove 4A/4B cannot fail on deferred separation, depth, or lighting. Implement the exact spec tie-break order, including one coverage per morphology, at most two Stage 4B survivors, and one winner in 4C/4D.

The V2 hard-flag domain is exact: `cube-face-seam`, `wrap-discontinuity`, `unstable-opening-identity`, and `captured-signal-loss`. Non-finite output is not a visual flag; it is setup-blocked before review.

- [ ] **Step 3: Write RED final-stock replay and classification tests**

Require a fresh four-progress setup/evidence and sampling replay. Assert:

- setup invalid -> `ORBITAL_LOOKDEV_V2_SETUP_BLOCKED`, `failedStage=final-stock`, no GPU/V3 authorization;
- valid evidence with zero entry or cap above `1%` -> sampling-health fail, no GPU/V3 authorization;
- valid replay + max full p95 `<=3` -> `PRODUCTION_ELIGIBLE`;
- `3 < p95 <=4` -> `QUERY_ONLY`;
- `p95>4` -> `OVER_BUDGET`;
- invalid timer -> `PERF_BLOCKED`;
- only a passed final-stock replay authorizes V3, irrespective of the later GPU classification.

The returned names are `ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE`, `ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY`, `ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET`, and `ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED`.

- [ ] **Step 4: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts \
  --grep "V2|final stock|setup precedence"
```

- [ ] **Step 5: Implement V2 schemas and pure resolvers**

Add versioned exports without renaming v1 symbols:

```ts
evaluateTakramOrbitalV2VisualReview(
  review: TakramOrbitalV2VisualReview
): TakramOrbitalV2VisualEvaluation;
resolveTakramOrbitalV2SharedGate(
  input: TakramOrbitalV2SharedGateInput
): TakramOrbitalV2SharedGateDecision;
resolveTakramOrbitalV2SignalPresenceGate(
  input: TakramOrbitalV2SignalPresenceInput
): TakramOrbitalV2SignalPresenceDecision;
resolveTakramOrbitalV2Stage4A(
  input: TakramOrbitalV2StageInput<"4A">
): TakramOrbitalV2StageDecision;
resolveTakramOrbitalV2Stage4B(
  input: TakramOrbitalV2StageInput<"4B">
): TakramOrbitalV2StageDecision;
resolveTakramOrbitalV2Stage4C(
  input: TakramOrbitalV2StageInput<"4C">
): TakramOrbitalV2StageDecision;
resolveTakramOrbitalV2Stage4D(
  input: TakramOrbitalV2StageInput<"4D">
): TakramOrbitalV2StageDecision;
resolveTakramOrbitalV2FinalStockReplay(
  input: TakramOrbitalV2FinalStockReplayInput
): TakramOrbitalV2FinalStockReplayDecision;
resolveTakramOrbitalV2FinalClassification(
  input: TakramOrbitalV2FinalClassificationInput
): TakramOrbitalV2FinalClassificationDecision;
```

Every resolver consumes raw machine decisions plus bounded score/flag records. Stage 4A and 4B invoke `resolveTakramOrbitalV2SignalPresenceGate()` after the shared resolver and before visual evaluation. None accepts `setupPass`, `samplingPass`, `signalPass`, `visualPass`, `metricPass`, or another handwritten verdict boolean.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts \
  tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts
git commit -m "feat(lubirth): resolve orbital lookdev v2 stages"
```

## Task 8: Add the frozen V3 adapter compatibility contract

**Files:**
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalV3Compatibility.ts`
- Create: `tests/unit/lubirthTakramOrbitalV3Compatibility.spec.ts`

- [ ] **Step 1: Write RED setup/parity tests**

Require the committed Stage 4D winner to equal the final-stock winner, normalize only texture identity/hash, mapping, repeat/offset, wrap, and channel transform, and require every other stock/V3 query/runtime/layer/sampling/lookdev/camera/renderer/output/native-frame/viewport/feature identity to match. Require fresh allocation epochs, all six temporal frames, finite compatible readbacks, source/encoding/structural audits, manifest hash/length parity, and byte-identical fresh-mount repeats.

Any failure above or a failed fresh stock replay must resolve `V3_WEATHER_ADAPTER_SETUP_BLOCKED` before V3 metrics or visual review.

- [ ] **Step 2: Write RED per-progress metric tests**

Test the exact independent thresholds:

```text
cloud fraction >= 0.002
pre-temporal signal >= 0.002
largest connected fraction >= 0.25
single-pixel fragments <= 0.02
small fragments <= 0.08
edge density <= 0.65
clear-air leakage <= 0.05
first/converged luma delta <= 0.08
signal retention in [0.90,1.10]
luma retention in [0.80,1.20]
entered primary rays > 0
cap saturation <= 0.01
```

Prove that averaging cannot hide a failed progress and that stock metric failure is setup-blocked while V3 metric failure is `V3_WEATHER_ADAPTER_FAIL`.

Require every stock/V3 progress metric record to serialize `noHitPrimaryCapSaturationFraction` from the direct primary-march buffer. Test `0`, `0.01`, and `>0.01` fixtures and prove that this value remains a required diagnostic: it is preserved in metric decisions and evidence publication but does not independently change PASS/FAIL beyond `cap saturation <= 0.01`.

- [ ] **Step 3: Write RED visual-schema and scope tests**

The review records six per-progress `0|1|2` dimensions, one sequence-level opening stability score, enumerated hard flags, identity, commit, winner, contact-sheet hashes, viewport/DPR, progress, and references. It contains no result boolean. Require every score `>=1` and no hard flag.

The V3 hard-flag domain is exact: `tiling-repeat`, `isolated-speckle`, `march-band`, `temporal-ghost`, `frame-pop`, `ground-intersection`, `clipped-solid-fill`, and `other-with-required-note`; the last value is invalid without a non-empty note.

Assert V3 is mandatory only after a Stage 4D visual winner and passed final-stock replay. A final-stock setup or sampling failure skips V3; after replay passes, production/query-only/over-budget/perf-blocked all require one V3 terminal result.

- [ ] **Step 4: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalV3Compatibility.spec.ts
```

- [ ] **Step 5: Implement the pure V3 module**

Expose:

```ts
validateTakramOrbitalV3Setup(
  input: TakramOrbitalV3SetupInput
): TakramOrbitalV3SetupDecision;
deriveTakramOrbitalV3ProgressDecision(
  input: TakramOrbitalV3ProgressMetrics
): TakramOrbitalV3ProgressDecision;
evaluateTakramOrbitalV3VisualReview(
  review: TakramOrbitalV3VisualReview
): TakramOrbitalV3VisualEvaluation;
resolveTakramOrbitalV3Compatibility(
  input: TakramOrbitalV3ResolverInput
): TakramOrbitalV3ResolverDecision;
```

The terminal resolver consumes only the machine setup report, four stock decisions, four V3 decisions, and bounded visual scores/flags. Each progress decision retains both `primaryCapSaturationFraction` and diagnostic `noHitPrimaryCapSaturationFraction` for publication. It returns only `V3_WEATHER_ADAPTER_SETUP_BLOCKED`, `V3_WEATHER_ADAPTER_FAIL`, or `V3_WEATHER_ADAPTER_PASS`.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalV3Compatibility.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalV3Compatibility.ts \
  tests/unit/lubirthTakramOrbitalV3Compatibility.spec.ts
git commit -m "feat(lubirth): resolve orbital V3 compatibility"
```

## Task 9: Integrate feature states, diagnostic readbacks, and submission timing

**Files:**
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevRuntime.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts`
- Modify: `tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts`
- Modify: `tests/unit/lubirthTakramParityContract.spec.ts`

- [ ] **Step 1: Write RED runtime feature-state tests**

For the same production contract, assert:

```text
native:
  lightShafts=true, official layer shadow flags
light-shafts-off:
  lightShafts=false, official layer shadow flags
bsm-off:
  lightShafts=true, every layer shadow=false, BSM pass/resources still allocated
```

Readback/diff must detect the wrong light-shafts or layer-shadow state. Remounting back to native must restore the immutable high-preset feature and official layer flags.

Also assert the existing one-remount-then-block ledger: the first stable runtime drift for a base key schedules exactly one complete composer remount, while the same persistent drift after that remount becomes setup-blocked and never increments the nonce again.

- [ ] **Step 2: Write RED profiler-start authorization tests**

The browser API must reject:

- a non-winner candidate;
- stale mount/evidence epoch;
- non-`full` output;
- requested feature state different from the mounted state;
- an unsupported mode;
- a second active population;
- a missing exact combined pass audit.

Its input is:

```ts
{
  candidateId: string;
  committedWinnerId: string;
  featureState: "native" | "light-shafts-off";
  lookdevMountKey: string;
  measurementMode:
    | "total-only-time-elapsed"
    | "stage-only-sequential-time-elapsed";
  runtimeEvidenceEpoch: string;
  targetSampleCount: 8 | 120;
  warmupFrameCount: 8 | 120;
}
```

- [ ] **Step 3: Run RED**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts \
  --grep "feature state|production profiler"
```

- [ ] **Step 4: Apply feature state as part of the immutable runtime contract**

Migrate every pipeline/client/runtime consumer from the temporary resolved `contract.stepScaleMode` alias to `contract.samplingPolicy`; include the complete discriminated policy in normalized query identity and read `clouds.perspectiveStepScale` from its resolved value. Remove the resolved compatibility alias from `TakramOrbitalLookdevContract` in this same commit, while retaining the historical `TakramOrbitalLookdevInput.stepScaleMode` adapter for causal callers.

Pass the normalized feature state to `apply/read/diffTakramOrbitalLookdevRuntime()`. Record it in requested contract, readback, drift signature, base/mount identity, runtime evidence epoch, and renderer fingerprint. A feature/output change must remount all six cloud/shadow/resolve allocations before frame counting.

- [ ] **Step 5: Mount the two capture-only shader modes**

For `sample-count-debug`, migrate the pipeline from the compatibility callback to `installAuditedTakramSampleCountInstrumentation()` and publish its lossless readback/audit. For `primary-march-debug`, install only primary-march instrumentation, define `DEBUG_SHOW_PRIMARY_MARCH`, read the native current target as direct-value `RGBA16F`, and publish `window.__MiraLithTakramPrimaryMarch`. Reject either diagnostic if `featureState` or output is unsupported.

On teardown, remove the exact define, restore source byte-for-byte, mark the material dirty, and publish the restored hash. Neither mode may coexist with GPU profiling.

- [ ] **Step 6: Replace the priority `0 -> 3` whole-composer timer**

Migrate the pipeline from `createTakramOrbitalWebGl2TimerProfiler()` to `createTakramOrbitalSubmissionTimerProfiler()`. Remove the existing `useFrame` begin at priority `0` and end at priority `3` in the same edit. Hold a ref to the actual composer, install `TakramOrbitalGpuSubmissionInstrumentation` only after the exact combined Clouds/AerialPerspective pass is available, and drive polling after submission without opening another query.

Expose the raw snapshot plus submission audit on `window.__MiraLithTakramGpuProfile`. The renderer fingerprint must include combined pass identity/order, hook source hash, installed build hash, and measurement mode. No R3F frame-priority interval may populate a `3/4 ms` decision.

- [ ] **Step 7: Keep readback/frame readiness exact**

`primary-march-debug` becomes active only after native frame `32`, matching temporal frame lock and a completed lossless readback. `stage-readback`, sample-count, primary-march, and screenshot dimensions/origins remain explicit. Every candidate/feature/output route allocates a fresh complete composer epoch.

- [ ] **Step 8: Verify focused tests and typechecks**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts \
  tests/unit/lubirthTakramSampleCountInstrumentation.spec.ts \
  tests/unit/lubirthTakramPrimaryMarchInstrumentation.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuSubmissionInstrumentation.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
```

- [ ] **Step 9: Commit**

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevContract.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevRuntime.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts
git commit -m "feat(lubirth): wire orbital production diagnostics"
```

## Task 10: Build the production System Chrome capture and publication harness

**Files:**
- Create: `tests/helpers/takramOrbitalProductionEvidence.ts`
- Create: `tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts`
- Create: `tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts`
- Create: `playwright.takram-orbital-production-system-chrome.config.ts`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Write RED atomic-publication and authorization tests**

Test that the helper:

- does nothing when `MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE` is absent;
- rejects a dirty tracked worktree but ignores the user's untracked `.superpowers/` directory;
- creates one run-specific ignored staging root at `output/takram-orbital-production-staging/<run-id>/<stage>/` and records its clean capture commit/build/environment;
- writes an ignored `output/takram-orbital-production-staging/active-<stage>.json` pointer containing only that immutable run ID; every follow-up command reads the pointer and the resolver rejects a run/stage mismatch;
- allows a capture command to populate only that staging root and never create the corresponding formal stage directory;
- writes a schema-valid blank review template into staging, then requires a human-edited review with reviewer identity and no result boolean before resolve;
- rejects resolve when staging capture hashes, capture commit/build/environment, review schema, contact-sheet hashes, or resolver inputs mismatch;
- hashes every artifact and verifies byte length before formal publication;
- has the resolve command assemble a complete sibling temporary formal directory, fsync files, verify it, and rename exactly once;
- refuses to overwrite an existing formal stage directory;
- permits retry by creating a new run ID only while no formal stage exists; it never mutates or reuses a failed staging run;
- requires the immediately preceding checkpoint state for Stage 1, Stage 2, Stage 4A–D, final-stock, and V3;
- rejects old Stage B as an authorization input;
- prevents a terminal stage from publishing any successor directory but permits common Task 16 verification/closure.

- [ ] **Step 2: Reserve the exact ignored staging root**

Add this repository-root-anchored rule to `.gitignore`:

```gitignore
/output/takram-orbital-production-staging/
```

Do not replace it with a broader `output/` rule. Add a unit assertion for the exact pattern and verify Git applies it before any capture helper can create a staging run:

```bash
git check-ignore -q output/takram-orbital-production-staging/probe.json
git check-ignore -v output/takram-orbital-production-staging/probe.json
```

The first command must exit `0`; the second must identify the new root-anchored `.gitignore` rule. A failed ignore check blocks the harness before it writes a staging pointer or capture artifact.

- [ ] **Step 3: Implement exact environment collection**

Collect and normalize:

```text
git rev-parse HEAD
git status --porcelain --untracked-files=no
system_profiler SPHardwareDataType -json   -> chip must be Apple M4
sw_vers -productVersion                   -> exact macOS version
pmset -g batt                             -> AC Power
pmset -g custom                           -> lowpowermode 0
Google Chrome --version
WEBGL_debug_renderer_info                 -> ANGLE Metal renderer/vendor
window.innerWidth/innerHeight, exact 1440x960 canvas width/height, devicePixelRatio
document.visibilityState, document.hasFocus()
production asset/build fingerprint
```

Do not silently substitute a different macOS version, browser, hardware, build, CSS viewport, physical canvas size, DPR, or power state. Return a structured invalid-reason list consumed by the pure environment validator and compare the complete normalized object before every threshold-bearing and confirmation population.

- [ ] **Step 4: Implement reusable exact-frame capture functions**

The helper must expose typed functions for:

```ts
captureOrbitalPng(input: OrbitalCaptureRequest): Promise<OrbitalPngCapture>;
captureSampleCountReadback(
  input: OrbitalCaptureRequest
): Promise<TakramParitySampleCountReadback>;
capturePrimaryMarchReadback(
  input: OrbitalCaptureRequest
): Promise<TakramParityPrimaryMarchReadback>;
captureStageReadback(
  input: OrbitalCaptureRequest
): Promise<TakramParityStageReadbackCapture>;
captureTemporalFrames(
  input: OrbitalCaptureRequest & { nativeFrames: readonly [1, 2, 4, 8, 16, 32] }
): Promise<readonly OrbitalPngCapture[]>;
runGpuPopulation(input: OrbitalGpuPopulationRequest): Promise<TakramOrbitalGpuProfileSnapshot>;
createOrbitalStagingRun(
  input: OrbitalStagingRunInput
): Promise<OrbitalStagingRun>;
writeOrbitalReviewTemplate(
  input: OrbitalReviewTemplateInput
): Promise<string>;
verifyFreshCompleteRemount(
  before: TakramOrbitalAllocationGenerations,
  after: TakramOrbitalAllocationGenerations
): void;
verifyArtifactManifest(root: string): Promise<void>;
resolveAndPublishStageAtomically(
  input: OrbitalStageResolutionInput
): Promise<OrbitalStagePublicationResult>;
```

Every route waits for exact query attributes, `telemetry.active`, runtime/fingerprint parity, frame lock, native frame, fresh allocations, and the expected feature/output identity before reading pixels. Capture functions accept only an `OrbitalStagingRun`; only `resolveAndPublishStageAtomically()` accepts a formal destination. Human review is read from staging, validated, copied into the temporary complete package, and published together with raw captures, machine metrics, resolver checkpoint, and outcome in the one rename.

- [ ] **Step 5: Add a production-server System Chrome config**

Configure installed Chrome headed, one worker, `1440x960`, `deviceScaleFactor: 1`, video/tracing off, port `3117` by default, and `reuseExistingServer=false`. The config's web server command is exactly `pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3117`; it must not run `pnpm build`. It checks that `apps/site/.next/BUILD_ID` exists before starting and rejects headless execution, so every formal stage reuses the Task 11 production artifact.

Add the package script:

```json
"capture:takram-orbital-production": "playwright test -c playwright.takram-orbital-production-system-chrome.config.ts tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts --workers=1"
```

- [ ] **Step 6: Write non-publishing System Chrome contract tests**

Cover all four candidate routes at native frame `32`, candidate/feature/output remount allocation changes, diagnostic source restoration, feature-state primary evidence parity, total/stage mutual exclusion, exact pass identity/order, and rejection of an intentionally mismatched environment fixture. These tests must not create formal evidence.

- [ ] **Step 7: Run RED/GREEN verification**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts
pnpm build
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "route contract|remount|diagnostic teardown|GPU boundaries"
```

Expected: unit and headed System Chrome contract tests pass without writing `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy` or `takram-orbital-lookdev-v2`.

- [ ] **Step 8: Commit the harness before any formal capture**

```bash
git add tests/helpers/takramOrbitalProductionEvidence.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  playwright.takram-orbital-production-system-chrome.config.ts \
  .gitignore \
  package.json
git commit -m "test(lubirth): add orbital production evidence harness"
```

## Task 11: Verify the complete implementation before formal evidence

**Files:**
- No production-file changes expected
- Modify only failing implementation/test files discovered by these checks

- [ ] **Step 1: Run the complete focused unit suite**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionSampling.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevIdentity.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevRuntime.spec.ts \
  tests/unit/lubirthTakramSampleCountInstrumentation.spec.ts \
  tests/unit/lubirthTakramPrimaryMarchInstrumentation.spec.ts \
  tests/unit/lubirthTakramOrbitalSamplingMetrics.spec.ts \
  tests/unit/lubirthTakramV3MorphologyMetrics.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuSubmissionInstrumentation.spec.ts \
  tests/unit/lubirthTakramOrbitalProductionPolicy.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts \
  tests/unit/lubirthTakramOrbitalV3Compatibility.spec.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts
```

Expected: all tests pass with zero retries.

- [ ] **Step 2: Run historical regression suites**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalSamplingCausality.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevContract.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts \
  tests/unit/lubirthTakramOrbitalGpuProfiler.spec.ts
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts \
  tests/e2e/lubirth-takram-orbital-lookdev.spec.ts \
  --workers=1
```

Expected: historical causal evidence logic and old lookdev route tests still pass; no historical evidence root changes.

- [ ] **Step 3: Run static/build verification**

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm exec eslint \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramPrimaryMarchInstrumentation.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuSubmissionInstrumentation.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalV3Compatibility.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx \
  tests/helpers/takramOrbitalProductionEvidence.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts
pnpm build
git diff --check
```

- [ ] **Step 4: Fix any failure with a focused RED/GREEN commit**

For each failure, add or tighten the smallest reproducing test, verify it fails before the fix, implement the fix, rerun the focused and affected regression commands, and commit with a message naming the repaired gate. Do not weaken thresholds, environment identity, source anchors, or terminal precedence to make a test pass.

- [ ] **Step 5: Confirm the formal-capture precondition**

```bash
git status --porcelain --untracked-files=no
git rev-parse HEAD
```

Expected: no tracked changes and one recorded implementation commit for the Stage 0 manifest. The user's untracked `.superpowers/` remains untouched.

## Task 12: Execute Stage 0 and publish the capability gate

**Files:**
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/stage-0/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/checkpoint.json`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/manifest.json`

- [ ] **Step 1: Record the immutable production artifact identity**

Without rebuilding after Task 11, record:

```bash
git rev-parse HEAD
cat apps/site/.next/BUILD_ID
shasum -a 256 apps/site/.next/BUILD_ID
git status --porcelain --untracked-files=no
```

The helper stores `evidenceCommit`, `productionArtifactCommit`, build ID/fingerprint, and the complete Section 6 environment separately. All later GPU populations must reuse this build ID/fingerprint.

- [ ] **Step 2: Run the formal Stage 0 publisher**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-0 \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 0"
```

The test must verify all `93` causal artifacts, causal outcome/contract/commit readability, current causal resolver parity, query/runtime/fingerprint/camera parity, the exact Apple M4/System Chrome/production/viewport/power environment, and independent `8+8` total-only and stage-only smoke populations.

- [ ] **Step 3: Verify the published Stage 0 package**

```bash
node -e 'const fs=require("fs"); const p="docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/checkpoint.json"; const x=JSON.parse(fs.readFileSync(p,"utf8")); const pass=x.stage===0&&x.authorizedNextStage===1; const blocked=x.outcome==="ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED"; if(!pass&&!blocked) process.exit(1); console.log(blocked?x.outcome:"stage-1-authorized")'
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "verifies published manifest"
git diff --check
```

If the checkpoint is `ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED`, generate root `OUTCOME.md`, do not interpret candidate images, and proceed to Step 4 only to verify/commit the terminal package. Mark Tasks 13–15 `not-authorized-after-terminal`, then jump to Task 16.

- [ ] **Step 4: Verify and commit the Stage 0 checkpoint or terminal**

```bash
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy
git commit -m "docs(lubirth): publish orbital production Stage 0"
```

For a passed checkpoint continue to Task 13. For a setup-blocked terminal jump to Task 16 after this commit; Task 16 remains mandatory in both paths.

## Task 13: Execute Stage 1/2 and lock the healthy stock baseline

**Files:**
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/stage-1/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/stage-2/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy/baseline/**`
- Modify atomically: root `manifest.json`, `metrics.json`, `metric-decision.json`, `visual-review.json`, `checkpoint.json`, and `OUTCOME.md`

- [ ] **Step 1: Capture the full Stage 1 base/repeat matrix**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-1-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 1 capture"
```

For `control/fine/confirmed/coarse` at `0/0.06/0.12/0.18`, write base and fresh-mount repeat cloud-raw/off, sample-count PNG/lossless, primary-march PNG/lossless, lossless pre-temporal/resolved/final, stage-readback PNG, identities, camera height, labelled step estimates, and artifact hashes/lengths only to one new `stage-1` staging run. The capture command writes machine metrics—including `primaryCapSaturationFraction` and required diagnostic `noHitPrimaryCapSaturationFraction`—plus a blank review template and contact sheets; it must assert that the formal `stage-1` directory does not exist before and after capture.

- [ ] **Step 2: Derive Stage 1 metrics and create the bounded visual review**

The machine extractor writes staging `metrics.json` and `metric-decision.json`. Inspect the fixed candidate/progress contact sheets, then fill the staging `visual-review.json` with reviewer identity and only `coherentDensityField: 0|1|2`, `isolatedFragments: boolean`, and notes for each evidence-valid non-control progress; it must not contain sampling or outcome booleans. Set `MIRALITH_TAKRAM_ORBITAL_STAGING_RUN` to that exact run ID when resolving.

The sheets include the frozen NASA comparison board and Takram upstream reference using the hashes already locked by the old plan; a hash mismatch is setup-blocked.

Run:

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-1.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-1-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 1 resolve"
```

The resolve command rehashes the immutable staging capture, validates the review/contact sheets, runs the pure resolver, and performs the sole atomic publication of the complete formal Stage 1 directory. Expected: either an explicit setup/quality terminal or at least one sampling-healthy non-control candidate authorized for Stage 2. The `control` remains non-winning.

- [ ] **Step 3: Commit Stage 1 before GPU capture**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "Stage 1|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy
git commit -m "docs(lubirth): publish orbital production Stage 1"
```

If Stage 1 is terminal, mark Tasks 13 Steps 4–8 and Tasks 14–15 `not-authorized-after-terminal`, then jump to Task 16 after committing the terminal Stage 1 package. Otherwise confirm the original Task 11 production build ID still exists and matches; do not rebuild.

- [ ] **Step 4: Capture all required Stage 2 visual/readback states**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-2-diagnostics \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 2 diagnostics"
```

At every progress for every healthy candidate, capture required outputs under native and light-shafts-off, the four required outputs under bsm-off, and aerial-final under native into one Stage 2 staging run. Derive primary-signal parity from primary-march bytes, native-hit masks, and pre-temporal opacity using the Stage 1 same-candidate/same-progress repeat floors. Do not create the formal Stage 2 directory until the Stage 2 resolve command.

- [ ] **Step 5: Run the four independent `120+120` GPU populations**

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-2.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-2-gpu \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 2 GPU populations"
```

For each healthy candidate/progress run native total-only, light-shafts-off total-only, native stage-only, and light-shafts-off stage-only. Preserve every raw sample, no-op/copy/empty baseline, disjoint epoch, complete same-frame stage set, direct p95, BSM same-frame combined p95, same-frame stage-sum p95, and directional comparison. Only native/full total p95 enters `3/4 ms` classification.

- [ ] **Step 6: Run confirmation populations only when the resolver requests them**

If the initial machine decision marks a candidate as a possible decoupling authorization, run:

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-2.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-2-confirmation \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 2 confirmation"
```

This performs a second independent native/full and light-shafts-off/full `120+120` population at all four progresses. It must reproduce both sides of the complete budget-crossing predicate. Do not run or invent confirmation evidence for a candidate that the machine decision did not request.

- [ ] **Step 7: Resolve Stage 2 and Stage 3**

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-2.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-2-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 2 resolve"
```

The resolve command consumes the exact Stage 2 staging run, verifies all diagnostic/GPU/confirmation artifacts, and performs one atomic formal publication. If the pure resolver returns a Stage 2 terminal, publish root `OUTCOME.md` and proceed to Step 8 to verify/commit the terminal policy package; after that commit mark Tasks 14–15 `not-authorized-after-terminal` and jump to Task 16. If it returns `ORBITAL_PUBLIC_STEP_POLICY_WINNER`, publish the immutable Stage 3 baseline in the same atomic package and require `ORBITAL_HEALTHY_STOCK_BASELINE_READY` before any lookdev-v2 staging or formal directory can be created.

- [ ] **Step 8: Verify and commit the policy result**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-production-step-policy
git commit -m "docs(lubirth): publish orbital production policy"
```

## Task 14: Execute the fresh Stage 4A–4D lookdev funnel

**Files:**
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/stage-4a/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/stage-4b/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/stage-4c/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/stage-4d/**`

- [ ] **Step 1: Capture Stage 4A into a new staging run**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4a-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4A capture"
```

Capture `h40/h80/h120`, coverage `0.3`, vertical/optical `1`, all progresses, and fresh sample-count/primary-march/stage readbacks into staging. Derive setup/sampling evidence, `nativeHitPixelCount`, `preTemporalSignalPixelFraction`, both cap fractions, contact sheets, and a blank 4A review template. Assert the formal `stage-4a` directory still does not exist. Old Stage A images appear only as labelled historical controls.

- [ ] **Step 2: Complete the Stage 4A review and resolve once**

Edit only the staging `visual-review.json` named by `active-stage-4a.json`. Only candidates passing shared setup/sampling and the machine `nativeHitPixelCount>0` plus `preTemporalSignalPixelFraction>0` gate receive macro-coherence, opening-identity, and artifact-freedom scores.

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-4a.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4a-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4A resolve"
```

The resolve command validates immutable capture hashes and the bounded review, then atomically publishes formal Stage 4A exactly once. It cannot overwrite a formal directory.

- [ ] **Step 3: Verify and commit Stage 4A**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "stage chain|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital lookdev Stage 4A"
```

A terminal marks Steps 4–12 and Task 15 `not-authorized-after-terminal` and jumps to Task 16 after this commit. Otherwise continue only with the committed 4A survivors.

- [ ] **Step 4: Capture Stage 4B into a new staging run**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4b-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4B capture"
```

For each committed 4A survivor, capture coverage `0.3/0.4/0.45/0.55`, vertical/optical `1`, all progresses, shared evidence, both cap diagnostics, and the machine signal-presence fields into staging. Assert no formal Stage 4B directory exists.

- [ ] **Step 5: Complete the Stage 4B review and resolve once**

Review only machine-eligible candidates for macro coherence, coverage usability, opening identity, and artifact freedom; separation, depth, and lighting remain non-failing observations.

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-4b.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4b-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4B resolve"
```

The pure resolver keeps at most one coverage per morphology and two overall survivors, then atomically publishes once. It cannot overwrite a formal directory.

- [ ] **Step 6: Verify and commit Stage 4B**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "stage chain|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital lookdev Stage 4B"
```

A terminal marks Steps 7–12 and Task 15 `not-authorized-after-terminal` and jumps to Task 16 after this commit. Otherwise continue only with the committed 4B survivors.

- [ ] **Step 7: Capture Stage 4C into a new staging run**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4c-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4C capture"
```

Capture vertical `1/2/4`, optical `1`, all progresses, shared machine evidence, both cap diagnostics, contact sheets, and a blank five-dimension review into staging. Assert no formal Stage 4C directory exists.

- [ ] **Step 8: Complete the Stage 4C review and resolve once**

Edit only the staging review named by `active-stage-4c.json`, then run:

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-4c.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4c-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4C resolve"
```

The resolver atomically publishes Stage 4C exactly once; lighting/BSM is observation-only. It cannot overwrite a formal directory.

- [ ] **Step 9: Verify and commit Stage 4C**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "stage chain|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital lookdev Stage 4C"
```

A terminal marks Steps 10–12 and Task 15 `not-authorized-after-terminal` and jumps to Task 16 after this commit. Otherwise continue only with the committed 4C survivor.

- [ ] **Step 10: Capture Stage 4D into a new staging run**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4d-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4D capture"
```

Capture optical `0.75/1/1.5`, all progresses, shared evidence, both cap diagnostics, contact sheets, and the blank final six-dimension review into staging. Assert no formal Stage 4D directory exists.

- [ ] **Step 11: Complete the Stage 4D review and resolve once**

Edit only the staging review named by `active-stage-4d.json`, then run:

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-stage-4d.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=stage-4d-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal Stage 4D resolve"
```

Atomically publish Stage 4D exactly once. Publish either `ORBITAL_LOOKDEV_V2_OPTICAL_FAIL` or one exact `ORBITAL_STOCK_LOOKDEV_V2_WINNER`; never average parameters or add lighting/exposure compensation.

- [ ] **Step 12: Verify and commit Stage 4D**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "stage chain|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital lookdev Stage 4D"
```

An optical terminal marks Task 15 `not-authorized-after-terminal` and jumps to Task 16 after this commit. A committed stock winner authorizes Task 15. Every Stage 4 capture starts tracked-clean; no two formal Stage 4 packages share a dirty worktree, and no resolve reruns against an existing formal stage.

## Task 15: Replay final stock, classify cost, and resolve V3 compatibility

**Files:**
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/final-stock/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/v3-compatibility/stock/**`
- Create conditionally: `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2/v3-compatibility/v3/**`
- Modify atomically: lookdev-v2 root `manifest.json`, `checkpoint.json`, and `OUTCOME.md`

- [ ] **Step 1: Capture fresh final-stock evidence into staging**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=final-stock-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal final stock capture"
```

Capture full, cloud raw/off, sample-count, primary-march, pre-temporal, resolved, bsm-off, light-shafts-off, aerial-final, all progresses, and progress-`0.06` repeat into one staging run. Recompute setup/evidence, sampling decisions, `primaryCapSaturationFraction`, and `noHitPrimaryCapSaturationFraction` from fresh buffers; do not reuse Stage 4D decisions and do not create formal final-stock evidence yet.

- [ ] **Step 2: Resolve the non-publishing final-stock replay gate**

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-final-stock.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=final-stock-replay \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal final stock replay"
```

This command writes only the machine replay decision into staging. On setup/sampling failure, run:

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-final-stock.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=final-stock-resolve-terminal \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal final stock terminal resolve"
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "final stock|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital final-stock terminal"
```

That atomically publishes the complete terminal, after which Steps 3–9 are marked `not-authorized-after-terminal` and execution jumps to Task 16. On pass, the replay authorizes GPU capture but still creates no formal directory.

- [ ] **Step 3: Run final GPU populations in the passed staging run**

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-final-stock.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=final-stock-gpu \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal final stock GPU"
```

Reuse the Task 11 production artifact and exact environment, including macOS version and CSS/physical dimensions. Run native/full authoritative `120+120` total-only populations at all four progresses and derive the maximum-p95 classification in staging.

- [ ] **Step 4: Resolve and publish final-stock exactly once**

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-final-stock.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=final-stock-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal final stock resolve"
```

Verify the complete staging package and atomically publish formal final-stock evidence. Before starting V3, run:

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "final stock|verifies published manifest"
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital final-stock evidence"
```

Because replay passed, V3 is mandatory even if GPU classification is over-budget or performance-blocked. V3 capture must start from this tracked-clean commit.

- [ ] **Step 5: Capture the complete V3 stock/control matrix into staging**

```bash
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=v3-compatibility-capture \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal V3 compatibility capture"
```

For stock and V3, every progress gets fresh mounts, frames `1/2/4/8/16/32`, native-frame-32 full/cloud-raw/off/sample-count/primary-march/stage-readback/bsm-off/aerial-final, complete identities, adapter/texture hashes, both cap diagnostics, and a second byte-identical fresh-mount repeat. Write machine metrics, contact sheets, convergence strips, and a blank bounded review only to staging; assert no formal V3 compatibility directory exists.

- [ ] **Step 6: Complete the bounded V3 review**

Edit only the staging `visual-review.json` named by `active-v3-compatibility.json`. Fill the six per-progress scores, one sequence-stability score, enumerated flags/required notes, reviewer identity, clean capture commit, winner ID, viewport/DPR, progress, references, and contact-sheet hashes. Do not add PASS/FAIL or quantitative booleans.

- [ ] **Step 7: Resolve and atomically publish V3 compatibility once**

```bash
MIRALITH_TAKRAM_ORBITAL_STAGING_RUN="$(node -p 'require("./output/takram-orbital-production-staging/active-v3-compatibility.json").runId')" \
MIRALITH_TAKRAM_ORBITAL_PRODUCTION_CAPTURE=v3-compatibility-resolve \
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "formal V3 compatibility resolve"
```

The resolver rehashes staging, validates the review, derives one V3 terminal, and publishes the complete formal V3 directory plus machine-owned root `checkpoint.json` and `OUTCOME.md` in one atomic transaction.

- [ ] **Step 8: Verify every final artifact and completion-boundary combination**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  tests/unit/lubirthTakramOrbitalLookdevEvidence.spec.ts \
  tests/unit/lubirthTakramOrbitalV3Compatibility.spec.ts \
  --grep "published manifest|completion boundary|V3"
git diff --check
```

The root outcome must match one and only one Section 15 completion case. Production/query-only/over-budget/perf-blocked require a V3 terminal only after final-stock replay passed. Final-stock setup/sampling terminals require no V3 directory.

- [ ] **Step 9: Commit terminal evidence and continue to common closure**

```bash
git add docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-lookdev-v2
git commit -m "docs(lubirth): publish orbital production lookdev outcome"
```

After this commit, jump to Task 16. Do not treat the terminal publication itself as plan closure.

## Task 16: Run final regression verification and close the plan

**Files:**
- Modify only if verification exposes a defect
- Do not modify historical evidence roots

- [ ] **Step 1: Resolve and verify the outcome-aware closure topology**

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "outcome-aware closure"
```

The test locates the earliest committed terminal checkpoint in the production-policy or lookdev-v2 root, proves it is one of the spec completion outcomes, verifies every required artifact hash/length, and asserts that all downstream formal directories are absent unless authorized by that checkpoint. It accepts Stage 0/1/2/4/final-stock/V3 terminals, requires a V3 terminal only after final-stock replay passed, and emits the normalized terminal outcome plus the list of `not-authorized-after-terminal` tasks. Failure here blocks plan closure.

- [ ] **Step 2: Run all orbital unit tests**

```bash
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthTakram*.spec.ts
```

Expected: zero failures.

- [ ] **Step 3: Run relevant headed System Chrome suites**

```bash
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-parity.spec.ts \
  tests/e2e/lubirth-takram-orbital-lookdev.spec.ts \
  tests/e2e/lubirth-takram-orbital-sampling-causality.spec.ts \
  --workers=1
pnpm exec playwright test \
  -c playwright.takram-orbital-production-system-chrome.config.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts \
  --workers=1 --grep "route contract|remount|diagnostic teardown|GPU boundaries"
```

- [ ] **Step 4: Run typecheck, production build, targeted lint, and evidence verification**

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm build
pnpm exec eslint \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionSampling.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramPrimaryMarchInstrumentation.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalSamplingMetrics.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuSubmissionInstrumentation.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalGpuProfiler.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalProductionPolicy.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalLookdevEvidence.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramOrbitalV3Compatibility.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx \
  tests/helpers/takramOrbitalProductionEvidence.ts \
  tests/e2e/lubirth-takram-orbital-production-lookdev.spec.ts
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/lubirthTakramOrbitalProductionEvidence.spec.ts \
  --grep "verifies published manifest|outcome-aware closure"
git diff --check
```

- [ ] **Step 5: Verify scope preservation**

```bash
git diff --name-only cfa815c..HEAD
git status --short
```

Confirm no production `EarthMoonScene`, on-disk Takram shader, patch artifact, homepage route, or historical evidence root changed. Confirm only the user's original untracked `.superpowers/` remains outside tracked files.

- [ ] **Step 6: Record the final state**

Update the plan status only after all commands above pass and the outcome evidence exists. Record the terminal outcome, final commit, `OUTCOME.md` SHA-256, test counts, build/typecheck/lint results, and any explicitly out-of-scope follow-up. Do not start homepage promotion or shader decoupling in this plan.

- [ ] **Step 7: Commit the closed execution record**

```bash
git add docs/superpowers/plans/2026-08-13-lubirth-takram-orbital-production-sampling-and-lookdev.md
git commit -m "docs(lubirth): close orbital production lookdev plan"
git status --short
```

Expected: tracked worktree clean; only the user's original untracked `.superpowers/` may remain.

## Plan self-review checklist

| Spec section | Implemented by |
| --- | --- |
| 1–4 decision, evidence, scope | Execution invariants and Tasks 1–2 |
| 5 production step contract | Tasks 1–2 |
| 6 diagnostic/GPU separation | Tasks 3, 5, and 9 |
| 7 Stage 0–3 policy funnel | Tasks 4, 6, 12, and 13 |
| 7 Stage 4A–4D funnel | Tasks 7 and 14 |
| 8 V2 visual acceptance | Tasks 7 and 14 |
| 9 final stock evidence/cost | Tasks 7 and 15 |
| 10 V3 compatibility | Tasks 8 and 15 |
| 11 evidence architecture | Tasks 10 and 12–15 |
| 12 runtime identity/failures | Tasks 2, 6, 7, 8, and 9 |
| 13 implementation boundaries | File structure and Tasks 1–10 |
| 14 test strategy | Tasks 1–11 and 16 |
| 15 completion boundary | Tasks 7, 8, 15, and 16 |

- [ ] Every spec Section 1–15 maps to at least one task above.
- [ ] Historical causal resolver and evidence remain immutable.
- [ ] Stage 1 cap health comes only from direct primary-march entry/loop/cap values.
- [ ] GPU totals begin before BSM current and end after the exact combined final EffectPass; whole-composer timing cannot classify.
- [ ] Full/light-shafts-off total and stage populations are independent, same-environment, and non-nested.
- [ ] Setup/structural failures precede sampling-health and visual outcomes in Stage 1, Stage 4, final-stock, and V3.
- [ ] Every Stage 4 candidate/progress and the final-stock replay recompute cap health.
- [ ] V3 starts only after final-stock replay passes and has a pure setup/metric/visual resolver.
- [ ] No capture test or visual review can handwrite a quantitative or terminal verdict.
- [ ] Every formal stage starts tracked-clean, writes atomically, verifies hashes/lengths, commits, and gates its successor.
- [ ] No code or evidence path in this plan changes the homepage or authorizes an unreviewed shader patch.
