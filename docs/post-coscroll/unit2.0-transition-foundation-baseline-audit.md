# Unit 2.0 — Transition Foundation Baseline Audit

**Audit date:** 2026-07-26
**Base commit:** `ec3cb9a feat(post-coscroll): add local media contract`
**Status:** `CHANGES REQUESTED — FOUNDATION COMMIT NO-GO`

## Decision

Unit 2 must not start from `ec3cb9a` alone: that commit contains the CP1.1 local-media contract, but not the current chapter-transition foundation. The current foundation cannot be committed yet. The dirty-worktree typecheck reads uncommitted package APIs, and the clean isolated baseline does not pass.

The correct Unit 2.0 exit is a **small, reviewable transition-only baseline commit** validated in a clean worktree created from `ec3cb9a`. It must include every package API consumed by the app-side foundation, must pass the existing regression suite there, and must be created only after all mixed hunks are split.

No Stage 2 route, particle visual, terminal design, or media playback was created by this audit.

## Evidence collected

| Check | Result | Evidence |
| --- | --- | --- |
| Knowledge graph | Pass | `ChapterTransitionProvider`, `useChapterTerminalGate`, `miraLithChapters` and the published-only helpers are in Community 6. `MiraLithChapterNavigation` is an adjacent thin Community 94. No path exists from navigation to `CoScrollSceneSlot`; their coupling is via runtime composition, not an inferred graph edge. |
| Type safety | Insufficient evidence | `pnpm --filter @miralith/site typecheck` passes on the current dirty worktree, but it resolves uncommitted CoScroll and RadioGaga package APIs. It cannot prove the proposed app-only commit is self-contained. |
| Browser regression suite | Fail — baseline | Playwright `1.59.1` Chromium `1217` was installed. Clean-port run: `CI=1 MIRALITH_PLAYWRIGHT_PORT=3106 pnpm exec playwright test tests/e2e/chapter-transition.spec.ts tests/e2e/chapter-navigation.spec.ts --project=desktop` completed `29 passed / 4 failed / 3 skipped` in 4.6 min. |
| Diff whitespace | Pass | `git diff --check` returned no errors. |
| CP1.1 dependency | Pass | `ec3cb9a` supplies the server-only local manifest resolver and production isolation. Its actual mode is `MIRALITH_POST_COSCROLL_MEDIA_MODE`, not the stale name in the original narrative plan. |

### Baseline failures that block the freeze

| Test | Observed failure | Classification |
| --- | --- | --- |
| `chapter-navigation.spec.ts:103` | `.radio-gaga-copy__final` never appears before the 60 s timeout, so the rail/finale clearance assertion cannot run. | Real failure |
| `chapter-transition.spec.ts:318` | CoScroll assets are requested during the RadioGaga warmup window, before the test permits the next published chapter preload. | Real failure |
| `chapter-transition.spec.ts:730` | The expected `waiting-ready` state is instead briefly `revealing` and then idle during history-back interruption. | Real failure |
| `chapter-transition.spec.ts:962` | The expected `waiting-ready` readiness hold for RadioGaga instead reveals/clears before the assertion. | Real failure |

An earlier run reused a stale port-3100 server and produced connection-refused cascades. It is not used as evidence; the table above comes only from the isolated port-3106 run.

## What exists today

1. `miraLithChapters.ts` already lists all seven chapter identities, but only exposes 01–03 through `publishedMiraLithChapterHrefs`, `getPublishedMiraLithChapter`, and `getNextPublishedChapter`.
2. `ChapterTransitionProvider` rejects every non-published source/target, guards stale destination signals, controls history recovery, and has a 2.6 s fallback request plus a 3.0 s hard recovery deadline.
3. `useChapterTerminalGate`, `preloadChapterTarget`, and `MiraLithChapterNavigation` each call a published-only helper independently. This is the exact duplication Unit 2 must replace with one resolver.
4. `ChapterTransitionSnapshot` and `ActiveChapterTransition` are typed with `PublishedMiraLithChapter`; Unit 2 must change that to a canonical registry chapter plus a resolved access result.
5. `/artbreeze`, `/constellation`, `/client-works`, and `/now-building` do not exist yet. CP1.1 verifies local media files but intentionally does not claim route playback.

## Freeze classification

| Classification | Paths | Why |
| --- | --- | --- |
| Candidate, but never whole-file stage by default | `apps/site/components/chapter-transition/*`, `apps/site/app/layout.tsx`, `apps/site/content/miraLithChapters.ts`, `apps/site/components/MiraLithChapterNavigation.tsx`, `apps/site/app/globals.css`, `apps/site/visual/VisualCanvas.tsx`, `apps/site/visual/scenes/CoScrollSceneSlot.tsx`, `apps/site/visual/scenes/RadioGagaSceneSlot.tsx`, `apps/site/components/RadioGagaRoute.tsx`, `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx`, transition tests | These establish the provider, destination ready/fallback contract, public rail, terminal input, and tests, but several include non-foundation visual/preload work and must be inspected hunk-by-hunk. |
| Required package API candidates | `packages/coscroll-scene/src/{types.ts,CoScrollStandaloneDemo.tsx,CoScrollSceneContent.tsx}`; `packages/radio-gaga-scene/src/{preloadRadioGagaAssets.ts,index.ts,types.ts,RadioGagaSceneContent.tsx,RadioGagaModelComposite.tsx}` | App code currently consumes `readinessGeneration`, `forceFallback`, `onReady`, `onFallback`, `preloadRadioGagaFinaleAssets`, and `loadFinale`, none of which exists at `ec3cb9a`. A clean foundation patch must include the exact supporting hunks or remove the app dependency; a dirty-tree typecheck cannot choose between those alternatives. |
| Must be hunk-split before a transition-only commit | `apps/site/components/LuBirthRevisedRoute.tsx`, `apps/site/app/globals.css`, CoScroll/RadioGaga app and package candidate files | LuBirth mixes destination hooks with atmosphere/cloud/DPR/validation work. The CSS, CoScroll and RadioGaga files mix transition contracts with fallback visuals, residue/finale preload, and scene behaviour. Whole-file staging would smuggle unrelated work into the baseline. |
| Not transition foundation; keep out of the Unit 2.0 commit | `apps/site/next.config.ts` dirty build-revision/dirty-boolean additions; `apps/site/visual/scenes/LuBirthSceneSlot.tsx`; all LuBirth assets/packages/tests; all CoScroll shader/residue changes not required by the selected API patch; all unrelated docs/downloads | The current `HEAD + dirty boolean` is explicitly inadequate for preview-session identity and is used by the LuBirth validation harness. Its replacement belongs to Unit 2B. The remaining files are separate visual, asset, or research work. |

`apps/site/app/globals.css` is included only for the `.chapter-transition-*` and chapter-navigation/terminal rules introduced with the provider. If unrelated CSS is added before the freeze, it must be hunk-split too.

## Required baseline commit boundary

The eventual Unit 2.0 commit must contain only this behaviour:

- global transition provider mount;
- existing public 01 → 02 → 03 coordinator, terminal, preloading, history, ready/fallback recovery and reduced-motion behaviour;
- destination integrations **and their exact package API hunks** needed to make those three routes honour the contract;
- the corresponding E2E coverage, passing from a clean worktree.

It must **not** contain a post-CoScroll route, a preview query/session, a scope implementation, a new terminal for CoScroll, a new transition visual, or a local-media consumer. Those start at Units 2A–2D.

## Unit 2 design freeze

The following contracts are now the proposed implementation boundary for author confirmation before Unit 2 code begins.

| Concept | Frozen meaning |
| --- | --- |
| `known` | A canonical registry route. It may directly mount and show its deterministic fallback without a preview session. |
| `preview` | A known but unpublished chapter. With a valid `post-coscroll-v1` scope it may participate in coordinator, review navigation, and preloading. The resolver may report a next-terminal candidate, but Unit 2 keeps the real CoScroll terminal disabled. |
| `published` | A known chapter that always participates in the public rail. Initial set: 01–03. |
| Direct known navigation | Never fabricates a transition or veil. Missing/invalid preview state leaves browser/Next navigation intact and the target mounts its local entry fallback. |
| History state | A namespaced, versioned scope marker only. It never carries a target href, index, or edge; the resolver always derives those from the canonical registry and current pathname. |
| Build scope | A SHA-256 identity of the active chapter-access build inputs, not `HEAD` plus a boolean. It must differ when any included source file differs and must fail closed if it cannot be computed/validated. It is a review feature gate, not authentication. |
| Media mode | The only local-media environment switch is server-only `MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview`. No public flag chooses a media source. |

## Recommended next action

1. Fix the four baseline failures without expanding into Unit 2 access behaviour.
2. Revise the Unit 2 plan to use a clean-worktree patch proof, defer the CoScroll terminal, and require deterministic route-shell readiness.
3. Commit the audit and revised plan as documentation only.
4. Build and validate a transition-only patch in a new `ec3cb9a` worktree. Only then create the Unit 2.0 foundation commit.
