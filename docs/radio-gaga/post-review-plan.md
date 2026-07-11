# RadioGaga Post-Review Follow-Up Implementation Plan

> Superseded by `docs/superpowers/plans/2026-07-11-radio-gaga-miralith-migration.md`. Retained for historical review context.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the RadioGaga review context and finish the remaining polish / integration decisions without reopening solved visual work.

**Architecture:** `/radio-gaga` is already a standalone Next.js route backed by site-owned DOM, scroll progress, fallback, and tests. `packages/radio-gaga-scene` owns only the R3F scene content. Follow-up work should be small timeline / CSS polish, documentation, and PR preparation unless the user explicitly chooses homepage integration.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, three, @react-three/fiber, @react-three/drei, GSAP ScrollTrigger, Playwright.

---

## Current Baseline

- Branch: `codex/radio-gaga-route-branch`
- Base implementation commit for this follow-up: `28d60e6403a1a9c701aedf93039c758e65bc5d2e`
- Current follow-up state: post-review merge fixes are committed on branch HEAD `5d1a9df fix(radio-gaga): harden review path`.
- Route: `/radio-gaga`
- Build status after follow-up: `pnpm build` passed and route list included dynamic server-rendered `/radio-gaga`.
- E2E status after follow-up: `pnpm exec playwright test tests/e2e/radio-gaga.spec.ts` passed with `30 passed`.
- Additional static checks after follow-up: `pnpm --filter @miralith/site lint`, `pnpm --filter @miralith/radio-gaga-scene typecheck`, and `pnpm --filter @miralith/site typecheck` all exited 0.
- Dev hydration status after follow-up: `/radio-gaga?visual=fallback` was checked on a dev server at port `3099`; `canvasCount=0`, `fallbackCount=1`, and no hydration-related console/pageerror messages were reported.
- Test server status after follow-up: ports `3100` and `3099` had no leftover listener after verification.
- Known uncommitted generated file at handoff: `apps/site/next-env.d.ts` can flip between `.next/dev/types/routes.d.ts` and `.next/types/routes.d.ts` after dev/build. Do not include it in RadioGaga feature commits unless the team intentionally normalizes the generated import.

## Review Summary

The current route is good enough for PR / integration review:

- Memory DOM copy is present and visible in the memory phase.
- Scattered word fragments were replaced by a structured process artifact.
- The process artifact now reads more like radio tuning / frequency marks.
- Core reveal now reads as “the radio shell becomes transparent and the internal ESP32 care core appears.”
- The board / chip silhouette makes the ESP32 layer more legible.
- Final phase no longer carries obvious old copy residue.
- Fallback has a static radio silhouette and is no longer an empty black text page.
- Mobile portrait, mobile landscape, desktop, and fallback states have been visually checked.

Resolved in this follow-up:

- `assetState === "checking"` no longer displays the fallback poster or hides the normal RadioGaga copy layer.
- Forced fallback and failed model preflight still render the readable fallback.
- Forced fallback now receives its initial state from server `searchParams`, so SSR and hydration both start on fallback DOM for `/radio-gaga?visual=fallback`.
- Mobile landscape memory copy, broadcast copy, and step marker are separated and covered by bbox e2e.
- Finale completion is covered by e2e: final English / Chinese lines reach high opacity and earlier copy groups exit.
- The ghost radio material no longer sets `needsUpdate` every frame while only opacity changes.

Remaining review work:

- Human visual approval passed for screenshots in `screenshots/radio-gaga-visual-review/final-skill-review/`: desktop top, desktop memory/broadcast, desktop core reveal, desktop finale, mobile landscape memory, and desktop forced fallback.
- PR attachments should use the final screenshots from `screenshots/radio-gaga-visual-review/final-skill-review/`; keep that directory as local review evidence unless the team explicitly decides to add binary screenshots to the repository.
- Homepage surfacing is undecided: keep `/radio-gaga` standalone for PR, or add a visible homepage path.

## Guardrails

Do not reopen these solved decisions without a new product reason:

- Do not return to scattered tag-cloud words.
- Do not make the ESP32 the protagonist over the care story.
- Do not add live audio, news fetching, podcast generation, n8n, Cloudflare Worker, MCP, Jotai, or TanStack Query.
- Do not create a second canvas for RadioGaga.
- Do not integrate homepage second-act behavior until `/radio-gaga` review is accepted.
- Do not commit generated `.next` output.

## File Map

Likely follow-up files:

```text
packages/radio-gaga-scene/src/radioGagaTimeline.ts
apps/site/app/globals.css
apps/site/app/radio-gaga/page.tsx
apps/site/components/RadioGagaRoute.tsx
tests/e2e/radio-gaga.spec.ts
README.md
docs/top-plan.md
docs/radio-gaga/post-review-plan.md
```

Only touch homepage files if the user explicitly chooses homepage surfacing:

```text
apps/site/components/MiraLithHome.tsx
tests/e2e/miralith.spec.ts
```

## Completed Background: Core-Entry Ghosting Timing

**Files:**

- Already updated before this follow-up: `packages/radio-gaga-scene/src/radioGagaTimeline.ts`
- Already updated before this follow-up: `tests/e2e/radio-gaga.spec.ts`

- [x] **Step 1: Shift core copy entry slightly later**

In `packages/radio-gaga-scene/src/radioGagaTimeline.ts`, `coreCopy` is already:

```ts
const coreCopy = smooth(range(progress, 0.62, 0.76));
```

Status: this is completed baseline as of `28d60e6403a1a9c701aedf93039c758e65bc5d2e`, not an open task.

- [x] **Step 2: Keep the core e2e check in the core phase**

The core e2e check now scrolls via the shared `scrollRadioGagaTo(page, 0.72)` helper, which keeps the assertion in the settled core phase after the later copy entrance.

- [x] **Step 3: Run full RadioGaga e2e**

Latest result: `pnpm exec playwright test tests/e2e/radio-gaga.spec.ts` exited 0 with `30 passed`.

## Completed Visual Review Screenshots

**Files:**

- No repo file changes required.
- Output directory: `screenshots/radio-gaga-visual-review/`

- [x] **Step 1: Build production bundle**

Run:

```bash
pnpm build
```

Expected: build succeeds and route list includes `/radio-gaga`.

- [x] **Step 2: Start production server**

Run:

```bash
pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3021
```

Expected: Next reports `Ready` at `http://127.0.0.1:3021`.

- [x] **Step 3: Capture review states**

Run this from another terminal:

```bash
node --input-type=module <<'EOF'
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const out = 'screenshots/radio-gaga-visual-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const states = [
  ['top', 0],
  ['memory', 0.5],
  ['core', 0.72],
  ['final', 0.93]
];
const viewports = [
  ['desktop', { width: 1440, height: 960 }],
  ['mobile-portrait', { width: 390, height: 844 }],
  ['mobile-landscape', { width: 844, height: 390 }]
];

for (const [name, viewport] of viewports) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:3021/radio-gaga', { waitUntil: 'networkidle' });
  for (const [label, progress] of states) {
    await page.evaluate((nextProgress) => {
      window.scrollTo({ top: window.innerHeight * 3.4 * nextProgress, behavior: 'instant' });
    }, progress);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${name}-${label}.png`, fullPage: false });
  }
  await page.goto('http://127.0.0.1:3021/radio-gaga?visual=fallback', { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}-fallback.png`, fullPage: false });
  await page.close();
}

await browser.close();
console.log(out);
EOF
```

Actual: screenshots exist in `screenshots/radio-gaga-visual-review/`.

- [x] **Step 4: Stop production server**

Stop the `next start` process with `Ctrl-C`.

Run:

```bash
lsof -nP -iTCP:3021 -sTCP:LISTEN || true
```

Expected: no process is listening on the review server port.

## Task 3: Decide Homepage Surfacing

**Files:**

- Preferred for “standalone only”: no code files.
- If surfaced: `apps/site/components/MiraLithHome.tsx`
- If surfaced: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Choose the route visibility**

Use this decision:

```text
Default: keep /radio-gaga standalone for PR / integration review.
Only add homepage surfacing after the user explicitly asks for it.
```

Expected: no homepage files change unless the user chooses surfacing.

- [ ] **Step 2: If standalone, record the PR note**

Use this PR note:

```text
RadioGaga is implemented as a standalone route at /radio-gaga. Homepage integration remains behind a product gate so the LuBirth-first entry can stay stable while this case page is reviewed.
```

Expected: reviewers understand why `/` does not yet link into the route.

- [ ] **Step 3: If homepage surfacing is requested, create a separate plan**

Create a new plan:

```text
docs/radio-gaga/homepage-integration-plan.md
```

Expected: homepage integration is planned separately, because it touches the LuBirth scroll spine and homepage e2e tests.

## Task 4: PR Readiness Checklist

**Files:**

- Modify only if the checklist reveals a real gap.

- [ ] **Step 1: Check worktree noise**

Run:

```bash
git status --short
```

Expected: only intentional files are modified. If `apps/site/next-env.d.ts` is the only leftover generated file, inspect it before deciding whether to restore or keep it.

- [ ] **Step 2: Run verification**

Run:

```bash
pnpm --filter @miralith/site lint
pnpm --filter @miralith/radio-gaga-scene typecheck
pnpm --filter @miralith/site typecheck
pnpm build
pnpm exec playwright test tests/e2e/radio-gaga.spec.ts
```

Expected:

```text
lint exits 0
radio-gaga-scene typecheck exits 0
typecheck exits 0
build exits 0 and includes /radio-gaga
RadioGaga e2e exits 0 with 30 passed
```

- [ ] **Step 3: Confirm no servers are left running**

Run:

```bash
lsof -nP -iTCP:3100 -sTCP:LISTEN || true
lsof -nP -iTCP:3021 -sTCP:LISTEN || true
```

Expected: no process is listening on either port.

- [ ] **Step 4: Prepare PR summary**

Use this summary:

```markdown
## Summary

- Ships `/radio-gaga` as a standalone RadioGaga case route.
- Adds memory/process DOM copy, radio tuning artifact, ESP32 care-core reveal, and static fallback silhouette.
- Moves scroll progress off React state into refs/CSS variables and keeps R3F updates in frame.
- Keeps pending/checking asset preflight on the normal route copy instead of flashing fallback.
- Passes forced fallback from server search params to avoid SSR hydration mismatch on `/radio-gaga?visual=fallback`.
- Separates mobile landscape memory/broadcast/step-marker layout and removes ghost material per-frame `needsUpdate`.
- Updates RadioGaga e2e coverage across desktop, mobile portrait, mobile landscape, pending preflight, finale, bbox, and fallback.
- Updates README, roadmap, state, and top-plan docs with the new route status.

## Verification

- pnpm --filter @miralith/site lint
- pnpm --filter @miralith/radio-gaga-scene typecheck
- pnpm --filter @miralith/site typecheck
- pnpm build
- pnpm exec playwright test tests/e2e/radio-gaga.spec.ts
```

Expected: PR description is ready without reconstructing conversation context.

## Continuation Prompt

If a future session starts from this file, use this prompt:

```text
Continue the RadioGaga route from docs/radio-gaga/post-review-plan.md. Start by reading the Current Baseline and Review Summary. Do not reopen solved visual choices. Core-entry ghosting, checking fallback, forced-fallback hydration, mobile landscape overlap, finale e2e, and ghost material needsUpdate have already been addressed; next decide homepage surfacing or prepare the PR.
```
