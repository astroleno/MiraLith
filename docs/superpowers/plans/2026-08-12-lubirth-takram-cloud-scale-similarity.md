# LuBirth Takram Cloud Scale Similarity Implementation Plan

> **For agentic workers:** REQUIRED SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Execute inline in the current worktree unless the user explicitly authorizes agents.

**Goal:** Implement the approved `PUBLIC_PARAMETER_SIMILARITY` architecture, run the stock-first `S=80/120/160` visual funnel, and produce an auditable checkpoint without unlocking Task 0P or the original Task 0–8.

**Architecture:** A pure project-owned resolver derives the complete cloud contract from one scale and one coverage mode. Stock and V3 both receive the same explicit scaled Takram R/G/B/A layers and the same native renderer settings; only weather-adapter fields may differ. Runtime readback, fingerprinting, and temporal history verify the applied contract before any evidence is accepted.

**Tech Stack:** TypeScript, React 19, React Three Fiber, Three.js, `@takram/three-clouds@0.7.6`, Playwright unit runner, headed System Chrome, existing query-only Takram parity route.

**Design source:** `docs/superpowers/specs/2026-08-12-lubirth-takram-cloud-scale-similarity-design.md`

**Execution status (2026-08-12):** Tasks 1–6 completed through the first valid stop condition. The resolver, route validation, runtime apply/readback, explicit stock/V3 layer parity, schema-4 fingerprint, history reset, atomic capture harness, and clean-HEAD Stage A evidence are complete. `S=80/120/160` all failed the stock visual floor, so the checkpoint is `PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_MIP_UNPROVEN`; Tasks 7–8 and Conditional Task M were not executed. Task 0P and the original Task 0–8 remain locked.

---

## Execution boundary

- Work only in `codex/lubirth-planetary-cloud-microbench`.
- Preserve the native `CloudsEffect → temporal resolve → AerialPerspectiveEffect` path.
- Do not edit homepage/product routes, replace the renderer, or silently fall back to legacy `260/40 km` candidates.
- Do not implement `mipDistanceScale` during the public-parameter run. It is a separately authorized conditional task only after all stock candidates fail and native mip evidence proves the trigger.
- Do not run the paused sample-budget A/B, Task 0P, Task 3–6, or original Task 0–8.
- Commit and push after each coherent task group.

## Task 1: Freeze the official source contract and pure scale resolver

**Files:**

- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleDefaults.ts`
- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleContract.ts`
- Create: `tests/unit/lubirthTakramCloudScaleContract.spec.ts`

### Step 1: Write the failing resolver tests

Cover all approved invariants, not only three snapshots:

```ts
test("resolves the complete official layer array for every public scale", async () => {
  const contract = await loadContract();
  for (const scale of [80, 120, 160] as const) {
    const resolved = contract.resolveTakramCloudScaleContract({
      scale,
      coverageMode: "parity"
    });

    expect(resolved.classification).toBe("PUBLIC_PARAMETER_SIMILARITY");
    expect(resolved.coverage).toBe(0.3);
    expect(resolved.layers).toHaveLength(4);
    expect(resolved.layers.map((layer) => layer.channel)).toEqual(["r", "g", "b", "a"]);
    expect(resolved.layers[3].height).toBe(0);
    expect(resolved.layers[3].densityScale).toBeCloseTo(0.2 / scale);
    for (let index = 0; index < 4; index += 1) {
      expect(resolved.layers[index].height * resolved.layers[index].densityScale)
        .toBeCloseTo(contract.TAKRAM_CLOUD_SCALE_DEFAULTS.layers[index].height *
          contract.TAKRAM_CLOUD_SCALE_DEFAULTS.layers[index].densityScale);
    }
  }
});

test("scales every dimensional public field and freezes every required fixed field", async () => {
  const contract = await loadContract();
  const resolved = contract.resolveTakramCloudScaleContract({
    scale: 80,
    coverageMode: "presentation"
  });

  expect(resolved.coverage).toBe(0.55);
  expect(resolved.shapeRepeat).toBeCloseTo(0.0003 / 80);
  expect(resolved.shapeDetailRepeat).toBeCloseTo(0.006 / 80);
  expect(resolved.turbulenceDisplacement).toBe(350 * 80);
  expect(resolved.clouds).toMatchObject({
    minStepSize: 50 * 80,
    maxStepSize: 1_000 * 80,
    maxRayDistance: 200_000 * 80,
    minSecondaryStepSize: 100 * 80,
    minShadowLengthStepSize: 50 * 80,
    maxShadowLengthRayDistance: 200_000 * 80,
    minDensity: 1e-5,
    minExtinction: 1e-5 / 80,
    secondaryStepScale: 2
  });
  expect(resolved.shadow).toMatchObject({
    minStepSize: 100 * 80,
    maxStepSize: 1_000 * 80,
    minDensity: 1e-5,
    minExtinction: 1e-5 / 80
  });
  expect(resolved.mipDistancePatch).toEqual({ active: false, scale: 1 });
});
```

Also assert:

- default values exactly match Takram `0.7.6` high defaults;
- the R/G/B/A density profile is explicitly `(0, 0, 0.75, 0.25)`;
- official layer altitude and dimensionless values stay fixed;
- shape/detail hierarchy remains `20:1`;
- `parity=0.3`, `presentation=0.55`;
- invalid scales and modes return no contract through typed parsers;
- results and nested arrays are immutable;
- atmosphere overflow is computed from runtime bottom/top radii and reports `G` at `S=80`, then `R/G/B` at `S=120/160`.

### Step 2: Run the test and verify RED

Run:

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramCloudScaleContract.spec.ts
```

Expected: FAIL because the two contract modules do not exist.

### Step 3: Implement the complete project-owned defaults

`TakramCloudScaleDefaults.ts` must contain literal frozen source values from Takram `0.7.6`; it must not import mutable upstream singleton objects:

```ts
export const TAKRAM_CLOUD_SCALE_VALUES = [80, 120, 160] as const;
export const TAKRAM_CLOUD_SCALE_COVERAGE = Object.freeze({
  parity: 0.3,
  presentation: 0.55
});

export const TAKRAM_CLOUD_SCALE_DEFAULTS = deepFreeze({
  source: {
    package: "@takram/three-clouds",
    version: "0.7.6",
    qualityPreset: "high"
  },
  shapeRepeat: 0.0003,
  shapeDetailRepeat: 0.006,
  turbulenceDisplacement: 350,
  layers: [
    { channel: "r", altitude: 750, height: 650, densityScale: 0.2, shapeAmount: 1, shapeDetailAmount: 1, weatherExponent: 1, shapeAlteringBias: 0.35, coverageFilterWidth: 0.6, densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0.75, constantTerm: 0.25 }, shadow: true },
    { channel: "g", altitude: 1_000, height: 1_200, densityScale: 0.2, shapeAmount: 1, shapeDetailAmount: 1, weatherExponent: 1, shapeAlteringBias: 0.35, coverageFilterWidth: 0.6, densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0.75, constantTerm: 0.25 }, shadow: true },
    { channel: "b", altitude: 7_500, height: 500, densityScale: 0.003, shapeAmount: 0.4, shapeDetailAmount: 0, weatherExponent: 1, shapeAlteringBias: 0.35, coverageFilterWidth: 0.5, densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0.75, constantTerm: 0.25 }, shadow: false },
    { channel: "a", altitude: 0, height: 0, densityScale: 0.2, shapeAmount: 1, shapeDetailAmount: 1, weatherExponent: 1, shapeAlteringBias: 0.35, coverageFilterWidth: 0.6, densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0.75, constantTerm: 0.25 }, shadow: false }
  ],
  clouds: {
    maxIterationCount: 500,
    minStepSize: 50,
    maxStepSize: 1_000,
    maxRayDistance: 200_000,
    perspectiveStepScale: 1.01,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minTransmittance: 1e-2,
    maxIterationCountToGround: 3,
    maxIterationCountToSun: 2,
    minSecondaryStepSize: 100,
    secondaryStepScale: 2,
    maxShadowLengthIterationCount: 500,
    minShadowLengthStepSize: 50,
    maxShadowLengthRayDistance: 200_000
  },
  shadow: {
    cascadeCount: 3,
    mapSize: [512, 512],
    maxIterationCount: 50,
    minStepSize: 100,
    maxStepSize: 1_000,
    minDensity: 1e-5,
    minExtinction: 1e-5,
    minTransmittance: 1e-4
  }
});
```

Implement a local recursive `deepFreeze` so every nested object/array is immutable.

### Step 4: Implement the pure resolver and atmosphere report

Expose these APIs from `TakramCloudScaleContract.ts`:

```ts
export type TakramCloudScale = 80 | 120 | 160;
export type TakramCloudCoverageMode = "parity" | "presentation";
export type TakramCloudScaleClassification = "PUBLIC_PARAMETER_SIMILARITY";

export function parseTakramCloudScale(value: string | null): TakramCloudScale | null;
export function parseTakramCloudCoverageMode(value: string | null): TakramCloudCoverageMode | null;
export function resolveTakramCloudScaleContract(input: {
  scale: TakramCloudScale;
  coverageMode: TakramCloudCoverageMode;
}): Readonly<TakramCloudScaleContract>;
export function resolveTakramCloudScaleAtmosphereDomain(input: {
  contract: TakramCloudScaleContract;
  bottomRadius: number;
  topRadius: number;
}): Readonly<TakramCloudScaleAtmosphereDomain>;
```

The resolver must calculate every value from `TAKRAM_CLOUD_SCALE_DEFAULTS`; it must contain no scale-specific branches except validating the allowed scale tuple.

### Step 5: Run GREEN and related tests

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  lubirthTakramCloudScaleContract.spec.ts \
  lubirthTakramParityContract.spec.ts \
  lubirthTakramParityV3Adapter.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
```

Expected: all pass.

### Step 6: Commit and push

```bash
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleDefaults.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleContract.ts \
  tests/unit/lubirthTakramCloudScaleContract.spec.ts
git commit -m "feat(lubirth): resolve Takram cloud scale contract"
git push
```

## Task 2: Add typed route validation and history identity

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `apps/site/components/LuBirthTakramParitySpikeClient.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `tests/unit/lubirthTakramParityContract.spec.ts`

### Step 1: Write failing route and epoch tests

Add table tests for:

```text
view=opening&input=stock&cloudScale=80&cloudCoverage=parity       -> valid
view=opening&input=v3&cloudScale=160&cloudCoverage=presentation   -> valid
view=control&cloudScale=80&cloudCoverage=parity                   -> cloud-scale-requires-opening
view=opening&cloudScale=81&cloudCoverage=parity                   -> unknown-cloud-scale
view=opening&cloudScale=80                                       -> cloud-scale-requires-coverage-mode
view=opening&cloudCoverage=parity                                 -> cloud-coverage-requires-scale
view=opening&cloudScale=80&cloudCoverage=parity&morphologyView=opening -> conflicting-scale-contracts
```

Extend the history epoch test so scale, coverage mode, coverage value, and mip patch state each change the epoch hash.

### Step 2: Run RED

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramParityContract.spec.ts
```

Expected: the new query and history fields are missing.

### Step 3: Implement query propagation

Add to the successful query type:

```ts
cloudScale?: TakramCloudScale;
cloudCoverageMode?: TakramCloudCoverageMode;
```

Add typed failure reasons exactly matching the table. Pass these props through the client → scene → pipeline chain. Add `data-cloud-scale` and `data-cloud-coverage` to the query route root.

### Step 4: Extend the immutable history epoch

Add:

```ts
cloudScale: number | null;
cloudCoverageMode: string | null;
cloudCoverage: number | null;
mipDistancePatchActive: boolean;
```

The pipeline must put the resolved scale contract into the epoch before the exact-frame counter advances. A scale/mode change must clear first-frame capture, matched-frame capture, native frame count, and stage readback.

### Step 5: Verify and commit

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramParityContract.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
git diff --check
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx \
  apps/site/components/LuBirthTakramParitySpikeClient.tsx \
  tests/unit/lubirthTakramParityContract.spec.ts
git commit -m "feat(lubirth): route Takram cloud scale candidates"
git push
```

## Task 3: Apply and read back the complete native runtime contract

**Files:**

- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleRuntime.ts`
- Create: `tests/unit/lubirthTakramCloudScaleRuntime.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`

### Step 1: Write failing runtime tests

Use a small fake native object containing the same public property/uniform shape as `CloudsEffect`. Assert:

- every scale-owned Clouds and Shadow value is applied;
- `turbulenceDisplacement` is applied;
- min extinction is applied to both materials;
- min density, iteration counts, `secondaryStepScale`, cascade count/map size, and filter radius remain official;
- readback reproduces the complete resolved contract;
- changing any non-adapter field changes the fingerprint;
- normalizing only weather-adapter identity preserves a stock/V3 match;
- missing runtime fields produce explicit drift entries rather than disappearing.

### Step 2: Run RED

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramCloudScaleRuntime.spec.ts
```

### Step 3: Implement runtime application/readback

Expose:

```ts
export function applyTakramCloudScaleRuntime(
  clouds: CloudsEffect,
  contract: TakramCloudScaleContract
): void;

export function readTakramCloudScaleRuntime(
  clouds: CloudsEffect,
  contract: TakramCloudScaleContract
): TakramCloudScaleRuntimeReadback;

export function diffTakramCloudScaleRuntime(
  expected: TakramCloudScaleContract,
  actual: TakramCloudScaleRuntimeReadback
): readonly TakramCloudScaleRuntimeDrift[];
```

Apply public `CloudsEffect` properties where available. For material-only uniforms, use the already-audited `clouds.cloudsPass.currentMaterial.uniforms` and `clouds.shadowPass.currentMaterial.uniforms`; do not patch shader source. Reapply after resource generation, scale/mode change, and native effect recreation.

### Step 4: Extend runtime fingerprint schema

Bump the fingerprint schema and include runtime-read fields:

- scale/classification/coverage/mip patch state;
- complete R/G/B/A layer values including density profile;
- shape/detail repeat and turbulence displacement;
- all scale-owned Clouds/Shadow step, ray, density, extinction fields;
- fixed fields needed to prove no renderer drift.

Do not omit layers as adapter-owned under the new scale route. Only weather texture/mapping/repeat/offset/wrap/hash may be normalized for stock/V3 comparison.

### Step 5: Verify and commit

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  lubirthTakramCloudScaleRuntime.spec.ts \
  lubirthTakramCloudScaleContract.spec.ts \
  lubirthTakramParityContract.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
git diff --check
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramCloudScaleRuntime.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts \
  tests/unit/lubirthTakramCloudScaleRuntime.spec.ts
git commit -m "feat(lubirth): apply Takram cloud scale runtime"
git push
```

## Task 4: Replace legacy scale candidates with explicit stock/V3 layer parity

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityV3Layers.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `tests/unit/lubirthTakramParityV3Adapter.spec.ts`
- Modify: `tests/unit/lubirthTakramCloudScaleRuntime.spec.ts`

### Step 1: Write failing explicit-layer parity tests

Assert the scale route:

- sets `disableDefaultLayers=true` for both stock and V3;
- renders exactly four explicit resolver layers for both inputs;
- retains official empty A layer for V3;
- never imports/uses `TAKRAM_PARITY_V3_LAYERS` or `TAKRAM_PARITY_V3_OPENING_PRESET` as its scaled layer source;
- reports equal layer arrays and normalized fingerprints for stock/V3 at the same scale/mode;
- reports the only allowed differences under `adapter`.

### Step 2: Run RED

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  lubirthTakramParityV3Adapter.spec.ts \
  lubirthTakramCloudScaleRuntime.spec.ts
```

### Step 3: Render the resolver layers for both inputs

For a scale route, the JSX boundary must be equivalent to:

```tsx
<Clouds
  ref={setCloudsRef}
  coverage={scaleContract.coverage}
  disableDefaultLayers
  globalWeatherMapping={adapter.globalWeatherMapping}
  localWeatherTexture={runtimeAssets.localWeather}
  qualityPreset="high"
  shapeDetailTexture={runtimeAssets.shapeDetail}
  shapeTexture={runtimeAssets.shape}
  stbnTexture={runtimeAssets.stbn}
  turbulenceTexture={runtimeAssets.turbulence}
>
  {scaleContract.layers.map((layer, index) => (
    <TakramCloudLayer key={layer.channel} index={index} {...layer} />
  ))}
</Clouds>
```

The existing unscaled control and historical morphology routes remain reproducible. They cannot mix with `cloudScale` and are excluded from the new checkpoint.

### Step 4: Publish contract telemetry

Add requested/readback telemetry for the full contract, runtime drift list, atmosphere bottom/top radii, overflow channels, mip state, and normalized parity hash. `active` must stay false while drift is non-empty.

### Step 5: Verify and commit

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  lubirthTakramCloudScaleContract.spec.ts \
  lubirthTakramCloudScaleRuntime.spec.ts \
  lubirthTakramParityContract.spec.ts \
  lubirthTakramParityV3Adapter.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
git diff --check
git add packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramParityV3Layers.ts \
  packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts \
  tests/unit/lubirthTakramParityV3Adapter.spec.ts \
  tests/unit/lubirthTakramCloudScaleRuntime.spec.ts
git commit -m "feat(lubirth): enforce stock V3 scaled layer parity"
git push
```

## Task 5: Add browser-level contract and exact-frame regressions

**Files:**

- Create: `tests/e2e/lubirth-takram-cloud-scale.spec.ts`
- Modify: `playwright.takram-parity-system-chrome.config.ts` only if the current matcher excludes the new file

### Step 1: Write the browser regressions

Test all scale/mode/input query combinations without evidence writes:

- route rejection matrix;
- runtime readback has zero drift;
- both inputs expose the same four explicit layers;
- stock/V3 normalized hashes match at each shared scale/mode;
- changing input changes only adapter fields;
- changing scale, coverage mode, input, diagnostic, or resource generation creates a new history epoch and exact `nativeFrameCount=1` capture;
- control and legacy morphology routes retain their old fingerprints/behavior;
- `window.__MiraLithTakramParity` records atmosphere overflow and `physicalAerialPerspectiveParityClaim=false`.

### Step 2: Run targeted headed System Chrome

```bash
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  lubirth-takram-cloud-scale.spec.ts --headed
```

Expected: all browser contracts pass. Fix runtime contract drift before visual capture; do not weaken assertions.

### Step 3: Run production build and commit

```bash
pnpm --filter @miralith/site build
git diff --check
git add tests/e2e/lubirth-takram-cloud-scale.spec.ts \
  playwright.takram-parity-system-chrome.config.ts
git commit -m "test(lubirth): verify Takram cloud scale runtime"
git push
```

## Task 6: Run Stage A stock visual funnel

**Files:**

- Modify: `tests/e2e/lubirth-takram-cloud-scale.spec.ts`
- Create: `tests/helpers/takramCloudScaleEvidence.ts`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale/README.md`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale/manifest.json`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale/checkpoint.json`
- Create: Stage A PNG/contact sheets under the same evidence directory

### Step 1: Add an atomic capture mode

Only write formal evidence when:

```text
MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE=1
```

Normal regressions must use the Playwright output directory or in-memory assertions. Write PNGs, manifest, hashes, contact sheets, and checkpoint through one staging directory and rename only after every artifact validates.

### Step 2: Capture the 12-frame minimal stock matrix

Run stock, coverage `0.3`, full output:

```text
S=80,120,160 × progress=0.00,0.06,0.12,0.18
```

Each record includes query, commit, browser executable/version, GPU vendor/renderer, viewport/DPR, exact native frame/jitter/STBN/history epoch, asset hashes, complete requested/readback contract, runtime drift, atmosphere radii/overflow, screenshot hash, and reproducible command.

### Step 3: Perform visual review

Review full-size source frames, not only contact sheets. For each scale and progress, record:

- coherent macro masses;
- cloud/ground separation or limb elevation;
- soft opacity layering;
- lit/backlit variation and local BSM modulation;
- motion identity across progress;
- salt-and-pepper fragmentation.

Projected size, signal presence, or automated metrics cannot mark PASS.

### Step 4: Write the Stage A checkpoint

Allowed states:

```text
PUBLIC_PARAMETER_SIMILARITY_STOCK_PASS
PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_MIP_UNPROVEN
```

If at least one scale passes, list it in `stockPassingScales` and continue to Task 7.

If all fail, stop before V3 and do not implement the mip patch. Record `PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_MIP_UNPROVEN`; only Task M becomes eligible for a separate diagnostic execution.

### Step 5: Verify artifacts and commit

```bash
MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE=1 \
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  lubirth-takram-cloud-scale.spec.ts --headed --grep "Stage A"
pnpm exec playwright test -c playwright.unit.config.ts lubirthTakramCloudScaleContract.spec.ts
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale \
  tests/e2e/lubirth-takram-cloud-scale.spec.ts \
  tests/helpers/takramCloudScaleEvidence.ts
git commit -m "test(lubirth): capture stock cloud scale funnel"
git push
```

## Task 7: Run Stage B/C stock–V3 parity funnel

**Precondition:** `stockPassingScales` is non-empty.

**Files:**

- Modify: `tests/e2e/lubirth-takram-cloud-scale.spec.ts`
- Modify: `tests/helpers/takramCloudScaleEvidence.ts`
- Modify: evidence README/manifest/checkpoint and add Stage B/C PNG/contact sheets

### Step 1: Capture Stage B

For only the stock-passing scales, capture stock and V3 at coverage `0.3` for all four opening progresses. Reject a population before visual review if runtime drift is non-empty or normalized fingerprints differ.

Allowed failure:

```text
V3_WEATHER_ADAPTER_PARITY_FAIL
```

### Step 2: Capture Stage C

For presentation-eligible scales only, capture stock and V3 at coverage `0.55` for all four progresses. Compare stock and V3 within the same coverage population.

Allowed failure:

```text
PRESENTATION_COVERAGE_FAIL
```

### Step 3: Record the presentation winner

A winner records scale, coverage, stock/V3 visual decisions, exact contract hashes, and the explicit limitation:

```text
physicalAerialPerspectiveParityClaim=false
presentationDomain="artistic-orbital"
```

Do not call it official physical Takram parity.

### Step 4: Verify and commit

```bash
MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE=1 \
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  lubirth-takram-cloud-scale.spec.ts --headed --grep "Stage B|Stage C"
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale \
  tests/e2e/lubirth-takram-cloud-scale.spec.ts \
  tests/helpers/takramCloudScaleEvidence.ts
git commit -m "test(lubirth): capture V3 cloud scale parity funnel"
git push
```

## Task 8: Revalidate the winner with existing exact-frame diagnostics

**Precondition:** Stage B/C has a visual winner.

**Files:**

- Modify: `tests/e2e/lubirth-takram-cloud-scale.spec.ts`
- Modify: evidence README/manifest/checkpoint; add diagnostic artifacts

### Step 1: Capture winner-only matched populations

Reuse existing instrumentation for:

- `full`, `cloud-raw`, `cloud-raw-off`, `bsm-off`;
- native hit/sample count;
- pre-temporal, resolved history/AerialPerspective input, final output;
- exact frame/jitter/STBN/history metadata;
- repeat capture noise floor.

All A/B comparisons must use the same immutable epoch and exact frame. Final framebuffer claims use cloud-on minus cloud-off. BSM metrics use a cloud-only mask.

### Step 2: Write the final similarity checkpoint

The checkpoint independently records:

- stock visual decision;
- V3 visual decision;
- presentation coverage decision;
- renderer parity decision;
- atmosphere presentation-domain limitation;
- whether Task 0P remains locked.

This plan does **not** unlock Task 0P. A later amendment may do so only after the formal evidence passes.

### Step 3: Full verification and commit

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  lubirthTakramCloudScaleContract.spec.ts \
  lubirthTakramCloudScaleRuntime.spec.ts \
  lubirthTakramParityContract.spec.ts \
  lubirthTakramParityV3Adapter.spec.ts
pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts \
  lubirth-takram-cloud-scale.spec.ts --headed
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site build
git diff --check
git add docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale \
  tests/e2e/lubirth-takram-cloud-scale.spec.ts
git commit -m "docs(lubirth): record cloud scale similarity checkpoint"
git push
```

## Task 9: Synchronize active plan entry points and graph

**Files:**

- Modify: `docs/superpowers/plans/2026-08-05-lubirth-planetary-volumetric-cloud-spike.md`
- Modify: `docs/superpowers/plans/2026-08-09-lubirth-takram-v3-scale-and-morphology.md`
- Modify: `graphify-out/graph.json` and generated graph report only if `/graphify --update` is available and changes are structural

### Step 1: Update plan status without rewriting history

Link this implementation plan and evidence checkpoint from both older plans. Mark `260/40 km` and sample-budget A/B as superseded historical paths. Keep Task 3–6, Task 0P, and original Task 0–8 locked unless a later explicit amendment changes them.

### Step 2: Update graph if available

```bash
/graphify --update
```

If `/graphify` is unavailable in the worktree environment, record that fact; do not delete or hand-edit generated graph data.

### Step 3: Commit and push

```bash
git diff --check
git add docs/superpowers/plans/2026-08-05-lubirth-planetary-volumetric-cloud-spike.md \
  docs/superpowers/plans/2026-08-09-lubirth-takram-v3-scale-and-morphology.md
git commit -m "docs(lubirth): sync cloud scale execution status"
git push
```

## Conditional Task M: Diagnose and narrowly patch primary-march mip distance

**Do not execute unless Task 6 records all three stock scales failing and the user authorizes continuation into the diagnostic.**

1. Add native mip-level readback for cloud-hit pixels at exact matched frames.
2. Prove or disprove premature mip escalation against the same stock populations.
3. If disproved, leave state `PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_MIP_UNPROVEN` and stop.
4. If proved, write a failing package-patch test, introduce only `mipDistanceScale`, replace the one primary-march `rayDistance * 1e-5` coefficient, resolve it as `1e-5 / S`, and fingerprint the patch separately.
5. Re-run stock-only Stage A. Only after this A/B may the state become `PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_AFTER_MIP_CORRECTION` or `PUBLIC_PARAMETER_SIMILARITY_STOCK_PASS`.

The conditional patch may not change layers, weather, shape/detail repeats, turbulence, density, sampling budgets, light, BSM, temporal, atmosphere, exposure, or output transform.

---

## Completion condition

This implementation plan is complete when either:

1. a stock/V3 presentation winner has passed the winner-only exact-frame revalidation and the checkpoint still explicitly locks Task 0P pending a later amendment; or
2. the stock-first funnel reaches a correctly evidenced stop state and no unauthorized downstream work has run.
