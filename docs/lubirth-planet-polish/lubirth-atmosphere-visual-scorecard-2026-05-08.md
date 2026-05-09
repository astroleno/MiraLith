# LuBirth Atmosphere Visual Scorecard

Date: 2026-05-08

Status: implementer draft, pending independent visual reviewer sign-off.

Decision supported by this draft: keep production on stack default; keep volumetric as spike-only evidence until visual and strict performance gates pass.

## Evidence Set

Evidence directory:

- `screenshots/lubirth-atmosphere-evidence-20260508/`

Latest production evidence capture:

- `tests/e2e/lubirth-atmosphere-spike.spec.ts` desktop screenshot matrix passed under single-worker execution on 2026-05-09: `7 passed / 1 skipped`.
- `tests/e2e/lubirth-revised.spec.ts` production evidence run passed against Playwright's production `build/start` webServer on 2026-05-08: `2 passed`.
- Production visible-copy screenshots are viewport captures. The test requires a canvas, verifies stack/volumetric candidate policy state, accepts stable visible copy states instead of a single animation frame, and keeps screenshot font-wait bypass scoped to the evidence helper.

Primary comparisons:

- Close stack: `desktop-desktop-stack-high-progress0.png`
- Close volumetric: `desktop-desktop-volumetric-high-progress0.png`
- Transition stack: `desktop-desktop-stack-high-progress05.png`
- Transition volumetric: `desktop-desktop-volumetric-high-progress05.png`
- Far stack: `desktop-desktop-stack-high-progress1.png`
- Far volumetric: `desktop-desktop-volumetric-high-progress1.png`
- Mobile high volumetric: `mobile-landscape-mobile-landscape-high-progress0.png`
- Study visible stack: `desktop-production-study-visible-stack-baseline.png`
- Study visible hybrid candidate: `desktop-production-study-visible-hybrid-candidate.png`
- Home visible stack: `desktop-production-home-visible-stack-intro.png`

## Scores

Scoring follows the v0.3 contract: `0 = worse than stack`, `1 = equivalent`, `2 = better than stack`.

| Criterion | Score | Evidence | Rationale |
| --- | ---: | --- | --- |
| Inner white line thinness and continuity | 1 | close / transition stack vs volumetric | Volumetric is continuous and clean, but the white line is materially thicker than stack and starts to read as a stylized rim rather than a thin atmospheric edge. |
| Blue shelf thickness without dirty wash | 0 | close / transition / mobile high volumetric | Volumetric adds a broad blue shelf and haze, especially at close and mobile landscape. It is impressive, but not disciplined enough for production. |
| Outer halo readability without black-field contamination | 0 | close volumetric, study visible hybrid candidate | The candidate produces a visible wide halo, and the production visible candidate shifts into a warm/pink band behind the title area. This is the strongest visual blocker. |
| Earth surface and cloud readability | 0 | close stack vs volumetric, study visible stack vs hybrid | Stack preserves stronger surface contrast. Volumetric washes the Earth surface and clouds under haze, especially near the limb. |
| Moon non-interference | 1 | close / transition / far volumetric | The moon remains readable and does not get direct atmospheric contamination, but the wider atmospheric language makes the field feel less restrained. |
| Transition and far-frame decay | 0 | progress 0.5 and progress 1 comparisons | Stack decays more naturally into far view. Volumetric keeps a heavy lit edge and shifts the Earth read toward a bright crescent. |
| Mobile landscape stability | 1 | mobile auto / medium fallback / high volumetric | Policy stability is good: auto and medium fall back to stack, explicit high renders. Visual candidate is stable but still too thick for production mobile. |
| Visible copy readability and non-occlusion | 1 | study visible stack vs hybrid, home visible stack | Text remains readable, but the hybrid candidate halo competes with the `LuBirth` title baseline and changes the first-screen mood. Home remains safe because intro resolves stack. |

Total: `4 / 16`.

## Fail-Fast / Blockers

- No assertion-level fail-fast was observed: canvases rendered, policy resolved as expected, low quality and mobile medium fallback stayed stack.
- Visual blocker: production study visible hybrid candidate has a wide warm/pink atmospheric band behind the main title region.
- Visual blocker: volumetric close and mobile high frames show thicker blue shelf and haze than the stack baseline.
- Promotion blocker: strict performance gate is still invalid in headless sampling and has not passed in a foreground unthrottled run.

## Conclusion

This score does not meet the `13 / 16` threshold and is not within promotion range. The correct production decision remains `stack default` / `spike-only`.

Recommended follow-up:

- Keep `/lubirth-atmosphere-spike` for comparison.
- Port the useful volumetric lessons back into `LandingAtmosphereStack` and `LandingEarth`: a more continuous inner line, slightly cleaner edge falloff, and restrained shelf discipline.
- Do not enable `hybrid` or `volumetric` in production until the visual score improves and strict performance passes.
