# CoScroll Homepage Integration Next Steps

> Handoff plan for continuing after the CoScroll migration spike. Use this file as the next execution entry point. The older `IMPLEMENTATION_PLAN.md` remains useful as historical reference, but it describes a broader full-chapter route than the current approved landing scope.

## Current Boundary

This branch can land as **CoScroll migration spike / shared-canvas-ready extraction**.

It must not be described as **homepage CoScroll chapter fully integrated** until the homepage runtime section, active scene switching, lazy asset loading, and scene-switching e2e coverage are implemented.

Correction from Phase 2 review: the homepage `.coscroll-section` is a **temporary placeholder**, not a successful landing of the original CoScroll experience. The next runtime phases must pass the **source-match gate** in `docs/coscroll-source-match/SOURCE_MATCH_GATE.md` before expanding visuals: compare against the original CoScroll live render, then restore the black-blue SilkR3F field, ice-jade/cyan-white material direction, and layered scripture motion instead of hardening the gold/mineral spike direction.

Current accepted spike state:

- `/coscroll-spike` renders the reviewable CoScroll visual extraction.
- `packages/coscroll-scene` exports canvas-less R3F scene content plus a standalone demo wrapper.
- `HomeVisualSceneSlot` / `CoScrollSceneSlot` prepare shared Canvas arbitration.
- Production homepage has only a placeholder CoScroll DOM section after the approved LuBirth range.
- Homepage tests assert the placeholder sits off the first screen, remains above the fixed Canvas when reached, and makes no first-screen `/assets/coscroll/` requests.
- CoScroll assets are limited to `心 / 空 / 道`:
  - `xin.glb`: about 54K.
  - `kong.glb`: about 79K.
  - `dao.glb`: about 94K.
- Fallback poster is real: `apps/site/public/assets/coscroll/posters/coscroll-poster.webp`, 1200x675, about 141K.

## Do Not Reintroduce

- Do not migrate the original CoScroll app shell.
- Do not add the audio player, seek bar, blue progress UI, full 364s audio experience, or Tone runtime to the homepage.
- Do not load OBJ at runtime.
- Do not restore the 14-anchor / 26-OBJ migration in the homepage path for the next PR.
- Do not add a second homepage `<Canvas>`.
- Do not let `CoScrollSceneContent` own global camera state outside an active-scene guard.
- Do not use the original large CJK font file as a global site font.
- Do not claim homepage integration complete while the homepage section is still a placeholder or the source-match gate has not passed.

## Preflight For The Next Session

Run from the MiraLith worktree:

```bash
pwd
git branch --show-current
git status --short
pnpm verify
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts
git diff --check
```

Expected before starting the next phase:

- Branch is the CoScroll branch intended for this work.
- `pnpm verify` passes.
- `tests/e2e/coscroll.spec.ts` passes.
- No unrelated LuBirth, P7, Radio Gaga, or source CoScroll edits are mixed into this branch.

## Phase 1: Land The Spike Boundary

Goal: make the existing branch safe to merge as a foundation PR.

Files to review:

- `README.md`
- `docs/top-plan.md`
- `docs/coscroll-migration-plan.md`
- `docs/coscroll-scene-interface.md`
- `docs/coscroll-implementation-plan/NEXT_STEPS_PLAN.md`

Tasks:

- [ ] Confirm docs say the current branch is a migration spike, not a full homepage chapter.
- [ ] Confirm `/coscroll-spike` is the only CoScroll page that needs to be reviewable in this PR.
- [ ] Confirm README and top-plan both point to this follow-up plan for homepage integration.
- [ ] Rerun the preflight commands above.

Acceptance:

- Reviewer can merge the branch without assuming CoScroll is live in the homepage narrative.
- Fresh verification passes.

## Phase 2: Add The Homepage Section Shell

Goal: create a visible temporary placeholder CoScroll DOM section without loading the 3D assets on the first screen.

Files likely to change:

- `apps/site/components/MiraLithHome.tsx`
- `apps/site/app/globals.css`
- `tests/e2e/coscroll.spec.ts`
- `docs/coscroll-source-match/SOURCE_MATCH_GATE.md`

Tasks:

- [ ] Add a homepage CoScroll section after the approved LuBirth range.
- [ ] Use `.coscroll-section` as the section selector.
- [ ] Keep DOM copy restrained: this is a MiraLith chapter, not a product demo hero.
- [ ] Keep full scripture or source excerpts in DOM / `sr-only` where needed for accessibility.
- [ ] Add a failing e2e assertion first: section becomes visible only after scrolling near it.
- [ ] Assert the section's stacking layer is above the fixed production Canvas when reached.
- [ ] Keep the existing first-screen assertion that `/assets/coscroll/` is not requested.

Acceptance:

- Homepage has one CoScroll DOM section.
- First screen still does not request CoScroll GLB or poster assets.
- The section is visibly above the fixed Canvas when scrolled into view.
- Title/copy fits desktop, mobile portrait, and mobile landscape.

Non-acceptance:

- Do not treat this as original CoScroll experience parity.
- Do not preserve tests that block the original CoScroll palette (`#1f2e38`, cold cyan/white, or nearby source colors).

## Phase 3: Drive CoScroll With Section Progress

Goal: derive CoScroll visual time from the section's scroll position.

Before implementation, run the source-match gate:

- Open `docs/coscroll-source-match/SOURCE_MATCH_GATE.md`.
- Capture or reuse a live screenshot of the original CoScroll render.
- Compare against source files `SilkR3F.tsx`, `useLayeredLyrics.ts`, `LyricBillboard.tsx`, and `JadeModelLoader.tsx`.
- Preserve the original black-blue silk background, cold jade material direction, cold white/cyan scripture, and horizontal front/back lyric travel as the target behavior.
- Any MiraLith adaptation must be documented as a deliberate deviation, not an accidental drift.

Files likely to change:

- `apps/site/components/MiraLithHome.tsx`
- Optional new hook: `apps/site/visual/useSectionProgress.ts`
- `packages/coscroll-scene/src/createCoScrollVisualState.ts`
- `tests/e2e/coscroll.spec.ts`

Tasks:

- [ ] Track CoScroll section progress with `requestAnimationFrame` and `getBoundingClientRect`, or an existing visual-core utility if one already fits.
- [ ] Map section progress to an 18-30 second MiraLith visual duration.
- [ ] Keep the original 364s CoScroll audio timeline out of the homepage driver.
- [ ] Use `scrollVelocity` only for atmosphere, not for core readability.
- [ ] Respect `prefers-reduced-motion`.

Acceptance:

- Progress is stable from `0` to `1`.
- Visual state changes as the user scrolls through the section.
- Reduced-motion path keeps the scene legible and calm.

## Phase 4: Activate Shared Canvas Scene Switching

Goal: switch the single production Canvas between LuBirth and CoScroll.

Files likely to change:

- `apps/site/components/MiraLithHome.tsx`
- `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- `tests/e2e/coscroll.spec.ts`

Tasks:

- [ ] Compute the active scene from section visibility.
- [ ] Pass `scene="lubirth"` on first screen and `scene="coscroll"` near the CoScroll section.
- [ ] Keep exactly one production Canvas.
- [ ] Keep CoScroll camera changes guarded by `active`.
- [ ] Ensure inactive scenes do not keep fighting camera, fog, background, or asset load state.

Acceptance:

- First screen renders LuBirth.
- Scrolling to the CoScroll section activates CoScroll in the shared Canvas.
- E2E confirms exactly one Canvas before and after the scene switch.
- Canvas pixel checks are nonblank in both active scenes.

## Phase 5: Lazy Load CoScroll Assets Near The Section

Goal: protect homepage first-screen budget while allowing the CoScroll section to render fully when approached.

Files likely to change:

- `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- `packages/coscroll-scene/src/assetManifest.ts`
- `tests/e2e/coscroll.spec.ts`

Tasks:

- [ ] Mount or dynamically import CoScroll only when the section is near active.
- [ ] Load only `xin.glb`, `kong.glb`, and `dao.glb`.
- [ ] Keep poster fallback available for forced fallback and WebGL failure.
- [ ] Add request tracking in Playwright for first-screen and near-section phases.

Acceptance:

- First-screen requests include no `/assets/coscroll/`.
- Near-section requests include only the approved three GLBs and poster.
- Each GLB remains under 350K.
- Poster remains under 180K and has real dimensions.

## Phase 6: Extend Runtime Tests

Goal: make "homepage CoScroll chapter integrated" a testable claim.

Files likely to change:

- `tests/e2e/coscroll.spec.ts`
- Optional: `tests/e2e/miralith.spec.ts`

Tasks:

- [ ] Replace placeholder assertions with runtime scene-switch assertions after the source-match implementation lands.
- [ ] Add desktop scene-switch test: first screen LuBirth, scroll to CoScroll, CoScroll active.
- [ ] Add mobile portrait smoke.
- [ ] Add mobile landscape smoke.
- [ ] Add forced fallback test for `scene="coscroll"`.
- [ ] Add shared Canvas nonblank pixel checks before and after switching.
- [ ] Add request-budget assertions for first screen and CoScroll section.

Acceptance:

```bash
pnpm verify
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts
git diff --check
```

all pass.

## Phase 7: Sync Docs After Runtime Integration

Goal: only update public wording after the runtime behavior exists.

Files likely to change:

- `README.md`
- `docs/top-plan.md`
- `docs/coscroll-migration-plan.md`
- `docs/coscroll-scene-interface.md`
- `docs/coscroll-integration-brief.md`

Tasks:

- [ ] Change README status from "spike / foundation PR" to "homepage chapter integrated" only after Phase 6 passes.
- [ ] Update top-plan with screenshots and final interaction notes.
- [ ] Remove or clearly mark any outdated 14-anchor/full-timeline instructions.
- [ ] Keep the original CoScroll full app documented as source reference, not implementation target.

Acceptance:

- Docs match the shipped behavior.
- No doc says the homepage chapter is complete before tests prove it.

## Stop Conditions

Stop and reassess if any of these happen:

- Homepage renders more than one Canvas.
- First-screen network requests include `/assets/coscroll/`.
- CoScroll scene changes camera while inactive.
- A GLB exceeds 350K without an explicit visual-quality reason.
- Poster fallback is missing, 1x1, or not referenced in computed CSS.
- Desktop `心 / 空 / 道` heading wraps unexpectedly.
- The implementation starts recreating the original CoScroll audio app instead of the MiraLith chapter.

## Final Verification Checklist

Before claiming the next phase complete:

```bash
pnpm verify
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts
git diff --check
```

If the next phase changes homepage behavior outside CoScroll, also run the broader homepage suite:

```bash
CI=1 pnpm exec playwright test tests/e2e/miralith.spec.ts
```
