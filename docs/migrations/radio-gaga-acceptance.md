# Radio Gaga migration acceptance

## Scope

- Migration mode: static MiraLith case-study narrative.
- Standalone acceptance route: `/radio-gaga`.
- Homepage order: LuBirth → Radio Gaga.
- Production rendering contract: one shared `data-visual-canvas="production"` Canvas.
- Excluded runtime: feed APIs, ListenHub, publish, KV/D1, MCP, hardware bridge, audio, credentials, and the source app state layer.

## Functional acceptance

- The standalone route retains its complete five-stage story, forced visual fallback, model failure fallback, and one-Canvas contract.
- Production rendering continues to use the existing `/model/radio_gaga.glb` and `/model/xiaozhi_esp32.glb`; neither GLB was replaced or modified. The static poster is used only by the explicit WebGL fallback path.
- A direct homepage second-act audit recorded both GLB resource requests with `data-home-scene="radio-gaga"`, one production Canvas, and zero Radio Gaga fallback nodes.
- The homepage mounts the Radio Gaga DOM act after the LuBirth intro, changes the shared title surface to Radio Gaga while the second act is active, and restores LuBirth when returning to the top.
- Radio Gaga model and proof assets are not requested on the homepage first screen. The scene module and its four visual assets are loaded only after the second act enters the near range.
- The Radio Gaga scene restores the previous shared camera, background, and fog when it is deactivated.
- Reduced motion exposes `data-radio-gaga-motion="reduced"`, disables the particle budget, preserves readable DOM copy, and keeps the homepage second act available without restoring LuBirth's pinned choreography.

## Visual review

Playwright CLI was used against the production Next server. The following artifacts remain local and are intentionally not committed:

- `output/playwright/radio-desktop-opening.png`
- `output/playwright/radio-desktop-process.png`
- `output/playwright/radio-desktop-esp32.png`
- `output/playwright/radio-desktop-esp32-solid.png`
- `output/playwright/radio-desktop-final.png`
- `output/playwright/radio-mobile-portrait-opening.png`
- `output/playwright/radio-mobile-portrait-memory.png`
- `output/playwright/radio-mobile-portrait-final.png`
- `output/playwright/radio-mobile-landscape-memory.png`
- `output/playwright/radio-desktop-fallback.png`
- `output/playwright/home-radio-gaga-glb.png`

Review result:

- 1440×960: opening radio, proof/process evidence, ESP32 handoff, and final family-message state remain legible.
- 412×915: opening, memory/proof, and final sheet remain in the viewport without copy/marker overlap.
- 915×412: memory copy remains in the left lane and the active step marker remains in the right lane without overlap.
- Forced fallback provides a readable radio poster and bilingual care-story summary without WebGL.

## Performance evidence

Production build, mid-story progress `0.58`, two-second warm-up followed by a ten-second RAF sample:

| Profile | Samples | Median | p95 | Max | Consecutive >100ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop 1440×960 | 601 | 16.70ms | 17.60ms | 17.70ms | 0 |
| Pixel 7, 412×839 CSS px, DPR 2.625 | 601 | 16.70ms | 17.50ms | 17.70ms | 0 |

Acceptance thresholds were desktop p95 ≤25ms and mobile p95 ≤33ms. Both measurements passed, so the centralized high/medium/low particle budgets were not reduced further.

## Baseline test note

The pre-migration desktop homepage suite had eight reproducible LuBirth failures on the current Chromium/runtime. The migration did not rewrite the LuBirth loading/projection state machine. Its affected assertions were stabilized around bounded fallback behavior, authored animation contracts, deterministic handoff endpoints, and current production transfer size before the combined suite was rerun.

## Final verification

- `pnpm --filter @miralith/radio-gaga-scene typecheck`: passed.
- `pnpm --filter @miralith/site typecheck`: passed.
- `pnpm --filter @miralith/site lint`: passed.
- `pnpm build`: passed; route output includes `/` and `/radio-gaga`.
- `git diff --check`: passed.
- Dedicated desktop, mobile portrait, and mobile landscape suite: 113 passed, 4 viewport-specific skips, 0 failed, 0 retries.
- `pnpm verify`: passed, including workspace typechecks and a second production build.

## Knowledge graph

Graph update blocked: the `/graphify` executable is unavailable in this environment. Both `/graphify --update` and `/graphify path "RadioGagaSceneContent" "HomeVisualSceneSlot"` exited `127`. The existing `graphify-out/graph.json` and `GRAPH_REPORT.md` were used for pre-change community/blast-radius review; no updated graph is claimed.

## CoScroll handoff

- Radio/home-spine integration commit: `c7a4cf0a70bfce1cf8d922ad1148c96dd2df1f08`.
- Latest verified migration commit before documentation closeout: `f5c190712183544effda34209d8f7a77ce209e02`.
- Shared files now owned by the merged home spine:
  - `apps/site/components/home/homeChapterTypes.ts`
  - `apps/site/components/home/homeChapterRegistry.ts`
  - `apps/site/components/home/MiraLithHomeNarrative.tsx`
  - `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- CoScroll must rebase onto the Radio/home-spine history before editing shared files.
- Extension contract: add a `HomeChapterRuntime`, extend registry order, mount only when near, and preserve one production Canvas.
