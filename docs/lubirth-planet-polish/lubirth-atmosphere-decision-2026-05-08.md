# LuBirth Atmosphere Decision Record

Date: 2026-05-08

Decision: spike-only / stack default for production until strict performance and visual review gates pass.

## Policy API

- Owner: slot-owned resolver.
- Resolver: `packages/lubirth-hero/src/atmospherePolicy.ts`.
- Production default: `apps/site/components/LuBirthRevisedRoute.tsx` resolves to `atmospherePolicy="stack"` unless an evidence-only `visualTest=pixels&atmoPolicy=...` or `perfTest=raf&atmoPolicy=...` override is present.
- Production evidence routes use `visualTest=pixels` to force the scene canvas on visible-copy pages without requiring fixed `progress=0`.
- Production performance routes use `perfTest=raf` to force the scene canvas without enabling screenshot-only `preserveDrawingBuffer`; this profile also caps the Canvas DPR at `1` to avoid mixing screenshot evidence cost into performance evidence.
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
- The spike screenshot evidence path now uses viewport captures through Chrome CDP `Page.captureScreenshot`, with Playwright screenshot as a fallback for non-Chromium projects.

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
- Evidence screenshots are viewport captures at `1440 x 960`, not full-page captures, and use Chrome CDP `Page.captureScreenshot` to avoid Playwright compositor/font-ready screenshot stalls. The helper still keeps the scoped Playwright font-ready bypass for fallback capture.
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

Latest default local run on 2026-05-09 passed as a recorder but remained invalid for promotion budgeting after moving performance URLs to `perfTest=raf`, disabling `preserveDrawingBuffer`, and capping DPR at `1`:

- Command: `PLAYWRIGHT_REUSE_SERVER=1 pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop --workers=1` after `rm -rf apps/site/.next && pnpm build` and `next start -H 127.0.0.1 -p 3100`.
- Blank RAF control: 108 samples, median 16.70ms, p95 17.60ms.
- Spike stack high: 2 samples, median 1300.60ms, p95 5099.00ms.
- Spike volumetric high: 2 samples, median 950.10ms, p95 2733.30ms.
- Production study visible stack: 1 sample, median 3249.20ms, p95 3249.20ms.
- Production study visible hybrid candidate: 2 samples, median 950.00ms, p95 2983.30ms.
- Production home intro stack: 2 samples, median 1483.30ms, p95 1599.80ms.

RAF control note:

- The blank Playwright Chromium control now runs inside the performance spec. Its 108-sample result shows the low route sample counts should be treated as LuBirth route/rendering invalidation in this automated environment, not as a global headless RAF throttle.

Latest strict local run on 2026-05-08 failed the promotion gate because headless RAF sampling was throttled:

- Command: `LUBIRTH_PERF_STRICT=1 pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop`.
- Spike stack high: 1 sample, median 3100.40ms, p95 3100.40ms.
- Spike volumetric high: 1 sample, median 2399.90ms, p95 2399.90ms.
- Production study visible stack: 2 samples, median 950.00ms, p95 3516.60ms.
- Production study visible hybrid candidate: 1 sample, median 2400.00ms, p95 2400.00ms.
- Production home intro stack: 2 samples, median 1534.00ms, p95 2283.40ms.

These numbers are not accepted as budget evidence because the sample counts are below the required threshold. They are accepted only as evidence that the current automated environment cannot certify volumetric promotion, even after isolating the performance path from screenshot capture settings.

## Reason

The policy API and safe stack default are implemented. The implementer scorecard currently lands at `4 / 16`, and strict performance evidence remains invalid in headless sampling. Production therefore remains stack default while volumetric remains available for spike and screenshot-only candidate evidence.

## Follow-up

- Run the stable screenshot matrix and fill visual scores from `screenshots/lubirth-atmosphere-evidence-20260508/`.
- Re-run the performance spec in a foreground, unthrottled browser context with `LUBIRTH_PERF_STRICT=1`.
- Complete browser console/WebGL and resize/dispose hardening checks.
- Only after those pass, change production policy from `stack` to `hybrid` or `volumetric`.
