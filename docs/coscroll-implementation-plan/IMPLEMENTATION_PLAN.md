# CoScroll Chapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MiraLith v1.1's CoScroll Heart Sutra chapter as a lightweight, lazy-loaded R3F scene that matches CoScroll's current `heart-sutra.json` / `心经.lrc` data while preserving anchor depth, ritual scroll atmosphere, and site-owned fallback behavior.

**Architecture:** `apps/site` keeps ownership of the only production `VisualCanvas`; `HomeVisualSceneSlot` chooses LuBirth or CoScroll and lazy-loads CoScroll only near the CoScroll section. `packages/coscroll-scene` owns canvas-less R3F scene content, pure visual-state mapping, lightweight CanvasTexture text, a GLB-only jade anchor, package-local asset failure reporting, and the standalone demo route content.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Three 0.184, React Three Fiber 9, Drei 10, GSAP ScrollTrigger, Playwright desktop/mobile projects, pnpm workspace packages.

---

## Source Of Truth

- Primary spec: `docs/coscroll-migration-plan.md`
- Interface sync target: `docs/coscroll-scene-interface.md`
- Integration brief sync target: `docs/coscroll-integration-brief.md`
- Source reference project: `/Users/aitoshuu/Documents/GitHub/CoScroll`

Keep this file as the execution checklist. If this file and `docs/coscroll-migration-plan.md` disagree, stop and update both before coding.

## Execution Workspace

Do not execute this implementation in the current dirty `codex/lubirth-reverse-opening` worktree. Before Task 1, use `superpowers:using-git-worktrees` to create or enter an isolated worktree on branch `codex/coscroll-chapter`.

Required pre-execution checks:

- If `.worktrees/` or `worktrees/` already exists, verify it is ignored before creating the worktree.
- If neither exists, follow `superpowers:using-git-worktrees` directory selection instead of guessing.
- Run baseline install/typecheck in the new worktree before editing.
- Keep LuBirth, P7, and radio-gaga dirty changes out of the CoScroll worktree.

## File Map

Create:

- `packages/coscroll-scene/package.json`: package metadata, workspace dependencies, typecheck script.
- `packages/coscroll-scene/tsconfig.json`: package TS config.
- `packages/coscroll-scene/src/index.ts`: public exports.
- `packages/coscroll-scene/src/types.ts`: v1.1 scene contract.
- `packages/coscroll-scene/src/defaultTimeline.ts`: source-matched 364-second Heart Sutra timeline with all 53 non-empty LRC lines and 16 anchor cues.
- `packages/coscroll-scene/src/assetManifest.ts`: public asset defaults and resolver.
- `packages/coscroll-scene/src/createCoScrollVisualState.ts`: pure progress/quality/timeline mapping.
- `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`: CanvasTexture vertical text mesh.
- `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`: GLB-only jade current-anchor renderer.
- `packages/coscroll-scene/src/CoScrollMineralField.tsx`: procedural dark mineral background.
- `packages/coscroll-scene/src/CoScrollSceneContent.tsx`: canvas-less R3F scene content and asset error boundary.
- `packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx`: the only CoScroll package component allowed to create `<Canvas>`.
- `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`: production scene arbiter.
- `apps/site/visual/scenes/CoScrollSceneSlot.tsx`: site adapter around `CoScrollSceneContent`.
- `apps/site/app/coscroll-spike/page.tsx`: review-only spike route.
- `apps/site/app/coscroll/page.tsx`: public first-pass CoScroll Heart Sutra route.
- `tests/e2e/coscroll.spec.ts`: CoScroll spike, homepage, fallback, budget, and accessibility checks.
- `apps/site/public/assets/coscroll/anchors/*.glb`: compressed Heart Sutra anchor models.
- `apps/site/public/assets/coscroll/posters/coscroll-poster.webp`: fallback poster.

Modify:

- `apps/site/package.json`: add `@miralith/coscroll-scene`.
- `apps/site/components/MiraLithHome.tsx`: add CoScroll section, scroll progress, active scene selection.
- `apps/site/app/globals.css`: CoScroll section layout, visual fallback styling, typography guard.
- `apps/site/visual/VisualCanvasFallback.tsx`: allow `scene="coscroll"`.
- `docs/coscroll-scene-interface.md`: match the implemented package contract.
- `docs/coscroll-integration-brief.md`: point implementation status to this plan and migration plan.

## Preflight

- [ ] **Step 1: Confirm isolated workspace and package manager**

Run:

```bash
pwd
git branch --show-current
pnpm --version || corepack enable && pnpm --version
git status --short
```

Expected:

- `pwd` prints the isolated CoScroll worktree path, not the dirty `codex/lubirth-reverse-opening` workspace.
- `git branch --show-current` prints `codex/coscroll-chapter`.
- `pnpm --version` prints a version.
- `git status --short` does not include LuBirth, P7, or radio-gaga unrelated changes.

- [ ] **Step 2: Confirm source Heart Sutra data and anchor assets exist**

Run:

```bash
test -f /Users/aitoshuu/Documents/GitHub/CoScroll/public/projects/heart-sutra.json
test -f /Users/aitoshuu/Documents/GitHub/CoScroll/public/lyrics/心经.lrc
for model in 101_观.obj 001_空.obj 045_苦.obj 094_色.obj 022_法.obj 019_生.obj 012_无.obj 020_死.obj 003_道.obj 002_心.obj 008_悟.obj 007_明.obj 009_真.obj; do
  test -f "/Users/aitoshuu/Documents/GitHub/CoScroll/public/models/10k_obj/${model}"
done
du -h /Users/aitoshuu/Documents/GitHub/CoScroll/public/models/10k_obj/{101_观,001_空,045_苦,094_色,022_法,019_生,012_无,020_死,003_道,002_心,008_悟,007_明,009_真}.obj
```

Expected:

- Every `test` exits with code `0`.
- `du` reports source OBJ sizes for all Heart Sutra anchor models.

## Task 1: Scaffold Package Contract And Pure State

**Files:**

- Create: `packages/coscroll-scene/package.json`
- Create: `packages/coscroll-scene/tsconfig.json`
- Create: `packages/coscroll-scene/src/types.ts`
- Create: `packages/coscroll-scene/src/defaultTimeline.ts`
- Create: `packages/coscroll-scene/src/assetManifest.ts`
- Create: `packages/coscroll-scene/src/createCoScrollVisualState.ts`
- Create: `packages/coscroll-scene/src/index.ts`
- Modify: `apps/site/package.json`

- [ ] **Step 1: Write the first package typecheck target**

Create `packages/coscroll-scene/package.json`:

```json
{
  "name": "@miralith/coscroll-scene",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@miralith/visual-core": "workspace:*",
    "@react-three/drei": "10.7.7",
    "@react-three/fiber": "9.6.0",
    "three": "0.184.0"
  },
  "peerDependencies": {
    "react": ">=19",
    "react-dom": ">=19"
  }
}
```

Create `packages/coscroll-scene/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Add to `apps/site/package.json` dependencies:

```json
"@miralith/coscroll-scene": "workspace:*"
```

- [ ] **Step 2: Create the contract files**

Use the exact public contract from `docs/coscroll-migration-plan.md` section `5. Package Contract` for:

- `packages/coscroll-scene/src/types.ts`
- `packages/coscroll-scene/src/defaultTimeline.ts`
- `packages/coscroll-scene/src/assetManifest.ts`

Required exported names:

```ts
CoScrollAnchorId;
CoScrollFallbackMode;
CoScrollFallbackReason;
CoScrollLyricSegment;
CoScrollAnchorCue;
CoScrollTimelineConfig;
CoScrollAnchorAsset;
CoScrollAssetManifest;
CoScrollVisualState;
CoScrollSceneContentProps;
DEFAULT_COSCROLL_TIMELINE;
DEFAULT_COSCROLL_ASSETS;
resolveCoScrollAssets;
```

- [ ] **Step 3: Create pure visual-state mapping**

Create `packages/coscroll-scene/src/createCoScrollVisualState.ts` from the migration plan's `createCoScrollVisualState` block.

Required behavior:

```ts
createCoScrollVisualState({
  progress: 0.54,
  scrollVelocity: 0,
  active: true,
  reducedMotion: false,
  qualityTier: "medium",
  timeline: DEFAULT_COSCROLL_TIMELINE,
  assets: DEFAULT_COSCROLL_ASSETS
});
```

must return:

- `fallbackMode: "none"`
- `shouldLoadModel: true`
- `currentAnchor` matches the active source anchor cue for the computed 364-second visual time.
- `lyrics` with at least one visible segment.
- `DEFAULT_COSCROLL_TIMELINE.duration` is `364`.
- `DEFAULT_COSCROLL_TIMELINE.lyricSegments` contains all 53 non-empty lines from `/Users/aitoshuu/Documents/GitHub/CoScroll/public/lyrics/心经.lrc` with exact text and timestamps.
- `DEFAULT_COSCROLL_TIMELINE.anchorCues` contains all 16 cue nodes from `/Users/aitoshuu/Documents/GitHub/CoScroll/public/projects/heart-sutra.json`.
- Do not pass the full `QualityProfile` object into `createCoScrollVisualState`; `CoScrollSceneContent` maps `quality.tier` to this pure helper's `qualityTier` input.

The exact source anchor cue array is:

```ts
[
  { anchor: "观", start: 11.84, end: 28.87 },
  { anchor: "空", start: 28.87, end: 36.79 },
  { anchor: "苦", start: 36.79, end: 52.53 },
  { anchor: "色", start: 52.53, end: 94.09 },
  { anchor: "法", start: 94.09, end: 98.88 },
  { anchor: "生", start: 98.88, end: 106.77 },
  { anchor: "无", start: 106.77, end: 140.5 },
  { anchor: "死", start: 140.5, end: 147.05 },
  { anchor: "道", start: 147.05, end: 194.1 },
  { anchor: "心", start: 194.1, end: 221.27 },
  { anchor: "悟", start: 221.27, end: 239.06 },
  { anchor: "明", start: 239.06, end: 247.59 },
  { anchor: "真", start: 247.59, end: 287.91 },
  { anchor: "道", start: 287.91, end: 322.62 },
  { anchor: "圆", start: 322.62, end: 348.83 },
  { anchor: "心", start: 348.83, end: 364 }
]
```

- [ ] **Step 4: Export only files that exist**

Create `packages/coscroll-scene/src/index.ts`:

```ts
export { DEFAULT_COSCROLL_ASSETS, resolveCoScrollAssets } from "./assetManifest";
export { DEFAULT_COSCROLL_TIMELINE } from "./defaultTimeline";
export { createCoScrollVisualState } from "./createCoScrollVisualState";
export type {
  CoScrollAnchorAsset,
  CoScrollAnchorCue,
  CoScrollAnchorId,
  CoScrollAssetManifest,
  CoScrollFallbackMode,
  CoScrollFallbackReason,
  CoScrollLyricSegment,
  CoScrollSceneContentProps,
  CoScrollTimelineConfig,
  CoScrollVisualState
} from "./types";
```

- [ ] **Step 5: Typecheck**

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @miralith/coscroll-scene typecheck
```

Expected: lockfile refresh completes and TypeScript exits with code `0`.

- [ ] **Step 6: Commit**

Run:

```bash
git add packages/coscroll-scene apps/site/package.json pnpm-lock.yaml
git commit -m "feat: scaffold coscroll scene contract"
```

Expected: commit succeeds. If unrelated dirty files exist, do not stage them.

## Task 2: Convert Heart Sutra Anchors And Add Asset Budget

**Files:**

- Create: `apps/site/public/assets/coscroll/anchors/*.glb`
- Create: `apps/site/public/assets/coscroll/posters/`
- Modify: `packages/coscroll-scene/src/assetManifest.ts`

- [ ] **Step 1: Convert Heart Sutra OBJs to GLB**

Run:

```bash
mkdir -p apps/site/public/assets/coscroll/anchors
while IFS="|" read -r source target; do
  pnpm dlx obj2gltf \
    -i "/Users/aitoshuu/Documents/GitHub/CoScroll/public/models/10k_obj/${source}" \
    -o "/tmp/coscroll-${target}.raw.glb"
  pnpm dlx @gltf-transform/cli optimize \
    "/tmp/coscroll-${target}.raw.glb" \
    "apps/site/public/assets/coscroll/anchors/${target}.glb" \
    --compress meshopt
done <<'EOF'
101_观.obj|guan
001_空.obj|kong
045_苦.obj|ku
094_色.obj|se
022_法.obj|fa
019_生.obj|sheng
012_无.obj|wu
020_死.obj|si
003_道.obj|dao
002_心.obj|xin
008_悟.obj|wu2
007_明.obj|ming
009_真.obj|zhen
001_空.obj|yuan
EOF
du -h apps/site/public/assets/coscroll/anchors/*.glb
for model in apps/site/public/assets/coscroll/anchors/*.glb; do
  pnpm dlx @gltf-transform/cli inspect "$model"
done
```

Expected: every anchor GLB is `<= 350KB`. `yuan.glb` may reuse the `001_空.obj` source because CoScroll maps `圆` to that model.

- [ ] **Step 2: Reserve poster output directory**

Run:

```bash
mkdir -p apps/site/public/assets/coscroll/posters
test -d apps/site/public/assets/coscroll/posters
```

Expected: the poster directory exists. Generate the actual `coscroll-poster.webp` from the approved spike screenshot in Task 5.

- [ ] **Step 3: Confirm manifest paths**

`packages/coscroll-scene/src/assetManifest.ts` must include:

```ts
const anchorModels = {
  "观": "/assets/coscroll/anchors/guan.glb",
  "空": "/assets/coscroll/anchors/kong.glb",
  "苦": "/assets/coscroll/anchors/ku.glb",
  "色": "/assets/coscroll/anchors/se.glb",
  "法": "/assets/coscroll/anchors/fa.glb",
  "生": "/assets/coscroll/anchors/sheng.glb",
  "无": "/assets/coscroll/anchors/wu.glb",
  "死": "/assets/coscroll/anchors/si.glb",
  "道": "/assets/coscroll/anchors/dao.glb",
  "心": "/assets/coscroll/anchors/xin.glb",
  "悟": "/assets/coscroll/anchors/wu2.glb",
  "明": "/assets/coscroll/anchors/ming.glb",
  "真": "/assets/coscroll/anchors/zhen.glb",
  "圆": "/assets/coscroll/anchors/yuan.glb"
} satisfies Record<CoScrollAnchorId, string>;
```

The manifest must contain entries for every key in `anchorModels`. Each entry uses the matching `modelSrc`, `materialPreset: "jade-dark"`, and `bytesBudget: 350_000`. The `心` entry also includes `posterSrc: "/assets/coscroll/posters/coscroll-poster.webp"`.

- [ ] **Step 4: Typecheck**

Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

Expected: TypeScript exits with code `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/site/public/assets/coscroll packages/coscroll-scene/src/assetManifest.ts
git commit -m "feat: add compressed coscroll heart sutra anchors"
```

Expected: commit succeeds.

## Task 3: Build Text Billboard And Jade Anchor

**Files:**

- Create: `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`
- Create: `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- Modify: `packages/coscroll-scene/src/index.ts`

- [ ] **Step 1: Implement CanvasTexture billboard**

Create `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`.

Required public component props:

```ts
import type { CoScrollLyricSegment } from "./types";

interface CoScrollTextBillboardProps {
  text: string;
  position: [number, number, number];
  opacity: number;
  fontSize: number;
  layer: "front" | "back";
  emphasis?: CoScrollLyricSegment["emphasis"];
  depthTest: boolean;
  depthWrite: boolean;
  renderOrder?: number;
}
```

Material contract:

```tsx
<meshBasicMaterial
  map={billboard.texture}
  transparent
  opacity={opacity}
  depthTest={depthTest}
  depthWrite={depthWrite}
  toneMapped={false}
/>
```

Texture rule:

- Draw vertical glyphs with a system font stack.
- Use `CoScrollLyricSegment["emphasis"]` directly; do not collapse `quiet | normal | bright` into a boolean.
- Dispose the generated `THREE.CanvasTexture` on unmount.
- Do not load `/fonts/润植家康熙字典美化体.ttf`.

- [ ] **Step 2: Implement GLB-only anchor**

Create `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`.

Required behavior:

```tsx
const { scene } = useGLTF(modelSrc);
```

Use these material colors:

```ts
const innerColor = new THREE.Color("#2d6d8b");
const innerEmissive = new THREE.Color("#0f2b38");
const outerColor = new THREE.Color("#ffffff");
```

Rules:

- Do not import `OBJLoader`.
- Do not call `camera.position.set`.
- Let `useGLTF` errors bubble to `CoScrollSceneContent`'s package-local asset boundary.
- Rotate with refs inside `useFrame`, not React state.

- [ ] **Step 3: Export only after files exist**

Add to `packages/coscroll-scene/src/index.ts`:

```ts
export { CoScrollJadeAnchor } from "./CoScrollJadeAnchor";
export { CoScrollTextBillboard } from "./CoScrollTextBillboard";
```

- [ ] **Step 4: Typecheck**

Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

Expected: TypeScript exits with code `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/coscroll-scene/src
git commit -m "feat: add coscroll text and anchor primitives"
```

Expected: commit succeeds.

## Task 4: Build Scene Content And Standalone Review Route

**Files:**

- Create: `packages/coscroll-scene/src/CoScrollMineralField.tsx`
- Create: `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Create: `packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx`
- Create: `apps/site/app/coscroll-spike/page.tsx`
- Modify: `packages/coscroll-scene/src/index.ts`
- Create: `tests/e2e/coscroll.spec.ts`

- [ ] **Step 1: Implement dark mineral field**

Create `packages/coscroll-scene/src/CoScrollMineralField.tsx`.

Required visual contract:

- Procedural geometry or unlit plane only.
- No HDR.
- No external bitmap background.
- Dominant color family: mineral black / charcoal.
- No purple/blue neon, glowing orbs, or bokeh decoration.

- [ ] **Step 2: Implement `CoScrollSceneContent`**

Create `packages/coscroll-scene/src/CoScrollSceneContent.tsx`.

Required scene ownership:

```tsx
useFrame(({ camera }) => {
  camera.position.set(0, 0, 7.2);
  camera.lookAt(0, 0, 0);
  if ("fov" in camera) {
    camera.fov = 42;
    camera.updateProjectionMatrix();
  }
}, -2);
```

Required scene JSX:

```tsx
<color attach="background" args={["#030509"]} />
<fog attach="fog" args={["#030509", 8, 26]} />
```

Required depth layout:

```text
front text:  z = +0.42 to +0.55, depthTest true
jade anchor: z = 0
back text:   z = -0.34 to -0.5, depthTest true
```

Required failure boundary:

- Wrap `CoScrollJadeAnchor` in a package-local React error boundary.
- On loader failure, call `onFallback("asset-failed")`.
- Render `null` from the boundary.
- Do not render package-owned homepage fallback DOM.

Required current-anchor asset selection:

```tsx
const currentAnchorAsset = assets.anchors.find((asset) => asset.id === state.currentAnchor);

if (!currentAnchorAsset) {
  onFallback?.("asset-failed");
  return null;
}
```

Pass `currentAnchorAsset.modelSrc` into `CoScrollJadeAnchor`. Do not hardcode the `心` asset or any single anchor model inside `CoScrollSceneContent`; the rendered model must follow `state.currentAnchor` from the active Heart Sutra source cue.

```tsx
<CoScrollAssetBoundary onFallback={onFallback}>
  <CoScrollJadeAnchor
    key={currentAnchorAsset.id}
    modelSrc={currentAnchorAsset.modelSrc}
    materialPreset={currentAnchorAsset.materialPreset}
    position={[0, 0, 0]}
  />
</CoScrollAssetBoundary>
```

Runtime loading rule: mount only the current anchor, or the current anchor plus one adjacent prewarm anchor. Never map over `assets.anchors` to mount or preload every Heart Sutra GLB.

- [ ] **Step 3: Implement standalone demo**

Create `packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx`.

Required rule: this is the only package component allowed to create `<Canvas>`.

Use fixed review props in `apps/site/app/coscroll-spike/page.tsx`:

```tsx
<CoScrollStandaloneDemo
  progress={0.42}
  active
  quality={{ tier: "medium", dpr: 1.25, segments: 72, aurora: false, stars: 0, reason: "spike" }}
  reducedMotion={false}
  timeline={DEFAULT_COSCROLL_TIMELINE}
  assets={resolveCoScrollAssets()}
/>
```

- [ ] **Step 4: Export scene content and standalone demo**

Add to `packages/coscroll-scene/src/index.ts`:

```ts
export { CoScrollSceneContent } from "./CoScrollSceneContent";
export { CoScrollStandaloneDemo } from "./CoScrollStandaloneDemo";
```

- [ ] **Step 5: Add first Playwright spike test**

Create `tests/e2e/coscroll.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";

test("coscroll spike renders one standalone canvas with visible pixels", async ({ page }) => {
  await page.goto("/coscroll-spike?visualTest=pixels");
  await expect(page.locator("canvas")).toHaveCount(1);
  const nonblank = await page.waitForFunction(() => {
    const source = document.querySelector("canvas");
    if (!source) return false;
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) return false;
    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) return true;
    }
    return false;
  });
  expect(await nonblank.jsonValue()).toBe(true);
});
```

- [ ] **Step 6: Run review route tests**

Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e -- --project=desktop tests/e2e/coscroll.spec.ts
```

Expected: typecheck, build, and desktop spike test pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/coscroll-scene/src apps/site/app/coscroll-spike tests/e2e/coscroll.spec.ts
git commit -m "feat: render coscroll standalone spike"
```

Expected: commit succeeds.

## Task 5: Capture Source Reference And Approve Visual Direction

**Files:**

- Modify: `tests/e2e/coscroll.spec.ts`
- Create: `test-results/coscroll-reference-current.png`
- Create: `test-results/coscroll-spike-desktop.png`
- Create: `test-results/coscroll-spike-mobile-portrait.png`
- Create: `test-results/coscroll-spike-mobile-landscape.png`
- Create: `apps/site/public/assets/coscroll/posters/coscroll-poster.webp`

- [ ] **Step 1: Capture current CoScroll source reference**

Terminal A:

```bash
cd /Users/aitoshuu/Documents/GitHub/CoScroll
npm run dev -- -p 3200
```

Terminal B:

```bash
cd /Users/aitoshuu/Documents/GitHub/MiraLith
pnpm exec playwright screenshot --viewport-size=1440,900 http://127.0.0.1:3200 test-results/coscroll-reference-current.png
```

Expected: `test-results/coscroll-reference-current.png` exists.

- [ ] **Step 2: Add spike screenshot test**

Append to `tests/e2e/coscroll.spec.ts`:

```ts
test("captures coscroll spike review screenshots", async ({ page }) => {
  await page.goto("/coscroll-spike?visualTest=pixels");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "test-results/coscroll-spike-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/coscroll-spike-mobile-portrait.png", fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "test-results/coscroll-spike-mobile-landscape.png", fullPage: true });
});
```

- [ ] **Step 3: Run screenshot test**

Run:

```bash
pnpm test:e2e -- --project=desktop tests/e2e/coscroll.spec.ts
```

Expected: all screenshots exist in `test-results/`.

- [ ] **Step 4: Owner approval gate**

Review these files side by side:

```text
test-results/coscroll-reference-current.png
test-results/coscroll-spike-desktop.png
test-results/coscroll-spike-mobile-portrait.png
test-results/coscroll-spike-mobile-landscape.png
```

Required approval text to record in the final implementation notes:

```text
APPROVE lightweight scene package
```

If approval is not given, stop homepage integration and keep only `/coscroll-spike` plus docs.

- [ ] **Step 5: Promote approved desktop screenshot into poster**

Run after visual approval:

```bash
pnpm dlx --package sharp node -e "const sharp=require('sharp'); sharp('test-results/coscroll-spike-desktop.png').resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 76 }).toFile('apps/site/public/assets/coscroll/posters/coscroll-poster.webp')"
du -h apps/site/public/assets/coscroll/posters/coscroll-poster.webp
```

Expected: `coscroll-poster.webp` exists and is `<= 180KB`.

- [ ] **Step 6: Commit test addition and poster**

Run:

```bash
git add tests/e2e/coscroll.spec.ts apps/site/public/assets/coscroll/posters/coscroll-poster.webp
git commit -m "test: capture coscroll visual review screenshots"
```

Expected: commit succeeds. Do not commit `test-results/` unless the project already tracks visual artifacts.

## Task 6: Add Site Scene Arbitration And Lazy Load Gate

**Files:**

- Create: `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- Create: `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- Modify: `apps/site/visual/VisualCanvasFallback.tsx`
- Modify: `apps/site/components/MiraLithHome.tsx`

- [ ] **Step 1: Implement site adapter**

Create `apps/site/visual/scenes/CoScrollSceneSlot.tsx`.

Required adapter contract:

```ts
interface CoScrollSceneSlotProps {
  progress: number;
  active: boolean;
  quality?: LandingQuality;
  scrollVelocity?: number;
  paused?: boolean;
}
```

Required mount gate:

```tsx
if (!active || assetFailed || qualityProfile.tier === "fallback") {
  return null;
}
```

Required fallback handling:

```tsx
onFallback={(reason) => {
  if (reason === "asset-failed") {
    setAssetFailed(true);
  }
}}
```

- [ ] **Step 2: Implement lazy arbiter**

Create `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`:

```tsx
"use client";

import { lazy, Suspense } from "react";
import { LuBirthSceneSlot } from "./LuBirthSceneSlot";
import type { EarthMoonHeroMode } from "@miralith/lubirth-hero";

const LazyCoScrollSceneSlot = lazy(() =>
  import("./CoScrollSceneSlot").then((module) => ({ default: module.CoScrollSceneSlot }))
);

interface HomeVisualSceneSlotProps {
  activeScene: "lubirth" | "coscroll";
  lubirthMode: EarthMoonHeroMode;
  coscrollProgress: number;
  coscrollActive: boolean;
  debugMianyang?: boolean;
}

export function HomeVisualSceneSlot({
  activeScene,
  lubirthMode,
  coscrollProgress,
  coscrollActive,
  debugMianyang = false
}: HomeVisualSceneSlotProps) {
  if (activeScene === "coscroll" && coscrollActive) {
    return (
      <Suspense fallback={null}>
        <LazyCoScrollSceneSlot progress={coscrollProgress} active={coscrollActive} />
      </Suspense>
    );
  }

  return <LuBirthSceneSlot mode={lubirthMode} debugMianyang={debugMianyang} />;
}
```

- [ ] **Step 3: Wire `MiraLithHome` to use arbiter**

Replace the direct `<LuBirthSceneSlot />` child with:

```tsx
<HomeVisualSceneSlot
  activeScene={activeVisualScene}
  lubirthMode="field"
  coscrollProgress={coscrollProgress}
  coscrollActive={coscrollActive}
  debugMianyang={debugMianyang}
/>
```

Required state rule:

```ts
const activeVisualScene = coscrollActive ? "coscroll" : "lubirth";
```

`coscrollActive` must become `true` only when the CoScroll section is near the viewport.

- [ ] **Step 4: Typecheck and build**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/site/visual/scenes apps/site/visual/VisualCanvasFallback.tsx apps/site/components/MiraLithHome.tsx
git commit -m "feat: arbitrate home visual scenes"
```

Expected: commit succeeds.

## Task 7: Add Homepage Chapter, Public Route, And Typography Guard

**Files:**

- Create: `apps/site/app/coscroll/page.tsx`
- Modify: `apps/site/components/MiraLithHome.tsx`
- Modify: `apps/site/app/globals.css`

- [ ] **Step 1: Add public route**

Create `apps/site/app/coscroll/page.tsx` with:

```tsx
import {
  CoScrollStandaloneDemo,
  DEFAULT_COSCROLL_TIMELINE,
  resolveCoScrollAssets
} from "@miralith/coscroll-scene";

export default function CoScrollPage() {
  return (
    <main className="coscroll-public-page" aria-label="CoScroll digital sutra chapter">
      <section className="coscroll-section coscroll-section--public">
        <p className="section-kicker">04 CoScroll</p>
        <h1>CoScroll</h1>
        <p>A cyber prayer wheel for the scrolling age.</p>
        <p>CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.</p>
        <CoScrollStandaloneDemo
          progress={0.54}
          active
          quality={{ tier: "medium", dpr: 1.25, segments: 72, aurora: false, stars: 0, reason: "public" }}
          reducedMotion={false}
          timeline={DEFAULT_COSCROLL_TIMELINE}
          assets={resolveCoScrollAssets()}
        />
      </section>
    </main>
  );
}
```

If Task 5 approves `static GLB + DOM text` or `poster-only vignette` instead of the live scene package, replace only the visual block inside this route. Keep the same heading, summary copy, and public route tests.

- [ ] **Step 2: Add homepage DOM section**

Add after the LuBirth scroll stages:

```tsx
<section id="coscroll" className="coscroll-section" aria-label="CoScroll digital sutra chapter">
  <p className="section-kicker">04 CoScroll</p>
  <h2>CoScroll</h2>
  <p>A cyber prayer wheel for the scrolling age.</p>
  <p>CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.</p>
  <p>In MiraLith it appears as the digital sutra chapter: a source-matched Heart Sutra timeline first, a project case study later.</p>
  <div className="coscroll-actions" aria-label="CoScroll actions">
    <a href="/coscroll">Enter CoScroll Heart Sutra</a>
    <a href="https://github.com/astroleno/CoScroll" target="_blank" rel="noreferrer">
      View source
    </a>
  </div>
  <ul className="sr-only" aria-label="CoScroll Heart Sutra lyrics">
    <li>观自在菩萨</li>
    <li>行深般若波罗蜜多时</li>
    <li>照见五蕴皆空</li>
    <li>度一切苦厄</li>
    <li>舍利子</li>
    <li>色不异空</li>
    <li>空不异色</li>
    <li>色即是空</li>
    <li>空即是色</li>
    <li>受想行识</li>
    <li>亦复如是</li>
    <li>舍利子</li>
    <li>是诸法空相</li>
    <li>不生不灭</li>
    <li>不垢不净</li>
    <li>不增不减</li>
    <li>是故空中无色</li>
    <li>无受想行识</li>
    <li>无眼耳鼻舌身意</li>
    <li>无色声香味触法</li>
    <li>无眼界</li>
    <li>乃至无意识界</li>
    <li>无无明</li>
    <li>亦无无明尽</li>
    <li>乃至无老死</li>
    <li>亦无老死尽</li>
    <li>无苦集灭道</li>
    <li>无智亦无得</li>
    <li>以无所得故</li>
    <li>菩提萨陲</li>
    <li>依般若波罗蜜多故</li>
    <li>心无挂碍</li>
    <li>无挂碍故</li>
    <li>无有恐怖</li>
    <li>远离颠倒梦想</li>
    <li>究竟涅盘</li>
    <li>三世诸佛</li>
    <li>依般若波罗蜜多故</li>
    <li>得阿耨多罗</li>
    <li>三藐三菩提</li>
    <li>故知般若波罗蜜多</li>
    <li>是大神咒</li>
    <li>是大明咒</li>
    <li>是无上咒</li>
    <li>是无等等咒</li>
    <li>能除壹切苦</li>
    <li>真实不虚</li>
    <li>故说般若波罗蜜多咒</li>
    <li>即说咒曰</li>
    <li>揭谛揭谛</li>
    <li>波罗揭谛</li>
    <li>波罗僧揭谛</li>
    <li>菩提娑婆诃</li>
  </ul>
</section>
```

- [ ] **Step 3: Add scoped typography guard**

Add to `apps/site/app/globals.css`:

```css
.coscroll-section {
  --coscroll-serif: "Iowan Old Style", "Songti SC", "STSong", "Noto Serif CJK SC", ui-serif, Georgia, serif;
  --coscroll-sans: "Avenir Next", "SF Pro Text", "PingFang SC", ui-sans-serif, system-ui, sans-serif;
  font-family: var(--coscroll-serif);
}

.coscroll-section h1,
.coscroll-section h2,
.coscroll-section p {
  font-family: var(--coscroll-serif);
  letter-spacing: 0;
}

.coscroll-section .section-kicker,
.coscroll-actions {
  font-family: var(--coscroll-sans);
}
```

Required visual result: the section reads as a ritual/sutra chapter, not a generic Inter portfolio block.

- [ ] **Step 4: Typecheck and build**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/site/app/coscroll apps/site/components/MiraLithHome.tsx apps/site/app/globals.css
git commit -m "feat: add coscroll chapter entry"
```

Expected: commit succeeds.

## Task 8: Add Fallback, Accessibility, Pixel, And Budget Tests

**Files:**

- Modify: `tests/e2e/coscroll.spec.ts`

- [ ] **Step 1: Add fallback DOM test**

Append:

```ts
test("coscroll fallback keeps DOM content available", async ({ page }) => {
  await page.goto("/?visual=fallback");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText("CoScroll")).toBeVisible();
  await expect(
    page.getByText("CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.")
  ).toBeVisible();
});
```

- [ ] **Step 2: Add first-screen lazy-load budget test**

Append:

```ts
test("coscroll assets do not load on first screen", async ({ page }) => {
  const coscrollResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/assets/coscroll/") || response.url().includes("coscroll-scene")) {
      coscrollResponses.push(response.url());
    }
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(coscrollResponses).toEqual([]);
});
```

- [ ] **Step 3: Add DOM accessibility and public route tests**

Append:

```ts
test("coscroll DOM copy and link remain accessible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(page.getByRole("heading", { name: "CoScroll" })).toBeVisible();
  await expect(page.getByText("source-matched Heart Sutra timeline")).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter CoScroll Heart Sutra" })).toHaveAttribute("href", "/coscroll");
  await expect(page.getByRole("link", { name: "View source" })).toHaveAttribute(
    "href",
    "https://github.com/astroleno/CoScroll"
  );
  await expect(page.locator('[aria-label="CoScroll Heart Sutra lyrics"]')).toContainText("观自在菩萨");
  await expect(page.locator('[aria-label="CoScroll Heart Sutra lyrics"]')).toContainText("菩提娑婆诃");
});

test("coscroll public route renders the primary CTA target", async ({ page }) => {
  await page.goto("/coscroll?visualTest=pixels");
  await expect(page.getByRole("heading", { name: "CoScroll" })).toBeVisible();
  await expect(
    page.getByText("CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.")
  ).toBeVisible();
  await expect(page.getByText("A cyber prayer wheel for the scrolling age.")).toBeVisible();
});
```

This public route test intentionally does not assert a Canvas. `/coscroll` must keep its DOM/CTA experience valid whether the approved expression is live WebGL, static GLB plus DOM text, or poster fallback.

- [ ] **Step 4: Add section-load budget and shared Canvas pixel tests**

Append:

```ts
test("coscroll section loads within chapter budget", async ({ page }) => {
  const assetSizes: Promise<number>[] = [];
  const anchorGlbPaths = new Set<string>();

  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/assets/coscroll/")) return;

    const pathname = new URL(url).pathname;
    if (pathname.startsWith("/assets/coscroll/anchors/") && pathname.endsWith(".glb")) {
      anchorGlbPaths.add(pathname);
    }

    assetSizes.push(response.body().then((body) => body.byteLength).catch(() => 0));
  });

  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForLoadState("networkidle");

  const coscrollBytes = (await Promise.all(assetSizes)).reduce((sum, value) => sum + value, 0);
  expect(anchorGlbPaths.size).toBeLessThanOrEqual(2);
  expect(coscrollBytes).toBeLessThanOrEqual(880_000);
});

test("coscroll shared canvas path renders nonblank pixels", async ({ page }) => {
  await page.goto("/?visualTest=pixels");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  const nonblank = await page.waitForFunction(() => {
    const source = document.querySelector("canvas");
    if (!source) return false;
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) return false;
    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) return true;
    }
    return false;
  });
  expect(await nonblank.jsonValue()).toBe(true);
});
```

- [ ] **Step 5: Run full verification**

Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all commands pass across desktop, mobile portrait, and mobile landscape projects.

- [ ] **Step 6: Commit**

Run:

```bash
git add tests/e2e/coscroll.spec.ts
git commit -m "test: verify coscroll fallback and budgets"
```

Expected: commit succeeds.

## Task 9: Sync Docs And Freeze Handoff

**Files:**

- Modify: `docs/coscroll-scene-interface.md`
- Modify: `docs/coscroll-integration-brief.md`
- Modify: `docs/coscroll-migration-plan.md`

- [ ] **Step 1: Sync interface doc**

Update `docs/coscroll-scene-interface.md` so it lists the implemented exports:

```ts
CoScrollSceneContent;
CoScrollStandaloneDemo;
DEFAULT_COSCROLL_ASSETS;
resolveCoScrollAssets;
DEFAULT_COSCROLL_TIMELINE;
createCoScrollVisualState;
```

and the implemented first-pass fields:

```ts
progress;
active;
quality;
reducedMotion;
timeline;
assets;
scrollVelocity;
paused;
onReady;
onFallback;
```

- [ ] **Step 2: Update integration brief**

Update `docs/coscroll-integration-brief.md` to point execution to:

```text
docs/coscroll-migration-plan.md
docs/coscroll-implementation-plan/IMPLEMENTATION_PLAN.md
```

- [ ] **Step 3: Add final implementation snapshot**

In `docs/coscroll-migration-plan.md`, fill the `Implementation Snapshot` block with:

```markdown
Status: CoScroll v1.1 first-pass scene implemented.
Runtime path: `apps/site` owned `VisualCanvas` -> `HomeVisualSceneSlot` -> `CoScrollSceneSlot` -> `CoScrollSceneContent`.
Timeline: 364-second CoScroll Heart Sutra data, exact `public/lyrics/心经.lrc` line text/timestamps, and 16 source anchor cues from `heart-sutra.json`.
Public route: `/coscroll`
Review route: `/coscroll-spike`
Primary CTA: `Enter CoScroll Heart Sutra`
Secondary source link: `View source`
Verification: `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`
```

- [ ] **Step 4: Stale language scan**

Run:

```bash
rg -n "View CoScroll sourc[e]|Enter CoScroll excer[p]t|heart[.]glb|CoScrollScene.*not.*contract" docs/coscroll-*.md docs/tech-stack.md docs/interfaces.md
```

Expected: no stale contract language and no old developer-first CTA label.

- [ ] **Step 5: Final verification**

Run:

```bash
pnpm verify
pnpm test:e2e
git status --short
```

Expected:

- `pnpm verify` passes.
- `pnpm test:e2e` passes.
- `git status --short` contains only intentional CoScroll implementation and docs changes.

- [ ] **Step 6: Commit**

Run:

```bash
git add docs/coscroll-scene-interface.md docs/coscroll-integration-brief.md docs/coscroll-migration-plan.md docs/coscroll-implementation-plan/IMPLEMENTATION_PLAN.md
git commit -m "docs: sync coscroll implementation plan"
```

Expected: commit succeeds.

## Stop Conditions

Stop implementation and update `docs/coscroll-migration-plan.md` plus this file if any condition occurs:

- Any Heart Sutra anchor GLB cannot be compressed below `350KB` while preserving a recognizable silhouette.
- First-screen requests include `/assets/coscroll/` or the CoScroll package chunk.
- Homepage production path renders more than one `canvas`.
- LuBirth and CoScroll mount side by side inside production `VisualCanvas`.
- Package-local loader failure cannot be converted into `onFallback("asset-failed")`.
- The source reference screenshot cannot be captured before homepage approval.
- Owner does not approve the spike as recognizably CoScroll.
- The approved visual reads as purple/blue neon, glowing-orb decoration, card-wrapped 3D, or generic dark WebGL.
- The DOM chapter still reads as a generic Inter portfolio section after the typography guard.
- The implementation requires Tone, Framer Motion, Troika, full CoScroll audio, full CoScroll font, or the full model library.

## Self-Review

- Spec coverage: tasks cover package scaffold, asset conversion, visual primitives, standalone spike, source reference capture, shared Canvas arbitration, homepage/public routes, typography guard, tests, budgets, and docs sync.
- Open marker scan: this plan has no unresolved work markers and no unspecified validation steps.
- Type consistency: the plan uses the same exported names, prop names, route names, CTA labels, and fallback reasons as `docs/coscroll-migration-plan.md`.
