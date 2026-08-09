# Unit 3 Typed Handoff, Recovery, and Playback State Contracts Implementation Plan

> **Execution default:** Use `superpowers:executing-plans` to implement this plan task-by-task. Use subagents only after the user explicitly authorizes agent delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the versioned visual-handoff, semantic return-state, narrative ownership, and media-attempt contracts required by CP1.3 without implementing any Unit 4 transition visuals or Unit 5 cinematic sequencing.

**Architecture:** Unit 3 is split into four pure contracts and two narrow integrations. Typed handoffs are validated against exact chapter edges before entering the transition runtime; semantic return snapshots are schema/build/revision scoped and route adapters validate stop/media IDs; the narrative reducer owns all legal controller transitions; and playback attempts use monotonic ownership tokens to reject stale media continuations. `ChapterTransitionProvider` only transports validated handoff and return data, while `PostCoScrollRouteShell` proves deterministic capture/restore without becoming the final ArtBreeze controller.

**Tech Stack:** TypeScript 6, React 19, Next.js 16 App Router, Playwright 1.59 Node/browser fixtures, sessionStorage, existing chapter transition coordinator.

---

## Scope lock

Unit 3 includes:

- `coscroll-ring`, `focuence-stars`, and `cosmic-water` payload schemas, edge validation, and normalized CSS-variable projection.
- A `chapter-return-v2` snapshot with build scope, monotonic revision, semantic stop, segment/narrative progress, independent completed/skipped media sets, one optional active-media playback state, mute preference, and allowlisted route state.
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
| `apps/site/components/chapter-transition/chapterTransitionTypes.ts` | Public transition, handoff, and destination-reset types; imports/re-exports route-state data types from the leaf module. |
| `apps/site/components/chapter-transition/chapterVisualHandoff.ts` | Runtime validation and normalized CSS-variable projection for the three approved visual edges. |
| `apps/site/components/chapter-transition/chapterRouteStateTypes.ts` | Leaf data-only module for return snapshots, route manifests, and adapter data; imports no transition runtime module. |
| `apps/site/components/chapter-transition/chapterRouteState.ts` | Snapshot creation, untrusted parsing, legacy normalization, revision protection, and storage failure containment. |
| `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx` | Transport validated handoff, register route adapters, capture before navigation/pagehide, and pass normalized return state to reset. |
| `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx` | Expose validated handoff kind and normalized variables without implementing final visuals. |
| `apps/site/app/artbreeze/page.tsx` | Supply the complete resolved ArtBreeze media-id allowlist to the route-state adapter without changing visible sequencing. |
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
| `tests/unit/reactThreeRuntimeResolution.spec.ts` | Regression guard proving site, RadioGaga, CoScroll, and LuBirth resolve one R3F/Drei/React runtime. |
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
  exitProgress: 1,
  angleRadians: 2.722713633111154,
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
    "--chapter-handoff-angle": `${ring.angleRadians}rad`
  });
});
```

Add a second valid `coscroll-ring` fixture with `signalSource: "fallback"` and `gapPhaseRadians` instead of live angle/velocity. Add equivalent valid fixtures for `focuence-stars` on `/artbreeze → /constellation` and `cosmic-water` on `/constellation → /client-works`; assert that cross-edge reuse, live/fallback field mixing, non-integer seeds, non-finite numbers, unknown keys, and any URL-like field fail closed.

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

interface CoScrollRingHandoffBase {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "coscroll-ring";
  sourceHref: "/coscroll";
  targetHref: "/artbreeze";
  center: NormalizedChapterPoint;
  diameter: number;
  lineWidth: number;
  exitProgress: number;
  direction: "clockwise";
}

export interface CoScrollRingLiveHandoff extends CoScrollRingHandoffBase {
  signalSource: "live";
  angleRadians: number;
  angularVelocityRadiansPerSecond: number;
}

export interface CoScrollRingFallbackHandoff extends CoScrollRingHandoffBase {
  signalSource: "fallback";
  gapPhaseRadians: number;
}

export type CoScrollRingHandoff =
  | CoScrollRingLiveHandoff
  | CoScrollRingFallbackHandoff;

export interface FocuenceStarsHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "focuence-stars";
  sourceHref: "/artbreeze";
  targetHref: "/constellation";
  collapseOrigin: NormalizedChapterPoint;
  seed: number;
  collapsePhase: number;
}

export interface CosmicWaterHandoff {
  version: typeof CHAPTER_VISUAL_HANDOFF_VERSION;
  kind: "cosmic-water";
  sourceHref: "/constellation";
  targetHref: "/client-works";
  highlightOrigin: NormalizedChapterPoint;
  radius: number;
  ripplePhase: number;
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
- keep normalized points and `exitProgress`, `collapsePhase`, and `ripplePhase` in `[0, 1]`;
- require ring `diameter` in `(0, 1]`, `lineWidth` in `(0, 0.25]`, and `lineWidth <= diameter / 2`;
- require water `radius` in `(0, 1]`;
- require finite ring angles/velocity and a finite unsigned 32-bit integer star `seed`;
- enforce the discriminated ring sub-union exactly: live accepts only `angleRadians` plus `angularVelocityRadiansPerSecond`, while fallback accepts only `gapPhaseRadians`;
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
- Create: `apps/site/components/chapter-transition/chapterRouteStateTypes.ts`
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts` (type-only import/re-export from the leaf module)
- Create: `apps/site/components/chapter-transition/chapterRouteState.ts`
- Create/Test: `tests/unit/chapterRouteState.spec.ts`

- [ ] **Step 1: Write RED tests for schema, build, manifest, and revision**

The test manifest is:

```ts
const manifest = {
  pathname: "/artbreeze",
  stopIds: ["entry", "await-send", "answer-tail"],
  segmentIds: ["opening", "prompt", "answer"],
  mediaIds: [
    "artbreeze-first-sequence",
    "artbreeze-cycle",
    "artbreeze-prompt",
    "artbreeze-answer"
  ],
  routeState: {
    answerSubmitted: { kind: "boolean" },
    answerMode: { kind: "enum", values: ["waiting", "answered"] }
  }
} as const;
```

Cover these facts:

- matching `chapter-return-v2`, build scope, pathname, known stop/segment/media, finite time, normalized segment/narrative progress, and allowlisted route key parse successfully;
- schema/build/path mismatch returns `null`;
- arbitrary URL/media id/stop id/route key returns `null` rather than being dropped;
- `activeMedia.playbackState = "playing"` normalizes to `paused-ready` on restore;
- one snapshot can restore at least two simultaneous results (for example completed first-sequence + cycle and skipped answer) plus a distinct active media item without replaying any result;
- completed/skipped IDs are unique, disjoint, manifest-allowlisted, and cannot also be the active media ID;
- a Replay snapshot is valid only after the replayed media ID has been removed from both outcome arrays; `gateReleased` remains `true` while that media is active/paused-ready;
- active media time clamps to the supplied tail time while completed/skipped results remain independent of that single active position;
- a lower revision cannot overwrite a newer stored snapshot;
- pure `nextRevisionFromValidatedSnapshot(validRevision20)` returns `{ revision: 21, resetStorage: false }` without importing the Provider;
- a validated snapshot at the saturation boundary returns `{ revision: 1, resetStorage: true }`;
- a malformed/over-limit stored revision is rejected as untrusted input and cannot make a new valid revision-`1` write stale;
- storage get/set/remove exceptions return a deterministic miss/result instead of throwing, and failed removal never falls through to `setItem`;
- the legacy 01–03 object normalizes to `semantic.kind: "legacy-progress"` while preserving `routeProgress`, `terminalState`, and `scrollY`.

Run the focused test and verify it fails because `chapterRouteState.ts` is absent.

- [ ] **Step 2: Define the semantic snapshot**

Create `chapterRouteStateTypes.ts` as a data-only leaf module and add these public types there. It must not import `chapterTransitionTypes.ts`, `chapterRouteState.ts`, the Provider, React, or any runtime implementation. `chapterTransitionTypes.ts` may type-import/re-export these definitions, so dependency direction remains `transition runtime → leaf types` and `route-state codec → leaf types`, never a cycle.

```ts
export const CHAPTER_RETURN_SNAPSHOT_VERSION = "chapter-return-v2" as const;
export const MAX_CHAPTER_RETURN_REVISION = 1_000_000_000 as const;

export type ChapterPlaybackState =
  | "ready"
  | "playing"
  | "paused-ready";

export interface ChapterActiveMediaState {
  id: string;
  playbackState: ChapterPlaybackState;
  timeSeconds: number;
}

export interface ChapterSemanticRouteState {
  kind: "semantic";
  semanticStop: string;
  segmentId: string;
  segmentProgress: number;
  narrativeProgress: number;
  completedMediaIds: readonly string[];
  skippedMediaIds: readonly string[];
  activeMedia: ChapterActiveMediaState | null;
  gateReleased: boolean;
  mutePreference: boolean;
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

export interface ChapterRouteStateManifest {
  pathname: string;
  stopIds: readonly string[];
  segmentIds: readonly string[];
  mediaIds: readonly string[];
  routeState: Readonly<Record<string,
    | { kind: "boolean" }
    | { kind: "number"; min: number; max: number }
    | { kind: "enum"; values: readonly string[] }
  >>;
  mediaTailSeconds?: Readonly<Record<string, number>>;
}

export interface ChapterRouteStateAdapter {
  manifest: ChapterRouteStateManifest;
  capture: () => ChapterSemanticRouteState;
}

export interface ChapterReturnRevisionPlan {
  revision: number;
  resetStorage: boolean;
}
```

The retained flat legacy fields allow existing 01–03 reset code to remain unchanged during Unit 3. `segmentProgress` and `narrativeProgress` are finite normalized scalars in `[0, 1]`; neither is inferred from `scrollY`. The media fields are independent: completed/skipped are the latest durable outcomes for any number of manifest media IDs, while `activeMedia` describes at most one currently resumable item. A completed/skipped ID never appears in `activeMedia`. `gateReleased` is a separate sticky property for the current semantic gate: Replay never sets it back to `false`, so downstream document flow stays released even while the old outcome is temporarily cleared and the replayed media becomes active.

- [ ] **Step 3: Implement the codec and injected storage boundary**

Expose:

```ts
export function parseChapterReturnSnapshot(
  value: unknown,
  context: { pathname: string; buildScope: string; manifest?: ChapterRouteStateManifest }
): ChapterReturnSnapshot | null;

export function writeChapterReturnSnapshot(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  key: string,
  snapshot: ChapterReturnSnapshot,
  context: { pathname: string; buildScope: string; manifest?: ChapterRouteStateManifest },
  revisionPlan: ChapterReturnRevisionPlan
): "written" | "stale" | "unavailable";

export function readChapterReturnSnapshot(
  storage: Pick<Storage, "getItem">,
  key: string,
  context: { pathname: string; buildScope: string; manifest?: ChapterRouteStateManifest }
): ChapterReturnSnapshot | null;

export function nextRevisionFromValidatedSnapshot(
  snapshot: ChapterReturnSnapshot | null
): ChapterReturnRevisionPlan;
```

Reject non-plain objects and unknown keys at every level. A semantic snapshot without the destination's registered manifest is rejected; only the restricted 01–03 legacy adapter may parse without one. Route-state values must satisfy their manifest field descriptor; strings are accepted only as explicit enum members, so an allowlisted key cannot smuggle an arbitrary URL. Require the build scope to be 64 lowercase hex characters. Finite active-media time is clamped to `[0, mediaTailSeconds[id]]` when a tail is declared. Restore normalization changes `playing` to `paused-ready`; completed/skipped items remain tail/poster outcomes and it never restores audible playing.

Revision is a bounded positive safe integer in `[1, MAX_CHAPTER_RETURN_REVISION)`; the exclusive limit is `1_000_000_000`, well below `Number.MAX_SAFE_INTEGER`. `readChapterReturnSnapshot()` fully validates the stored snapshot before its revision participates in ordering. `writeChapterReturnSnapshot()` compares only against a stored snapshot that parses under the supplied path/build/manifest context; malformed JSON, an unsafe/over-limit revision, or any otherwise invalid snapshot is treated as absent and can be replaced by revision `1`. `nextRevisionFromValidatedSnapshot()` is the pure Task 3 contract: null returns revision `1`; a normal validated snapshot returns `revision + 1`; a revision whose increment would reach the exclusive limit returns revision `1` with `resetStorage: true`. The writer requires that `snapshot.revision === revisionPlan.revision`. When `resetStorage` is true it calls `removeItem` before `setItem`; if removal throws, it returns `unavailable` and must not call `setItem`. A normal plan never removes the entry and retains stale-write comparison.

The legacy unversioned reader is restricted to `/`, `/radio-gaga`, and `/coscroll`; a legacy object for any 04–07 pathname is rejected. If `NEXT_PUBLIC_MIRALITH_CHAPTER_PREVIEW_SCOPE` is absent or malformed, semantic persistence fails closed and the destination uses its deterministic entry state.

- [ ] **Step 4: Run GREEN and commit**

Run the focused test, typecheck, and `git diff --check`. Commit:

```bash
git add apps/site/components/chapter-transition/chapterRouteStateTypes.ts apps/site/components/chapter-transition/chapterTransitionTypes.ts apps/site/components/chapter-transition/chapterRouteState.ts tests/unit/chapterRouteState.spec.ts
git commit -m "feat(chapters): add semantic return-state codec"
```

### Task 4: Integrate capture/restore with the coordinator and route shell

**Files:**
- Modify: `apps/site/components/chapter-transition/chapterRouteStateTypes.ts`
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify: `apps/site/app/artbreeze/page.tsx`
- Modify: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Create/Test: `tests/e2e/chapter-route-state.spec.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`

- [ ] **Step 1: Write failing browser contracts**

Using the local-preview runner, add tests that:

1. enter ArtBreeze, explicitly start video, seek to a known time, mute, navigate to Constellation, then go back;
2. assert ArtBreeze restores the same media id and a position no more than two seconds behind, but the video is paused/ready and never audibly playing;
3. mark the media completed, navigate away/back, and assert the tail state is restored without replay;
4. restore a snapshot containing two completed media IDs, one skipped media ID, and a fourth active media item; assert all outcomes survive back/forward and a later mute/time capture without replaying completed/skipped items;
5. seed a codec-valid Replay literal (`gateReleased=true`, replayed id absent from both outcomes, same id active), hard refresh, and assert downstream remains released while playback restores paused-ready without sound; Task 5 must later produce this identical shape without being imported by Task 4;
6. replace the stored build scope or media id with an invalid value and assert the deterministic entry poster is used;
7. seed a valid revision `20`, refresh, change mute/semantic state immediately, and assert the Provider writes revision `21`;
8. seed a saturated valid revision while an older throttled media-time callback is pending; assert the Provider cancels that callback, removes the entry, increments its revision epoch, writes revision `1`, and the old callback cannot overwrite it;
9. seed an unsafe/over-limit revision, refresh, change semantic state, and assert the malformed value is replaced by a valid revision-`1` snapshot rather than blocking the write as stale;
10. make sessionStorage get/set/remove throw independently and assert navigation/reveal still reaches idle;
11. while playback has a pending throttled time write, advance to a newer time, dispatch `pagehide`, wait beyond the throttle window, hard reload, and assert the synchronous pagehide snapshot retains the newest time/revision and the old callback never overwrites it;
12. verify the existing 01–03 route-progress history tests remain green.

Run the new spec and verify RED: the current shell always resets video state to zero and the stored snapshot lacks schema/semantic data.

- [ ] **Step 2: Add a route-state adapter registration**

Extend the existing destination registration atomically so reset controls and route-state validation cannot register in different React effects:

```ts
export interface ChapterDestinationControls {
  resetEntry: (context: ChapterDestinationResetContext) => void | Promise<void>;
  forceFallback: (context: ChapterDestinationFallbackContext) => void | Promise<void>;
  routeState?: ChapterRouteStateAdapter;
}

captureRouteState: (pathname: string, reason: "semantic" | "media-time" | "pagehide" | "transition") => void;
```

`ChapterRouteStateAdapter` is imported from the leaf `chapterRouteStateTypes.ts`; it is not redeclared in the Provider module. `useChapterTransitionDestination()` returns a pathname-bound `captureRouteState(reason)` callback. The Provider constructs schema/build/pathname/revision/timestamp/scroll fields; a route adapter supplies only its validated semantic state.

The Provider owns revisions per pathname. On registration/refresh it first reads and fully validates the stored snapshot for that pathname/build/manifest, then calls `nextRevisionFromValidatedSnapshot()`; absent or invalid storage initializes it to `1`. No raw stored number may seed or block the counter. Each pathname also owns a runtime-only `revisionEpoch`. If the helper requests a saturation reset, the Provider first cancels the pending media-time timer, increments `revisionEpoch`, removes the old entry through the guarded storage boundary, and only then writes revision `1`. Every throttled closure captures both its assigned revision and epoch and aborts unless both still match, so a pre-reset high-revision callback cannot overwrite the restarted sequence. It captures synchronously:

- immediately for semantic stop, media outcome, mute, skip, ended, pause, and seeked;
- at most once per two seconds for active playback time;
- on `pagehide`;
- immediately before starting a coordinator transition.

Any queued media-time write records its source revision and epoch and is discarded if a newer immediate capture or epoch reset exists. `pagehide` first cancels the timer, invalidates its closure, reads the adapter's current media time synchronously, and writes the final snapshot before returning; it does not await React effects, media events, or a Promise.

- [ ] **Step 3: Preserve the legacy adapter**

If no registered route adapter exists, capture the current 01–03 `routeProgress`, `terminalState`, and `scrollY` into a valid v2 snapshot with `semantic.kind: "legacy-progress"`. `readReturnSnapshot` also accepts the old unversioned object and normalizes it in memory. Existing route reset call sites continue reading the flat fields.

- [ ] **Step 4: Register the current post-CoScroll shell**

`app/artbreeze/page.tsx` passes every resolved manifest item with `workId === "artbreeze"`, not only `artbreeze-first-sequence`, while the shell continues to display the same deterministic first ready item by default. `PostCoScrollRouteShell` builds its route-state manifest from that complete ArtBreeze media-id set. Its current semantic stop ids are exactly `entry`, `poster-ready`, `playing`, and `media-tail`; its segment id is `route-shell`, both progress values remain deterministic fixtures, and `playbackRequested` and `audioEnabled` are declared as boolean route-state fields. This supplies a real multi-media manifest without implementing Unit 5 sequencing.

Capture rules:

- no video: `entry` or `poster-ready`, `activeMedia` is `null` or ready for the selected item;
- active video: stop `playing`, current media id/time and `playbackState` `playing` or `paused-ready`;
- initial ended: stop `media-tail`, remove the id from skipped, add it to completed, clear `activeMedia`, and set sticky `gateReleased=true`;
- initial skip: remove the id from completed, add it to skipped, clear `activeMedia`, and set sticky `gateReleased=true`;
- Replay begin: preserve `gateReleased=true`, remove the replayed id from both outcome arrays, and make it the sole `activeMedia` before capture;
- Replay ended/skip: clear `activeMedia` and write only the latest outcome, removing the id from the opposite array;
- restored completed/skipped sets remain independent and are carried forward unchanged by later active-media time or mute captures.

Effects call `captureRouteState(pathname, "semantic")` after stop/outcome/mute changes and `captureRouteState(pathname, "media-time")` from `timeupdate`; the Provider, not the component, enforces the two-second throttle and revision check.

Restore rules:

- active `playing`/`paused-ready`: select that manifest media id, mount the verified local video, seek after metadata, keep paused, restore mute preference, and keep downstream expanded when `gateReleased=true` (Replay recovery);
- every completed/skipped id: preserve the tail/poster outcome without calling `play()`; skipped also exposes the deterministic summary marker expected by later UI;
- invalid/missing snapshot: current deterministic entry behavior.

- [ ] **Step 5: Run GREEN and commit**

Run the new route-state E2E under `playwright.local-preview.config.ts`, existing transition history tests under production config, Node contracts, typecheck, and lint. Commit:

```bash
git add apps/site/app/artbreeze/page.tsx apps/site/components/chapter-transition apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx tests/e2e/chapter-route-state.spec.ts tests/e2e/chapter-transition.spec.ts
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
| `released-hold` | `release-gate` |
| `reverse-after-complete` | `scroll-timeline` |
| `transitioning` | `route-transition` |

The reducer has one exhaustive phase × event table. Any cell not listed is rejected; tests enumerate every phase against every event kind, not only representative forbidden edges:

| From phase | Accepted event | To phase / guard |
| --- | --- | --- |
| `scrub` | `reach-await` | `await-send`, or preserved `manual-ready` when re-entering a previously interrupted gate |
| `scrub` | `reverse-completed` | `reverse-after-complete`; completed/skipped sets are retained |
| `await-send` | `attempt-began(mediaId, generation)` | `answer-starting`; active media is set and any stale outcome for that id is removed |
| `await-send` | `skip(mediaId)` | `released-hold`, latest outcome skipped, `gateReleased=true`, `freshInputArmed=false` |
| `await-send` | `reverse` | `reverse-before-complete`, resume phase `await-send` |
| `answer-starting` | matching `play-accepted(generation)` | `autoplay` |
| `answer-starting` | matching `play-rejected(generation)` | `manual-ready` |
| `answer-starting` | `cancel` | `manual-ready`; active attempt is cleared |
| `answer-starting` | `skip(mediaId)` | `released-hold`, latest outcome skipped; arm immediately only when the gate was already released by a Replay |
| `answer-starting` | `reverse` | `reverse-before-complete`, resume phase `manual-ready` |
| `manual-ready` | `attempt-began(mediaId, generation)` | `answer-starting`; active media is set and any stale outcome for that id is removed |
| `manual-ready` | `skip(mediaId)` | `released-hold`, latest outcome skipped; arm immediately only when the gate was already released by a Replay |
| `manual-ready` | `reverse` | `reverse-before-complete`, resume phase `manual-ready` |
| `autoplay` | `ended(mediaId)` | `released-hold`, remove skipped/add completed/clear active; set `gateReleased=true`; arm immediately only for Replay |
| `autoplay` | `skip(mediaId)` | `released-hold`, remove completed/add skipped/clear active; set `gateReleased=true`; arm immediately only for Replay |
| `autoplay` | `reverse` | `reverse-before-complete`, resume phase `manual-ready` |
| `reverse-before-complete` | `settled` | `scrub`; outcome is not completed/skipped and preserved resume phase controls later re-entry |
| `released-hold` | `inertia-settled` | remains `released-hold`, sets `freshInputArmed=true` |
| `released-hold` | `fresh-forward-input(nextSegmentId)` | `scrub` only when armed; this exact event is the new physical input after inertia, not the tail of the releasing gesture |
| `released-hold` | `reverse` | `reverse-after-complete`; completed/skipped sets are retained |
| `released-hold` | `attempt-began(mediaId, generation)` | `answer-starting` only for explicit Replay; keep `gateReleased=true`, remove media id from both outcome arrays, set it active |
| `reverse-after-complete` | `settled(previousSegmentId)` | `scrub` at the prior semantic stop without clearing outcomes |
| `reverse-after-complete` | `return-to-tail` | `released-hold`, armed, without replay |
| `reverse-after-complete` | `attempt-began(mediaId, generation)` | `answer-starting` only for explicit Replay; keep `gateReleased=true`, remove media id from both outcome arrays, set it active |
| every non-`transitioning` phase | `route-transition` | `transitioning`; active attempt is cleared |
| `transitioning` | `reset(segmentId)` | `scrub` |

`skip` is therefore legal from every incomplete gate phase: `await-send`, `answer-starting`, `manual-ready`, and `autoplay`. `answer-starting` also has explicit cancel and reverse; `manual-ready` has reverse. `gateReleased` is independent and sticky for the current segment. Initial completion/skip changes it from false to true and enters unarmed `released-hold`; the existing inertia must settle before fresh input can progress. Replay never relocks it: Replay begin first removes that media id from both outcome sets, Replay refresh persists `gateReleased=true + activeMedia`, and Replay ended/skip writes exactly one latest outcome. A Replay result returns armed because the document flow was already released. Only `fresh-forward-input(nextSegmentId)` or route reset starts the next segment with `gateReleased=false`. Each accepted result exposes exactly one derived owner. Rejected transitions return `{ accepted: false, state: originalState }` and cannot mutate the original object. Mismatched/stale generations and unarmed fresh-input attempts are explicit rejected variants in the Cartesian tests.

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
  | "released-hold"
  | "reverse-after-complete"
  | "transitioning";

export type NarrativeInputOwner =
  | "scroll-timeline"
  | "await-send"
  | "autoplay-controls"
  | "release-gate"
  | "route-transition";

export function narrativeInputOwnerForPhase(phase: NarrativeControllerPhase): NarrativeInputOwner;

export function reduceNarrativeControllerState(
  state: NarrativeControllerState,
  event: NarrativeControllerEvent
): { accepted: true; state: NarrativeControllerState } | { accepted: false; state: NarrativeControllerState };
```

State carries only route-agnostic `segmentId`, `phase`, `progress`, `activeMediaId`, `attemptGeneration`, `completedMediaIds`, `skippedMediaIds`, sticky `gateReleased`, the interrupted gate's resume phase, and `freshInputArmed`. It does not contain ArtBreeze shot ids, DOM selectors, ScrollTrigger instances, media URLs, or transition animation parameters.

`attemptGeneration` is a receipt, not a counter: the reducer never creates, increments, or guesses it. The playback-attempt controller is the canonical generation owner. A caller first obtains a token from `attemptController.begin(...)`, then dispatches `attempt-began(mediaId, token.generation)`; accepted state must expose that exact number. Every play continuation includes its token generation and is rejected unless it equals the state's active receipt. Skip, cancel, reverse, play rejection, route transition, and reset clear the receipt after the caller synchronously invalidates the attempt controller. Reducer tests cover completed→Replay, skipped→Replay, Replay→ended, and Replay→skip; the Task 4 browser contract covers Replay refresh. Together they assert `activeMediaId` never overlaps either outcome set and completed/skipped never overlap each other.

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
- Modify/Test: `tests/e2e/post-coscroll-route-shell.spec.ts` (production fixture isolation only)

- [ ] **Step 1: Write failing attempt-race tests**

Use deferred promises and a fake media element for unit tests. Prove:

- generations increase monotonically;
- `begin()` pauses and invalidates the prior element;
- ownership includes generation, segment id, element identity, and transition id;
- skip, cancel, reverse, pause, ended, new attempt, play rejection, coordinator route transition, direct/history navigation, reset, visibility hidden, and unmount each invalidate the token;
- delayed fulfill/reject/playing/ended callbacks cannot write state or outcome;
- a delayed fulfill that starts the underlying element after invalidation causes another `pause()`;
- the controller alone allocates generations; after `begin()` the reducer accepts `attempt-began(mediaId, token.generation)`, and fixture/controller state report the same active generation until invalidation;
- synchronous `play()` throw and rejected `play()` Promise both call `invalidate("rejected")` before reporting rejected; a later `playing` or `ended` event from that element remains stale.

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
  invalidate(reason:
    | "skip"
    | "cancel"
    | "reverse"
    | "pause"
    | "ended"
    | "new-attempt"
    | "rejected"
    | "route-transition"
    | "navigation"
    | "reset"
    | "hidden"
    | "unmount"
  ): void;
  requestPlay(token: MediaPlaybackAttemptToken): Promise<"playing" | "rejected" | "stale">;
}

export function createMediaPlaybackAttemptController(): MediaPlaybackAttemptController;
```

The attempt controller is the only generation owner. `begin()` is the only operation that returns a token, and both `begin()` and `invalidate()` advance the same monotonic internal counter; invalidation clears the current token, so the next begin may contain a deliberate generation gap. `requestPlay()` calls `token.element.play()` synchronously before its first await. The reducer receives the returned generation only through `attempt-began(mediaId, generation)` and never allocates one itself. A synchronous throw or current Promise rejection first invalidates with `rejected`, then returns `rejected`; stale rejection returns `stale`. Any delayed resolution/event checks `isCurrent()` before state writes, and if the stale element is no longer paused it pauses again.

- [ ] **Step 3: Add the gated real-video fixture**

The server page returns `notFound()` unless `MIRALITH_CONTRACT_FIXTURES=1`. The client fixture renders a real `<video ref>` and controls that expose phase, owner, controller token generation, reducer receipt generation, and pause count through `data-*` attributes. It allows the E2E test to replace `play()` with a controllable promise while preserving real element identity. The fixture fails its own synchronization marker if the token and reducer generations ever differ.

`playwright.contract.config.ts` uses a fixed `next dev` port, `reuseExistingServer: false`, and this web-server environment only:

```ts
env: {
  MIRALITH_CONTRACT_FIXTURES: "1"
}
```

The production runner never receives this flag. Add an explicit default-production assertion in `post-coscroll-route-shell.spec.ts` that `/spikes/post-coscroll-controller-contract` returns the framework 404 and never renders the fixture root. This isolation test runs in the source tree with no fixture flag; it is not inferred merely from the config text.

- [ ] **Step 4: Prove gesture order and stale races in Chromium**

The browser test must assert:

- clicking Send calls `video.play()` in the same click task before any readiness continuation and records `navigator.userActivation.isActive === true` at the exact intercepted call;
- focusing Send and pressing Enter uses the same direct handler, calls `play()` synchronously, records active user activation, and creates exactly one new generation;
- rejection enters `manual-ready` and a second explicit click creates a higher generation;
- after rejection, dispatch delayed `playing` and `ended` from the rejected element and assert neither leaves `manual-ready`, marks completion, nor restores the rejected generation;
- resolving the first promise after the second attempt cannot set playing;
- skip/cancel/reverse/pause/ended/route-transition/navigation/reset/hidden/unmount followed by delayed resolution leaves the fixture in its new state and increments pause count where an element could still be playing;
- an `ended` event from a stale element cannot mark the current segment completed.

The interception records `{ trigger, generation, isActive }` synchronously inside the replaced `play()` before returning its controlled Promise. Merely observing that a Promise was created is insufficient evidence of the browser activation chain.

Run with a fixed-port dev Playwright config and `MIRALITH_CONTRACT_FIXTURES=1`.

- [ ] **Step 5: Run GREEN and commit**

Run unit tests, the focused browser fixture, typecheck, and lint. Commit:

```bash
git add apps/site/components/post-coscroll/mediaPlaybackAttempt.ts apps/site/components/post-coscroll/PostCoScrollControllerContractFixture.tsx apps/site/app/spikes/post-coscroll-controller-contract/page.tsx playwright.contract.config.ts tests/unit/mediaPlaybackAttempt.spec.ts tests/e2e/post-coscroll-controller-contract.spec.ts tests/e2e/post-coscroll-route-shell.spec.ts
git commit -m "feat(post-coscroll): guard media playback attempts"
```

### Task 7: Close the CP1.3 candidate for independent review

**Files:**
- Modify: `docs/post-coscroll/CHECKPOINTS.md`
- Create: `docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-status.json`
- Create: `docs/post-coscroll/evidence/cp1.3-playback-scroll-state-model-checksums.sha256`
- Create/Test: `tests/unit/reactThreeRuntimeResolution.spec.ts`

- [ ] **Step 1: Add the retained R3F/Drei singleton guard**

Use `createRequire()` from all four actual React Three consumer roots, resolve each runtime entry, normalize with `realpathSync()`, and assert every root resolves the same physical file:

```text
apps/site/package.json
packages/radio-gaga-scene/package.json
packages/coscroll-scene/package.json
packages/lubirth-hero/package.json
```

Resolve and compare:

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

Run the current production transition/navigation/media suite in a source tree with no `public/media/post-coscroll` residue and without `MIRALITH_CONTRACT_FIXTURES`. It must preserve `60 passed / 3 expected skipped` plus the new explicit fixture-isolation assertion, or report the new exact count with zero unexpected failures. The production result must include proof that `/spikes/post-coscroll-controller-contract` is a 404.

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
- the exact bounded revision rule, refresh continuation result, and malformed-high-revision recovery result;
- the saturation reset result, guarded `removeItem` result, revision-epoch change, and proof that a pre-reset throttled write stayed stale;
- the multi-media snapshot fixture and its simultaneous completed/skipped/active restore result;
- the completed→Replay, skipped→Replay, Replay-refresh, Replay-ended, and Replay-skipped outcome-normalization results including sticky `gateReleased`;
- the exact legal controller transition table and owner map;
- the canonical playback-generation owner, complete invalidation-reason matrix, rejection-race result, and token/reducer synchronization result;
- the synchronous pagehide final-write result and proof that the older throttled callback did not overwrite it;
- click and Enter activation records including `navigator.userActivation.isActive` at `play()` invocation;
- the production fixture-route 404 result;
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

- Spec coverage: frozen live/fallback ring, seeded stars, bounded water geometry, multi-media semantic recovery, Replay outcome normalization, legacy recovery, manifest validation, storage containment, refresh/saturation-safe revision continuation, synchronous pagehide capture, the complete phase × event matrix, sticky release, playback generation/invalidation ownership, activation-chain proof, and Unit 4/5 exclusions each have a dedicated task and test gate.
- Placeholder scan: the plan contains no deferred implementation slot; future Units are explicit exclusions rather than unfinished Unit 3 work.
- Type consistency: `ChapterVisualHandoff`, `ChapterReturnSnapshot`, `ChapterRouteStateAdapter`, `NarrativeControllerState`, and `MediaPlaybackAttemptToken` retain the same names and ownership boundaries across tasks; only the attempt controller allocates generations.
- Dependency direction: snapshot, manifest, and adapter data live in `chapterRouteStateTypes.ts`, which imports no runtime module; pure codecs/reducers do not import React or the Provider; the Provider and route shell consume them, and fixtures consume public contracts rather than private runtime refs.
- Safety: all untrusted objects fail closed, storage exceptions cannot deadlock a transition, Replay cannot create an active/outcome overlap, audible playing is never restored, and stale storage/media work cannot revive an invalidated revision or attempt.
