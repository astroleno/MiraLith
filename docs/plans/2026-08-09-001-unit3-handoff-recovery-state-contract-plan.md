# Unit 3 Typed Handoff, Recovery, and Playback State Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the versioned visual-handoff, semantic return-state, narrative ownership, and media-attempt contracts required by CP1.3 without implementing any Unit 4 transition visuals or Unit 5 cinematic sequencing.

**Architecture:** Unit 3 is split into four pure contracts and two narrow integrations. Typed handoffs are validated against exact chapter edges before entering the transition runtime; semantic return snapshots are schema/build/revision scoped and route adapters validate stop/media IDs; the narrative reducer owns all legal controller transitions; and playback attempts use monotonic ownership tokens to reject stale media continuations. `ChapterTransitionProvider` only transports validated handoff and return data, while `PostCoScrollRouteShell` proves deterministic capture/restore without becoming the final ArtBreeze controller.

**Tech Stack:** TypeScript 6, React 19, Next.js 16 App Router, Playwright 1.59 Node/browser fixtures, sessionStorage, existing chapter transition coordinator.

---

## Scope lock

Unit 3 includes:

- `coscroll-ring`, `focuence-stars`, and `cosmic-water` payload schemas, edge validation, and normalized CSS-variable projection.
- A `chapter-return-v2` snapshot with build scope, monotonic revision, semantic stop, media outcome, playback position, mute state, and allowlisted route state.
- A legacy adapter for the existing 01–03 `routeProgress` / `terminalState` snapshot.
- A route-level capture/restore registration consumed by the coordinator and by `pagehide`.
- A pure narrative state reducer with one input owner per state.
- A monotonic playback-attempt controller that filters delayed `play()` and media events.
- Contract fixtures and evidence required to place CP1.3 into independent review.

Unit 3 explicitly excludes:

- CoScroll terminal activation, jade residue, particle rendering, the loading-ring animation, or any Unit 4 visual.
- ScrollTrigger, final `NarrativeController.tsx`, ArtBreeze shot sequencing, answer playback UI, AeScape/Focuence orchestration, or any Unit 5 implementation.
- Production CDN/media publication.
- New arbitrary animation kinds, URL-bearing payloads, or a general animation DSL.

## File map

| File | Responsibility |
| --- | --- |
| `apps/site/components/chapter-transition/chapterTransitionTypes.ts` | Public transition, handoff, destination-reset, and return-snapshot types. |
| `apps/site/components/chapter-transition/chapterVisualHandoff.ts` | Runtime validation and normalized CSS-variable projection for the three approved visual edges. |
| `apps/site/components/chapter-transition/chapterRouteState.ts` | Snapshot creation, untrusted parsing, legacy normalization, revision protection, and storage failure containment. |
| `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx` | Transport validated handoff, register route adapters, capture before navigation/pagehide, and pass normalized return state to reset. |
| `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx` | Expose validated handoff kind and normalized variables without implementing final visuals. |
| `apps/site/components/post-coscroll/narrativeControllerState.ts` | Pure legal-transition table and derived single input owner. |
| `apps/site/components/post-coscroll/mediaPlaybackAttempt.ts` | Monotonic attempt ownership and stale continuation invalidation. |
| `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx` | Minimal semantic capture/restore adapter for current poster/video shell. |
| `apps/site/app/spikes/post-coscroll-controller-contract/page.tsx` | Development-only real DOM/video contract fixture; returns 404 unless the fixture environment flag is enabled. |
| `apps/site/components/post-coscroll/PostCoScrollControllerContractFixture.tsx` | Buttons and real `<video>` ref used to prove attempt races and controller ownership. |
| `playwright.contract.config.ts` | Fixed-port development runner that enables only the gated Unit 3 fixture. |
| `tests/unit/chapterVisualHandoff.spec.ts` | Handoff allowlist, geometry, edge, version, and CSS projection tests. |
| `tests/unit/chapterRouteState.spec.ts` | Snapshot schema/build/revision, legacy, manifest, and storage tests. |
| `tests/unit/narrativeControllerState.spec.ts` | Legal/illegal transition and single-owner tests. |
| `tests/unit/mediaPlaybackAttempt.spec.ts` | Attempt generation and stale continuation tests. |
| `tests/e2e/chapter-route-state.spec.ts` | Actual route-shell history/refresh capture and restore tests. |
| `tests/e2e/post-coscroll-controller-contract.spec.ts` | Real `<video>` and delayed promise/event race tests. |
| `tests/unit/reactThreeRuntimeResolution.spec.ts` | Regression guard proving site and RadioGaga resolve one R3F/Drei/React runtime. |
| `docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-status.json` | Durable CP1.3 candidate identity and verification report. |
| `docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-checksums.sha256` | Root-relative evidence checksum. |

### Task 1: Add the typed visual handoff contract

**Files:**
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Create: `apps/site/components/chapter-transition/chapterVisualHandoff.ts`
- Create/Test: `tests/unit/chapterVisualHandoff.spec.ts`

- [ ] **Step 1: Write the failing handoff tests**

Create tests that import the not-yet-existing validator and assert the exact approved edges:

```ts
import { expect, test } from "@playwright/test";
import {
  chapterVisualHandoffCssVariables,
  parseChapterVisualHandoff
} from "../../apps/site/components/chapter-transition/chapterVisualHandoff";

const ring = {
  version: "chapter-visual-handoff-v1",
  kind: "coscroll-ring",
  sourceHref: "/coscroll",
  targetHref: "/artbreeze",
  center: { x: 0.5, y: 0.5 },
  diameter: 0.11875,
  lineWidth: 0.00625,
  gapAngleRadians: 2.705260340591211,
  phaseRadians: 2.722713633111154,
  angularVelocityRadiansPerSecond: 6.918,
  direction: "clockwise",
  signalSource: "live"
} as const;

test("accepts only the versioned CoScroll to ArtBreeze ring payload", () => {
  expect(parseChapterVisualHandoff(ring, "/coscroll", "/artbreeze")).toEqual(ring);
  expect(parseChapterVisualHandoff({ ...ring, version: "chapter-visual-handoff-v0" }, "/coscroll", "/artbreeze")).toBeNull();
  expect(parseChapterVisualHandoff(ring, "/artbreeze", "/constellation")).toBeNull();
});

test("rejects out-of-range geometry and unknown payload fields", () => {
  expect(parseChapterVisualHandoff({ ...ring, center: { x: 1.1, y: 0.5 } }, "/coscroll", "/artbreeze")).toBeNull();
  expect(parseChapterVisualHandoff({ ...ring, mediaUrl: "https://example.invalid/video.mp4" }, "/coscroll", "/artbreeze")).toBeNull();
});

test("projects validated normalized geometry into stable CSS variables", () => {
  const parsed = parseChapterVisualHandoff(ring, "/coscroll", "/artbreeze");
  expect(parsed && chapterVisualHandoffCssVariables(parsed)).toMatchObject({
    "--chapter-handoff-center-x": "50%",
    "--chapter-handoff-center-y": "50%",
    "--chapter-handoff-diameter": "11.875%",
    "--chapter-handoff-gap-angle": `${ring.gapAngleRadians}rad`
  });
});
```

Add equivalent valid fixtures for `focuence-stars` on `/artbreeze → /constellation` and `cosmic-water` on `/constellation → /client-works`; assert that cross-edge reuse, empty/oversized star arrays, non-finite numbers, unknown keys, and any URL-like field fail closed.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/chapterVisualHandoff.spec.ts --workers=1
```

Expected: FAIL because `chapterVisualHandoff.ts` and its exports do not exist.

- [ ] **Step 3: Declare the exact payload union**

Add to `chapterTransitionTypes.ts`:

```ts
export const CHAPTER_VISUAL_HANDOFF_VERSION = "chapter-visual-handoff-v1" as const;

export interface NormalizedChapterPoint {
  x: number;
  y: number;
}

export interface CoScrollRingHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "coscroll-ring";
  sourceHref: "/coscroll";
  targetHref: "/artbreeze";
  center: NormalizedChapterPoint;
  diameter: number;
  lineWidth: number;
  gapAngleRadians: number;
  phaseRadians: number;
  angularVelocityRadiansPerSecond: number;
  direction: "clockwise";
  signalSource: "live" | "fallback";
}

export interface FocuenceStarsHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "focuence-stars";
  sourceHref: "/artbreeze";
  targetHref: "/constellation";
  origin: NormalizedChapterPoint;
  points: readonly NormalizedChapterPoint[];
  phaseRadians: number;
}

export interface CosmicWaterHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "cosmic-water";
  sourceHref: "/constellation";
  targetHref: "/client-works";
  focus: NormalizedChapterPoint;
  horizonY: number;
  phaseRadians: number;
}

export type ChapterVisualHandoff =
  | CoScrollRingHandoff
  | FocuenceStarsHandoff
  | CosmicWaterHandoff;
```

No payload contains a URL, media id, free-form CSS string, arbitrary transition kind, or pixel coordinate.

- [ ] **Step 4: Implement strict runtime parsing and CSS projection**

`chapterVisualHandoff.ts` must:

- require a plain object with exactly the keys for its discriminated kind;
- require version `chapter-visual-handoff-v1`;
- match the exact source/target edge;
- keep normalized points in `[0, 1]`;
- require finite positive ring diameter/line width and finite phases/velocity;
- accept 1–64 finite star points;
- return a newly frozen, sanitized object rather than the untrusted input object;
- emit only known `--chapter-handoff-*` variables.

The public signatures are:

```ts
export function parseChapterVisualHandoff(
  value: unknown,
  sourceHref: string,
  targetHref: string
): ChapterVisualHandoff | null;

export function chapterVisualHandoffCssVariables(
  handoff: ChapterVisualHandoff
): React.CSSProperties & Record<`--chapter-handoff-${string}`, string>;
```

- [ ] **Step 5: Run GREEN and commit**

Run the focused test, site typecheck, and `git diff --check`. Expected: all pass.

Commit:

```bash
git add apps/site/components/chapter-transition/chapterTransitionTypes.ts apps/site/components/chapter-transition/chapterVisualHandoff.ts tests/unit/chapterVisualHandoff.spec.ts
git commit -m "feat(chapters): add typed visual handoff contract"
```

### Task 2: Transport validated handoff through the coordinator

**Files:**
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionLayer.tsx`
- Modify/Test: `tests/unit/chapterVisualHandoff.spec.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`

- [ ] **Step 1: Extend the focused tests before production code**

Add assertions for a pure `resolveChapterTransitionHandoff` helper:

```ts
test("uses the validated payload as the visual variant and degrades malformed input to direct", () => {
  const valid = resolveChapterTransitionHandoff(ring, "/coscroll", "/artbreeze");
  expect(valid).toMatchObject({ kind: "coscroll-ring", handoff: ring });
  expect(resolveChapterTransitionHandoff({ ...ring, kind: "cosmic-water" }, "/coscroll", "/artbreeze")).toEqual({
    kind: "direct",
    handoff: null
  });
});
```

Run the focused test and confirm it fails because the helper is absent.

- [ ] **Step 2: Add handoff to every runtime consumer**

Add `handoff: ChapterVisualHandoff | null` to:

- `ChapterTransitionSnapshot`;
- private `ActiveChapterTransition`;
- `ChapterDestinationResetContext`.

Change the public method to:

```ts
beginTransition: (
  targetHref: string,
  initiator: Exclude<ChapterTransitionInitiator, "history">,
  handoff?: ChapterVisualHandoff | null
) => string | null;
```

`startRuntime` must parse the supplied payload against the normalized source/target. A valid handoff sets both runtime `handoff` and visual `kind`; invalid or mismatched input sets `handoff: null` and `kind: "direct"`. Existing `/ → /radio-gaga` and `/radio-gaga → /coscroll` calls without a handoff retain their legacy kinds. History always starts with `handoff: null` and `kind: "direct"`.

The validated handoff exists only on the active in-memory transition. It is never copied into sessionStorage, history state, or a return snapshot.

`chapterVisualHandoff.ts` exports the shared resolver so validation cannot diverge between caller tests and the Provider:

```ts
export function resolveChapterTransitionHandoff(
  value: unknown,
  sourceHref: string,
  targetHref: string
): {
  kind: "direct" | ChapterVisualHandoff["kind"];
  handoff: ChapterVisualHandoff | null;
};
```

Extend `ChapterTransitionKind` with `ChapterVisualHandoff["kind"]`; do not create a second, separately maintained visual-kind union.

- [ ] **Step 3: Add a data/CSS bridge without final animation**

`ChapterTransitionLayer` exposes `data-handoff-kind={snapshot.handoff?.kind}`. `ChapterTransitionVisual` applies `chapterVisualHandoffCssVariables(snapshot.handoff)` and renders one inert marker element:

```tsx
<div
  className="chapter-transition-visual__handoff-contract"
  data-chapter-handoff={snapshot.handoff?.kind}
  style={snapshot.handoff ? chapterVisualHandoffCssVariables(snapshot.handoff) : undefined}
  aria-hidden="true"
/>
```

Do not add ring, star, water, particle, trail, or morph animation CSS in Unit 3.

- [ ] **Step 4: Preserve existing behavior and commit**

Run handoff unit tests, typecheck, lint, and the existing transition/navigation focused suite. Expected: existing 01–03 behavior remains green and no handoff node appears during current published transitions.

Commit:

```bash
git add apps/site/components/chapter-transition tests/unit/chapterVisualHandoff.spec.ts tests/e2e/chapter-transition.spec.ts
git commit -m "feat(chapters): carry validated handoff through transitions"
```

### Task 3: Add the versioned semantic return-state codec

**Files:**
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Create: `apps/site/components/chapter-transition/chapterRouteState.ts`
- Create/Test: `tests/unit/chapterRouteState.spec.ts`

- [ ] **Step 1: Write RED tests for schema, build, manifest, and revision**

The test manifest is:

```ts
const manifest = {
  pathname: "/artbreeze",
  stopIds: ["entry", "await-send", "answer-tail"],
  mediaIds: ["artbreeze-first-sequence", "artbreeze-answer"],
  routeState: {
    answerSubmitted: { kind: "boolean" },
    answerMode: { kind: "enum", values: ["waiting", "answered"] }
  }
} as const;
```

Cover these facts:

- matching `chapter-return-v2`, build scope, pathname, known stop/media, finite time, and allowlisted route key parse successfully;
- schema/build/path mismatch returns `null`;
- arbitrary URL/media id/stop id/route key returns `null` rather than being dropped;
- `playing` normalizes to `paused-ready` on restore;
- completed/skipped media preserve the outcome and clamp to the supplied tail time;
- a lower revision cannot overwrite a newer stored snapshot;
- storage get/set exceptions return a deterministic miss/result instead of throwing;
- the legacy 01–03 object normalizes to `semantic.kind: "legacy-progress"` while preserving `routeProgress`, `terminalState`, and `scrollY`.

Run the focused test and verify it fails because `chapterRouteState.ts` is absent.

- [ ] **Step 2: Define the semantic snapshot**

Add these public types:

```ts
export const CHAPTER_RETURN_SNAPSHOT_VERSION = "chapter-return-v2" as const;

export type ChapterMediaOutcome =
  | "ready"
  | "playing"
  | "paused-ready"
  | "completed"
  | "skipped";

export interface ChapterSemanticMediaState {
  id: string;
  outcome: ChapterMediaOutcome;
  timeSeconds: number;
  muted: boolean;
}

export interface ChapterSemanticRouteState {
  kind: "semantic";
  stopId: string;
  media: ChapterSemanticMediaState | null;
  routeState: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ChapterLegacyRouteState {
  kind: "legacy-progress";
  routeProgress: number | null;
  terminalState: boolean;
}

export interface ChapterReturnSnapshot {
  schema: typeof CHAPTER_RETURN_SNAPSHOT_VERSION;
  buildScope: string;
  pathname: string;
  revision: number;
  scrollY: number;
  routeProgress: number | null;
  terminalState: boolean;
  semantic: ChapterSemanticRouteState | ChapterLegacyRouteState;
  timestamp: number;
}
```

The retained flat legacy fields allow existing 01–03 reset code to remain unchanged during Unit 3.

- [ ] **Step 3: Implement the codec and injected storage boundary**

Expose:

```ts
export interface ChapterRouteStateManifest {
  pathname: string;
  stopIds: readonly string[];
  mediaIds: readonly string[];
  routeState: Readonly<Record<string,
    | { kind: "boolean" }
    | { kind: "number"; min: number; max: number }
    | { kind: "enum"; values: readonly string[] }
  >>;
  mediaTailSeconds?: Readonly<Record<string, number>>;
}

export function parseChapterReturnSnapshot(
  value: unknown,
  context: { pathname: string; buildScope: string; manifest?: ChapterRouteStateManifest }
): ChapterReturnSnapshot | null;

export function writeChapterReturnSnapshot(
  storage: Pick<Storage, "getItem" | "setItem">,
  key: string,
  snapshot: ChapterReturnSnapshot
): "written" | "stale" | "unavailable";

export function readChapterReturnSnapshot(
  storage: Pick<Storage, "getItem">,
  key: string,
  context: { pathname: string; buildScope: string; manifest?: ChapterRouteStateManifest }
): ChapterReturnSnapshot | null;
```

Reject non-plain objects and unknown keys at every level. A semantic snapshot without the destination's registered manifest is rejected; only the restricted 01–03 legacy adapter may parse without one. Route-state values must satisfy their manifest field descriptor; strings are accepted only as explicit enum members, so an allowlisted key cannot smuggle an arbitrary URL. Require the build scope to be 64 lowercase hex characters. Finite times are clamped to `[0, mediaTailSeconds[id]]` when a tail is declared. Restore normalization changes `playing` to `paused-ready`; it never restores audible playing.

The legacy unversioned reader is restricted to `/`, `/radio-gaga`, and `/coscroll`; a legacy object for any 04–07 pathname is rejected. If `NEXT_PUBLIC_MIRALITH_CHAPTER_PREVIEW_SCOPE` is absent or malformed, semantic persistence fails closed and the destination uses its deterministic entry state.

- [ ] **Step 4: Run GREEN and commit**

Run the focused test, typecheck, and `git diff --check`. Commit:

```bash
git add apps/site/components/chapter-transition/chapterTransitionTypes.ts apps/site/components/chapter-transition/chapterRouteState.ts tests/unit/chapterRouteState.spec.ts
git commit -m "feat(chapters): add semantic return-state codec"
```

### Task 4: Integrate capture/restore with the coordinator and route shell

**Files:**
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Create/Test: `tests/e2e/chapter-route-state.spec.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`

- [ ] **Step 1: Write failing browser contracts**

Using the local-preview runner, add tests that:

1. enter ArtBreeze, explicitly start video, seek to a known time, mute, navigate to Constellation, then go back;
2. assert ArtBreeze restores the same media id and a position no more than two seconds behind, but the video is paused/ready and never audibly playing;
3. mark the media completed, navigate away/back, and assert the tail state is restored without replay;
4. replace the stored build scope or media id with an invalid value and assert the deterministic entry poster is used;
5. make sessionStorage throw and assert navigation/reveal still reaches idle;
6. verify the existing 01–03 route-progress history tests remain green.

Run the new spec and verify RED: the current shell always resets video state to zero and the stored snapshot lacks schema/semantic data.

- [ ] **Step 2: Add a route-state adapter registration**

Extend the existing destination registration atomically so reset controls and route-state validation cannot register in different React effects:

```ts
export interface ChapterRouteStateAdapter {
  manifest: ChapterRouteStateManifest;
  capture: () => ChapterSemanticRouteState;
}

export interface ChapterDestinationControls {
  resetEntry: (context: ChapterDestinationResetContext) => void | Promise<void>;
  forceFallback: (context: ChapterDestinationFallbackContext) => void | Promise<void>;
  routeState?: ChapterRouteStateAdapter;
}

captureRouteState: (pathname: string, reason: "semantic" | "media-time" | "pagehide" | "transition") => void;
```

`useChapterTransitionDestination()` returns a pathname-bound `captureRouteState(reason)` callback. The Provider constructs schema/build/pathname/revision/timestamp/scroll fields; a route adapter supplies only its validated semantic state.

The Provider owns revisions per pathname. It captures synchronously:

- immediately for semantic stop, media outcome, mute, skip, ended, pause, and seeked;
- at most once per two seconds for active playback time;
- on `pagehide`;
- immediately before starting a coordinator transition.

Any queued media-time write records its source revision and is discarded if a newer immediate capture exists.

- [ ] **Step 3: Preserve the legacy adapter**

If no registered route adapter exists, capture the current 01–03 `routeProgress`, `terminalState`, and `scrollY` into a valid v2 snapshot with `semantic.kind: "legacy-progress"`. `readReturnSnapshot` also accepts the old unversioned object and normalizes it in memory. Existing route reset call sites continue reading the flat fields.

- [ ] **Step 4: Register the current post-CoScroll shell**

`PostCoScrollRouteShell` builds its manifest from the actual `mediaItems` ids. Its current semantic stop ids are exactly `entry`, `poster-ready`, `playing`, and `media-tail`; `playbackRequested` and `audioEnabled` are declared as boolean route-state fields.

Capture rules:

- no video: `entry` or `poster-ready`, media outcome `ready`;
- active video: stop `playing`, current media id/time/mute, outcome `playing` or `paused-ready`;
- ended: stop `media-tail`, outcome `completed`;
- explicit skip when added by later units: outcome `skipped`.

Effects call `captureRouteState(pathname, "semantic")` after stop/outcome/mute changes and `captureRouteState(pathname, "media-time")` from `timeupdate`; the Provider, not the component, enforces the two-second throttle and revision check.

Restore rules:

- `playing`/`paused-ready`: mount the verified local video, seek after metadata, keep paused, keep mute state;
- completed/skipped: mount or show the verified tail/poster without calling `play()`;
- invalid/missing snapshot: current deterministic entry behavior.

- [ ] **Step 5: Run GREEN and commit**

Run the new route-state E2E under `playwright.local-preview.config.ts`, existing transition history tests under production config, Node contracts, typecheck, and lint. Commit:

```bash
git add apps/site/components/chapter-transition apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx tests/e2e/chapter-route-state.spec.ts tests/e2e/chapter-transition.spec.ts
git commit -m "feat(chapters): restore semantic route state safely"
```

### Task 5: Add the single-owner narrative controller reducer

**Files:**
- Create: `apps/site/components/post-coscroll/narrativeControllerState.ts`
- Create/Test: `tests/unit/narrativeControllerState.spec.ts`

- [ ] **Step 1: Write RED tests for the complete state table**

The public phases and owners are:

| Phase | Input owner |
| --- | --- |
| `scrub` | `scroll-timeline` |
| `await-send` | `await-send` |
| `answer-starting` | `autoplay-controls` |
| `manual-ready` | `autoplay-controls` |
| `autoplay` | `autoplay-controls` |
| `reverse-before-complete` | `scroll-timeline` |
| `release` | `scroll-timeline` |
| `transitioning` | `route-transition` |

Test every allowed edge and representative forbidden edges. Required allowed edges:

```text
scrub --reach-await--> await-send
await-send --request-play--> answer-starting
answer-starting --play-accepted--> autoplay
answer-starting --play-rejected--> manual-ready
manual-ready --request-play--> answer-starting
manual-ready --skip--> release
autoplay --reverse--> reverse-before-complete
autoplay --ended|skip--> release
reverse-before-complete --settled--> scrub
release --next-segment--> scrub
scrub|await-send|answer-starting|manual-ready|autoplay|reverse-before-complete|release --route-transition--> transitioning
transitioning --reset--> scrub
```

Each accepted result must expose exactly one derived owner. Rejected transitions return `{ accepted: false, state: originalState }` and cannot mutate the original object.

- [ ] **Step 2: Run RED**

Run the focused unit test. Expected: missing module failure.

- [ ] **Step 3: Implement the discriminated state/event reducer**

Export:

```ts
export type NarrativeControllerPhase =
  | "scrub"
  | "await-send"
  | "answer-starting"
  | "manual-ready"
  | "autoplay"
  | "reverse-before-complete"
  | "release"
  | "transitioning";

export type NarrativeInputOwner =
  | "scroll-timeline"
  | "await-send"
  | "autoplay-controls"
  | "route-transition";

export function narrativeInputOwnerForPhase(phase: NarrativeControllerPhase): NarrativeInputOwner;

export function reduceNarrativeControllerState(
  state: NarrativeControllerState,
  event: NarrativeControllerEvent
): { accepted: true; state: NarrativeControllerState } | { accepted: false; state: NarrativeControllerState };
```

State carries only route-agnostic `segmentId`, `phase`, `progress`, `attemptGeneration`, and completed/skipped outcome. It does not contain ArtBreeze shot ids, DOM selectors, ScrollTrigger instances, media URLs, or transition animation parameters.

- [ ] **Step 4: Run GREEN and commit**

Run focused tests, typecheck, and lint. Commit:

```bash
git add apps/site/components/post-coscroll/narrativeControllerState.ts tests/unit/narrativeControllerState.spec.ts
git commit -m "feat(post-coscroll): define narrative ownership state machine"
```

### Task 6: Add monotonic media playback attempts

**Files:**
- Create: `apps/site/components/post-coscroll/mediaPlaybackAttempt.ts`
- Create/Test: `tests/unit/mediaPlaybackAttempt.spec.ts`
- Create: `apps/site/components/post-coscroll/PostCoScrollControllerContractFixture.tsx`
- Create: `apps/site/app/spikes/post-coscroll-controller-contract/page.tsx`
- Create: `playwright.contract.config.ts`
- Create/Test: `tests/e2e/post-coscroll-controller-contract.spec.ts`

- [ ] **Step 1: Write failing attempt-race tests**

Use deferred promises and a fake media element for unit tests. Prove:

- generations increase monotonically;
- `begin()` pauses and invalidates the prior element;
- ownership includes generation, segment id, element identity, and transition id;
- skip, reverse, new attempt, navigation, visibility hidden, and unmount invalidate the token;
- delayed fulfill/reject/playing/ended callbacks cannot write state or outcome;
- a delayed fulfill that starts the underlying element after invalidation causes another `pause()`.

Run RED before creating the implementation.

- [ ] **Step 2: Implement the attempt controller**

Export:

```ts
export interface MediaPlaybackAttemptToken {
  generation: number;
  segmentId: string;
  element: HTMLMediaElement;
  transitionId: string | null;
}

export interface MediaPlaybackAttemptController {
  begin(input: Omit<MediaPlaybackAttemptToken, "generation">): MediaPlaybackAttemptToken;
  isCurrent(token: MediaPlaybackAttemptToken): boolean;
  guard(token: MediaPlaybackAttemptToken, continuation: () => void): boolean;
  invalidate(reason: "skip" | "reverse" | "new-attempt" | "navigation" | "hidden" | "unmount"): void;
  requestPlay(token: MediaPlaybackAttemptToken): Promise<"playing" | "rejected" | "stale">;
}

export function createMediaPlaybackAttemptController(): MediaPlaybackAttemptController;
```

`requestPlay()` calls `token.element.play()` synchronously before its first await. A stale resolution/rejection returns `stale`; if the element is no longer paused, it pauses again.

- [ ] **Step 3: Add the gated real-video fixture**

The server page returns `notFound()` unless `MIRALITH_CONTRACT_FIXTURES=1`. The client fixture renders a real `<video ref>` and controls that expose phase, owner, generation, and pause count through `data-*` attributes. It allows the E2E test to replace `play()` with a controllable promise while preserving real element identity.

`playwright.contract.config.ts` uses a fixed `next dev` port, `reuseExistingServer: false`, and this web-server environment only:

```ts
env: {
  MIRALITH_CONTRACT_FIXTURES: "1"
}
```

The production runner never receives this flag and must continue to return 404 for the fixture route.

- [ ] **Step 4: Prove gesture order and stale races in Chromium**

The browser test must assert:

- clicking Send calls `video.play()` in the same click task before any readiness continuation;
- rejection enters `manual-ready` and a second explicit click creates a higher generation;
- resolving the first promise after the second attempt cannot set playing;
- skip/reverse/navigation/unmount followed by delayed resolution leaves the fixture released/unmounted and increments pause count;
- an `ended` event from a stale element cannot mark the current segment completed.

Run with a fixed-port dev Playwright config and `MIRALITH_CONTRACT_FIXTURES=1`.

- [ ] **Step 5: Run GREEN and commit**

Run unit tests, the focused browser fixture, typecheck, and lint. Commit:

```bash
git add apps/site/components/post-coscroll/mediaPlaybackAttempt.ts apps/site/components/post-coscroll/PostCoScrollControllerContractFixture.tsx apps/site/app/spikes/post-coscroll-controller-contract/page.tsx playwright.contract.config.ts tests/unit/mediaPlaybackAttempt.spec.ts tests/e2e/post-coscroll-controller-contract.spec.ts
git commit -m "feat(post-coscroll): guard media playback attempts"
```

### Task 7: Close the CP1.3 candidate for independent review

**Files:**
- Modify: `docs/post-coscroll/CHECKPOINTS.md`
- Create: `docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-status.json`
- Create: `docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-checksums.sha256`
- Create/Test: `tests/unit/reactThreeRuntimeResolution.spec.ts`

- [ ] **Step 1: Add the retained R3F/Drei singleton guard**

Use `createRequire()` from `apps/site/package.json` and `packages/radio-gaga-scene/package.json`, resolve each runtime entry, normalize with `realpathSync()`, and assert equality for:

```text
@react-three/fiber
@react-three/drei
react
react-dom
```

This test should pass immediately on the repaired foundation. It adds no production code; its purpose is to fail if a later lockfile refresh splits the peer graph again.

- [ ] **Step 2: Run the full Unit 3 matrix**

Required commands and results:

```bash
pnpm typecheck
pnpm lint
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/chapterVisualHandoff.spec.ts tests/unit/chapterRouteState.spec.ts tests/unit/narrativeControllerState.spec.ts tests/unit/mediaPlaybackAttempt.spec.ts tests/unit/reactThreeRuntimeResolution.spec.ts tests/unit/miraLithChapters.spec.ts tests/unit/resolveChapterPreviewScope.spec.ts --workers=1
```

All must exit `0`.

Run the current production transition/navigation/media suite in a source tree with no `public/media/post-coscroll` residue. It must preserve `60 passed / 3 expected skipped` or report the new exact count with zero unexpected failures.

Run local-preview route-shell plus `chapter-route-state.spec.ts`; run the controller fixture separately with `MIRALITH_CONTRACT_FIXTURES=1`. Both commands must exit `0`.

- [ ] **Step 3: Verify scope and forbidden implementation**

The candidate diff must not contain:

```text
ScrollTrigger
CoScrollAnchorResidue
terminal-hold
particleization
Canvas
preserveDrawingBuffer
AfterimagePass
production media manifest
```

Allow the word `Canvas` only in historical docs outside the Unit 3 diff. Confirm no new video URL is accepted from storage/history/payload data.

- [ ] **Step 4: Record durable evidence**

The JSON records:

- base `eefce7cb889d3b78513e3ea52d347338e5feff59`;
- candidate commit/tree and binary patch SHA-256;
- handoff schema `chapter-visual-handoff-v1`;
- return schema `chapter-return-v2` and preview/build scope algorithm `chapter-preview-scope-v1`;
- the exact legal controller transition table and owner map;
- test commands/results;
- explicit Unit 4/5 exclusions;
- any retained non-blocking R3F/Drei singleton risk.

The checksum file uses a repository-root-relative path and passes:

```bash
shasum -a 256 -c docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-checksums.sha256
```

- [ ] **Step 5: Put CP1.3 into review, not PASS**

Set:

```text
CP1.3 — IN REVIEW
Unit 4 — CLOSED
```

Only an independent correctness review may authorize the exact candidate. A modification request, mixed proposal, or test-only partial pass does not open Unit 4.

- [ ] **Step 6: Commit evidence**

```bash
git add docs/post-coscroll/CHECKPOINTS.md docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-status.json docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-checksums.sha256
git commit -m "docs(post-coscroll): submit CP1.3 contract evidence"
```

## Self-review

- Spec coverage: typed handoff, direct fallback, semantic recovery, legacy recovery, manifest validation, storage containment, write timing, revision protection, controller ownership, attempt races, and Unit 4/5 exclusions each have a dedicated task and test gate.
- Placeholder scan: the plan contains no deferred implementation slot; future Units are explicit exclusions rather than unfinished Unit 3 work.
- Type consistency: `ChapterVisualHandoff`, `ChapterReturnSnapshot`, `ChapterRouteStateAdapter`, `NarrativeControllerState`, and `MediaPlaybackAttemptToken` retain the same names and ownership boundaries across tasks.
- Dependency direction: pure codecs/reducers do not import React or the Provider; the Provider and route shell consume them, and fixtures consume public contracts rather than private runtime refs.
- Safety: all untrusted objects fail closed, storage exceptions cannot deadlock a transition, audible playing is never restored, and stale async media work cannot revive an invalidated attempt.
