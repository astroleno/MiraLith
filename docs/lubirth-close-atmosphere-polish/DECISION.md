# LuBirth Close Atmosphere Polish Decision

Date: 2026-05-12

## Decision

Keep the close-atmosphere tuning spike-only for now. Do not promote production tuning in this pass.

The shader path is wired and visually demonstrable, but RAF samples from the desktop run were too sparse to count as valid promotion evidence. The high all-on evidence frame also reads intentionally strong, so production values should be selected only after a calmer visual review pass with valid close-route RAF samples.

Post-review note: shared `LandingEarth` surface air-lift and horizon-haze additions are now gated behind a non-zero close/truth surface-active scalar. Production default `effective` close tuning remains zero, so those close surface formulas do not run as baseline production styling.

## Evidence

Screenshot directory:

```text
screenshots/lubirth-close-atmosphere-polish-20260512/
```

Captured frames:

```text
desktop-progress0-high-all-on.png
desktop-progress05-high-all-on.png
desktop-progress1-high-all-on.png
desktop-progress0-medium-all-on.png
desktop-progress0-low-high-intensity.png
```

Spike values used for evidence:

```ts
{
  edgeGlowStrength: 1,
  verticalGradientStrength: 1,
  depthShadowStrength: 1,
  groundProjectionStrength: 1,
  cloudVolumeShadowStrength: 1
}
```

## Visual Notes

- Thin blue-white contact line: visible in high all-on.
- Blue shelf/outward gradient: visible; high all-on is strong enough that it should not be promoted directly.
- Surface/cloud readability: still readable in the close crop, with controlled shadow/projection changes.
- Black field: remains near black in pixel smoke and screenshots.
- Moon contamination: low-quality high-intensity evidence shows the moon remains clean.
- Low/fallback behavior: low-quality requested strengths are retained in debug `requested` state but effective strengths are all zero.

## Test Results

Passed:

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/lubirth-close-atmosphere-spike.spec.ts --project=desktop --workers=1
pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop --workers=1 -g "defaults the study route"
pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop --workers=1
```

Close spike coverage:

- Deterministic route: no `/api/lubirth-geo` request and runtime location stays empty by default.
- All-off vs all-on pixel smoke: limb luma/blue increases while black field stays bounded.
- `cloudDepth=0/1` differential: bounded terrain-band luma delta proves the knob is connected.
- Low-quality gate: effective close-atmosphere strengths are all zero and volumetric remains inactive.

RAF rows from the performance run:

```text
close atmosphere high all-on stack: median=3583.30ms p95=3583.30ms max=3583.30ms samples=1
close atmosphere low high-intensity stack: median=650.10ms p95=816.40ms max=816.40ms samples=3
```

These rows are invalid for promotion budgeting because sample counts are below 30. The performance spec passed in non-strict mode, but close-route rows now use a promotion-specific RAF helper and are annotated as `perf-promotion-blocker` when sample counts are too low. Set `LUBIRTH_PERF_PROMOTION_GATE=1` to make those annotations hard failures during a promotion run.

## Invariants

- Production route remains stack by default.
- Production route receives no effective close-atmosphere tuning by default.
- Volumetric atmosphere remains inactive by default.
- `packages/visual-core/src/theatre/openingTimeline.ts` was not modified.
- `packages/visual-core/src/scroll/progressDriver.ts` was not modified.
- Camera position, `camera.lookAt`, Earth scale, Earth yaw/pitch interpolation, moon placement, and scroll progress mapping were not changed for this work.
