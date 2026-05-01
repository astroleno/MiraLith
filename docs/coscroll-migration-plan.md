# CoScroll to MiraLith Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MiraLith v1.1's CoScroll chapter as a lightweight scene package that preserves jade anchor, front/back scripture depth, and ritual scroll atmosphere without migrating the full CoScroll app.

**Architecture:** MiraLith keeps ownership of the fixed production Canvas in `apps/site`. A site scene slot arbitrates which scene is mounted in that Canvas so LuBirth and CoScroll never fight over camera, background, fog, or asset loading. `packages/coscroll-scene` provides canvas-less R3F scene content, pure timeline/state mapping, lightweight text billboards, a GLB-only jade anchor, and fallback metadata; site code owns DOM copy, SEO, routing, section progress, fallback presentation, lazy scene loading, and public asset hosting.

**Tech Stack:** Next.js 16 App Router, React 19, Three 0.184, React Three Fiber 9, Drei 10, Zustand 5 through `@miralith/visual-core`, GSAP ScrollTrigger for the existing first-act scroll driver, Playwright for browser verification.

---

## 1. Current Ground Truth

### MiraLith v1.0 implementation

- `apps/site/components/MiraLithHome.tsx` mounts one production `VisualCanvas`.
- `apps/site/visual/VisualCanvas.tsx` owns the only homepage Canvas, context-loss fallback, first usable marker, `?visual=fallback`, and `?visualTest=pixels`.
- `apps/site/visual/scenes/LuBirthSceneSlot.tsx` is the current scene adapter pattern: resolve reduced motion and quality tier in site code, then pass resolved props into a package scene.
- `packages/lubirth-hero` exports `EarthMoonScene`, `resolveLandingPreset`, `resolveLandingAssets`, and a package-level asset budget model that uses public URLs under `/assets/lubirth/...`.
- `packages/visual-core` already owns quality detection and a basic scroll progress utility.
- `tests/e2e/miralith.spec.ts` verifies one Canvas, nonblank pixels, forced fallback, first usable marker under 3 seconds, mobile landscape smoke, and first-screen transfer budget under 3MB.

### CoScroll source facts

- Source project: `/Users/aitoshuu/Documents/GitHub/CoScroll`.
- Runtime stack differs: Next 14, React 18, R3F 8, Three 0.160, Zustand 4, Troika, Tone, Framer Motion.
- Useful source code anchors:
  - `src/components/layouts/UnifiedLyricsAndModel.tsx`: single Canvas composition, depth-test idea, current visual proportions.
  - `src/components/layouts/useLayeredLyrics.ts`: front/back layer selection and travel math.
  - `src/components/layouts/LyricBillboard.tsx`: CanvasTexture text billboards, vertical text, edge feather.
  - `src/components/jade/JadeModelLoader.tsx`: canvas-less jade model loader and dual material intent.
  - `src/components/jade/ModelPreloader.ts`: preload ideas only, not the first implementation dependency.
- Heavy source assets:
  - `public/projects/heart-sutra.json`: Wang Fei Heart Sutra config, 364-second duration, 16 anchor cues.
  - `public/lyrics/心经.lrc`: 53 non-empty source lyric lines, used verbatim.
  - Heart Sutra anchor OBJs under `public/models/10k_obj/`: about 1.0MB to 1.5MB each before GLB compression.
  - `public/fonts/润植家康熙字典美化体.ttf`: about 5.8MB, not migrated.
  - `public/audio/心经.mp3`: about 14MB, not migrated.
  - `public/audio/心经_2.mp3`: about 5.7MB, not migrated.
  - HDR and normal textures are about 1MB each, not loaded in the first homepage path.

### Worker prerequisites

- Do not implement from the current dirty `codex/lubirth-reverse-opening` worktree. Use `superpowers:using-git-worktrees` to create or enter an isolated worktree on branch `codex/coscroll-chapter` before Task 1.
- Run from that isolated MiraLith worktree.
- If `pnpm` is unavailable, run `corepack enable` first, then retry `pnpm --version`.
- Do not start implementation while `docs/coscroll-migration-plan.md` is the only source of truth and `docs/coscroll-scene-interface.md` still disagrees with it; Task 11 closes that loop after the spike validates the contract.

## 2. Fixed Decisions For v1.1 First Pass

- Heart Sutra data source: match CoScroll `public/projects/heart-sutra.json` and `public/lyrics/心经.lrc`, not a rewritten excerpt.
- First timeline duration: 364 seconds, matching CoScroll `assets.audio.duration` for the Wang Fei Heart Sutra version. The audio file itself is not loaded in MiraLith v1.1.
- First lyric set: all 53 non-empty LRC lines from `public/lyrics/心经.lrc`, with exact source text and source timestamps.
- First anchor timeline: all 16 anchor cue nodes from `heart-sutra.json`, covering 14 unique anchors: `观`, `空`, `苦`, `色`, `法`, `生`, `无`, `死`, `道`, `心`, `悟`, `明`, `真`, `圆`.
- First runtime model format: GLB only. Runtime must not load OBJ. Convert the Heart Sutra anchor models to GLB and lazy-load only the current/near anchor instead of preloading all models.
- First text renderer: CanvasTexture billboard adapted from CoScroll, not Troika. This avoids adding `troika-three-text` before the spike proves it is needed.
- First background: procedural dark mineral field inside the scene plus CSS/DOM fallback, no HDR on the homepage path.
- First mobile low tier: static or near-static anchor with reduced text count. True front/back occlusion is allowed on low only if the Playwright mobile smoke remains stable.
- First fallback: site-owned poster plus DOM project copy. The package can report fallback reasons, but it does not own visible fallback UI in homepage mode.
- Site-owned Canvas rule: `CoScrollSceneContent` never creates `<Canvas>`. Only `CoScrollStandaloneDemo` may create a Canvas.
- Canvas scripture text is decorative. Equivalent text must exist in DOM as visible summary copy plus an `sr-only` full Heart Sutra lyric list copied from `public/lyrics/心经.lrc`.
- Homepage CTA hierarchy for the first pass: primary label `Enter CoScroll Heart Sutra`, destination `/coscroll`; secondary label `View source`, destination `https://github.com/astroleno/CoScroll`, opens in a new tab with `rel="noreferrer"`.
- Homepage integration requires a product/experience approval gate after the standalone spike. If the owner decides MiraLith v1.1 should remain LuBirth-only, stop after `/coscroll-spike` and docs.
- No direct imports from `/Users/aitoshuu/Documents/GitHub/CoScroll/src` in MiraLith. Copy and adapt code into `packages/coscroll-scene`.

## 3. Target Files

Create:

- `packages/coscroll-scene/package.json`
- `packages/coscroll-scene/tsconfig.json`
- `packages/coscroll-scene/src/index.ts`
- `packages/coscroll-scene/src/types.ts`
- `packages/coscroll-scene/src/defaultTimeline.ts`
- `packages/coscroll-scene/src/assetManifest.ts`
- `packages/coscroll-scene/src/createCoScrollVisualState.ts`
- `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`
- `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- `packages/coscroll-scene/src/CoScrollMineralField.tsx`
- `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- `packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx`
- `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- `apps/site/app/coscroll-spike/page.tsx`
- `apps/site/app/coscroll/page.tsx`
- `tests/e2e/coscroll.spec.ts`
- `apps/site/public/assets/coscroll/anchors/*.glb`
- `apps/site/public/assets/coscroll/posters/coscroll-poster.webp`

Modify:

- `apps/site/package.json`: add `@miralith/coscroll-scene`.
- `apps/site/visual/VisualCanvasFallback.tsx`: allow `scene="coscroll"` in addition to `scene="lubirth"`.
- `apps/site/components/MiraLithHome.tsx`: add the CoScroll section only after the spike route passes. Keep LuBirth first-act behavior unchanged.
- `docs/coscroll-scene-interface.md`: sync final field names after the spike.
- `docs/coscroll-integration-brief.md`: link this plan as the file-level migration plan.

Do not modify in this plan:

- CoScroll source project files.
- `packages/lubirth-hero` implementation.
- Existing LuBirth first-act e2e expectations, except adding assertions that the first act still has one production Canvas.

## 4. Public Asset Layout

Use public assets from the site app, mirroring LuBirth:

```text
apps/site/public/assets/coscroll/
  anchors/
    guan.glb
    kong.glb
    ku.glb
    se.glb
    fa.glb
    sheng.glb
    wu.glb
    si.glb
    dao.glb
    xin.glb
    wu2.glb
    ming.glb
    zhen.glb
    yuan.glb
  posters/
    coscroll-poster.webp
```

Initial budgets:

| Asset | Source | Target | Budget |
| --- | --- | --- | --- |
| each anchor GLB | CoScroll `10k_obj/*.obj` used by `heart-sutra.json` | compressed GLB with meshopt | <= 350KB each |
| `coscroll-poster.webp` | screenshot or designed static fallback | WebP | <= 180KB |
| text renderer | generated CanvasTexture | runtime only | no font download |
| background | procedural shader/material | runtime only | no texture download |

Anchor source mapping:

| Anchor | Source OBJ | Target GLB |
| --- | --- | --- |
| `观` | `101_观.obj` | `guan.glb` |
| `空` | `001_空.obj` | `kong.glb` |
| `苦` | `045_苦.obj` | `ku.glb` |
| `色` | `094_色.obj` | `se.glb` |
| `法` | `022_法.obj` | `fa.glb` |
| `生` | `019_生.obj` | `sheng.glb` |
| `无` | `012_无.obj` | `wu.glb` |
| `死` | `020_死.obj` | `si.glb` |
| `道` | `003_道.obj` | `dao.glb` |
| `心` | `002_心.obj` | `xin.glb` |
| `悟` | `008_悟.obj` | `wu2.glb` |
| `明` | `007_明.obj` | `ming.glb` |
| `真` | `009_真.obj` | `zhen.glb` |
| `圆` | `001_空.obj` | `yuan.glb` |

Run conversion from the MiraLith repo root:

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
```

Reject any anchor GLB over 350KB after compression. If one misses budget, run a second pass with geometry simplification and compare the jade silhouette in the spike route before accepting it. Runtime may request only the current and near anchor assets; it must not preload all converted anchors on first screen.

## 5. Package Contract

`packages/coscroll-scene/src/types.ts` defines the stable v1.1 first-pass contract. Include the current Heart Sutra anchors from CoScroll `heart-sutra.json`; do not add unrelated future projects or video fallback fields until the first pass ships:

```ts
import type { QualityProfile, ResolvedQualityTier } from "@miralith/visual-core";

export type CoScrollAnchorId =
  | "观"
  | "空"
  | "苦"
  | "色"
  | "法"
  | "生"
  | "无"
  | "死"
  | "道"
  | "心"
  | "悟"
  | "明"
  | "真"
  | "圆";
export type CoScrollFallbackMode = "none" | "poster" | "dom-static";
export type CoScrollFallbackReason =
  | "webgl-unavailable"
  | "context-lost"
  | "asset-failed"
  | "quality-tier"
  | "reduced-motion";

export interface CoScrollLyricSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  layer: "front" | "back";
  emphasis?: "quiet" | "normal" | "bright";
}

export interface CoScrollAnchorCue {
  anchor: CoScrollAnchorId;
  start: number;
  end: number;
}

export interface CoScrollTimelineConfig {
  duration: number;
  easing: "linear" | "ritual-slow-in" | "breath";
  anchorCues: CoScrollAnchorCue[];
  lyricSegments: CoScrollLyricSegment[];
}

export interface CoScrollAnchorAsset {
  id: CoScrollAnchorId;
  label: string;
  modelSrc: string;
  posterSrc?: string;
  materialPreset: "jade-dark" | "jade-gold" | "jade-blue";
  bytesBudget: number;
}

export interface CoScrollAssetManifest {
  anchors: CoScrollAnchorAsset[];
  fallback: {
    posterSrc: string;
    posterBytesBudget: number;
  };
}

export interface CoScrollVisualState {
  visualTime: number;
  duration: number;
  lyrics: CoScrollLyricSegment[];
  currentAnchor: CoScrollAnchorId;
  scrollVelocity: number;
  frontLayerOpacity: number;
  backLayerOpacity: number;
  backgroundIntensity: number;
  fallbackMode: CoScrollFallbackMode;
  shouldLoadModel: boolean;
}

export interface CoScrollSceneContentProps {
  progress: number;
  active: boolean;
  quality: QualityProfile;
  reducedMotion?: boolean;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  scrollVelocity?: number;
  paused?: boolean;
  onReady?: () => void;
  onFallback?: (reason: CoScrollFallbackReason) => void;
}

export type { QualityProfile, ResolvedQualityTier };
```

Default timeline in `defaultTimeline.ts`:

```ts
import type { CoScrollTimelineConfig } from "./types";

export const DEFAULT_COSCROLL_TIMELINE: CoScrollTimelineConfig = {
  duration: 364,
  easing: "breath",
  anchorCues: [
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
  ],
  lyricSegments: [
    { id: "lrc-01", text: "观自在菩萨", start: 11.84, end: 18.68, layer: "front", emphasis: "bright" },
    { id: "lrc-02", text: "行深般若波罗蜜多时", start: 18.68, end: 28.87, layer: "back", emphasis: "normal" },
    { id: "lrc-03", text: "照见五蕴皆空", start: 28.87, end: 36.79, layer: "front", emphasis: "bright" },
    { id: "lrc-04", text: "度一切苦厄", start: 36.79, end: 49.28, layer: "back", emphasis: "bright" },
    { id: "lrc-05", text: "舍利子", start: 49.28, end: 52.53, layer: "front", emphasis: "normal" },
    { id: "lrc-06", text: "色不异空", start: 52.53, end: 54, layer: "back", emphasis: "bright" },
    { id: "lrc-07", text: "空不异色", start: 54, end: 63.47, layer: "front", emphasis: "normal" },
    { id: "lrc-08", text: "色即是空", start: 63.47, end: 65.75, layer: "back", emphasis: "normal" },
    { id: "lrc-09", text: "空即是色", start: 65.75, end: 74.04, layer: "front", emphasis: "normal" },
    { id: "lrc-10", text: "受想行识", start: 74.04, end: 78.23, layer: "back", emphasis: "normal" },
    { id: "lrc-11", text: "亦复如是", start: 78.23, end: 91.22, layer: "front", emphasis: "normal" },
    { id: "lrc-12", text: "舍利子", start: 91.22, end: 94.09, layer: "back", emphasis: "normal" },
    { id: "lrc-13", text: "是诸法空相", start: 94.09, end: 98.88, layer: "front", emphasis: "bright" },
    { id: "lrc-14", text: "不生不灭", start: 98.88, end: 101.51, layer: "back", emphasis: "bright" },
    { id: "lrc-15", text: "不垢不净", start: 101.51, end: 104.14, layer: "front", emphasis: "normal" },
    { id: "lrc-16", text: "不增不减", start: 104.14, end: 106.77, layer: "back", emphasis: "normal" },
    { id: "lrc-17", text: "是故空中无色", start: 106.77, end: 112.07, layer: "front", emphasis: "bright" },
    { id: "lrc-18", text: "无受想行识", start: 112.07, end: 115.33, layer: "back", emphasis: "normal" },
    { id: "lrc-19", text: "无眼耳鼻舌身意", start: 115.33, end: 118.71, layer: "front", emphasis: "normal" },
    { id: "lrc-20", text: "无色声香味触法", start: 118.71, end: 125.14, layer: "back", emphasis: "normal" },
    { id: "lrc-21", text: "无眼界", start: 125.14, end: 127.48, layer: "front", emphasis: "normal" },
    { id: "lrc-22", text: "乃至无意识界", start: 127.48, end: 132.16, layer: "back", emphasis: "normal" },
    { id: "lrc-23", text: "无无明", start: 132.16, end: 135.28, layer: "front", emphasis: "normal" },
    { id: "lrc-24", text: "亦无无明尽", start: 135.28, end: 140.5, layer: "back", emphasis: "normal" },
    { id: "lrc-25", text: "乃至无老死", start: 140.5, end: 143.77, layer: "front", emphasis: "bright" },
    { id: "lrc-26", text: "亦无老死尽", start: 143.77, end: 147.05, layer: "back", emphasis: "normal" },
    { id: "lrc-27", text: "无苦集灭道", start: 147.05, end: 150.06, layer: "front", emphasis: "bright" },
    { id: "lrc-28", text: "无智亦无得", start: 150.06, end: 182.07, layer: "back", emphasis: "normal" },
    { id: "lrc-29", text: "以无所得故", start: 182.07, end: 185.32, layer: "front", emphasis: "normal" },
    { id: "lrc-30", text: "菩提萨陲", start: 185.32, end: 189.13, layer: "back", emphasis: "normal" },
    { id: "lrc-31", text: "依般若波罗蜜多故", start: 189.13, end: 194.1, layer: "front", emphasis: "normal" },
    { id: "lrc-32", text: "心无挂碍", start: 194.1, end: 198.59, layer: "back", emphasis: "bright" },
    { id: "lrc-33", text: "无挂碍故", start: 198.59, end: 202.1, layer: "front", emphasis: "normal" },
    { id: "lrc-34", text: "无有恐怖", start: 202.1, end: 204.61, layer: "back", emphasis: "normal" },
    { id: "lrc-35", text: "远离颠倒梦想", start: 204.61, end: 208.18, layer: "front", emphasis: "normal" },
    { id: "lrc-36", text: "究竟涅盘", start: 208.18, end: 213.06, layer: "back", emphasis: "normal" },
    { id: "lrc-37", text: "三世诸佛", start: 213.06, end: 215.79, layer: "front", emphasis: "normal" },
    { id: "lrc-38", text: "依般若波罗蜜多故", start: 215.79, end: 221.27, layer: "back", emphasis: "normal" },
    { id: "lrc-39", text: "得阿耨多罗", start: 221.27, end: 224, layer: "front", emphasis: "normal" },
    { id: "lrc-40", text: "三藐三菩提", start: 224, end: 233.08, layer: "back", emphasis: "normal" },
    { id: "lrc-41", text: "故知般若波罗蜜多", start: 233.08, end: 237.42, layer: "front", emphasis: "normal" },
    { id: "lrc-42", text: "是大神咒", start: 237.42, end: 239.06, layer: "back", emphasis: "normal" },
    { id: "lrc-43", text: "是大明咒", start: 239.06, end: 240.71, layer: "front", emphasis: "bright" },
    { id: "lrc-44", text: "是无上咒", start: 240.71, end: 242.42, layer: "back", emphasis: "normal" },
    { id: "lrc-45", text: "是无等等咒", start: 242.42, end: 244.57, layer: "front", emphasis: "normal" },
    { id: "lrc-46", text: "能除壹切苦", start: 244.57, end: 247.59, layer: "back", emphasis: "normal" },
    { id: "lrc-47", text: "真实不虚", start: 247.59, end: 287.91, layer: "front", emphasis: "bright" },
    { id: "lrc-48", text: "故说般若波罗蜜多咒", start: 287.91, end: 302.27, layer: "back", emphasis: "bright" },
    { id: "lrc-49", text: "即说咒曰", start: 302.27, end: 322.62, layer: "front", emphasis: "normal" },
    { id: "lrc-50", text: "揭谛揭谛", start: 322.62, end: 330.71, layer: "back", emphasis: "normal" },
    { id: "lrc-51", text: "波罗揭谛", start: 330.71, end: 340.2, layer: "front", emphasis: "bright" },
    { id: "lrc-52", text: "波罗僧揭谛", start: 340.2, end: 348.83, layer: "back", emphasis: "normal" },
    { id: "lrc-53", text: "菩提娑婆诃", start: 348.83, end: 364, layer: "front", emphasis: "bright" }
  ]
};
```

Default assets in `assetManifest.ts`:

```ts
import type { CoScrollAssetManifest } from "./types";

export const DEFAULT_COSCROLL_ASSETS: CoScrollAssetManifest = {
  anchors: [
    { id: "观", label: "观", modelSrc: "/assets/coscroll/anchors/guan.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "空", label: "空", modelSrc: "/assets/coscroll/anchors/kong.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "苦", label: "苦", modelSrc: "/assets/coscroll/anchors/ku.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "色", label: "色", modelSrc: "/assets/coscroll/anchors/se.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "法", label: "法", modelSrc: "/assets/coscroll/anchors/fa.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "生", label: "生", modelSrc: "/assets/coscroll/anchors/sheng.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "无", label: "无", modelSrc: "/assets/coscroll/anchors/wu.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "死", label: "死", modelSrc: "/assets/coscroll/anchors/si.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "道", label: "道", modelSrc: "/assets/coscroll/anchors/dao.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "心", label: "心", modelSrc: "/assets/coscroll/anchors/xin.glb", posterSrc: "/assets/coscroll/posters/coscroll-poster.webp", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "悟", label: "悟", modelSrc: "/assets/coscroll/anchors/wu2.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "明", label: "明", modelSrc: "/assets/coscroll/anchors/ming.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "真", label: "真", modelSrc: "/assets/coscroll/anchors/zhen.glb", materialPreset: "jade-dark", bytesBudget: 350_000 },
    { id: "圆", label: "圆", modelSrc: "/assets/coscroll/anchors/yuan.glb", materialPreset: "jade-dark", bytesBudget: 350_000 }
  ],
  fallback: {
    posterSrc: "/assets/coscroll/posters/coscroll-poster.webp",
    posterBytesBudget: 180_000
  }
};

export function resolveCoScrollAssets(assets: Partial<CoScrollAssetManifest> = {}): CoScrollAssetManifest {
  return {
    ...DEFAULT_COSCROLL_ASSETS,
    ...assets,
    fallback: {
      ...DEFAULT_COSCROLL_ASSETS.fallback,
      ...assets.fallback
    }
  };
}
```

## 6. Fallback And Load Ownership

Fallback ownership is intentionally split:

- `apps/site` owns visible fallback UI, DOM copy, CTA links, and section accessibility.
- `VisualCanvas` owns global WebGL failure fallback through `?visual=fallback`, context loss, and error boundaries.
- `CoScrollSceneSlot` owns whether the CoScroll scene is mounted. If `active === false`, `quality.tier === "fallback"`, or a previous `asset-failed` occurred, it returns `null`.
- `CoScrollSceneContent` owns only WebGL scene content. It may call `onFallback(reason)` for telemetry/state, but it must not render homepage fallback DOM.

Asset loading rule:

```text
active false -> HomeVisualSceneSlot renders LuBirth and does not import LazyCoScrollSceneSlot -> no CoScroll package chunk, GLB, poster, or texture request
active true + quality fallback -> CoScrollSceneSlot returns null -> site DOM/poster remains visible
active true + model load fails -> package-local asset error boundary calls onFallback("asset-failed") -> CoScrollSceneSlot disables future scene mount
forced visual fallback -> VisualCanvas renders site fallback -> no Canvas
```

`createCoScrollVisualState` exposes `shouldLoadModel`. `CoScrollSceneContent` must not call `useGLTF`, render `CoScrollJadeAnchor`, or allocate text textures when `shouldLoadModel === false`.

## 7. Shared Canvas Handoff

LuBirth currently writes camera, background, fog, moon position, and light state every frame. CoScroll must not mount beside LuBirth in the production Canvas. The site layer needs one scene arbiter:

```text
VisualCanvas
  -> HomeVisualSceneSlot
      -> LuBirthSceneSlot when activeVisualScene === "lubirth"
      -> lazy CoScrollSceneSlot when activeVisualScene === "coscroll"
```

Rules:

- Exactly one active visual scene mounts in the production Canvas at a time.
- `HomeVisualSceneSlot` keeps LuBirth as the default scene until the CoScroll section is near the viewport.
- `CoScrollSceneSlot` is lazy-loaded with `React.lazy` so its JS chunk is not requested on the first LuBirth viewport.
- `CoScrollSceneContent` owns its active camera state: camera position `[0, 0, 7.2]`, look-at `[0, 0, 0]`, fov `42`, background `#030509`, and fog `["#030509", 8, 26]`.
- CoScroll resets camera/background/fog every frame while active, just as `EarthMoonScene` does for LuBirth.
- No crossfade is required in the first pass. A hard handoff is acceptable if the DOM transition is clean.

Depth direction:

- MiraLith's default camera sits on positive z and looks toward negative z.
- Higher z values are closer to the camera.
- Lower z values are farther from the camera.
- Therefore the first CoScroll depth layout is:

```text
front text:  z = +0.42 to +0.55, depthTest true
jade anchor: z = 0
back text:   z = -0.34 to -0.5, depthTest true
```

## 8. Visual Direction Gate

CoScroll's MiraLith role for v1.1 is a ritual chapter for the full Heart Sutra visual timeline. It is not a generic portfolio card, not a source-code CTA block, and not a full CoScroll app migration. DOM copy, CTA hierarchy, screenshot review, and scroll pacing must support that role.

CTA hierarchy:

- Primary CTA: `Enter CoScroll Heart Sutra`, destination `/coscroll` in the first pass. `/coscroll-spike` stays review-only and must not be the public homepage CTA target.
- When a real project detail route exists, retarget the primary CTA to that route without changing its experience-first role.
- Secondary link: `View source`, destination `https://github.com/astroleno/CoScroll`, opens in a new tab with `rel="noreferrer"`.

Visual direction:

- Use mineral black / charcoal as the field, not flat pure black.
- Use dark jade for the current Heart Sutra anchor: translucent, heavy, and object-like rather than neon.
- Use restrained dark gold only as a small accent.
- Preserve sutra-scroll whitespace: sparse vertical text, quiet pauses, and visible empty bands around the anchor.
- Keep the 3D scene full-bleed inside the shared visual layer. Do not wrap it in a card, framed preview, or hero panel.
- Do not use purple/blue neon, glowing orb or bokeh decoration, card-based hero composition, or generic particle-dark-WebGL as the main read.

Typography guard:

- Scope CoScroll typography inside `.coscroll-section`; do not let it inherit the body `Inter` / generic portfolio tone unchanged.
- Use a quiet serif/CJK stack for the chapter title, Heart Sutra lyric rhythm, and long-form narrative copy:

```css
.coscroll-section {
  --coscroll-serif: "Iowan Old Style", "Songti SC", "STSong", "Noto Serif CJK SC", ui-serif, Georgia, serif;
  --coscroll-sans: "Avenir Next", "SF Pro Text", "PingFang SC", ui-sans-serif, system-ui, sans-serif;
}
```

- Use `var(--coscroll-serif)` for `h2` and narrative paragraphs; reserve `var(--coscroll-sans)` for CTA labels and small metadata.
- Keep letter spacing at `0` for readable body copy. The small kicker may use slight tracking, but it must not become a loud uppercase portfolio label.
- Do not add external font files for this pass. If system serif/CJK rendering fails screenshot review, adjust size/line-height first, then consider a subset font in a later phase.

Source reference capture:

- Before approving the standalone spike, capture the current CoScroll visual baseline from `/Users/aitoshuu/Documents/GitHub/CoScroll`.
- Store the review screenshot at `test-results/coscroll-reference-current.png`; after approval, optionally copy the accepted reference into `docs/references/coscroll-reference-current.png`.
- Review the reference side by side with `/coscroll-spike` desktop/mobile screenshots. Approval must compare against this captured reference rather than memory.

Narrative copy gate:

- The section copy must state CoScroll's first-pass MiraLith role as a full Heart Sutra visual chapter.
- If the intended role changes to project index or full case-study route, update the CTA destination, layout emphasis, and scroll rhythm before homepage integration.

## 9. Baseline And Experience Gates

Before homepage integration, compare three candidate expressions on `/coscroll-spike`:

| Candidate | Build Cost | Pass Condition |
| --- | --- | --- |
| Poster-only vignette | Lowest | Use only if animated scene fails budget or readability |
| Static GLB + DOM text | Medium | Use if text billboards are unreadable but jade anchor works |
| Lightweight scene package | Highest | Use only if it visibly preserves current-anchor rendering, front/back depth, and ritual scroll atmosphere |

Experience gate:

- Capture the current CoScroll source reference required by the Visual Direction Gate.
- Capture desktop `1440x900`, mobile portrait `390x844`, and mobile landscape `844x390` screenshots from `/coscroll-spike`.
- Owner approval is required before Task 9 homepage integration.
- Approval criteria: the current source anchor is recognizable, the front/back depth is visible in at least one desktop screenshot, the mobile version still communicates "digital sutra / prayer wheel", the visual direction matches the source reference, and the scene does not read as a generic dark WebGL demo.
- If approval fails, stop package integration and use poster-only or static GLB as the MiraLith v1.1 expression. Update Task 9 and Task 10 expectations to match the selected fallback expression before continuing.

CanvasTexture kill criteria:

- If fewer than 6 of 8 scripture lines are readable in desktop screenshot review, switch to Troika or a subset font spike.
- If vertical CJK glyphs clip at top/bottom on mobile portrait, reduce visible line count and font size once; if still clipped, switch to DOM/SVG text overlay for mobile.
- If text readability requires loading the 5.8MB CoScroll font, reject Canvas text for the homepage path.

Product gate:

- CoScroll homepage integration must improve this user outcome: visitors understand CoScroll as a second project in the MiraLith world without weakening LuBirth as the entrance myth.
- If the desired v1.1 outcome is still a focused LuBirth opening rather than a multi-chapter homepage, keep CoScroll at `/coscroll-spike` and defer Task 9.

## 10. Milestones

| # | Milestone | Target | Success Criteria |
| --- | --- | --- | --- |
| M0 | Scaffold and contract | 0.5 day | `@miralith/coscroll-scene` typechecks and exports pure state helpers |
| M1 | Asset spike | 1 day | Heart Sutra anchor GLBs and poster are in public assets and within per-anchor budget |
| M2 | Standalone visual spike | 1 day | `/coscroll-spike` renders the source-timed Heart Sutra line window, current anchor, front/back text, mineral field, fallback path |
| M3 | Shared Canvas integration | 1 day | `CoScrollSceneSlot` mounts inside `VisualCanvas` without creating another Canvas |
| M4 | Homepage chapter integration | 1 day | CoScroll appears after LuBirth with DOM content, section progress, owner approval, and no first-screen budget regression |
| M5 | Verification and docs freeze | 0.5 day | Playwright, build, typecheck, docs sync all pass |

## 11. Task Plan

### Task 1: Scaffold `@miralith/coscroll-scene`

**Files:**

- Create `packages/coscroll-scene/package.json`
- Create `packages/coscroll-scene/tsconfig.json`
- Create `packages/coscroll-scene/src/index.ts`
- Create `packages/coscroll-scene/src/types.ts`
- Modify `apps/site/package.json`

- [ ] Create `packages/coscroll-scene/package.json`:

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

- [ ] Create `packages/coscroll-scene/tsconfig.json` using the same compiler posture as `packages/lubirth-hero/tsconfig.json`, with `src/**/*` included.

- [ ] Add `@miralith/coscroll-scene` to `apps/site/package.json` dependencies:

```json
"@miralith/coscroll-scene": "workspace:*"
```

- [ ] Add `types.ts` from the contract in section 5.

- [ ] Create `index.ts` with only the exports that exist in Task 1:

```ts
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

- [ ] Run:

```bash
pnpm install
pnpm --filter @miralith/coscroll-scene typecheck
pnpm typecheck
```

Expected: all commands pass. If `pnpm install` rewrites the lockfile only because the workspace package was added, include the lockfile in the same commit.

### Task 2: Add visual state mapping

**Files:**

- Create `packages/coscroll-scene/src/defaultTimeline.ts`
- Create `packages/coscroll-scene/src/createCoScrollVisualState.ts`

- [ ] Create `defaultTimeline.ts` from section 5.

- [ ] Create `createCoScrollVisualState.ts`:

```ts
import type {
  CoScrollAssetManifest,
  CoScrollFallbackMode,
  CoScrollTimelineConfig,
  CoScrollVisualState
} from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function ease(progress: number, easing: CoScrollTimelineConfig["easing"]) {
  if (easing === "ritual-slow-in") {
    return progress * progress;
  }
  if (easing === "breath") {
    return progress * progress * (3 - 2 * progress);
  }
  return progress;
}

function resolveFallbackMode(input: {
  active: boolean;
  reducedMotion: boolean;
  qualityTier: string;
}): CoScrollFallbackMode {
  if (input.qualityTier === "fallback") {
    return "poster";
  }
  if (input.reducedMotion) {
    return "dom-static";
  }
  if (!input.active) {
    return "poster";
  }
  return "none";
}

export function createCoScrollVisualState(input: {
  progress: number;
  active: boolean;
  qualityTier: "high" | "medium" | "low" | "fallback";
  reducedMotion: boolean;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  scrollVelocity?: number;
}): CoScrollVisualState {
  const progress = clamp01(input.progress);
  const eased = ease(progress, input.timeline.easing);
  const duration = Math.max(1, input.timeline.duration);
  const visualTime = eased * duration;
  const fallbackMode = resolveFallbackMode({
    active: input.active,
    reducedMotion: input.reducedMotion,
    qualityTier: input.qualityTier
  });
  const currentAnchor =
    input.timeline.anchorCues.find((cue) => visualTime >= cue.start && visualTime <= cue.end)?.anchor ??
    input.timeline.anchorCues[0]?.anchor ??
    "观";
  const velocity = input.reducedMotion ? 0 : Math.max(-1, Math.min(1, input.scrollVelocity ?? 0));
  const activeLyrics = input.timeline.lyricSegments.filter((line) => {
    const paddedStart = Math.max(0, line.start - 2.5);
    const paddedEnd = Math.min(duration, line.end + 2.5);
    return visualTime >= paddedStart && visualTime <= paddedEnd;
  });

  return {
    visualTime,
    duration,
    lyrics: activeLyrics.length > 0 ? activeLyrics : input.timeline.lyricSegments.slice(0, 4),
    currentAnchor,
    scrollVelocity: velocity,
    frontLayerOpacity: fallbackMode === "none" ? 1 : 0.72,
    backLayerOpacity: fallbackMode === "none" ? 0.62 : 0.28,
    backgroundIntensity: input.active ? 1 : 0.35,
    fallbackMode,
    shouldLoadModel: fallbackMode === "none"
  };
}
```

- [ ] Update `packages/coscroll-scene/src/index.ts` after the files exist:

```ts
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

- [ ] Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

Expected: pass with no implicit `any`.

### Task 3: Convert and budget Heart Sutra anchors

**Files:**

- Create `apps/site/public/assets/coscroll/anchors/*.glb`
- Create `apps/site/public/assets/coscroll/posters/coscroll-poster.webp`
- Create `packages/coscroll-scene/src/assetManifest.ts`

- [ ] Convert every Heart Sutra anchor OBJ listed in section 4 to GLB using the commands in section 4.

- [ ] Inspect and record the final file size:

```bash
du -h apps/site/public/assets/coscroll/anchors/*.glb
for model in apps/site/public/assets/coscroll/anchors/*.glb; do
  pnpm dlx @gltf-transform/cli inspect "$model"
done
```

Expected: every anchor GLB is at or below 350KB. `yuan.glb` may reuse the compressed `空` model source but remains a separate manifest entry because `heart-sutra.json` has a `圆` anchor cue.

- [ ] Generate a static poster from the standalone route after Task 7, or use a temporary hand-authored poster before then:

```bash
mkdir -p apps/site/public/assets/coscroll/posters
```

Expected: `apps/site/public/assets/coscroll/posters/coscroll-poster.webp` exists and is at or below 180KB before homepage integration.

- [ ] Add `assetManifest.ts` from section 5.

- [ ] Update `packages/coscroll-scene/src/index.ts` after `assetManifest.ts` exists:

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

- [ ] Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

### Task 4: Port text billboards without adding Troika

**Files:**

- Create `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`

- [ ] Adapt the CanvasTexture approach from CoScroll `LyricBillboard.tsx`.

Required behavior:

- Accept `text`, `position`, `opacity`, `fontSize`, `layer`, `emphasis`, `depthTest`, `depthWrite`, and `renderOrder`.
- Type `emphasis` as `CoScrollLyricSegment["emphasis"]`, i.e. `"quiet" | "normal" | "bright"`, so billboard rendering keeps the same lyric brightness semantics as the timeline contract.
- Use system font stack by default.
- Support vertical glyph layout.
- Dispose generated texture on unmount.
- Do not log font diagnostics in production or development render paths.
- Expose an `aria-hidden` equivalent only at the DOM owner level; the mesh itself remains decorative WebGL.

- [ ] Use these material defaults:

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

- [ ] Add this note to the file comment and enforce it during screenshot review:

```ts
// If system-font CanvasTexture cannot keep 6 of 8 lines readable at 1440x900
// and 390x844, do not load the original 5.8MB font. Switch the plan to
// Troika with a subset font or a DOM/SVG mobile text overlay.
```

- [ ] Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

### Task 5: Build GLB-only jade anchor

**Files:**

- Create `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`

- [ ] Implement a GLB-only loader with `useGLTF` from Drei. Do not import `OBJLoader`.

- [ ] Preserve CoScroll's dual material idea:

```ts
const inner = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#2d6d8b"),
  metalness: 1,
  roughness: 1,
  emissive: new THREE.Color("#0f2b38"),
  emissiveIntensity: 8,
  transmission: 0
});

const outer = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color("#ffffff"),
  metalness: 0,
  roughness: 0.82,
  transmission: 1,
  ior: 1.52,
  thickness: 0.18,
  transparent: false
});
```

- [ ] Scale and center the anchor inside a `<group>` instead of moving the shared camera. `CoScrollJadeAnchor` must never call `camera.position.set`.

- [ ] Let `useGLTF` loader errors bubble to the package-local asset error boundary created in Task 6. Do not try to catch loader failures inside `CoScrollJadeAnchor`.

- [ ] Drive rotation in `useFrame` using refs, not React state:

```ts
rotationRef.current += (baseSpeed + scrollVelocity * 1.2) * delta;
group.current.rotation.y = rotationRef.current;
```

- [ ] Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

### Task 6: Build `CoScrollSceneContent`

**Files:**

- Create `packages/coscroll-scene/src/CoScrollMineralField.tsx`
- Create `packages/coscroll-scene/src/CoScrollSceneContent.tsx`

- [ ] Implement `CoScrollMineralField` as procedural geometry or a large unlit plane. Do not load HDR or bitmap background assets in the first pass.

- [ ] In `CoScrollSceneContent`, call `createCoScrollVisualState` once per render and update moving values inside R3F frames through refs where necessary.

- [ ] Return `null` before rendering model or text when `state.shouldLoadModel === false`:

```tsx
if (!state.shouldLoadModel) {
  return null;
}
```

- [ ] Own CoScroll camera/background/fog while mounted:

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

The scene JSX must include:

```tsx
<color attach="background" args={["#030509"]} />
<fog attach="fog" args={["#030509", 8, 26]} />
```

- [ ] Place layers in one depth relationship:

```text
front text:  z = +0.42 to +0.55, depthTest true
jade anchor: z = 0
back text:   z = -0.34 to -0.5, depthTest true
```

- [ ] Map timeline text into a small visible window:

```ts
const visibleLines = state.lyrics.slice(0, quality.tier === "low" ? 4 : 8);
```

- [ ] Resolve the active model from `state.currentAnchor` before rendering `CoScrollJadeAnchor`:

```tsx
const currentAnchorAsset = assets.anchors.find((asset) => asset.id === state.currentAnchor);

if (!currentAnchorAsset) {
  onFallback?.("asset-failed");
  return null;
}
```

Pass `currentAnchorAsset.modelSrc` into `CoScrollJadeAnchor`. Do not hardcode the `心` asset or any single anchor model in `CoScrollSceneContent`; the rendered anchor must follow the active source cue from `heart-sutra.json`. Runtime may mount only the current anchor or the current anchor plus one adjacent prewarm anchor. It must never map over `assets.anchors` to mount or preload every Heart Sutra GLB.

- [ ] Call `onReady` after the anchor GLB and first text texture are mounted.

- [ ] Call `onFallback("quality-tier")` when `quality.tier === "fallback"` and render `null`.

- [ ] Wrap `CoScrollJadeAnchor` in a package-local React error boundary inside `CoScrollSceneContent`. The boundary catches thrown loader errors from `useGLTF`, calls `onFallback("asset-failed")`, renders `null`, and does not try to render package-owned fallback DOM.

- [ ] Update `packages/coscroll-scene/src/index.ts` after `CoScrollSceneContent.tsx` exists:

```ts
export { CoScrollSceneContent } from "./CoScrollSceneContent";
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

- [ ] Run:

```bash
pnpm --filter @miralith/coscroll-scene typecheck
```

### Task 7: Add standalone spike route

**Files:**

- Create `packages/coscroll-scene/src/CoScrollStandaloneDemo.tsx`
- Create `apps/site/app/coscroll-spike/page.tsx`

- [ ] Implement `CoScrollStandaloneDemo` as the only component in the package that creates a Canvas.

- [ ] Use fixed props for the route:

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

- [ ] Add Playwright coverage in `tests/e2e/coscroll.spec.ts`:

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

- [ ] Capture the current source reference outside the required CI suite before judging the spike:

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

Expected: `test-results/coscroll-reference-current.png` exists and shows the current CoScroll visual baseline used for side-by-side approval.

- [ ] Add screenshot capture for the experience gate:

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

- [ ] Review `test-results/coscroll-reference-current.png` side by side with the spike screenshots before Task 8. Required decision:

```text
APPROVE lightweight scene package
or FALL BACK to static GLB + DOM text
or FALL BACK to poster-only vignette
```

Do not start homepage integration without this decision.

- [ ] Update `packages/coscroll-scene/src/index.ts` after `CoScrollStandaloneDemo.tsx` exists:

```ts
export { CoScrollSceneContent } from "./CoScrollSceneContent";
export { CoScrollStandaloneDemo } from "./CoScrollStandaloneDemo";
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

- [ ] Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e -- --project=desktop tests/e2e/coscroll.spec.ts
```

Expected: route builds, renders, and returns nonblank pixels.

### Task 8: Add site scene slot and shared Canvas arbitration

**Files:**

- Create `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- Create `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- Modify `apps/site/visual/VisualCanvasFallback.tsx`

- [ ] Implement `CoScrollSceneSlot` with the same adapter shape as `LuBirthSceneSlot`:

```tsx
"use client";

import { useState } from "react";
import {
  CoScrollSceneContent,
  DEFAULT_COSCROLL_TIMELINE,
  resolveCoScrollAssets
} from "@miralith/coscroll-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type { LandingQuality } from "@miralith/visual-core";

interface CoScrollSceneSlotProps {
  progress: number;
  active: boolean;
  quality?: LandingQuality;
  scrollVelocity?: number;
  paused?: boolean;
}

export function CoScrollSceneSlot({
  progress,
  active,
  quality = "auto",
  scrollVelocity = 0,
  paused = false
}: CoScrollSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityProfile = useQualityTier(quality, reducedMotion);
  const [assetFailed, setAssetFailed] = useState(false);

  if (!active || assetFailed || qualityProfile.tier === "fallback") {
    return null;
  }

  return (
    <CoScrollSceneContent
      progress={progress}
      active={active}
      quality={qualityProfile}
      reducedMotion={reducedMotion}
      timeline={DEFAULT_COSCROLL_TIMELINE}
      assets={resolveCoScrollAssets()}
      scrollVelocity={scrollVelocity}
      paused={paused}
      onFallback={(reason) => {
        if (reason === "asset-failed") {
          setAssetFailed(true);
        }
      }}
    />
  );
}
```

- [ ] Implement `HomeVisualSceneSlot` as the only child mounted inside production `VisualCanvas`:

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

This lazy import is required. A static import of `CoScrollSceneSlot` from `MiraLithHome.tsx` or `HomeVisualSceneSlot.tsx` can grow the first-screen JS chunk and fail the budget intent.

- [ ] Change `VisualCanvasFallbackProps["scene"]` from `"lubirth"` to `"lubirth" | "coscroll"`.

- [ ] Add an e2e test that a page containing both LuBirth and CoScroll still reports one `canvas` and one `.visual-canvas`.

- [ ] Add an e2e check that no URL containing `coscroll-scene` or `/assets/coscroll/` is requested on the first viewport.

- [ ] Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: existing LuBirth tests still pass.

### Task 9: Integrate as a homepage section after LuBirth

**Files:**

- Create `apps/site/app/coscroll/page.tsx`
- Modify `apps/site/components/MiraLithHome.tsx`
- Modify `apps/site/app/globals.css`

- [ ] Create `apps/site/app/coscroll/page.tsx` as the stable public entry for the first-pass CoScroll Heart Sutra chapter. It may reuse `CoScrollStandaloneDemo` after Task 7 approval, but it must include DOM title/summary/fallback copy outside Canvas. Do not point the public homepage CTA at `/coscroll-spike`.

- [ ] Add a third section after the two LuBirth scroll stages. The DOM content must contain the project title, one-line description, narrative role copy, primary CTA, secondary source link, and full Heart Sutra lyric list even when WebGL is unavailable:

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

- [ ] Add scoped CoScroll typography styles in `apps/site/app/globals.css`:

```css
.coscroll-section {
  --coscroll-serif: "Iowan Old Style", "Songti SC", "STSong", "Noto Serif CJK SC", ui-serif, Georgia, serif;
  --coscroll-sans: "Avenir Next", "SF Pro Text", "PingFang SC", ui-sans-serif, system-ui, sans-serif;
  font-family: var(--coscroll-serif);
}

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

Expected: the section reads as a ritual/sutra chapter, not as a generic Inter portfolio block.

- [ ] Derive `coscrollProgress` with the same GSAP ScrollTrigger style as the current LuBirth opening progress. Do not introduce Lenis or another scroll library in this task.

- [ ] Derive `activeVisualScene` in site state:

```ts
const activeVisualScene = coscrollActive ? "coscroll" : "lubirth";
```

`coscrollActive` must become true only when the CoScroll section is near the viewport, not merely because the component exists.

- [ ] Replace the direct `<LuBirthSceneSlot />` child inside `VisualCanvas` with `<HomeVisualSceneSlot />`:

```tsx
<HomeVisualSceneSlot
  activeScene={activeVisualScene}
  lubirthMode="field"
  coscrollProgress={coscrollProgress}
  coscrollActive={coscrollActive}
  debugMianyang={debugMianyang}
/>
```

Do not mount `LuBirthSceneSlot` and `CoScrollSceneSlot` side by side in the same Canvas.

- [ ] Ensure LuBirth remains first in narrative order and CoScroll does not appear before the LuBirth window has completed.

- [ ] Confirm the owner approved the Task 7 experience gate. If approval is absent, stop here and leave CoScroll accessible only at `/coscroll-spike`.

- [ ] Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: first-screen transfer budget remains under 3MB because CoScroll assets are not requested before the CoScroll section nears visibility.

### Task 10: Add fallback and budget checks

**Files:**

- Modify `tests/e2e/coscroll.spec.ts`
- Modify `tests/e2e/miralith.spec.ts` if shared assertions are clearer there

- [ ] Add forced fallback test:

```ts
test("coscroll fallback keeps DOM content available", async ({ page }) => {
  await page.goto("/?visual=fallback");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText("CoScroll")).toBeVisible();
  await expect(page.getByText("CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.")).toBeVisible();
});
```

- [ ] Add first-screen budget guard remains unchanged:

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

- [ ] Add DOM accessibility check:

```ts
test("coscroll DOM copy and link remain accessible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(page.getByRole("heading", { name: "CoScroll" })).toBeVisible();
  await expect(page.getByText("source-matched Heart Sutra timeline")).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter CoScroll Heart Sutra" })).toHaveAttribute(
    "href",
    "/coscroll"
  );
  await expect(page.getByRole("link", { name: "View source" })).toHaveAttribute(
    "href",
    "https://github.com/astroleno/CoScroll"
  );
  await expect(page.locator('[aria-label="CoScroll Heart Sutra lyrics"]')).toContainText("观自在菩萨");
  await expect(page.locator('[aria-label="CoScroll Heart Sutra lyrics"]')).toContainText("菩提娑婆诃");
});
```

- [ ] Add public route check:

```ts
test("coscroll public route renders the primary CTA target", async ({ page }) => {
  await page.goto("/coscroll?visualTest=pixels");
  await expect(page.getByRole("heading", { name: "CoScroll" })).toBeVisible();
  await expect(
    page.getByText("CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.")
  ).toBeVisible();
});
```

- [ ] Add reduced-motion fallback check:

```ts
test("coscroll reduced motion keeps DOM experience without forced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(page.getByText("CoScroll turns scripture, scroll velocity, and jade typography into a small ritual interface.")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] Add section-load budget guard after scrolling near CoScroll:

```ts
test("coscroll section loads within chapter budget", async ({ page }) => {
  const sizes: Promise<number>[] = [];
  const anchorGlbPaths = new Set<string>();

  page.on("response", (response) => {
    const url = response.url();
    if (!url.includes("/assets/coscroll/")) return;

    const pathname = new URL(url).pathname;
    if (pathname.startsWith("/assets/coscroll/anchors/") && pathname.endsWith(".glb")) {
      anchorGlbPaths.add(pathname);
    }

    sizes.push(response.body().then((body) => body.byteLength).catch(() => 0));
  });

  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForLoadState("networkidle");

  const total = (await Promise.all(sizes)).reduce((sum, value) => sum + value, 0);
  expect(anchorGlbPaths.size).toBeLessThanOrEqual(2);
  expect(total).toBeLessThanOrEqual(880_000);
});
```

- [ ] Add a shared Canvas pixel guard after scrolling near CoScroll:

```ts
test("coscroll shared canvas path renders nonblank pixels", async ({ page }) => {
  await page.goto("/?visualTest=pixels");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
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

- [ ] Run:

```bash
pnpm test:e2e
```

Expected: LuBirth first screen stays below 3MB, and the CoScroll section-load path requests no more than two anchor GLBs plus poster budget, <= 880KB.

### Task 11: Sync docs

**Files:**

- Modify `docs/coscroll-scene-interface.md`
- Modify `docs/coscroll-integration-brief.md`
- Modify `docs/tech-stack.md` only if implementation changes the agreed package boundary

- [ ] Update `docs/coscroll-scene-interface.md` so its interfaces exactly match `packages/coscroll-scene/src/types.ts`.

- [ ] Update `docs/coscroll-integration-brief.md` section 9 to mark `docs/coscroll-migration-plan.md` as written and point execution to this file.

- [ ] Add a short implementation snapshot to this file after M5 completes:

```markdown
## Implementation Snapshot

Status: CoScroll v1.1 first-pass scene implemented.
Runtime path: `apps/site` owned `VisualCanvas` -> `HomeVisualSceneSlot` -> `CoScrollSceneSlot` -> `CoScrollSceneContent`.
Timeline: 364-second CoScroll Heart Sutra data, exact `public/lyrics/心经.lrc` line text/timestamps, and 16 source anchor cues from `heart-sutra.json`.
Assets: compressed Heart Sutra anchor GLBs, one poster fallback, no audio, no full font, no OBJ runtime loading.
Verification: `pnpm typecheck`, `pnpm build`, and `pnpm test:e2e` pass.
```

- [ ] Run:

```bash
rg -n "progress/active/quality/reducedMotion.*final|CoScrollScene.*not.*contract" docs/coscroll-*.md docs/tech-stack.md docs/interfaces.md
pnpm typecheck
```

Expected: no stale CoScroll contract language remains, and typecheck passes.

## 12. Acceptance Criteria

Functional:

- CoScroll renders as a MiraLith homepage chapter after LuBirth.
- Homepage production path has exactly one Canvas.
- CoScroll scene content runs inside the existing Canvas and never creates its own Canvas.
- The first visual pass follows the CoScroll Heart Sutra timeline: exact LRC text/timestamps, current source anchor cue, front text in front of the anchor, and back text partially hidden by the anchor depth relationship.
- DOM copy remains visible and meaningful when visual fallback is forced.
- Canvas scripture text is decorative and has an equivalent DOM list containing all 53 non-empty source LRC lines.
- DOM copy states CoScroll's MiraLith role as a source-matched Heart Sutra visual chapter, not only as source code or a generic WebGL scene.
- The CoScroll section includes a primary `Enter CoScroll Heart Sutra` CTA to `/coscroll` and a secondary `View source` link to `https://github.com/astroleno/CoScroll`.
- Owner approves the desktop/mobile screenshots side by side with `test-results/coscroll-reference-current.png` before homepage integration.
- The Visual Direction Gate passes: mineral black field, dark jade anchor, restrained dark gold accent, sutra-scroll whitespace, no purple/blue neon, no glowing orb or bokeh decoration, and no card-wrapped 3D scene.
- The typography guard passes: `.coscroll-section` scopes its own serif/CJK typography, title and narrative copy do not inherit a generic Inter portfolio tone, body copy uses `letter-spacing: 0`, and no external font files are added.
- Mobile fallback still communicates CoScroll as a digital sutra/prayer-wheel chapter even if true WebGL front/back occlusion is reduced or replaced by static GLB plus DOM text.

Performance:

- LuBirth first-screen transfer budget remains <= 3MB.
- CoScroll assets and CoScroll JS chunks are not requested before the first screen completes.
- CoScroll first-screen asset budget is 0KB before the section nears visibility; CoScroll section-load requested asset budget is <= 880KB, with each anchor GLB <= 350KB and poster <= 180KB.
- Mobile low tier avoids HDR, heavy postprocessing, full font downloads, and full model library loading.

Architecture:

- No `tone`, `framer-motion`, `troika-three-text`, `@tanstack/react-query`, or CoScroll project config store is added for the first pass.
- No runtime OBJ loading in MiraLith.
- No direct imports from the CoScroll repo.
- LuBirth and CoScroll are not mounted side by side in the production Canvas; `HomeVisualSceneSlot` arbitrates the active scene.
- `CoScrollSceneSlot` gates scene mount on `active`, quality tier, and prior asset failure.
- `docs/coscroll-scene-interface.md` and `packages/coscroll-scene/src/types.ts` match after implementation.

Verification:

- `pnpm typecheck` passes.
- `pnpm build` passes.
- `pnpm test:e2e` passes.
- Pixel checks prove the standalone spike and shared Canvas path are nonblank.
- Forced fallback path proves CoScroll DOM content remains readable without WebGL.
- Accessibility checks prove heading, link, and full Heart Sutra lyric text are available outside Canvas.

## 13. Commit Split

Use these commits:

1. `feat: scaffold coscroll scene package`
2. `feat: add coscroll visual state contract`
3. `feat: add compressed coscroll heart sutra anchors`
4. `feat: render coscroll standalone spike`
5. `feat: arbitrate home visual scenes`
6. `test: verify coscroll fallback and budgets`
7. `docs: sync coscroll migration contract`

## 14. Stop Conditions

Stop and revise the plan if any of these happen:

- Any Heart Sutra anchor GLB cannot be compressed below 350KB while preserving a recognizable silhouette.
- Shared Canvas e2e shows more than one `canvas` on the homepage.
- CoScroll assets load during the first LuBirth viewport.
- CoScroll JS chunk loads during the first LuBirth viewport.
- LuBirth camera/background/fog continues to control the Canvas after `activeVisualScene === "coscroll"`.
- Mobile low tier cannot hold a stable frame with true text/anchor depth.
- The current CoScroll source reference cannot be captured before approval, or the spike cannot be judged side by side against it.
- Owner does not approve the standalone screenshots as recognizably CoScroll.
- The approved scene still reads as purple/blue neon, glowing-orb decoration, card-wrapped 3D, or generic dark WebGL after the Visual Direction Gate pass.
- The CoScroll DOM section still reads as a generic Inter portfolio section after the typography guard is applied.
- The implementation requires adding the full CoScroll audio system, full font file, or full model library to preserve the visual idea.
