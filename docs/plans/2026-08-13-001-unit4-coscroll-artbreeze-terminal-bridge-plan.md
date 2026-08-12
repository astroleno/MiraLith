# Unit 4 CoScroll → ArtBreeze Terminal Bridge Implementation Plan

> **Execution default:** Use `superpowers:executing-plans` task-by-task only after `CP1.4 Architecture Ready` receives an independent `PASS — TECH`. Do not use subagents unless the user explicitly authorizes delegation. While this document is `IN REVIEW`, production implementation and CoScroll terminal activation are closed.

**Goal:** Freeze the single architecture for the CoScroll `空` terminal, live/fallback ring handoff, and ArtBreeze `n=355` takeover before changing production code; after approval, implement the Stage 2 thin slice in small independently reviewable units and stop at `CP2.4 AUTHOR GO`.

**Architecture:** `/coscroll` keeps its current wrapped 48-second ritual whenever `/artbreeze` is not accessible. When the canonical access resolver exposes `/artbreeze`, the existing CoScroll input owner switches to a clamped `timeline → terminal-hold → terminal-exit → committing` policy. The source GLB remains opaque and keeps its real negative Y-yaw; source-sampled pale-jade particles carry that motion into an open ring. A persistent transition-layer DOM ring transports the already-formed ring across navigation, but it is not an additional editorial scene and is removed as soon as the verified ArtBreeze first frame owns the image. Explicit Canvas/model/signal failure or a 500ms terminal signal deadline latches a one-way static fallback for that terminal attempt. ArtBreeze reveals only after the verified `artbreeze-first-sequence` poster/video boundary is ready, then waits for a fresh post-transition input before advancing.

**Tech Stack:** TypeScript 6, React 19, Next.js 16 App Router, React Three Fiber 9, Three.js, GSAP only where already used by CoScroll, existing chapter coordinator and typed `chapter-visual-handoff-v1`, local-preview media resolver, Playwright 1.59 for contract and visual evidence.

---

## Gate and scope lock

Current baseline:

- repository HEAD: `382f02952e2181cbb267b607395d9f164dab894f`;
- `CP0.4`: `PASS — AUTHOR + TECH`, freeze `cp0.4-b-ring-first-v9-2026-07-25`;
- `CP1.1`, `CP1.2`, and `CP1.3`: `PASS — TECH / integrated`;
- current action: plan and architecture audit only;
- current checkpoint: `CP1.4 — IN REVIEW / IMPLEMENTATION CLOSED`.

This plan does not authorize or contain:

- production code changes;
- a live CoScroll terminal;
- new route behavior;
- ScrollTrigger or a complete ArtBreeze `NarrativeController`;
- a second WebGL canvas, full-screen feedback texture, `preserveDrawingBuffer`, or `AfterimagePass`;
- a production media manifest, CDN, publication, or upload work;
- Unit 5 answer/AeScape/Focuence sequencing;
- any change to the `CP0.4` editorial order, frame boundaries, text, sound carrier, or responsibility boundary.

After independent plan review, `CP1.4` may become `PASS — TECH` only if the reviewer finds no unresolved architecture branch. A request to mix approaches or change a contract keeps it in review; it is not a pass.

## Authoritative inputs

| Input | Frozen identity / fact | Unit 4 use |
| --- | --- | --- |
| Stage 0 editorial freeze | `docs/post-coscroll/evidence/cp0.4-b-ring-first-v9-editorial-freeze.json`; SHA-256 `d906937cc0b885b12fc942f91ce50e9af919878142cead5c0b36d8bd648140a1` | Exact B order and ownership boundary. |
| Selected B linear | SHA-256 `803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e` | Review identity only; runtime consumes the verified derivative, never this ignored review file directly. |
| Source spec | `POST_COSCROLL_MEDIA_SOURCE_SPEC_SHA256 = 0abfd288738e0197ccea9ec6808d3a23064e177c7a4d72e287cc4a3599b0ebbd` | Resolver and runtime must reject a stale editorial binding. |
| Runtime media id | `artbreeze-first-sequence` | The only media item permitted to own the first handoff. |
| Film entry | exact source `n=355`, PTS `1,065,000`, first-frame MD5 `9fb23e4d30cf5d743e46e7ad012a94ca` | Poster and first decoded video frame must trace to this boundary. |
| Frozen first sequence | source `[n=355,n=556) → [n=4,n=355)`; QR/black `[n=0,n=4)` omitted | Runtime must not fall back to master source order. |
| Film geometry | letterbox preserved; stable window `[n=355,n=363)`; screen gap at `n=355` approximately `154°`; clockwise approximately `396.4°/s` | Browser geometry is recalculated with `object-fit: contain`; 960×540 values remain evidence, not fixed CSS pixels. |
| Web visual | real negative `rotation.y`; opaque `空`; low-saturation jade reference `#B6CCD6`; no screen-plane glyph spin | Source signal and particle bridge. |
| Sound | source-content carrier; 12ms entry/exit fades; accepted `105.986ms` restart pocket | Media remains `source-on-unlock`; no audible autoplay is inferred from wheel navigation. |

The implementation must fail closed when the resolved manifest does not contain a ready `artbreeze-first-sequence` whose editorial-freeze hash and source-spec hash match these identities. A poster or unrelated ArtBreeze clip cannot impersonate the selected media.

---

## Architecture freeze

### 1. Access boundary: existing loop versus narrative terminal

The access resolver is the only authority:

```ts
const next = getNextAccessibleChapter("/coscroll");
const terminalAccessible = next?.href === "/artbreeze";
```

No CSS selector, query parameter, route-local availability flag, or presence of local media may independently enable the terminal.

| Condition | Time policy | Terminal layers | Navigation result |
| --- | --- | --- | --- |
| `/artbreeze` not accessible | Preserve the current unbounded `targetTimeRef`, `wrapTime()`, `PIXELS_PER_SECOND=22`, 360ms GSAP easing, wheel/touch/key mapping, and `10.2/48` initial state | None | No 03→04 scroll transition; `/coscroll` continues looping in both directions. |
| `/artbreeze` accessible | Start from the same current wrapped position but use a clamped narrative time on subsequent input | Mount nothing before the first forward reach of `1` | First forward reach of `1` enters `terminal-hold`; it does not wrap. |
| Access disappears before commit | Cancel terminal visuals and invalidate their motion epoch; retain the displayed `空` endpoint as ritual time `48` | Remove residue/ring and release signal attempt | No route commit; the next new input resumes legacy wrapped behavior. |
| Access changes after the coordinator accepted a transition id | Provider access validation/recovery is authoritative | Source input stays disabled | Do not start a second local transition; provider either completes or recovers source. |

The same native input event that first reaches narrative progress `1` is consumed by the timeline and its overshoot is discarded. It cannot also advance `terminal-exit`; a later physical event is required. `/coscroll-spike`, static review, and non-source-match modes never enable the terminal.

The chapter rail may still perform its existing direct link transition. The cinematic ring handoff is only the scroll-terminal path; the rail must not synthesize a ring payload or call the terminal reducer.

### 2. CoScroll terminal state model

The pure module will be `apps/site/app/coscroll-spike/coscrollTerminalState.ts`. It is route-specific and does not become a second general navigation state machine.

```ts
type CoScrollTerminalPhase =
  | "looping-unavailable"
  | "timeline"
  | "terminal-hold"
  | "terminal-exit"
  | "committing";

type CoScrollTerminalSignalDecision = "pending" | "live" | "fallback";

interface CoScrollTerminalState {
  phase: CoScrollTerminalPhase;
  narrativeProgress: number;
  exitProgress: number;
  motionEpoch: number;
  physicalEventId: number;
  terminalAttempt: number;
  signalDecision: CoScrollTerminalSignalDecision;
  fallbackReason: CoScrollTerminalFallbackReason | null;
  requiresFreshForward: boolean;
}
```

Invariants:

- `narrativeProgress` and `exitProgress` are finite and clamped to `[0,1]`.
- `terminal-hold` always means `narrativeProgress=1`, `exitProgress=0`, anchor cue `空`.
- `terminal-exit` always means `narrativeProgress=1`, `0<exitProgress<1`.
- `committing` always means `narrativeProgress=1`, `exitProgress=1`, one frozen sanitized `coscroll-ring` payload, and no local input owner.
- `requiresFreshForward=true` rejects input that belongs to the entry/recovery inertia generation. It clears only on a later eligible physical event after the quiet-window receipt.
- A transition from `pending` or `live` to `fallback` is one-way within the same `terminalAttempt`.
- Every phase change that cancels a tween, terminal attempt, or visual continuation increments `motionEpoch`; callbacks with an older epoch are no-ops.

State/event table:

| Current | Event | Guard | Next / effect |
| --- | --- | --- | --- |
| `looping-unavailable` | forward/reverse input | no accessible next | Preserve the exact existing wrapped ritual-time path. |
| `looping-unavailable` | `access-available` | next is exact `/artbreeze` | `timeline` at current wrapped progress; no auto terminal. |
| `timeline` | forward input | target remains `<1` | Increase clamped narrative time with current 22px/s conversion and easing. |
| `timeline` | forward input | first target reaches/exceeds `1` | Kill the timeline tween, discard overshoot, increment epoch/attempt, enter `terminal-hold`; start signal deadline. |
| `timeline` | reverse input | target remains `>0` | Decrease narrative time; no residue. |
| `timeline` | access unavailable | any | `looping-unavailable`, preserving the current visual position. |
| `terminal-hold` | forward input | new physical event, fresh-input guard satisfied | Enter `terminal-exit`; apply only this event's normalized pixels to exit progress. |
| `terminal-hold` | reverse input | fresh-input guard satisfied | Cancel signal attempt, increment epoch, enter `timeline` below `1`; apply reverse delta. |
| `terminal-hold` | fallback/deadline | same terminal attempt | Keep phase; latch `signalDecision=fallback`. |
| `terminal-exit` | forward input | result `<1` | Add `pixels/exitDistancePx`; update residue from exit progress. |
| `terminal-exit` | reverse input | result `>0` | Subtract the same normalized amount; visuals reverse from ring toward intact `空`. |
| `terminal-exit` | reverse input | result `<=0` | Clear residue, increment epoch, return `terminal-hold`. |
| `terminal-exit` | forward input | result `>=1` and target still accessible | Freeze a sanitized live/fallback handoff, enter `committing`, call `beginTransition` exactly once. |
| `terminal-exit` | access unavailable/reset | before accepted transition id | Cancel residue and return to unavailable loop endpoint; no navigation. |
| `committing` | `commit-accepted(id)` | id belongs to attempt | Keep source input disabled; Provider owns navigation. |
| `committing` | `commit-rejected` or source recovery | no active accepted runtime | Discard payload/residue, increment epoch, restore `terminal-hold`, require fresh forward input. |
| any terminal phase | history/direct reset | see recovery table | Reinitialize atomically; no prior tween, timer, or signal continuation survives. |

`exitDistancePx = clamp(0.75 * visualViewportHeight, 480, 900)`. Wheel line/page deltas, touch movement, `ArrowDown/ArrowUp`, `PageDown/PageUp`, and `Space` are converted by the single CoScroll owner before reducer dispatch. Key repeat and modified/editable-target keys are rejected. Positive and negative exit deltas use the same scale.

### 3. Single input owner and stale inertia isolation

`CoScrollSpikeExperience` remains the only owner of wheel, touch, and keyboard input while `/coscroll` is active. Unit 4 must not mount `useChapterTerminalGate` for CoScroll and must not let `CoScrollJadeAnchor` add window-level wheel listeners in source-match mode.

Ownership sequence:

| Interval | Owner | Allowed writes |
| --- | --- | --- |
| legacy/timeline/hold/exit | CoScroll route input adapter | Ritual target time, terminal reducer, source scroll velocity. |
| committing through coordinator reveal | ChapterTransitionProvider/Layer | Navigation, veil, persistent DOM ring. Both source and destination route input writers are disabled. |
| post-reveal quiet window | ArtBreeze first-sequence owner observes but does not advance | It records the last residual event and waits for 160ms without wheel/touch/key continuation. |
| first later physical event | ArtBreeze first-sequence owner | Arms and then advances the first sequence. |

Each native input receives a monotonically increasing `physicalEventId`. GSAP callbacks, `requestAnimationFrame` visual updates, the 500ms signal timer, coordinator continuation, and destination readiness callbacks capture `motionEpoch`/transition id and are ignored after cancellation. Phase changes kill the old GSAP tween before publishing the next state. Old wheel inertia may reset the ArtBreeze quiet timer but can never advance media; only the first physical event after the quiet window is a fresh input.

Navigation failure, browser back, access loss, `visibilitychange`, component unmount, reduced-motion change, and Canvas fallback all invalidate pending local continuations before updating visible state.

### 4. Rotation signal and 500ms one-way fallback

The current `{angle,speed}` ref uses zero as both a valid value and an unready value and has no source generation. It must be replaced, not wrapped with more guesses.

```ts
type CoScrollRotationSignalStatus = "pending" | "live" | "fallback";

interface CoScrollRotationSignalSnapshot {
  generation: string;
  status: CoScrollRotationSignalStatus;
  anchor: "空" | null;
  yawRadians: number | null;
  yawVelocityRadiansPerSecond: number | null;
  sampledAtMs: number | null;
  fallbackReason: CoScrollFallbackReason | null;
}
```

Contract:

- generation changes whenever the source anchor/model/readiness generation changes; a sample from `观`, an old `空` instance, or an earlier Canvas generation is invalid;
- `pending` uses null numeric fields;
- `live` requires exact anchor `空`, finite Y-yaw, finite signed Y angular velocity, and a monotonic sample timestamp;
- source `yawVelocityRadiansPerSecond` remains negative for the current real source direction; Unit 4 must not flip the GLB or add screen-plane/third-axis glyph rotation to match the film;
- `fallback` uses null numeric fields and an allowlisted reason;
- the package writes live samples only after the real model and source material are ready; fallback is emitted on Canvas/context/model/material failure;
- app code reads a descriptor snapshot once per animation step and never treats a mutable/foreign object as validated state;
- terminal entry accepts a matching live sample no older than 100ms; otherwise it starts `performance.now()` based 500ms deadline;
- a matching finite sample before the deadline latches live; an explicit failure or deadline latches fallback; explicit failure may downgrade a prior live decision, but fallback never upgrades during that terminal attempt;
- reversing back into timeline cancels the timer and increments `terminalAttempt`; a later genuine terminal entry creates a new decision;
- background-tab suspension does not manufacture live data: on visibility return, a stale pending attempt either receives a new finite sample or reaches the deadline.

Fallback is not allowed to invent a static `空`. The existing real CoScroll fallback (`心`/poster/diagnostic) remains truthful and yields to a separate static pale-jade open ring.

### 5. Source particle bridge and typed handoff mapping

The production path may reuse the existing deterministic surface sampler and fragment cutout in `CoScrollAnchorResidue`, but it must remove review-auto timing and URL-driven ownership from the production decision. `exitProgress` is the only production driver.

Source visual phases:

| Exit range | Required visual |
| --- | --- |
| `0…0.12` | `空` remains fully opaque and continues its current negative Y-yaw; velocity begins increasing; historical particle traces become visible. |
| `0.12…0.56` | The GLB is still non-transparent. An edge/interior fragment cutout removes strokes while particles sampled from the same surface and quaternion replace those exact regions. No flat screenshot or screen-plane glyph is used. |
| `0.56…0.82` | The glyph is fully absent. Pale-jade particles retain the source motion, detach from the 3D glyph pose, and regroup into an open screen-space ring. |
| `0.82…0.90` | A complete pale-jade/blue ring is held as a distinct readable state. |
| `0.90…1` | The already-complete ring warms toward the browser-calibrated ArtBreeze orange and advances clockwise to the exact `n=355` gap. Orange is brief; commit follows immediately. |

The nominal phase ranges are behavioral fixtures inherited from the approved review bridge. CP2 visual tuning may adjust easing inside a range but may not reorder the five states, make the glyph transparent, stop the glyph before dissolution, reverse its Y-yaw, introduce a third-plane glyph spin, or warm particles before a coherent pale-jade ring exists.

Coordinate semantics:

- `center.x` is normalized by the rendered video content box width;
- `center.y` is normalized by the rendered video content box height;
- `diameter` and `lineWidth` are normalized by the content box short edge and rendered inside a `100vmin`-equivalent ring coordinate plane;
- the content box is the actual `object-fit: contain` rectangle of the 1920×1080 coded raster, including its embedded letterbox; it is not the 1920×810 active picture crop;
- browser resize recomputes the content box; no fixed 960×540 or `0.5` projection calibration becomes production logic;
- source Y-yaw and screen gap phase are different coordinate systems. Negative Y-yaw projects into forward clockwise ring motion only after the glyph has dissolved; no source direction is rewritten.

At the end of regrouping, choose a forward-only screen-phase path with one or more full clockwise turns so that `exitProgress=1` lands on the exact `n=355` gap phase. The path cannot use a late reverse correction.

Mapping into the existing sanitized union:

```ts
// live
{
  version: "chapter-visual-handoff-v1",
  kind: "coscroll-ring",
  sourceHref: "/coscroll",
  targetHref: "/artbreeze",
  center,
  diameter,
  lineWidth,
  exitProgress: 1,
  direction: "clockwise",
  signalSource: "live",
  angleRadians: finalScreenGapPhaseRadians,
  angularVelocityRadiansPerSecond: finalPositiveScreenAngularVelocity
}

// fallback
{
  ...sameGeometry,
  exitProgress: 1,
  direction: "clockwise",
  signalSource: "fallback",
  gapPhaseRadians: n355GapPhaseRadians
}
```

For live handoff, `angleRadians` is the final screen-space gap phase after projection/regrouping, not raw GLB yaw. `angularVelocityRadiansPerSecond` is positive clockwise screen velocity. The raw signed Y-yaw never enters the coordinator payload. Both objects must pass `parseChapterVisualHandoff()` before `beginTransition`; no component may send a hand-built unparsed object into the Provider.

### 6. DOM ring ownership across the route

`CoScrollArtBreezeBridge` is rendered by the persistent `ChapterTransitionVisual` only for a sanitized `coscroll-ring` handoff.

It is a transport owner, not C's rejected persistent DOM-ring edit:

1. source particles form and own the ring before commit;
2. the transition-layer DOM ring takes the same center, short-edge diameter, line width, phase, direction, and browser-measured display color as the source ring while the source route is being covered;
3. it continues clockwise during navigation and destination waiting;
4. once the ArtBreeze `n=355` video frame is decoded, the DOM ring continues forward to the next occurrence of the frozen `n=355` phase;
5. it then holds the exact phase only for the frozen four 30fps exposure frames (`133.333ms`) while the underlying real film frame gains `0.25/0.50/0.75/1.00` ownership;
6. the DOM ring is removed. It never persists into `n=356+`, LOADING/waiting, or another segment.

This bridge-specific four-frame reveal replaces the generic 440ms opacity reveal only for `coscroll-ring`; other transition kinds retain existing timings. `ChapterTransitionLayer` must keep the layer opaque while waiting for the forward phase alignment, cancel alignment on stale transition id, and call `onRevealed` only after the four exposure frames finish. Fallback is already at the fixed `n=355` phase and proceeds directly to the exposure once the destination reports ready.

No second Canvas is created. The transition owner is DOM/CSS/SVG only. The ring implementation must expose stable data attributes for phase source, geometry, readiness, and owner so tests can prove there is exactly one owner at each boundary.

### 7. Destination entry reason and recovery semantics

The existing reset context calls both direct restoration and browser traversal `initiator="history"`. Unit 4 requires an explicit reason so CoScroll can intentionally treat refresh differently without parsing transition-id strings.

Add this leaf type and populate it at every Provider call site:

```ts
type ChapterDestinationEntryReason =
  | "coordinator-target"
  | "history-traversal"
  | "direct-restore"
  | "source-recovery";
```

`ChapterDestinationResetContext.entryReason` is transport metadata, not persisted route state. Existing 01–03 and post-CoScroll reset tests must characterize the new field before consumers branch on it.

| Route / entry | Restore result |
| --- | --- |
| `/coscroll`, direct URL or hard refresh | Ignore stored terminal state; restore formal `10.2/48` timeline, `exitProgress=0`, no residue, new epochs. |
| `/coscroll`, ordinary coordinator link target | Formal initial timeline unless a future explicit route contract says otherwise; never terminal merely because an old snapshot exists. |
| `/coscroll`, browser back from ArtBreeze | Restore `terminal-hold`, `narrativeProgress=1`, `exitProgress=0`, real `空`, no half-residue, fresh terminal attempt, new input required. |
| `/coscroll`, ArtBreeze target failure/source recovery | Same terminal hold recovery; discard the prior handoff and wait for new input. |
| `/artbreeze`, active ring handoff | Enter handoff takeover at exact first-sequence frame; do not restore unrelated older semantic media state. |
| `/artbreeze`, direct URL | Deterministic verified poster/fallback entry; no web ring and no automatic playback. |
| `/artbreeze`, hard refresh/history without handoff | Use valid `chapter-return-v2` semantic state; playing normalizes to paused-ready; no handoff is reconstructed. |
| forged/stale preview or route state | Existing fail-closed access/codec path; no veil, terminal, or media privilege is created. |

Handoff remains ephemeral and is never written to sessionStorage/history. CoScroll's legacy return snapshot only needs `routeProgress=1` plus `terminalState=true`; a route-local hidden status marker may supply this capture signal, but the clickable chapter navigation terminal must not be enabled as a bypass around the particle bridge.

### 8. ArtBreeze poster/video readiness and first fresh input

The normal direct-entry route shell keeps its existing poster-or-diagnostic fallback readiness. A `coscroll-ring` target uses a stricter takeover gate:

1. resolver status is `ready` and the selected item is exact id `artbreeze-first-sequence`;
2. editorial freeze/source-spec hashes match the committed contract;
3. the verified `n=355` poster loads, or reports an explicit poster failure;
4. the real local MP4 is mounted with `playsInline`, initially muted, and without audible autoplay;
5. metadata is loaded, time is set to derivative time `0`, and the first decoded frame is proven by `requestVideoFrameCallback`; `loadeddata` is only the documented compatibility fallback;
6. only then does the destination report visual ready and permit DOM-ring phase alignment;
7. video error/decode timeout uses the exact verified poster as `fallback-ready`; if the poster also fails, the diagnostic fallback becomes ready. Neither fallback may be counted as the CP2.3 real-media pass;
8. after the four-frame reveal and the Provider's 160ms inertia settle, the first sequence remains at its takeover stop until the route owner observes a quiet window and a later new physical input.

The poster is a readiness/failure surface, not the successful film owner. CP2.3 must prove that the actual local MP4 produced a decoded frame and later advanced through the verified B sequence.

The first-sequence clip remains `mode="scrub"`. Unit 4 implements only the frozen first-sequence owner, not the complete Unit 5 controller. It uses a monotonic narrative high-water mark plus a reversible local offset: reverse input can visibly withdraw from the latest push, but it cannot erase the highest completed narrative accumulation or release a future segment. Forward input first repays the local reverse offset and then raises the high-water mark. This is the contract that distinguishes “push the stone again” from arbitrary video seeking.

The source audio carrier and 12ms/restart edits remain embedded exactly as frozen. Runtime starts muted and exposes explicit click/Enter sound unlock; wheel alone never claims audible user activation. Reduced-motion and muted users can complete the visual sequence without sound. CP2.4 evidence must state whether the author reviewed with sound unlocked and must not claim a wheel-triggered audible autoplay path.

### 9. Reduced motion and failure paths

| Path | Behavior |
| --- | --- |
| `prefers-reduced-motion` | Keep `空` opaque at hold; replace continuous acceleration/residue with a short mask-cut/discrete pale-jade ring state, then static warm `n=355` gap and poster/video takeover. No high-speed spin or trail. |
| Canvas context/model/material failure before terminal | Keep truthful existing fallback; do not display a fake `空`; form a separate static pale-jade ring and send fallback payload. |
| Failure after live decision but before commit | Latch fallback, remove source particle assumptions, complete static ring, never switch back to live in that attempt. |
| Nil signal for 500ms | Same fallback; navigation must still complete. |
| Destination video slow | Persistent DOM ring remains bounded under the existing destination hard deadline; poster fallback releases it. |
| Destination poster/video both fail | Diagnostic fallback becomes ready; provider does not leave a permanent veil. |
| `beginTransition` returns null | Source returns to terminal hold with a new input generation; no stuck committing state. |
| Browser back during cover/wait | Abort ring timers and video readiness callbacks by transition id/signal; restore the correct source/target semantic state. |

---

## File map for approved implementation

| File | Responsibility |
| --- | --- |
| `apps/site/app/coscroll-spike/coscrollTerminalState.ts` | Pure terminal reducer, invariants, delta normalization, epochs, and access/recovery policy. |
| `apps/site/app/coscroll-spike/useCoScrollNarrativeTerminal.ts` | One route-level adapter between native CoScroll input, signal deadline, reducer, and `beginTransition`. |
| `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx` | Preserve legacy loop; expose terminal state/marker; wire production exit progress without adding another listener owner. |
| `packages/coscroll-scene/src/types.ts` | Generation-aware rotation signal types and explicit exit-progress residue input. |
| `packages/coscroll-scene/src/CoScrollSceneContent.tsx` | Thread the signal generation and terminal-only residue controls to the real `空` anchor. |
| `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx` | Emit real Y-yaw/readiness; keep GLB opaque; no terminal-only axis reversal. |
| `packages/coscroll-scene/src/CoScrollAnchorResidue.tsx` | Promote the approved source-sampled residue from review auto timing to explicit `exitProgress`; preserve review harness isolation. |
| `apps/site/components/chapter-transition/chapterTransitionTypes.ts` | Add explicit destination entry reason only; keep `chapter-visual-handoff-v1` shape unchanged. |
| `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx` | Populate entry reason and transport sanitized handoff; no new media URL knowledge. |
| `apps/site/components/chapter-transition/ChapterTransitionLayer.tsx` | Ring-specific forward alignment and four-frame reveal, abortable by transition id. |
| `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx` | Select the persistent DOM ring only for a sanitized ring payload. |
| `apps/site/components/post-coscroll/CoScrollArtBreezeBridge.tsx` | DOM/SVG ring geometry, phase, color, ownership, reduced-motion and fallback projection. |
| `apps/site/components/post-coscroll/ArtBreezeFirstSequence.tsx` | Exact item selection, decoded `n=355` takeover, fresh-input guard, limited B-sequence scrub and semantic capture. |
| `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx` | Delegate only ArtBreeze first-sequence handoff mode; retain current 04–07 direct shell behavior. |
| `apps/site/app/globals.css` | Bridge-specific contained styles and four-frame exposure; no global access policy. |
| `tests/unit/coscrollTerminalState.spec.ts` | Complete state/event/access/recovery matrix. |
| `tests/unit/coscrollRotationSignal.spec.ts` | Generation, finite sample, deadline, one-way fallback, stale continuation. |
| `tests/unit/chapterVisualHandoff.spec.ts` | Exact live/fallback mapping and unchanged strict parser contract. |
| `tests/e2e/coscroll.spec.ts` | Existing loop/source characterization and source-integrity regression. |
| `tests/e2e/coscroll-artbreeze-transition.spec.ts` | Live/fallback bridge, readiness, fresh input, back/refresh/direct entry, reduced motion. |
| `docs/post-coscroll/evidence/cp2.*` | Durable checkpoint identities, manifests, measurements, and review artifacts; large media stays ignored. |

No new generic animation DSL, media URL in a handoff, route-specific branch in the Provider, or second narrative reducer is permitted.

---

## Implementation tasks after CP1.4 PASS

### Task 1: Characterize and protect current CoScroll behavior

**Files:**

- Modify/Test: `tests/e2e/coscroll.spec.ts`
- Create: `docs/post-coscroll/evidence/cp2.1-coscroll-characterization.json`

- [ ] Capture current baseline at initial `10.2/48`, cue boundary `24/48`, exact `1`, first forward wrap, reverse wrap, wheel, touch, keyboard, source fallback, and `/coscroll-spike` isolation.
- [ ] Add deterministic assertions that source mode uses `空` at progress `1`, current negative Y-yaw, no residue layer by default, no request for `道`, and no terminal/route commit without accessible `/artbreeze`.
- [ ] Save desktop 960/1440/1920 and one non-16:9 source-match screenshots plus computed geometry/readiness data. These are characterization evidence, not new visual targets.
- [ ] Run the focused CoScroll suite and the existing 01–03 production transition/navigation suite before any terminal code.
- [ ] Commit only characterization tests/evidence. Do not change production to make a brittle assertion pass; first determine whether the assertion describes the actual approved baseline.

**CP2.1 status:** stays `IN PROGRESS`; characterization alone does not pass it.

### Task 2: Implement the pure terminal policy/state contract

**Files:**

- Create: `apps/site/app/coscroll-spike/coscrollTerminalState.ts`
- Create/Test: `tests/unit/coscrollTerminalState.spec.ts`

- [ ] Write RED tests for every row in the state/event table, invariants, same-event overshoot rejection, equal reverse delta, access loss, commit rejection, history hold, direct initial state, and stale epoch callbacks.
- [ ] Add a generated phase × event matrix test so any undefined event returns the identical frozen state object and performs no effect.
- [ ] Implement the smallest pure reducer that satisfies this frozen table. It must not import React, GSAP, Provider, Three.js, DOM, or media modules.
- [ ] Run the focused unit suite, site typecheck, lint, and `git diff --check`; commit independently.

### Task 3: Add the generation-aware rotation signal

**Files:**

- Modify: `packages/coscroll-scene/src/types.ts`
- Modify: `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx`
- Modify: `packages/coscroll-scene/src/index.ts`
- Create/Test: `tests/unit/coscrollRotationSignal.spec.ts`
- Modify/Test: `tests/e2e/coscroll.spec.ts`

- [ ] Write RED tests for pending/live/fallback descriptors, source generation changes, wrong-anchor samples, non-finite values, older timestamps, stale generation, explicit fallback after live, 500ms timeout, and late live rejection.
- [ ] Add signal publication without adding a React render per frame. The route reads a current immutable snapshot; readiness/fallback changes may notify React, raw frame samples may not.
- [ ] Prove real source Y-yaw remains negative and terminal code adds no screen-plane glyph transform or new window listener.
- [ ] Preserve all pre-terminal screenshots and package typecheck; run the four-root R3F singleton guard because this crosses the site/package boundary.
- [ ] Update the knowledge graph after the public package API change, then commit independently.

### Task 4: Integrate the access-gated terminal without bridge visuals

**Files:**

- Create: `apps/site/app/coscroll-spike/useCoScrollNarrativeTerminal.ts`
- Modify: `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx`
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify/Test: `tests/e2e/coscroll.spec.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`

- [ ] First test access-off infinite loop, access-on first reach hold, overshoot discard, reverse to timeline, 500ms fallback decision, commit rejection, and all four destination entry reasons.
- [ ] Replace only the route input dispatch; do not mount `useChapterTerminalGate` or change the rail resolver.
- [ ] Expose terminal state and legacy capture marker without enabling a clickable terminal shortcut.
- [ ] Use a temporary non-visual handoff fixture only in tests to prove `beginTransition` is called once with a sanitized payload; production bridge rendering remains absent until Task 5.
- [ ] Run production public mode and preview mode separately. Public must remain the current loop; preview may reach hold/exit but this task is not visually complete.
- [ ] Commit independently. Do not mark CP2.1 pass until source-integrity captures after the integration are reviewed.

### Task 5: Implement live/fallback particle and DOM ring continuity

**Files:**

- Modify: `packages/coscroll-scene/src/types.ts`
- Modify: `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollAnchorResidue.tsx`
- Create: `apps/site/components/post-coscroll/CoScrollArtBreezeBridge.tsx`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionLayer.tsx`
- Modify: `apps/site/app/globals.css`
- Modify/Test: `tests/unit/chapterVisualHandoff.spec.ts`
- Create/Test: `tests/e2e/coscroll-artbreeze-transition.spec.ts`

- [ ] Write RED tests for opaque GLB/cutout behavior, real-yaw particle history, pale-jade complete ring before warmth, forward-only phase, normalized contain geometry, exact live/fallback payload, single DOM owner, and four-frame reveal.
- [ ] Drive the source sampler only with reducer `exitProgress`; review query modes remain explicitly review-only and cannot auto-activate in `/coscroll`.
- [ ] Implement explicit fallback fixtures for context loss, model/material failure, and nil signal. Assert fallback navigation completes in bounded time and late signal cannot switch the owner.
- [ ] Capture live and forced-fallback pause frames at source residue, complete pale-jade ring, warm exact-phase ring, and destination boundary at 960/1440/1920/non-16:9.
- [ ] Verify no second canvas, no full-screen render target, no fixed-pixel 960×540 projection, and no DOM ring after real film ownership.
- [ ] Commit independently; submit `CP2.2` evidence only after `CP2.1` is already pass.

### Task 6: Implement ArtBreeze `n=355` takeover and recovery

**Files:**

- Create: `apps/site/components/post-coscroll/ArtBreezeFirstSequence.tsx`
- Modify: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Modify: `apps/site/app/artbreeze/page.tsx`
- Modify: `apps/site/app/globals.css`
- Modify/Test: `tests/e2e/post-coscroll-route-shell.spec.ts`
- Modify/Test: `tests/e2e/chapter-route-state.spec.ts`
- Modify/Test: `tests/e2e/coscroll-artbreeze-transition.spec.ts`

- [ ] Write RED tests for exact item/hash binding, poster delay/503, video metadata delay/error, decoded first-frame proof, no fake poster success, phase alignment, four-frame exposure, fresh-input guard, and real B-sequence advancement.
- [ ] Add direct/back/forward/refresh/source-recovery tests. CoScroll back returns hold; CoScroll refresh returns `10.2/48`; ArtBreeze refresh restores semantic paused/ready state without recreating a handoff.
- [ ] Add forged preview/history and scope mismatch tests around the real 03→04 flow; they must fail closed without permanent veil.
- [ ] Add sound-unlock click and Enter coverage and prove wheel alone does not call an audible `play()`.
- [ ] Run the exact real local-preview catalog. Verify the MP4 request and decoded frame, not merely the poster.
- [ ] Produce the complete Stage 2 capture from the final 2–3 seconds of CoScroll through the end of `artbreeze-first-sequence`, plus a forced-fallback capture and freeze-vs-runtime diff.
- [ ] Commit independently; submit `CP2.3` for technical review. Stop before Unit 5 or any answer/AeScape work.

### Task 7: CP2.4 author review package

**Files:**

- Create: `docs/post-coscroll/evidence/cp2.4-first-bridge-author-review.json`
- Update: `docs/post-coscroll/CHECKPOINTS.md`
- Local ignored media: `apps/site/.generated/post-coscroll-stage2-review/`

- [ ] Export exactly three labeled pause frames: jade glyph acceleration, particle ring closure, ArtBreeze `n=355` takeover.
- [ ] Export one continuous live recording and one forced-fallback recording with file SHA-256 values.
- [ ] Add a CP0.4-versus-runtime table for order, PTS/frame identity, geometry, phase, letterbox, color, four-frame exposure, text, sound, DOM/video ownership, and supplementary footage.
- [ ] Explain input ownership, old-inertia rejection, back/refresh/direct entry, reduced motion, fallback, and sound unlock.
- [ ] Keep `CP2.4 — IN REVIEW` until the author explicitly says GO for the exact media SHA. A change request requires a new media version; it is not GO.
- [ ] Do not open Unit 5/Stage 3 until `CP2.4 AUTHOR GO` is recorded.

---

## Checkpoint acceptance matrix

| Checkpoint | Required evidence | Pass rule | What remains closed |
| --- | --- | --- | --- |
| `CP1.4 Architecture Ready` | This plan, baseline/plan/patch identities, independent architecture review | No unresolved branch in access, state, signal, handoff, recovery, media readiness, or CP0.4 binding | All Unit 4 production implementation until pass. |
| `CP2.1 CoScroll Source Integrity` | Characterization plus access-gated terminal captures/tests | Pre-terminal 01–03 visuals/input unchanged; public no-next loop unchanged; preview first reach holds real `空`; reverse/back work | Particle/DOM continuity cannot be accepted on top of a source regression. |
| `CP2.2 Live / Fallback Ring Continuity` | Live signal dump, forced fallback cases, multi-viewport pause frames, payload dump | One owner; correct direction/center/diameter/gap; bounded fallback; no black flash, duplicate canvas, or permanent terminal | Frozen edit thin-slice pass. |
| `CP2.3 Frozen Edit Thin Slice` | Exact real-media capture, hashes, freeze diff, input/transfer/audio report | Actual B-v9 derivative starts at n=355 and completes; four-frame exposure and ownership match; old inertia cannot advance; poster cannot impersonate video | Author GO and all Stage 3 work. |
| `CP2.4 First Bridge GO` | Three pause frames, continuous live/fallback recordings, differences/risks, exact SHAs | Author confirms the exact runtime reads as rotating effort leaving traces and becoming waiting, not spinner/loading/technical flourish | Unit 5/Stage 3 until explicit author GO. |

## Verification commands for the final Unit 4 candidate

Commands are run from a clean isolated worktree with frozen dependencies. Local-preview media is restored/generated only in that worktree and remains ignored.

```bash
pnpm install --frozen-lockfile
pnpm exec playwright test -c playwright.unit.config.ts \
  tests/unit/coscrollTerminalState.spec.ts \
  tests/unit/coscrollRotationSignal.spec.ts \
  tests/unit/chapterVisualHandoff.spec.ts \
  tests/unit/chapterRouteState.spec.ts \
  tests/unit/reactThreeRuntimeResolution.spec.ts \
  --workers=1
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
git diff --check
```

Production/public isolation is tested in a detached tree with no preview-media residue. It must prove 01–03 behavior and no accessible scroll terminal:

```bash
pnpm exec playwright test -c playwright.config.ts \
  tests/e2e/chapter-transition.spec.ts \
  tests/e2e/chapter-navigation.spec.ts \
  tests/e2e/coscroll.spec.ts \
  --project=desktop --workers=1
```

Real media and the 03→04 preview edge are tested only with the existing local-preview runner:

```bash
MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview \
pnpm exec playwright test -c playwright.local-preview.config.ts \
  tests/e2e/post-coscroll-route-shell.spec.ts \
  tests/e2e/chapter-route-state.spec.ts \
  tests/e2e/coscroll-artbreeze-transition.spec.ts \
  --project=desktop --workers=1
```

The evidence report must record exact pass/skip counts, exit codes, worktree HEAD/tree, browser version, viewport matrix, media manifest SHA, source-spec SHA, editorial-freeze SHA, candidate patch SHA, and root-relative checksum command. Counts are recorded from the actual runner and are not guessed in advance.

## Independent review questions

The plan reviewer must answer all of these before granting `CP1.4 PASS — TECH`:

1. Can any path enable the terminal without `getNextAccessibleChapter("/coscroll") === /artbreeze`?
2. Can one physical event both reach `timeline=1` and advance exit?
3. Can reverse input, access loss, navigation failure, or stale GSAP/rAF/timer work commit later?
4. Is there exactly one wheel/touch/key owner in every phase?
5. Can a stale/wrong-anchor/non-finite signal become live, or can a late signal reverse fallback?
6. Does the GLB stay opaque and retain real negative Y-yaw until its sampled particles replace it?
7. Are source yaw and screen gap phase explicitly different coordinate systems with no source reversal?
8. Does the DOM ring exist only between source-ring completion and verified film ownership?
9. Does the real ArtBreeze MP4, rather than a poster, own the successful `n=355` boundary?
10. Do direct, refresh, history traversal, and source recovery have unambiguous different results?
11. Can old terminal inertia advance ArtBreeze before a quiet window and a new input?
12. Does every frozen B-v9 frame/sound/letterbox/ownership field remain traceable to CP0.4 and the source spec?

Any “either/or” answer means architecture is not ready and `CP1.4` remains `IN REVIEW / IMPLEMENTATION CLOSED`.
