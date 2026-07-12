# Home LuBirth Next-Stage Plan

> Created: 2026-04-29  
> Scope: MiraLith home route, LuBirth loading ritual, Earth/Moon field, title rail, first project intro.  
> Start here after a conversation reset.

## Current Landing Review

The current home implementation is directionally correct. The loading ritual now uses the LuBirth Three scene as its source of truth instead of a hand-authored decorative arc:

- `EarthMoonScene` projects the initial Earth horizon and Moon position while opening progress is near zero.
- `HomeLoadingOverlay` uses `data-projection="scene"` when that frame is available, with fallback SVG geometry only as a backup.
- Local production preview sampling on desktop and mobile both reached `data-projection="scene"` before the visible contour state.
- The loading contour is now a broad shallow Earth-limb curve, not the earlier small orbit-like hook.
- The mobile loading frame clearly shows the Moon outline, LuBirth title, and Earth horizon as one coherent prelude.
- The post-loading desktop frame reads as one system: Moon above, LuBirth title near the Earth limb, Earth field underneath.
- The scroll-end mobile frame is readable with the fixed title bar, Moon, reduced Earth, and LuBirth project intro.

Screenshots from the latest review run:

- `test-results/home-current-review-2026-04-29/mobile-1600.png`
- `test-results/home-current-review-2026-04-29/mobile-scroll-end.png`
- `test-results/home-current-review-2026-04-29/desktop-scroll-end.png`

## Remaining Review Findings

### 1. Loading animation should be gated by projection readiness

Current code starts the CSS loading animation from `data-home-loading="active"` on a fixed schedule. The scene projection usually arrives early enough in local production sampling, but the line animation itself is not explicitly gated on projection readiness. On a slower cold start, the fallback path can begin drawing and then snap into the scene-projected path.

Target behavior:

- Start WebGL warmup immediately.
- Show black/warm-black hold state while projection is missing.
- Add a root state such as `data-home-projection="scene"` or `data-home-loading-ready="true"` when projection is available.
- Start the SVG line animations only after projection is ready.
- Keep a conservative fallback deadline, for example 1600-2200ms, so loading never stalls forever if WebGL fails.
- Add a Playwright assertion that records whether the first visible contour frame used `data-projection="scene"` or the fallback deadline.

### 2. Loading visual is good enough to keep, but should be validated by video or DOM sampling

Playwright screenshots can miss precise desktop loading frames because screenshot capture itself can advance the animation while WebGL is active. Use DOM sampling for timing assertions and screenshots/video for visual review.

Acceptance:

- At the first visible contour frame, path opacity is greater than zero and `data-projection="scene"` in normal production preview.
- The loading path midpoint visually lines up with the real Earth horizon revealed after the fade.
- The Moon outline position does not jump between loading and the first WebGL frame.

### 3. Earth/Moon visual layer still needs the dedicated hardening pass

This loading fix does not replace the broader LuBirth visual pass. Continue to treat the blockers in `docs/lubirth-earthmoon-visual-gap-review.md` as active:

- Scroll performance.
- Fixed, readable starfield.
- Visible rotating code cloud shell.
- Clear Karman-line / atmosphere rim.
- Visible but restrained aurora or airglow.

### 4. Residual console noise is not blocking, but should be tracked

The `GSAP target not found` warnings are resolved in current sampling. The remaining warning observed during review is `THREE.Clock` deprecation noise from the current Three/R3F stack. Do not block visual work on this, but keep it out of final launch cleanup.

## Next Phase Goal

Make the LuBirth first screen feel technically stable and visually inevitable:

```text
projection-based loading
  -> exact Earth/Moon reveal
  -> smooth scroll shrink
  -> readable title rail and project intro
  -> visible atmosphere/cloud/aurora detail
```

The next phase should not add Radio Gaga, CoScroll, or new homepage sections.

## Execution Plan

1. Stabilize loading readiness.
   - Add a home loading ready state that starts the CSS line/title/hint animation only when the scene projection is available or the fallback deadline expires.
   - Preserve the current projection SVG design.
   - Verify no visible snap from fallback path to scene path.

2. Add stronger visual test hooks.
   - Keep `?visualTest=pixels`.
   - Extend debug layers as needed for `stars`, `clouds`, `atmosphere`, `aurora`, and `all`.
   - Save desktop and mobile screenshots for loading, post-load, and scroll-end.

3. Fix starfield stability and readability.
   - Make the background feel fixed relative to the screen while scroll changes Earth/Moon composition.
   - Raise star visibility without turning it into noise.

4. Make the code cloud layer legible.
   - Add clear shell thickness and independent slow rotation.
   - Make the layer distinguishable from the Earth surface texture clouds.

5. Strengthen the atmosphere / Karman edge.
   - Separate the rim into white needle, blue shelf, and outer diffusion.
   - Keep a subtle blue edge in the final reduced Earth state.

6. Make aurora or airglow visible.
   - Adjust reveal and intensity so near-Earth and final frames both retain a controlled atmospheric signal.
   - Avoid overpowering the Earth rim or title text.

7. Run performance and visual verification.
   - Measure scroll smoothness after each shader layer change.
   - Treat screenshots and scroll recordings as acceptance, not just passing code.

## Startup Steps

Use these steps after reopening the repo:

```bash
cd /Users/aitoshuu/Documents/GitHub/MiraLith
pnpm install
pnpm --filter @miralith/site dev
```

The dev script prints the active URL, usually `http://localhost:3000` unless that port is occupied.

If you need a production-style local preview:

```bash
cd /Users/aitoshuu/Documents/GitHub/MiraLith
pnpm build
pnpm --filter @miralith/site start -- -p 3101
```

For production preview, open:

```text
http://localhost:3101/?visualTest=pixels
```

Read these documents first:

1. `README.md`
2. `docs/top-plan.md`
3. `docs/home-lubirth-next-stage-plan.md`
4. `docs/lubirth-earthmoon-visual-gap-review.md`
5. `docs/superpowers/plans/2026-04-24-lubirth-first-two-screens.md`

## Verification Commands

Run these before calling the next phase complete:

```bash
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site typecheck
pnpm build
pnpm exec playwright test tests/e2e/miralith.spec.ts tests/e2e/lubirth-revised.spec.ts --project=desktop
```

Add a focused visual script or Playwright test for:

- desktop loading first visible contour;
- mobile loading first visible contour;
- desktop post-load frame;
- mobile scroll-end frame;
- console warning count for `GSAP target`.
