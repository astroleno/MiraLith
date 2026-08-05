# LuBirth Planetary Cloud Task -1R Representation Amendment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use task checkboxes for tracking.

**Goal:** 修复 disposable microbench 的光线路径与表示层，使它只检验“V3 可否作为 Takram-first 系统的宏观天气输入”，而不把平面径向挤出误判为 V3 或 Takram 的否决证据。

**Architecture:** 保留 Task -1 已通过的 Earth-local→ECEF bridge、world-depth、RGBA16F/HDR 与单次 sRGB 输出。新的 raymarch 仍是 query-only evidence harness：V3 R 仅提供宏观 coverage，确定性 3D base-shape field 负责 cloudlet occupancy remap，垂直 profile 负责 base/core/top；不新增 Takram、remote asset、temporal、adaptive、BSM 或共享 composer。太阳光的 secondary ray 以 cloud-base/outer shell 的真实正向区间为上限，遇到 cloud base 即停止，避免穿过地球到对侧球壳。

**Tech Stack:** TypeScript、Three.js/R3F、GLSL、Playwright、现有 V3 PNG、现有 microbench evidence route。

---

## Locked scope and decision vocabulary

- `EARLY_REPRESENTATION_FAIL` 只表示本 disposable representation 未通过视觉门，不能被解释为 Takram-first 或 V3 失败。
- V3 的 `R` 是唯一宏观 weather/coverage source；`G/B/A` 继续只控制 cloud top/morphology/concavity。3D base-shape 不能引入新的宏观天气图、remote asset 或 production export。
- 3D base-shape 采用 shader 内确定性、无缝 ECEF-domain field，并以 coverage threshold remap；detail erosion、turbulence、time animation 都关闭。
- 只有至少一个 case 经人工 visual review 通过后，才用既有 120 warmup + 120 valid-frame GPU 窗口。visual fail 时不启动正式 GPU 采样。
- Task 0–8、Takram 安装、默认首页、共享 composer、temporal/adaptive/BSM 仍不在本 amendment 范围内。

## File map

- `packages/lubirth-hero/src/planetaryCloud/planetaryCloudMath.ts`：可测试的 cloud-shell 区间纯函数，供 CPU depth probe 与 shader contract oracle 使用。
- `packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchShader.ts`：真实 to-sun interval、3D base-shape remap、vertical profile、最小 HG + sky fill 与守恒累积。
- `packages/lubirth-hero/src/planetaryCloud/microbench/LuBirthCloudShellMicrobench.tsx`：CPU probe 与 GPU shell 逻辑一致；不改变 pipeline owner 或 RT 拓扑。
- `packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchContract.ts`：表示失败与 infra early kill 的决策区分。
- `tests/unit/lubirthPlanetaryCloudMicrobenchMath.spec.ts`：先锁 radial/oblique/tangent secondary-ray bounds 与 inside-inner depth branch，再锁 shader source contract。
- `tests/e2e/lubirth-planetary-cloud-microbench.spec.ts`：复用 fixed opening capture，附加 Task -1R evidence identifier / telemetry 验证。
- `docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/*`：保留 Task -1 已通过的 coordinate/HDR/gamma evidence，并记录 Task -1R capture 与 conditional GPU gate。

---

### Task 1: Lock shell-segment and checkpoint contracts

**Files:**
- Modify: `tests/unit/lubirthPlanetaryCloudMicrobenchMath.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/planetaryCloudMath.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchContract.ts`

- [x] **Step 1: Write failing pure-math and decision tests.** Extend the test module declarations, then add these assertions:

```ts
expect(math!.resolveForwardCloudShellLightDistance(
  new Vector3(11, 0, 0), new Vector3(1, 0, 0), 10, 20
)).toBeCloseTo(9, 6);
expect(math!.resolveForwardCloudShellLightDistance(
  new Vector3(11, 0, 0), new Vector3(0, 1, 0), 10, 20
)).toBeCloseTo(Math.sqrt(279), 6);
expect(math!.resolveCloudShellWorldSegment(
  { near: -8, far: 12 }, { near: -4, far: 3 }
)).toEqual({ enter: 3, exit: 12 });
expect(contract!.resolveCloudShellMicrobenchCheckpoint({
  coordinatePass: true, hdrColorPass: true, microVisualPass: false,
  timerSupported: true, visualPassingCaseP95Ms: []
})).toBe("EARLY_REPRESENTATION_FAIL");
```

- [x] **Step 2: Verify RED.**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthPlanetaryCloudMicrobenchMath.spec.ts`

Expected: FAIL because the two cloud-shell helpers and reclassified decision do not yet exist.

- [x] **Step 3: Implement the minimal shared math.** Export `resolveCloudShellWorldSegment(outer, inner)` that mutates `enter` (not `exit`) when the ray begins inside inner sphere. Export `resolveForwardCloudShellLightDistance(origin, direction, cloudBaseRadius, outerRadius)` that uses both sphere intervals, retains the first positive shell segment only, and returns `0` if the positive ray enters cloud base. Reclassify only a visual-gate failure as `EARLY_REPRESENTATION_FAIL`; keep `EARLY_KILL` for coordinate/HDR/timer/invalid GPU evidence.

- [x] **Step 4: Verify GREEN.**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthPlanetaryCloudMicrobenchMath.spec.ts`

Expected: PASS with radial, oblique, tangent, and inside-inner cases green.

- [x] **Step 5: Commit.**

```bash
git add packages/lubirth-hero/src/planetaryCloud/planetaryCloudMath.ts \
  packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchContract.ts \
  tests/unit/lubirthPlanetaryCloudMicrobenchMath.spec.ts
git commit -m "fix(lubirth): bound cloud shell light rays"
```

### Task 2: Build the constrained representation gate

**Files:**
- Modify: `tests/unit/lubirthPlanetaryCloudMicrobenchMath.spec.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchShader.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/microbench/LuBirthCloudShellMicrobench.tsx`

- [x] **Step 1: Write a failing shader / CPU consistency test.** Require:

```ts
expect(source).toContain("float forwardCloudShellLightDistance");
expect(source).toContain("float baseShape3d");
expect(source).toContain("float remapCoverageToBaseShape");
expect(source).toContain("float henyeyGreensteinPhase");
expect(source).toContain("const float SKY_FILL");
expect(source).toContain("float cloudBaseRadiusEcef = shellBaseRadiusEcef");
```

The same test must prove `resolveCloudShellWorldSegment()` advances `enter` for `{ outer: [-8, 12], inner: [-4, 3] }`.

- [x] **Step 2: Verify RED.**

Run: `pnpm exec playwright test -c playwright.unit.config.ts lubirthPlanetaryCloudMicrobenchMath.spec.ts`

Expected: FAIL on missing representation functions, proving the old fixed-52km/radial-extrusion shader cannot satisfy this gate.

- [x] **Step 3: Implement the constrained shader and probe.** The density path must use:

```glsl
float weatherCoverage = clamp(weather.r, 0.0, 1.0);
float occupancy = remapCoverageToBaseShape(
  weatherCoverage, baseShape3d(positionEcef, shellHeight01)
);
float density = occupancy * verticalProfile * morphologyGain * concavityGain;
float lightDistanceMeters = forwardCloudShellLightDistance(positionEcef);
```

`forwardCloudShellLightDistance` uses outer and `shellBaseRadiusEcef` ray intervals, caps at the first positive cloud-base hit, and divides that physical length across `LIGHT_STEPS`. In-scattering uses `(1.0 - exp(-extinction)) * albedo`, view transmittance, minimal HG direct lighting, and density-gated sky fill. The CPU depth probe calls `resolveCloudShellWorldSegment()` so its inside-inner branch exactly matches the GPU ray segment.

- [x] **Step 4: Verify GREEN and browser contracts.**

Run:

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthPlanetaryCloudMicrobenchMath.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/lubirth-planetary-cloud-microbench.spec.ts --project=desktop
```

Expected: all tests/typechecks pass; the route has no shader compile errors and retains Task -1 coordinate/HDR/gamma/depth contracts.

- [x] **Step 5: Commit.**

```bash
git add packages/lubirth-hero/src/planetaryCloud/microbench/cloudShellMicrobenchShader.ts \
  packages/lubirth-hero/src/planetaryCloud/microbench/LuBirthCloudShellMicrobench.tsx \
  tests/unit/lubirthPlanetaryCloudMicrobenchMath.spec.ts
git commit -m "feat(lubirth): add constrained cloud representation gate"
```

### Task 3: Re-run evidence and conditionally measure GPU cost

**Files:**
- Modify: `tests/e2e/lubirth-planetary-cloud-microbench.spec.ts`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/README.md`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/manifest.json`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/visual-review.json`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/checkpoint.json`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-05/microbench/screenshots/*`

- [x] **Step 1: Write a failing Task -1R capture assertion.** Require E2E capture metadata to identify `task-1r`, while retaining no-Takram, fixed resolution, coordinate, HDR, gamma, matrix, and depth assertions.

- [x] **Step 2: Verify RED.**

Run: `pnpm exec playwright test tests/e2e/lubirth-planetary-cloud-microbench.spec.ts --project=desktop`

Expected: FAIL only because the Task -1R evidence identifier has not been wired.

- [x] **Step 3: Implement capture metadata and run visual evidence.** Keep the route query-only and run:

```bash
MIRALITH_CLOUD_MICROBENCH_CAPTURE=1 pnpm exec playwright test \
  tests/e2e/lubirth-planetary-cloud-microbench.spec.ts --project=desktop
```

Manually inspect the three four-frame contact sheets. A visual pass needs all original criteria plus no persistent full-shell white rim under the corrected light interval; no pixel heuristic may authorize it.

- [x] **Step 4: Conditionally run the formal GPU window.** Only if a reviewer records at least one full visual pass, run `measure=1&visualGate=pass`, wait for 120 valid non-disjoint frames after warmup, and record p50/p95 for density/light, resolve, and composite. Otherwise keep formal GPU values null and write `EARLY_REPRESENTATION_FAIL`.

- [x] **Step 5: Update evidence, validate, commit, and push.** Preserve coordinate/HDR/gamma passes and state whether the result is a disposable representation failure or a visual-passing early-cost candidate.

Run:

```bash
pnpm exec playwright test -c playwright.unit.config.ts lubirthPlanetaryCloudMicrobenchMath.spec.ts
pnpm exec playwright test tests/e2e/lubirth-planetary-cloud-microbench.spec.ts --project=desktop
pnpm --filter @miralith/site build
git diff --check
git status --short
```

Expected: all checks pass before staging. Commit docs/evidence with `docs(lubirth): record task minus 1r representation review`, then push `codex/lubirth-planetary-cloud-microbench`.

## Completed result

- 原 Task -1 的 EARLY_KILL 已追溯更正为 EARLY_REPRESENTATION_FAIL：当时的固定光线路径与二维 coverage 径向挤出并不能否决 V3 或 Takram-first。
- Task -1R 三个 opening case 已通过这一受限 representation 的人工视觉门，因此启动了 headed System Chrome 的正式 GPU 窗口。
- 最低固定工作量的 visual-pass case 32/2 在 121 个有效、非 disjoint GPU 样本中得到 total p95 32.961416 ms，超过 4 ms 预算；最终 checkpoint 为 MICROBENCH_OVER_BUDGET。本计划在此停止，Task 0–8 仍未获授权。

## Plan self-review

- Task 1 covers true secondary-ray geometry, the P2 CPU/GPU interval divergence, and decision vocabulary.
- Task 2 makes V3 macro-only via constrained 3D remap, vertical profile, minimal lighting, and no production-pipeline expansion.
- Task 3 reruns fixed visual cases and only permits GPU data after manual visual acceptance.
- No Task introduces Takram, a remote asset, BSM, temporal, adaptive, detail turbulence, a shared composer, or a production export.
