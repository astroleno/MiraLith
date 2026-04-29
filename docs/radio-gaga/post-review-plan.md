# RadioGaga Post-Review Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the RadioGaga review context and finish the remaining polish / integration decisions without reopening solved visual work.

**Architecture:** `/radio-gaga` is already a standalone Next.js route backed by site-owned DOM, scroll progress, fallback, and tests. `packages/radio-gaga-scene` owns only the R3F scene content. Follow-up work should be small timeline / CSS polish, documentation, and PR preparation unless the user explicitly chooses homepage integration.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, three, @react-three/fiber, @react-three/drei, GSAP ScrollTrigger, Playwright.

---

## Current Baseline

- Branch: `codex/radio-gaga-route-branch`
- Latest implementation commit: `8ae601b feat: ship radio gaga case route`
- Route: `/radio-gaga`
- Build status at review handoff: `pnpm build` passed and route list included `/radio-gaga`.
- E2E status at review handoff: `pnpm exec playwright test tests/e2e/radio-gaga.spec.ts` passed with `18 passed`.
- Test server status at handoff: stopped.
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

Remaining non-blocking polish:

- Around progress `0.62`, mobile can still show a very faint previous-copy residue under the entering core copy.
- Homepage surfacing is undecided: keep `/radio-gaga` standalone for PR, or add a visible homepage path.
- PR screenshots should be regenerated from the final branch state before review.

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

## Task 1: Remove the Last Core-Entry Ghosting

**Files:**

- Modify: `packages/radio-gaga-scene/src/radioGagaTimeline.ts`
- Modify: `tests/e2e/radio-gaga.spec.ts`

- [ ] **Step 1: Shift core copy entry slightly later**

In `packages/radio-gaga-scene/src/radioGagaTimeline.ts`, change:

```ts
const coreCopy = smooth(range(progress, 0.58, 0.74));
```

to:

```ts
const coreCopy = smooth(range(progress, 0.62, 0.76));
```

Expected effect: memory/process get a cleaner exit before core copy becomes readable.

- [ ] **Step 2: Keep the core e2e check in the core phase**

In `tests/e2e/radio-gaga.spec.ts`, find:

```ts
await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.25, behavior: "instant" }));
```

Inside the `radioGAGA core phase exits earlier copy groups` test, change it to:

```ts
await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.45, behavior: "instant" }));
```

Expected effect: the assertion still measures the settled core phase after the later copy entrance.

- [ ] **Step 3: Run focused e2e**

Run:

```bash
pnpm exec playwright test tests/e2e/radio-gaga.spec.ts --project=mobile-portrait
```

Expected: all mobile portrait RadioGaga tests pass.

- [ ] **Step 4: Run full RadioGaga e2e**

Run:

```bash
pnpm exec playwright test tests/e2e/radio-gaga.spec.ts
```

Expected: `18 passed`.

- [ ] **Step 5: Commit if this polish is accepted**

Run:

```bash
git add packages/radio-gaga-scene/src/radioGagaTimeline.ts tests/e2e/radio-gaga.spec.ts
git commit -m "fix: delay radio gaga core copy entrance"
```

Expected: a focused commit containing only the timing polish and test adjustment.

## Task 2: Regenerate Review Screenshots

**Files:**

- No repo file changes required.
- Output directory: `/tmp/miralith-radiogaga-review-ready`

- [ ] **Step 1: Build production bundle**

Run:

```bash
pnpm build
```

Expected: build succeeds and route list includes `/radio-gaga`.

- [ ] **Step 2: Start production server**

Run:

```bash
pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3021
```

Expected: Next reports `Ready` at `http://127.0.0.1:3021`.

- [ ] **Step 3: Capture review states**

Run this from another terminal:

```bash
node --input-type=module <<'EOF'
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const out = '/tmp/miralith-radiogaga-review-ready';
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

Expected: screenshots exist in `/tmp/miralith-radiogaga-review-ready`.

- [ ] **Step 4: Stop production server**

Stop the `next start` process with `Ctrl-C`.

Run:

```bash
lsof -nP -iTCP:3021 -sTCP:LISTEN || true
```

Expected: no process is listening on port `3021`.

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
pnpm --filter @miralith/site typecheck
pnpm build
pnpm exec playwright test tests/e2e/radio-gaga.spec.ts
```

Expected:

```text
lint exits 0
typecheck exits 0
build exits 0 and includes /radio-gaga
RadioGaga e2e exits 0 with 18 passed
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
- Updates RadioGaga e2e coverage across desktop, mobile portrait, mobile landscape, and fallback.
- Updates README, roadmap, state, and top-plan docs with the new route status.

## Verification

- pnpm --filter @miralith/site lint
- pnpm --filter @miralith/site typecheck
- pnpm build
- pnpm exec playwright test tests/e2e/radio-gaga.spec.ts
```

Expected: PR description is ready without reconstructing conversation context.

## Continuation Prompt

If a future session starts from this file, use this prompt:

```text
Continue the RadioGaga route from docs/radio-gaga/post-review-plan.md. Start by reading the Current Baseline and Review Summary. Do not reopen solved visual choices. First decide whether to apply Task 1's core-entry ghosting polish, then run the listed verification commands.
```
