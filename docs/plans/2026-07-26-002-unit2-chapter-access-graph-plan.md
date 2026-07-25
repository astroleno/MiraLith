# Unit 2 — Chapter Access Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one canonical known/preview/published chapter-access graph so 04–07 can be reviewed locally without entering the public 01–03 rail.

**Architecture:** The chapter registry owns identities, paths, availability, and canonical sequence. A pure resolver derives every UI and coordinator permission from the registry plus a validated tab/build-scoped preview context. The Provider, terminal gate, preloader, navigation, history handler, and route shells consume that resolver rather than independently testing a published href. Route shells use the existing server-only local-media resolver and only expose already-normalized serializable data to the client.

**Tech Stack:** Next.js App Router, React, TypeScript, browser `sessionStorage`/`history.state`, Playwright, existing CP1.1 local media resolver.

---

## Scope and non-goals

- Task 0 is the prerequisite. Units 2A–2D begin only after the Unit 2.0 transition-only baseline commit described in [the audit](../post-coscroll/unit2.0-transition-foundation-baseline-audit.md) exists and the pinned Playwright Chromium suite passes.
- Initial availability is fixed: 01–03 are `published`; 04–07 are `preview`; all seven are `known`.
- Unit 2 creates deterministic route shells, poster/fallback states, and an explicit local manifest play control. It does not create a handoff visual, particle system, CoScroll terminal, ScrollTrigger timeline, CDN publication, or production media contract.
- `MIRALITH_POST_COSCROLL_MEDIA_MODE` remains server-only. No `NEXT_PUBLIC_*` media-mode flag is allowed.
- `CP1.2` is technical evidence only. It is not a visual editorial approval and it does not open Unit 3 automatically.

## Access matrix

| Current route / state | Direct mount | Coordinator link/history veil | Terminal next | Review navigation | Preload next |
| --- | --- | --- | --- | --- | --- |
| Published 01–03, no preview | yes | published edge only | published edge only | 01–03 only | published next only |
| Preview 04–07, no preview | yes, deterministic direct entry | no | no | no public preview rail | no |
| Published or preview, valid `post-coscroll-v1` scope | yes | canonical 01 → 02 → 03 → 04 → 05 → 06 → 07 edge only | resolver candidate only; Unit 2 does not enable CoScroll terminal UI | review rail includes accessible chapters | current accessible next only |
| Unknown pathname / forged state | Next normal handling | no | no | no | no |

`history.state` is never an authority for a href, edge, or publication status. It can only mirror a valid scope identifier. The resolver always looks up the current pathname and target pathname in the registry.

## Build-scope contract

Use the canonical public variable `NEXT_PUBLIC_MIRALITH_CHAPTER_PREVIEW_SCOPE`. It must be a lower-case 64-character SHA-256 digest and is not a secret.

At Next config evaluation, calculate the digest from a version string, `git rev-parse HEAD`, and the SHA-256 of each working-tree file in this fixed input set:

```text
apps/site/app/**
apps/site/components/**
apps/site/content/**
apps/site/lib/**
apps/site/next.config.ts
apps/site/package.json
package.json
pnpm-lock.yaml
```

The calculation must include untracked non-ignored files inside those paths and must sort normalized POSIX relative paths before hashing `path + NUL + content-hash + LF`. It must fail preview activation when Git or a readable source file is unavailable. An explicit `MIRALITH_CHAPTER_PREVIEW_SCOPE` override is valid only when it is the same 64-hex format; Next config exposes its validated value as the public variable. This distinguishes different dirty source builds without making unrelated media/doc files invalidate the access rail.

## Required file map

| File | Responsibility |
| --- | --- |
| `apps/site/content/miraLithChapters.ts` | Canonical registry and pure access resolver; legacy published exports remain derived views. |
| `apps/site/lib/chapter-preview/resolveChapterPreviewScope.ts` | Node-only, deterministic scope generation and override validation for Next config. |
| `apps/site/components/chapter-transition/chapterPreviewSession.ts` | Browser-only bootstrap, storage/history parsing, validation, scope propagation, and query cleanup. |
| `apps/site/components/chapter-transition/chapterTransitionTypes.ts` | Registry-aware snapshot and transition types. |
| `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx` | Owns current validated preview context; uses resolver for begin/popstate/registration. |
| `apps/site/components/chapter-transition/useChapterTerminalGate.ts` | Requests only `resolver.nextTerminalChapter`. |
| `apps/site/components/chapter-transition/preloadChapterTarget.ts` | Refuses an inaccessible target and only preloads the resolver-selected next edge. |
| `apps/site/components/MiraLithChapterNavigation.tsx` | Renders public or review rail from the same resolver; preserves native-link semantics when a target is inaccessible. |
| `apps/site/app/{artbreeze,constellation,client-works,now-building}/page.tsx` | Server route entry: resolves CP1.1 media and passes serializable route data. |
| `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx` | Deterministic known-route UI, destination reset/ready-fallback reporting, diagnostic fallback, poster, and explicit local video play. |
| `apps/site/next.config.ts` | Exposes validated chapter preview scope while retaining CP1.1 production media isolation. |
| `tests/e2e/chapter-transition.spec.ts` | Access, terminal, history, and forged-state matrix. |
| `tests/e2e/chapter-navigation.spec.ts` | Public/review rail and native-link semantics. |
| `tests/e2e/post-coscroll-route-shell.spec.ts` | Route direct entry, local manifest playback, and production isolation. |
| `docs/post-coscroll/CHECKPOINTS.md` | CP1.2 evidence ledger; status remains `IN REVIEW` until all evidence is recorded. |

### Task 0: Unit 2.0 — split and commit the transition foundation

**Files:**

- Modify only the transition hunks listed as candidates in `docs/post-coscroll/unit2.0-transition-foundation-baseline-audit.md`.
- Do not include: `apps/site/next.config.ts` dirty build metadata, `LuBirthSceneSlot`, LuBirth packages/assets, CoScroll residue/shader work, or unrelated documents.
- Test: `tests/e2e/chapter-transition.spec.ts`, `tests/e2e/chapter-navigation.spec.ts`.

- [ ] **Step 1: Establish a clean, reproducible public-rail baseline.**

Run:

```bash
pnpm exec playwright install chromium
CI=1 MIRALITH_PLAYWRIGHT_PORT=3106 pnpm exec playwright test tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts --project=desktop
```

Expected: all 36 desktop tests pass with no server reuse. The current known baseline is `29 passed / 4 failed / 3 skipped`; fix those four failures before any foundation patch is staged.

- [ ] **Step 2: Define a full hunk-level foundation patch, including package contracts.**

Select only transition hunks from every candidate file. Include the exact supporting package hunks for CoScroll `readinessGeneration`/`forceFallback`/ready-fallback callbacks and RadioGaga `preloadRadioGagaFinaleAssets`/`loadFinale` if the app foundation still calls them. Otherwise remove those app calls from the patch. Do not select an app hunk whose imported symbol is absent from the patch.

Use intent-to-add plus interactive hunk staging for the candidate paths; this changes only the index, not the dirty working files. Build the candidate patch, then inspect both sides:

```bash
git add -N apps/site/components/chapter-transition apps/site/app/layout.tsx \
  apps/site/content/miraLithChapters.ts apps/site/components/MiraLithChapterNavigation.tsx \
  apps/site/app/globals.css apps/site/visual/VisualCanvas.tsx \
  apps/site/visual/scenes/CoScrollSceneSlot.tsx apps/site/visual/scenes/RadioGagaSceneSlot.tsx \
  apps/site/components/RadioGagaRoute.tsx apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx \
  apps/site/components/LuBirthRevisedRoute.tsx \
  packages/coscroll-scene/src/types.ts packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx packages/coscroll-scene/src/CoScrollSceneContent.tsx \
  packages/radio-gaga-scene/src/preloadRadioGagaAssets.ts packages/radio-gaga-scene/src/index.ts packages/radio-gaga-scene/src/types.ts packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx packages/radio-gaga-scene/src/RadioGagaModelComposite.tsx \
  tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts
git add -p -- apps/site packages/coscroll-scene packages/radio-gaga-scene tests/e2e
git diff --cached --binary > /tmp/miralith-unit2-foundation.patch
git diff --cached --name-only
git diff --name-only
```

Expected: the candidate contains no `resolveLandingVisualPolicy`, `ReliefLiteValidationHarness`, atmosphere/cloud/DPR changes, residue visual work, or unrelated finale visual work. Every package import resolves from the same candidate patch.

- [ ] **Step 3: Validate the patch from a clean `ec3cb9a` worktree.**

```bash
unit2_baseline_worktree="$(mktemp -d /tmp/miralith-unit2-foundation-XXXXXX)"
rmdir "$unit2_baseline_worktree"
git worktree add --detach "$unit2_baseline_worktree" ec3cb9a
git -C "$unit2_baseline_worktree" apply --check /tmp/miralith-unit2-foundation.patch
git -C "$unit2_baseline_worktree" apply /tmp/miralith-unit2-foundation.patch
git -C "$unit2_baseline_worktree" diff --check
pnpm --dir "$unit2_baseline_worktree" --filter @miralith/site typecheck
CI=1 MIRALITH_PLAYWRIGHT_PORT=3107 pnpm --dir "$unit2_baseline_worktree" exec playwright test tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts --project=desktop
```

Expected: the clean worktree typechecks and all 36 tests pass without reading the original dirty worktree. A failed import proves the candidate omitted a required package hunk; a visual regression proves the candidate included an incorrect hunk or changed an existing contract.

- [ ] **Step 4: Commit only the already-proven patch.**

```bash
git -C "$unit2_baseline_worktree" add -A
git -C "$unit2_baseline_worktree" commit -m "feat(chapter-transition): establish public rail foundation"
```

Expected: only the clean worktree receives the commit. Record its SHA in `docs/post-coscroll/CHECKPOINTS.md` under Unit 2.0; do not mark CP1.2 passed. Apply/cherry-pick that exact commit into the intended branch only after its diff is reviewed.

### Task 1: Unit 2A — canonical registry and pure access contract

**Files:**

- Modify: `apps/site/content/miraLithChapters.ts`
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Test: `tests/e2e/chapter-transition.spec.ts`, `tests/e2e/chapter-navigation.spec.ts`

- [ ] **Step 1: Add failing access-matrix assertions before changing the registry.**

Add browser assertions that demonstrate the current failure: `/artbreeze` is direct-loadable once its shell exists but has no terminal link without a session; `/coscroll?preview=post-coscroll-v1` exposes a review-rail link to 04 while its actual CoScroll terminal remains absent; a fabricated route is never selected.

```ts
await page.goto("/coscroll");
await expect(page.locator("[data-chapter-terminal] a")).toHaveCount(0);
await page.goto("/coscroll?preview=post-coscroll-v1");
await expect(page.locator("a[aria-label^='04 ArtBreeze']")).toHaveAttribute("href", "/artbreeze");
await expect(page.locator("[data-chapter-terminal] a")).toHaveCount(0);
```

Expected before implementation: the preview assertion fails because the registry only recognises published chapters.

- [ ] **Step 2: Replace the href-map-first model with an explicit seven-entry registry.**

Define these public types and keep legacy published views as filters:

```ts
export type MiraLithChapterAvailability = "published" | "preview";
export type MiraLithKnownChapter = {
  index: "01" | "02" | "03" | "04" | "05" | "06" | "07";
  title: string;
  zh: string;
  en: string;
  href: "/" | "/radio-gaga" | "/coscroll" | "/artbreeze" | "/constellation" | "/client-works" | "/now-building";
  availability: MiraLithChapterAvailability;
};

export const miraLithChapterRegistry: readonly MiraLithKnownChapter[] = [/* 01–07 in canonical order */];
export const publishedMiraLithChapters = miraLithChapterRegistry.filter(
  (chapter): chapter is MiraLithKnownChapter & { availability: "published" } =>
    chapter.availability === "published"
);
```

Do not retain a separately maintained `publishedMiraLithChapterHrefs` source of truth. Export it only as an object derived from `publishedMiraLithChapters` for existing callers that still need it during this task.

- [ ] **Step 3: Implement a pure resolver with no browser reads.**

Use a context whose only runtime privilege is `previewActive`:

```ts
export type MiraLithAccessResolution = {
  chapter: MiraLithKnownChapter | null;
  level: "unknown" | "known" | "published" | "preview";
  directEntryAllowed: boolean;
  coordinatorAllowed: boolean;
  visibleInNavigation: boolean;
  preloadAllowed: boolean;
};

export function resolveMiraLithChapterAccess(
  href: string,
  context: { previewActive: boolean }
): MiraLithAccessResolution;

export function getNextAccessibleMiraLithChapter(
  href: string,
  context: { previewActive: boolean }
): MiraLithKnownChapter | undefined;
```

`directEntryAllowed` is true for every known entry. `coordinatorAllowed`, `visibleInNavigation`, and `preloadAllowed` are true for a published entry or for a preview entry with `previewActive`. The next helper only returns the immediately following canonical accessible chapter; it never skips an inaccessible preview chapter. For an active preview context it returns ArtBreeze for CoScroll, but Unit 2 does not wire that candidate to a real CoScroll terminal.

- [ ] **Step 4: Change transition snapshot typing without adding Unit 3 payloads.**

Replace `PublishedMiraLithChapter` in `ChapterTransitionSnapshot` and `ActiveChapterTransition` with:

```ts
export interface ResolvedChapterTransitionEndpoint {
  chapter: MiraLithKnownChapter;
  level: "published" | "preview";
}
```

Do not add handoff, media playback, or semantic recovery fields in this task.

- [ ] **Step 5: Run the pure/public rail regression and commit Unit 2A.**

```bash
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts --project=desktop
git add apps/site/content/miraLithChapters.ts apps/site/components/chapter-transition/chapterTransitionTypes.ts tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts
git commit -m "feat(chapters): add canonical access registry"
```

Expected: no-preview 01 → 02 → 03 behaviour remains unchanged; 04–07 have canonical hrefs but cannot be coordinator targets yet.

### Task 2: Unit 2B — preview session and robust chapter-preview scope

**Files:**

- Create: `apps/site/lib/chapter-preview/resolveChapterPreviewScope.ts`
- Create: `apps/site/components/chapter-transition/chapterPreviewSession.ts`
- Modify: `apps/site/next.config.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Test: `tests/e2e/chapter-transition.spec.ts`

- [ ] **Step 1: Add failing session, scope, and forged-state tests.**

Cover exact token, scope loss, and untrusted data:

```ts
await page.goto("/coscroll?preview=post-coscroll-v1");
await expect(page).toHaveURL(/\/coscroll$/);
await page.evaluate(() => sessionStorage.setItem("miralith:chapter-preview:v1", "{bad json"));
await page.reload();
await expect(page.locator("[data-chapter-terminal] a")).toHaveCount(0);
await page.evaluate(() => history.replaceState({ __miralithChapterPreview: { v: 1, scope: "0".repeat(64), href: "/evil" } }, ""));
await page.goBack();
await expect(page).not.toHaveURL(/evil/);
```

Expected before implementation: no versioned session exists and the query is not cleaned/validated.

- [ ] **Step 2: Implement deterministic Node scope generation and Next config exposure.**

`resolveChapterPreviewScope.ts` must export `isChapterPreviewScope(value)` and `resolveChapterPreviewScope({ repoRoot, override })`. The resolver must return a 64-hex digest only after hashing the fixed input set in this plan; it must throw a descriptive error when a selected input cannot be read. `next.config.ts` must preserve the existing CP1.1 call to `assertPostCoScrollProductionMediaIsolation`, reject an invalid override, and expose only:

```ts
env: {
  NEXT_PUBLIC_MIRALITH_CHAPTER_PREVIEW_SCOPE: chapterPreviewScope
}
```

Remove the dirty boolean from the chapter-preview path. Do not remove unrelated LuBirth diagnostic variables unless their owner separately approves that change.

- [ ] **Step 3: Implement versioned browser storage/history helpers.**

Use exactly one storage key and one history key:

```ts
const PREVIEW_SESSION_STORAGE_KEY = "miralith:chapter-preview:v1";
const PREVIEW_HISTORY_KEY = "__miralithChapterPreview";
const PREVIEW_TOKEN = "post-coscroll-v1";
```

Persist only `{ v: 1, token: "post-coscroll-v1", scope: string }`. Parse unknown values defensively, require the current public scope to match byte-for-byte, and merge the history key into the existing `history.state` object. On the exact query token, write valid session + current entry marker and call `history.replaceState` with the query removed. A missing/invalid entry marker on `popstate` returns `previewActive: false` even when stale storage remains. No helper accepts a href/index/edge from storage or history state.

- [ ] **Step 4: Let the Provider own validated session state and propagation only.**

On mount, bootstrap only `?preview=post-coscroll-v1`; on `popstate`, revalidate the current history entry; after a successful coordinator `router.push`, write a marker to the newly committed entry only when the same valid session remains active. Expose `{ previewActive, scope }` in provider context. Do not make the query itself a permanent URL capability.

- [ ] **Step 5: Verify lifecycle and commit Unit 2B.**

```bash
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/chapter-transition.spec.ts --project=desktop
git add apps/site/lib/chapter-preview/resolveChapterPreviewScope.ts apps/site/components/chapter-transition/chapterPreviewSession.ts apps/site/next.config.ts apps/site/components/chapter-transition/ChapterTransitionProvider.tsx tests/e2e/chapter-transition.spec.ts
git commit -m "feat(chapters): scope preview sessions to a build and tab"
```

Expected: query activation is tab-local, query-free after bootstrap, preserved through coordinator navigation/back/forward, and invalidated by bad storage, bad history marker, or scope mismatch.

### Task 3: Unit 2C — one resolver for coordinator, terminal, preloader, and navigation

**Files:**

- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify: `apps/site/components/chapter-transition/useChapterTerminalGate.ts`
- Modify: `apps/site/components/chapter-transition/preloadChapterTarget.ts`
- Modify: `apps/site/components/MiraLithChapterNavigation.tsx`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`
- Modify/Test: `tests/e2e/chapter-navigation.spec.ts`

- [ ] **Step 1: Add failing parity tests for all consumers.**

For an active preview session, assert that automatic prefetch, explicit review link, and `beginTransition` agree on `/artbreeze`, while the CoScroll terminal stays disabled. Without a session, assert they all refuse 04 while direct `/artbreeze` navigation stays native.

```ts
await page.goto("/coscroll?preview=post-coscroll-v1");
await expect(page.locator("a[aria-label^='04 ArtBreeze']")).toBeVisible();
await expect(page.locator("[data-chapter-terminal] a")).toHaveCount(0);
await page.goto("/coscroll");
await expect(page.locator("a[aria-label^='04 ArtBreeze']")).toHaveCount(0);
```

- [ ] **Step 2: Inject the registry resolver into the Provider transition start and popstate paths.**

`startRuntime` must resolve both endpoints from current `previewActive`; it starts only when both `coordinatorAllowed` values are true. In `popstate`, a known-but-inaccessible target clears any active runtime and returns to idle without veil/recovery manipulation. Registration of destination controls remains legal for every known route, which preserves direct-entry fallback.

- [ ] **Step 3: Replace all published-only calls.**

`useChapterTerminalGate` gets the resolver context and reads `getNextAccessibleMiraLithChapter`. `preloadChapterTarget` accepts an access result or resolver context and returns an already-resolved promise without calling `router.prefetch` when inaccessible. `MiraLithChapterNavigation` maps only `visibleInNavigation` entries and invokes `beginTransition` only when `coordinatorAllowed`; otherwise it leaves ordinary anchor behaviour untouched.

The public no-session bar must still show 01–03 exactly as before. A valid preview context may show the review rail 01–07, but preview metadata remains `noindex` in Task 4.

- [ ] **Step 4: Keep terminal and visual scope unchanged.**

Do not add a `transitionKindForPair` variant, alter `ChapterTransitionVisual`, attach `useChapterTerminalGate` to CoScroll, or expose an ArtBreeze CTA at its terminal in this task. The resolver's next candidate and review rail are sufficient Unit 2 evidence. The real CoScroll terminal, edge kind, and visual handoff remain Stage 2 work.

- [ ] **Step 5: Run parity/history tests and commit Unit 2C.**

```bash
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts --project=desktop
git add apps/site/components/chapter-transition/ChapterTransitionProvider.tsx apps/site/components/chapter-transition/useChapterTerminalGate.ts apps/site/components/chapter-transition/preloadChapterTarget.ts apps/site/components/MiraLithChapterNavigation.tsx tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts
git commit -m "feat(chapters): share access resolution across the rail"
```

Expected: no-preview 01 → 02 → 03 passes unchanged. Preview is the sole way to coordinate into 04–07. Direct known history always settles without a permanent veil.

### Task 4: Unit 2D — known route shells and real local media consumption

**Files:**

- Create: `apps/site/app/artbreeze/page.tsx`
- Create: `apps/site/app/constellation/page.tsx`
- Create: `apps/site/app/client-works/page.tsx`
- Create: `apps/site/app/now-building/page.tsx`
- Create: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Create: `tests/e2e/post-coscroll-route-shell.spec.ts`
- Modify: `tests/e2e/post-coscroll-media.spec.ts` only if route evidence needs a reusable fixture

- [ ] **Step 1: Add failing direct-entry and local-playback tests.**

```ts
await page.goto("/artbreeze");
await expect(page.locator("[data-post-coscroll-route='artbreeze']")).toBeVisible();
await expect(page.locator("video")).toHaveCount(0);

await page.goto("/artbreeze?preview=post-coscroll-v1");
await page.getByRole("button", { name: "Play verified local ArtBreeze media" }).click();
await expect(page.locator("video")).toHaveJSProperty("readyState", expect.any(Number));
```

Run the second case only under `MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview` with the CP1.1 generated catalog present. It must fail if the manifest resolver reports `disabled`, `invalid`, or a missing required ArtBreeze item.

- [ ] **Step 2: Implement server route entry points.**

Each page calls `postCoScrollMediaResolverOptionsFromEnvironment` and `resolvePostCoScrollMediaManifest` on the server, chooses its chapter's stable `workId`, and passes only `{ chapter, resolverStatus, diagnostics, mediaItems }` to `PostCoScrollRouteShell`. Do not pass filesystem paths, raw manifest JSON, source hashes beyond the already-normalized item metadata, or environment switches to the client.

Set `robots` to `noindex, nofollow` for 04–07 while their registry availability remains `preview`.

- [ ] **Step 3: Implement the deterministic client shell.**

The shell must register itself with `useChapterTransitionDestination(chapter.href, controls)` before it renders a playable video. `resetEntry` pauses any owned video, resets it to time zero, and restores the deterministic poster state. A decoded/cached poster reports `visual-ready`; resolver-disabled/degraded/missing media reports `fallback-ready`. It must render, in this order:

1. chapter identity and a stable `data-post-coscroll-route` attribute;
2. a poster/semantic fallback immediately on mount;
3. resolver diagnostics when local preview is invalid/degraded;
4. an explicit play button only for a `ready` local item;
5. a `<video playsInline preload="metadata">` only after that button is activated.

For ArtBreeze select `artbreeze-first-sequence`. Keep it muted until an explicit user action and do not autoplay audio. For other routes use their first ready mapped item or the deterministic fallback when no item is ready. No scroll scrub, GSAP/ScrollTrigger, Canvas overlay, or transition animation is allowed.

The readiness test must click the preview review-rail link from CoScroll to ArtBreeze, assert that the Provider remains covered until the ArtBreeze poster or diagnostic fallback is ready, and then assert that the veil reveals. Direct `/artbreeze` entry must remain veil-free and deterministic.

- [ ] **Step 4: Add production-isolation coverage at the route boundary.**

Run the existing production reject cases and assert that `/artbreeze` never receives a local media source in production. The correct production preview-route outcome before publication is a deterministic unpublished fallback, not a silent attempt to read `public/media/post-coscroll`.

- [ ] **Step 5: Verify local playback and commit Unit 2D.**

```bash
pnpm --filter @miralith/site media:post-coscroll:check
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/post-coscroll-media.spec.ts tests/e2e/post-coscroll-route-shell.spec.ts --project=desktop
git add apps/site/app/artbreeze/page.tsx apps/site/app/constellation/page.tsx apps/site/app/client-works/page.tsx apps/site/app/now-building/page.tsx apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx tests/e2e/post-coscroll-route-shell.spec.ts
git commit -m "feat(post-coscroll): add deterministic preview route shells"
```

Expected: all four paths mount without a predecessor. ArtBreeze plays the CP1.1 verified local item only in explicit local-preview mode; production remains isolated.

### Task 5: CP1.2 — Chapter Access Graph evidence and gate

**Files:**

- Modify: `docs/post-coscroll/CHECKPOINTS.md`
- Create: `docs/post-coscroll/evidence/cp1.2-chapter-access-graph-status.json`
- Create: `docs/post-coscroll/evidence/cp1.2-chapter-access-graph-checksums.sha256`

- [ ] **Step 1: Generate a compact, durable access report.**

Record the baseline commit, Unit 2 commit SHAs, resolver scope algorithm version, access matrix outputs, exact CP1.1 source-spec/editorial-freeze hashes, the local ArtBreeze item identity, commands, Playwright counts, and production-isolation results. Do not copy ignored media or a preview manifest into Git.

- [ ] **Step 2: Validate evidence paths and checksums.**

```bash
sha256sum docs/post-coscroll/evidence/cp1.2-chapter-access-graph-status.json > docs/post-coscroll/evidence/cp1.2-chapter-access-graph-checksums.sha256
git check-ignore -v docs/post-coscroll/evidence/cp1.2-chapter-access-graph-status.json || true
```

Expected: the evidence JSON is not ignored; generated MP4/poster/manifest remain ignored as required.

- [ ] **Step 3: Mark the checkpoint correctly.**

Set `CP1.2 — Chapter Access Graph` to `IN REVIEW` with links to the access report, the relevant E2E files, and the local media contract. Only mark it `PASS — TECH` after the complete matrix passes and a reviewer verifies the exact evidence. Do not alter CP0.4, CP1.1, or any editorial approval.

- [ ] **Step 4: Run the final verification set and commit evidence.**

```bash
pnpm --filter @miralith/site media:post-coscroll:check
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts tests/e2e/post-coscroll-media.spec.ts tests/e2e/post-coscroll-route-shell.spec.ts --project=desktop
git add docs/post-coscroll/CHECKPOINTS.md docs/post-coscroll/evidence/cp1.2-chapter-access-graph-status.json docs/post-coscroll/evidence/cp1.2-chapter-access-graph-checksums.sha256
git commit -m "docs(post-coscroll): record chapter access graph review"
```

Expected: the report proves public isolation, preview session/history handling, forged-state rejection, direct-known fallback, and actual local ArtBreeze playback without advancing into Unit 3.

## Plan self-review

| Requirement | Covered by |
| --- | --- |
| Freeze the floating transition foundation before Unit 2 | Task 0 and the linked Unit 2.0 audit |
| Seven chapter canonical registry; 01–03 published, 04–07 preview | Task 1 |
| Validated query/sessionStorage/history with robust dirty-build identity | Task 2 |
| One resolver used by Provider, gate, preloader, navigation | Task 3 |
| Four direct route shells and real local-manifest ArtBreeze playback | Task 4 |
| CP1.2 matrix, history, forged state, production rail isolation, evidence | Task 5 |
| No Stage 2 visual implementation | Scope boundary and Task 3 Step 4 / Task 4 Step 3 |
