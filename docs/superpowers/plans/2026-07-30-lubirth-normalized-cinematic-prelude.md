# LuBirth Normalized Cinematic Prelude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate a query-only normalized cinematic prelude that shows an opaque offline plate through progress 0–0.18, performs a veil-protected match cut, and returns to real-IP Relief-lite at 0.22 without changing the default homepage.

**Architecture:** A DOM-scoped CinematicPlate and independent TransitionVeil live above the existing VisualCanvas only. The live LuBirth scene runs beneath from the start with actual IP state and opening progress. A pure controller owns arming, hysteresis, source cuts, fallback, and release; the first release uses only HTMLVideoFrameProvider.

**Tech Stack:** Next.js App Router, React, existing React Three Fiber VisualCanvas/LuBirthSceneSlot, HTMLVideoElement/requestVideoFrameCallback, FFmpeg/ffprobe media preparation, Playwright.

---

## Preconditions and Scope Lock

- Start from commit b680891b3b7293ebfddb1b1135f908f06fa7c559 or the design branch containing the approved specification.
- Do not modify codex/lubirth-cloud-baseline, codex/lubirth-offline-bake-spike, the default homepage route, Hybrid code, deep-impostor code, globals.css, CoScroll, or Radio Gaga files.
- Implement only the query route /lubirth-cinematic-prelude.
- The offline source is an externally authored, high-quality internal master sequence. The preparation command must reject a missing or nonconforming source; it must not synthesize a lower-quality substitute.
- The first release supports HTMLVideoFrameProvider only. The implementation must fall back to Relief-lite rather than adding image-sequence or WebCodecs code.

## File Map

| File | Responsibility |
| --- | --- |
| apps/site/content/lubirthCinematicPreludeManifest.ts | Strict manifest schema, hard budgets, frame mapping, and safe-crop validation |
| apps/site/scripts/prepare-lubirth-cinematic-prelude.mjs | ffprobe/ffmpeg source validation and deterministic desktop/mobile manifest generation |
| apps/site/public/assets/lubirth/cinematic-prelude/manifest.json | Generated source-bound asset manifest |
| apps/site/public/assets/lubirth/cinematic-prelude/desktop.mp4 and mobile.mp4 | Generated opaque all-I desktop/mobile variants |
| apps/site/components/lubirth-cinematic-prelude/types.ts | Shared state, telemetry, and FrameProvider contracts |
| apps/site/components/lubirth-cinematic-prelude/frameProvider.ts | HTMLVideoFrameProvider only; arms, maps requests to rendered frames, and releases presentation resources |
| apps/site/components/lubirth-cinematic-prelude/controller.ts | Pure forward/reverse/hysteresis/timeout state machine |
| apps/site/components/lubirth-cinematic-prelude/CinematicPlate.tsx | Opaque Canvas-scoped video element and normalized crop transform |
| apps/site/components/lubirth-cinematic-prelude/TransitionVeil.tsx | Independent progress-driven shared veil |
| apps/site/components/lubirth-cinematic-prelude/LuBirthCinematicPreludeStack.tsx | Integrates controller, plate, veil, live-scene readiness, and telemetry |
| apps/site/components/LuBirthCinematicPreludeRoute.tsx | Query-only route composition with VisualCanvas and real-IP LuBirthSceneSlot |
| apps/site/components/LuBirthCinematicPreludeRoute.module.css | Canvas-only stacking, safe cropping, no pointer interception, and veil layering |
| apps/site/app/lubirth-cinematic-prelude/page.tsx | App Router entry point |
| tests/e2e/lubirth-cinematic-prelude-contract.spec.ts | Asset/manifest and source-pipeline contract tests |
| tests/e2e/lubirth-cinematic-prelude-controller.spec.ts | Pure controller and fake-provider state tests |
| tests/e2e/lubirth-cinematic-prelude.spec.ts | Browser route, visual-boundary, fallback, mobile, and performance tests |
| docs/lubirth-cinematic-prelude-evidence/2026-07-30/README.md | Source-bound result and promotion/rejection decision |

## Task 1: Establish the Source-Bound Media Contract

**Files:**
- Create: apps/site/content/lubirthCinematicPreludeManifest.ts
- Create: apps/site/scripts/prepare-lubirth-cinematic-prelude.mjs
- Create: apps/site/public/assets/lubirth/cinematic-prelude/manifest.json
- Create: apps/site/public/assets/lubirth/cinematic-prelude/desktop.mp4 and mobile.mp4
- Test: tests/e2e/lubirth-cinematic-prelude-contract.spec.ts

- [ ] **Step 1: Write the failing manifest contract tests**

Add tests that load the public manifest and reject a variant unless all of these are true:

~~~ts
expect(variant.transferBytes).toBeLessThanOrEqual(variant.tier === "desktop" ? 6 * 1024 * 1024 : 2 * 1024 * 1024);
expect(variant.firstFrameDeadlineMs).toBe(variant.tier === "desktop" ? 1200 : 1800);
expect(variant.maxPresentationResidencyBytes).toBe(variant.tier === "desktop" ? 16 * 1024 * 1024 : 8 * 1024 * 1024);
expect(variant.keyframePolicy).toBe("all-i");
expect(variant.colorSpace).toBe("rec709-srgb-sdr");
expect(variant.safeCrop).toMatchObject({ left: expect.any(Number), right: expect.any(Number), top: expect.any(Number), bottom: expect.any(Number) });
expect(manifest.handoff).toMatchObject({ cutProgress: 0.195, liveProgress: 0.22, veilPeakProgress: 0.195 });
~~~

Also test missing source/output hashes, missing veil profile, nonopaque media, missing mobile variant, and a missing input file passed to the preparation script.

- [ ] **Step 2: Run the contract test to prove it fails**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude-contract.spec.ts
~~~

Expected: FAIL because the manifest module, generator, and generated manifest do not exist.

- [ ] **Step 3: Implement the manifest schema and generator**

Define the shared shape with no implicit defaults for visual-critical fields:

~~~ts
export interface CinematicPreludeVariant {
  tier: "desktop" | "mobile";
  src: string;
  sha256: string;
  transferBytes: number;
  width: number;
  height: number;
  frameRate: number;
  frameCount: number;
  durationSeconds: number;
  keyframePolicy: "all-i";
  colorSpace: "rec709-srgb-sdr";
  firstFrameDeadlineMs: number;
  maxPresentationResidencyBytes: number;
  safeCrop: { left: number; right: number; top: number; bottom: number };
}
~~~

The generator must require --desktop-source, --mobile-source, --output-root, --ffmpeg, and --ffprobe. It must:

Use this all-I SDR output contract for each approved source:

~~~sh
ffmpeg -y -i "$source" -an -c:v libx264 -pix_fmt yuv420p -g 1 -keyint_min 1 -sc_threshold 0 -movflags +faststart -color_primaries bt709 -color_trc bt709 -colorspace bt709 "$output"
~~~

1. call ffprobe and reject video with audio, alpha, HDR metadata, unsupported duration, non-all-I keyframes, or mismatched frame count;
2. hash sources and generated outputs with SHA-256;
3. compute byte counts and reject the tier that exceeds its hard ceiling;
4. write manifest.json atomically only after both variants validate;
5. write a source manifest entry for renderer/tool versions, source scene/script path, seed, parameter summary, handoff frame identifiers, reference Canvas checksum, veil color/luminance profile, and internal license/provenance.

The expected sequence duration is 7.2 * 0.22 = 1.584 seconds; target frame mapping is progress / 0.22 clamped to the declared frame range.

- [ ] **Step 4: Run the contract test to prove it passes**

Run the preparation command with the approved master files, then:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude-contract.spec.ts
~~~

Expected: PASS with both variants, all-I policy, checksums, and hard budgets verified.

- [ ] **Step 5: Commit the media contract**

~~~sh
git add apps/site/content/lubirthCinematicPreludeManifest.ts apps/site/scripts/prepare-lubirth-cinematic-prelude.mjs apps/site/public/assets/lubirth/cinematic-prelude tests/e2e/lubirth-cinematic-prelude-contract.spec.ts
git commit -m "feat(lubirth): define cinematic prelude media contract"
~~~

## Task 2: Implement the Primary FrameProvider and Pure State Machine

**Files:**
- Create: apps/site/components/lubirth-cinematic-prelude/types.ts
- Create: apps/site/components/lubirth-cinematic-prelude/frameProvider.ts
- Create: apps/site/components/lubirth-cinematic-prelude/controller.ts
- Test: tests/e2e/lubirth-cinematic-prelude-controller.spec.ts

- [ ] **Step 1: Write failing controller tests with a fake FrameProvider**

Create a fake provider that exposes deferred arm and frame promises. Test these scenarios exactly:

1. a forward cycle without frame-zero readiness becomes fallback-live for the whole 0–0.18 interval;
2. a ready forward cycle keeps the plate visible to 0.18, closes veil to 0.195, atomically changes source at the peak, and reveals live by 0.22;
3. progress jitter inside 0.18–0.22 never performs a second source cut;
4. reverse from live closes the veil, waits for the requested frame, then cuts to plate at veil peak;
5. reverse timeout reopens live and records timeout instead of holding an opaque veil;
6. progress >=0.22 releases presentation resources without deleting provider manifest metadata;
7. reduced motion, decode failure, background recovery uncertainty, and low-memory cleanup return fallback-live.

Use the observable state shape:

~~~ts
type PreludeSource = "plate" | "live";
type PreludeState =
  | "arming"
  | "plate"
  | "forward-veil-close"
  | "forward-veil-open"
  | "live"
  | "reverse-veil-close"
  | "reverse-wait-frame"
  | "fallback-live";

interface PreludeSnapshot {
  source: PreludeSource;
  state: PreludeState;
  veilOpacity: number;
  forwardCycleLockedToLive: boolean;
  requestedFrame: number | null;
  renderedFrame: number | null;
}
~~~

- [ ] **Step 2: Run the controller test to prove it fails**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude-controller.spec.ts
~~~

Expected: FAIL because controller.ts and frameProvider.ts do not exist.

- [ ] **Step 3: Implement FrameProvider and controller contracts**

Implement HTMLVideoFrameProvider around one muted, playsInline HTMLVideoElement. It must arm only after an initial requestVideoFrameCallback confirms frame zero. Its requestFrame(frame, deadlineMs) must seek to frame / frameRate, wait for a rendered callback whose mediaTime matches the requested target within one frame, and return pending or failed without changing the currently visible element.

Use one fixed timing table:

~~~ts
export const PRELUDE_TIMING = {
  plateEnd: 0.18,
  veilPeak: 0.195,
  liveStart: 0.22,
  reverseDesktopDeadlineMs: 450,
  reverseMobileDeadlineMs: 700
} as const;
~~~

Controller rules:

~~~ts
if (reducedMotion || providerError || lowMemory || backgroundUnverified) {
  return fallbackLiveSnapshot;
}
if (!armedBeforeForwardStart) {
  return lockForwardCycleToLive();
}
if (direction === "forward" && progress >= PRELUDE_TIMING.liveStart) {
  provider.releasePresentationResources();
  return liveSnapshot;
}
if (direction === "reverse" && progress <= PRELUDE_TIMING.plateEnd && frameReadyAtVeilPeak) {
  return plateSnapshot;
}
~~~

Do not add a second provider implementation. Preserve manifest/provider metadata after releasePresentationResources().

- [ ] **Step 4: Run controller tests to prove they pass**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude-controller.spec.ts
~~~

Expected: PASS for all forward, reverse, timeout, hysteresis, lifecycle, and fallback cases.

- [ ] **Step 5: Commit the state machine**

~~~sh
git add apps/site/components/lubirth-cinematic-prelude/types.ts apps/site/components/lubirth-cinematic-prelude/frameProvider.ts apps/site/components/lubirth-cinematic-prelude/controller.ts tests/e2e/lubirth-cinematic-prelude-controller.spec.ts
git commit -m "feat(lubirth): add cinematic prelude frame controller"
~~~

## Task 3: Build Canvas-Scoped Plate and Shared TransitionVeil

**Files:**
- Create: apps/site/components/lubirth-cinematic-prelude/CinematicPlate.tsx
- Create: apps/site/components/lubirth-cinematic-prelude/TransitionVeil.tsx
- Create: apps/site/components/lubirth-cinematic-prelude/LuBirthCinematicPreludeStack.tsx
- Create: apps/site/components/LuBirthCinematicPreludeRoute.module.css
- Test: tests/e2e/lubirth-cinematic-prelude.spec.ts

- [ ] **Step 1: Write failing DOM-layer tests**

Add browser tests that assert:

~~~ts
await expect(page.locator("[data-cinematic-plate]")).toHaveCSS("pointer-events", "none");
await expect(page.locator("[data-transition-veil]")).toHaveCSS("pointer-events", "none");
await expect(page.locator("[data-transition-veil]")).toHaveAttribute("data-layer-above", "plate canvas");
await expect(page.locator("header, nav")).not.toBeDescendantOf(page.locator("[data-cinematic-prelude-stack]"));
~~~

At the veil peak, assert the plate and Canvas are not both exposed; verify telemetry reports one active source rather than an opacity blend.

- [ ] **Step 2: Run the route test to prove it fails**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts --grep "layers plate and veil"
~~~

Expected: FAIL because the route and layers do not exist.

- [ ] **Step 3: Implement DOM layering and color/crop inputs**

CinematicPlate renders only an opaque video element. It maps the normalized IP composition vector to CSS translate and scale within manifest safeCrop bounds. It never changes Earth yaw/pitch itself.

TransitionVeil renders as an independent absolute element over both sources. Its opacity, color, and edge profile are read from controller state plus manifest veil metadata. It does not derive state from video events or Canvas pixels.

The stack must have this ownership:

~~~tsx
<div className={styles.stack} data-cinematic-prelude-stack>
  <VisualCanvas>{liveScene}</VisualCanvas>
  <CinematicPlate snapshot={snapshot} normalizedComposition={composition} />
  <TransitionVeil snapshot={snapshot} profile={manifest.handoff.veilProfile} />
</div>
~~~

CSS requirements:

~~~css
.stack { position: relative; isolation: isolate; }
.plate, .veil { inset: 0; pointer-events: none; position: absolute; }
.plate { z-index: 2; }
.veil { z-index: 3; }
.plate video { height: 100%; object-fit: cover; width: 100%; }
~~~

Keep DOM copy/navigation outside .stack. Use Rec.709/sRGB manifest metadata to set the same authored color/exposure reference in the plate and veil. Do not add globals.css.

- [ ] **Step 4: Run the DOM-layer tests to prove they pass**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts --grep "layers plate and veil"
~~~

Expected: PASS, including Canvas-only coverage and no pointer interception.

- [ ] **Step 5: Commit presentation layers**

~~~sh
git add apps/site/components/lubirth-cinematic-prelude/CinematicPlate.tsx apps/site/components/lubirth-cinematic-prelude/TransitionVeil.tsx apps/site/components/lubirth-cinematic-prelude/LuBirthCinematicPreludeStack.tsx apps/site/components/LuBirthCinematicPreludeRoute.module.css tests/e2e/lubirth-cinematic-prelude.spec.ts
git commit -m "feat(lubirth): add cinematic prelude transition veil"
~~~

## Task 4: Compose the Query-Only Route with Real-IP Relief-lite

**Files:**
- Create: apps/site/components/LuBirthCinematicPreludeRoute.tsx
- Create: apps/site/app/lubirth-cinematic-prelude/page.tsx
- Modify: tests/e2e/lubirth-cinematic-prelude.spec.ts

- [ ] **Step 1: Write failing integration tests**

Add test cases that visit:

~~~text
/lubirth-cinematic-prelude?copy=hidden&location=ip&geoLat=31.2&geoLon=103.8&progress=0
/lubirth-cinematic-prelude?copy=hidden&location=ip&geoLat=-33.8688&geoLon=151.2093&progress=0.22
/lubirth-cinematic-prelude?copy=hidden&quality=high&progress=0.1
~~~

Assert the underlying live scene always reports Relief-lite and real IP coordinates while the plate is visible. Assert route telemetry reports normalized composition rather than a city-specific asset key.

- [ ] **Step 2: Run the integration test to prove it fails**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts --grep "keeps real IP Relief-lite prewarmed"
~~~

Expected: FAIL because the query-only page does not exist.

- [ ] **Step 3: Implement route composition without default-policy changes**

Create LuBirthCinematicPreludeRoute using the existing VisualCanvas and LuBirthSceneSlot with the established NASA/Relief-lite policy. Set window.__MiraLithOpeningProgress from the route’s explicit progress test control or normal opening driver. Render the new stack around VisualCanvas only.

The route may parse query-only controls for progress, geoLat, geoLon, location, quality, and copy. It must not mutate resolveLandingVisualPolicy defaults, LuBirthRevisedRoute, globals.css, or the homepage path.

Publish telemetry under window.__MiraLithLuBirthCinematicPrelude with at least:

~~~ts
{
  source: "plate" | "live",
  state: PreludeState,
  progress: number,
  normalizedComposition: { x: number; y: number; scale: number },
  selectedTier: "desktop" | "mobile" | null,
  armStatus: "ready" | "late" | "failed" | "skipped",
  requestedFrame: number | null,
  renderedFrame: number | null,
  veilOpacity: number,
  fallbackReason: string | null
}
~~~

- [ ] **Step 4: Run the integration test to prove it passes**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts --grep "keeps real IP Relief-lite prewarmed"
~~~

Expected: PASS for normal, northern, southern, dateline-adjacent, and birth-default inputs.

- [ ] **Step 5: Commit the query-only route**

~~~sh
git add apps/site/components/LuBirthCinematicPreludeRoute.tsx apps/site/app/lubirth-cinematic-prelude/page.tsx tests/e2e/lubirth-cinematic-prelude.spec.ts
git commit -m "feat(lubirth): add query-only cinematic prelude route"
~~~

## Task 5: Prove Arming, Match Cut, Reverse, and Fallback Semantics

**Files:**
- Modify: tests/e2e/lubirth-cinematic-prelude.spec.ts
- Modify: tests/e2e/lubirth-cinematic-prelude-controller.spec.ts

- [ ] **Step 1: Write failing behavioral tests**

Add deterministic fake-provider query controls limited to the query-only route:

- preludeTest=late-first-frame: arm misses before progress zero, then becomes ready at progress 0.10; expected source remains live;
- preludeTest=reverse-pending: reverse target frame is pending at veil peak; expected current live frame remains visible;
- preludeTest=reverse-timeout: target never becomes ready; expected veil reopens and source stays live;
- preludeTest=decode-error, background-resume, and low-memory: expected live fallback with an explicit telemetry reason;
- preludeTest=reduced-motion: expected plate is skipped;
- progress values oscillating through 0.18–0.22: expected source-cut count remains one.

- [ ] **Step 2: Run behavioral tests to prove they fail**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts --grep "does not enter late|reopens live|hysteresis"
~~~

Expected: FAIL until all route-level conditions connect to the controller.

- [ ] **Step 3: Connect controller state to browser lifecycle**

Wire visibilitychange, pageshow, media error, and low-memory test hooks to controller fallback. On successful forward live lock, release provider presentation resources. On reverse, request target frame before source cut and use only shared veil for concealment.

Record source-cut count in telemetry. Do not use CSS opacity to overlap a visible plate and Canvas Earth during the source cut.

- [ ] **Step 4: Run behavioral tests to prove they pass**

Run:

~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts
~~~

Expected: PASS for normal forward, boundary jitter, reverse ready, reverse timeout, all listed fallbacks, and mobile tier selection.

- [ ] **Step 5: Commit behavior proof**

~~~sh
git add tests/e2e/lubirth-cinematic-prelude.spec.ts tests/e2e/lubirth-cinematic-prelude-controller.spec.ts
git commit -m "test(lubirth): cover cinematic prelude recovery"
~~~

## Task 6: Capture Visual and Performance Evidence; Make the Route Decision

**Files:**
- Create: docs/lubirth-cinematic-prelude-evidence/2026-07-30/README.md
- Create: docs/lubirth-cinematic-prelude-evidence/2026-07-30/desktop-telemetry.json
- Create: docs/lubirth-cinematic-prelude-evidence/2026-07-30/mobile-telemetry.json
- Modify: tests/e2e/lubirth-cinematic-prelude.spec.ts

- [ ] **Step 1: Add failing evidence-gate assertions**

Add a test that fails if the route does not expose:

~~~ts
expect(metrics.firstFrameMs).toBeLessThanOrEqual(metrics.tier === "desktop" ? 1200 : 1800);
expect(metrics.transferBytes).toBeLessThanOrEqual(metrics.tier === "desktop" ? 6 * 1024 * 1024 : 2 * 1024 * 1024);
expect(metrics.presentationResidencyBytes).toBeLessThanOrEqual(metrics.tier === "desktop" ? 16 * 1024 * 1024 : 8 * 1024 * 1024);
expect(metrics.rafP95Ms).toBeLessThanOrEqual(33.4);
expect(metrics.droppedFrameRate).toBeLessThanOrEqual(0.02);
expect(metrics.reliefCloudGpuP95Ms).toBeLessThanOrEqual(3);
~~~

Skip the GPU assertion only when the browser extension is unavailable, and record that lack as evidence rather than treating it as a pass.

- [ ] **Step 2: Run evidence gate to prove it fails**

Run:

~~~sh
MIRALITH_CINEMATIC_PRELUDE_EVIDENCE_DIR=/private/tmp/miralith-cinematic-prelude-evidence pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude.spec.ts --grep "records prelude evidence"
~~~

Expected: FAIL until telemetry and capture hooks are complete.

- [ ] **Step 3: Implement evidence capture and visual review**

Capture desktop and mobile frames at progress 0.00, 0.18, 0.195, 0.22, and 0.30. Save only source-bound JSON evidence and approved representative captures. Review all captures at 1× for:

- no continental double image;
- no black/blank frame;
- no brightness or veil-color jump after opening;
- no crop leakage at desktop/mobile safe-crop limits;
- no DOM title/navigation coverage;
- intact Relief-lite cloud GPU budget after the handoff;
- acceptable rAF/drop rate and target-frame latency.

Use real target browser/device measurements for promotion evidence. Headless measurements remain diagnostic only.

- [ ] **Step 4: Run full verification**

Run:

~~~sh
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site build
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cinematic-prelude-contract.spec.ts tests/e2e/lubirth-cinematic-prelude-controller.spec.ts tests/e2e/lubirth-cinematic-prelude.spec.ts
git diff --check
~~~

Expected: all commands pass before documenting either PROMOTE or REJECT.

- [ ] **Step 5: Write the explicit decision and commit**

The evidence README must end with exactly one of PROMOTE or REJECT. It must state that promotion is impossible if the plate violates visual quality, frame-addressability, transfer/residency, first-frame, cadence, or no-double-image gates. It must also state whether a separate default-home promotion plan is authorized.

~~~sh
git add docs/lubirth-cinematic-prelude-evidence/2026-07-30 tests/e2e/lubirth-cinematic-prelude.spec.ts
git commit -m "docs(lubirth): record cinematic prelude decision"
~~~

## Plan Self-Review

- Spec coverage: Tasks 1–2 cover media, frame-addressability, and lifecycle; Task 3 covers independent veil/Canvas ownership and color/crop; Task 4 covers normalized IP plus real-IP prewarm; Task 5 covers reverse and fallback; Task 6 covers visual, performance, and explicit decision.
- Scope: all runtime changes are query-only; no default-home, Hybrid, or deep-impostor file is listed.
- Consistency: the same 0.18, 0.195, and 0.22 thresholds, desktop/mobile budgets, and primary-only FrameProvider rule appear in every task.
- Placeholder scan: the only external input is a declared high-quality offline master source, which is a hard precondition validated by Task 1 rather than an implementation omission.
