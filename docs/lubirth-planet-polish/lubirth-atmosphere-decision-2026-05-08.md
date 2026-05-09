# LuBirth Atmosphere Decision Record

Date: 2026-05-08

Decision: spike-only / stack default for production until strict performance and visual review gates pass.

## Policy API

- Owner: slot-owned resolver.
- Resolver: `packages/lubirth-hero/src/atmospherePolicy.ts`.
- Production default: `apps/site/components/LuBirthRevisedRoute.tsx` passes `atmospherePolicy="stack"` unless the evidence-only `visualTest=pixels&atmoPolicy=...` override is present.
- Production evidence routes use `visualTest=pixels` to force the scene canvas on visible-copy pages without requiring fixed `progress=0`.
- Production look for promotion evidence: `lubirth`.
- Resolver tests: `tests/e2e/lubirth-atmosphere-policy.spec.ts`.

## Evidence Matrix

Stable screenshot output directory:

- `screenshots/lubirth-atmosphere-evidence-20260508/`

Covered by `tests/e2e/lubirth-atmosphere-spike.spec.ts`:

- Spike desktop stack close / transition / far.
- Spike desktop volumetric close / transition / far.
- Spike split A/B.
- Spike desktop medium volumetric.
- Spike low fallback.
- Spike mobile auto fallback.
- Spike mobile medium fallback.
- Spike mobile high volumetric review.

Latest spike validation:

- `pnpm exec playwright test tests/e2e/lubirth-atmosphere-spike.spec.ts --project=desktop --workers=1` passed on 2026-05-09: `7 passed / 1 skipped`.
- The spike screenshot evidence path now uses viewport captures and the same scoped Playwright font-ready bypass used by the revised production evidence helper.

Covered by `tests/e2e/lubirth-revised.spec.ts`:

- Production study hidden stack baseline.
- Production study visible stack baseline.
- Production study visible hybrid candidate, screenshot-only.
- Production home visible stack intro.
- Production home hidden hybrid candidate, screenshot-only.

Latest production evidence validation:

- `pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop --workers=1` passed on 2026-05-09: `21 passed`.
- `pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop --grep "production home intro|captures production route atmosphere evidence"` passed on 2026-05-08 against Playwright's production `build/start` webServer: `2 passed`.
- Home intro evidence now asserts the stable invariant, stack renderer with volumetric inactive, instead of the timing-dependent `home-intro-stack` reason.
- Visible production evidence now uses `visualTest=pixels` to force a canvas and accepts the visible production copy layer across loading/opening/hero states.
- Evidence screenshots are viewport captures at `1440 x 960`, not full-page captures, and skip Playwright's font-ready wait only inside the evidence screenshot helper.
- Runtime moon/visitor-geo coverage is split into per-location tests with a single aggregated runtime-state poll per sample so the full desktop suite can finish under single-worker execution.

## Score

Implementer draft scorecard:

- `docs/lubirth-planet-polish/lubirth-atmosphere-visual-scorecard-2026-05-08.md`

Draft score: `4 / 16`.

- Inner white line: `1`
- Blue shelf: `0`
- Outer halo: `0`
- Earth/cloud readability: `0`
- Moon non-interference: `1`
- Transition/far decay: `0`
- Mobile stability: `1`
- Visible copy readability: `1`

Current score status: below the `13 / 16` promotion threshold and pending independent visual reviewer sign-off. This supports `stack default` / `spike-only`, not production volumetric or hybrid promotion.

## Hardening

- Low quality fallback: covered.
- Mobile landscape medium fallback: covered.
- Split mode stays spike-only: covered.
- Production policy reason: covered.
- Browser console/WebGL resource review: pending.
- Resize/dispose stress review: pending.
- Tone-mapping review: pending.

## Performance

Executable sampler:

- `tests/e2e/lubirth-atmosphere-performance.spec.ts`.
- Default mode records metrics and marks low sample count as invalid for promotion.
- Strict promotion mode: `LUBIRTH_PERF_STRICT=1 pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop`.

Latest default local run on 2026-05-09 passed as a recorder but remained invalid for promotion budgeting:

- Command: `pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop --workers=1`.
- Spike stack high: 2 samples, median 949.90ms, p95 2150.10ms.
- Spike volumetric high: 1 sample, median 2650.00ms, p95 2650.00ms.
- Production study visible stack: 2 samples, median 1400.60ms, p95 1516.20ms.
- Production study visible hybrid candidate: 2 samples, median 699.90ms, p95 4116.70ms.
- Production home intro stack: 4 samples, median 816.70ms, p95 833.50ms.

Latest strict local run on 2026-05-08 failed the promotion gate because headless RAF sampling was throttled:

- Command: `LUBIRTH_PERF_STRICT=1 pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop`.
- Spike stack high: 1 sample, median 3100.40ms, p95 3100.40ms.
- Spike volumetric high: 1 sample, median 2399.90ms, p95 2399.90ms.
- Production study visible stack: 2 samples, median 950.00ms, p95 3516.60ms.
- Production study visible hybrid candidate: 1 sample, median 2400.00ms, p95 2400.00ms.
- Production home intro stack: 2 samples, median 1534.00ms, p95 2283.40ms.

These numbers are not accepted as budget evidence because the sample counts are below the required threshold. They are accepted only as evidence that the current automated environment cannot certify volumetric promotion.

## Reason

The policy API and safe stack default are implemented. The implementer scorecard currently lands at `4 / 16`, and strict performance evidence remains invalid in headless sampling. Production therefore remains stack default while volumetric remains available for spike and screenshot-only candidate evidence.

## Follow-up

- Run the stable screenshot matrix and fill visual scores from `screenshots/lubirth-atmosphere-evidence-20260508/`.
- Re-run the performance spec in a foreground, unthrottled browser context with `LUBIRTH_PERF_STRICT=1`.
- Complete browser console/WebGL and resize/dispose hardening checks.
- Only after those pass, change production policy from `stack` to `hybrid` or `volumetric`.
