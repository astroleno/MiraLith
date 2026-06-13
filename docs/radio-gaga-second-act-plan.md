# RadioGAGA Second Act Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build radioGAGA as MiraLith's second act: first as an isolated `/radio-gaga` route for visual iteration, then integrate it after LuBirth with transition hooks for the eventual CoScroll handoff.

**Architecture:** The route branch uses the existing Next.js site-owned `VisualCanvas` pattern and a new lightweight scene package. The homepage integration keeps one fixed WebGL canvas, lazy-loads radioGAGA only when the second act is near, and treats the route branch as a staging surface rather than a separate production architecture.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, three, @react-three/fiber, @react-three/drei, GSAP ScrollTrigger, existing `@miralith/visual-core` quality and fallback helpers.

---

## 1. Product Direction

radioGAGA must not read as a hardware teardown or ESP32 demo. It should read as:

```text
My voice returns home through an old radio.
我的声音通过一个旧物回到父母身边。
```

The chapter owns one emotional idea:

```text
I put my voice, local news, and family memory into a 1970s radio,
so technology becomes a medium that can stay close to my parents.
```

The final chapter structure is:

```text
0-15    old object appears
15-35   voice enters
35-55   family memory surfaces
55-80   care core reveal
80-100  returns to warm household object
```

The isolated route must prove this sequence before any homepage integration work begins.

### Visual Design Guardrails

The route should feel warm and domestic, but not monochrome sepia. Use material roles instead of washing the whole scene in amber:

```text
Bakelite red: radio body and dominant object identity
aged brass: dial edges, tiny hardware warmth, restrained highlights
paper cream: DOM copy, memory fragments, soft household light
muted circuit green: ESP32/circuit traces, low saturation only
off-black: background, table-dark negative space, non-pure black
```

Do not let `warm amber/red` become a single-note orange page. Orange light is an accent, not the palette.

Typography must not fall back to the global `Inter`-led site stack for this chapter. Use a route-local font stack so radioGAGA feels like an object/case vignette rather than a generic web section:

```text
display/case title: "Avenir Next", "SF Pro Display", "PingFang SC", system-ui, sans-serif
body/captions: "Avenir Next", "SF Pro Text", "PingFang SC", system-ui, sans-serif
technical micro labels only: ui-monospace, SFMono-Regular, Menlo, monospace
```

Do not add a new webfont dependency in the route branch. The point is to bypass inherited Inter and give the chapter a softer domestic voice with system fonts already available on macOS/iOS.

Floating words must not become a decorative word cloud:

```text
maximum 4 visible floating word groups at once
fixed slots around the speaker/right side, not random scattering
opacity is tied to voiceLinesOpacity or memoryLayerOpacity
words move like radio transmission or family-note fragments
no generic tag-wall layout
```

The 55-80% care-core reveal is the signature frame. It should be the only 120% moment:

```text
old shell becomes translucent
ESP32 core glows softly, never dominates
voice lines pass through the speaker area
core callout arrives at the same time
memory fragments quiet down so the reveal reads in one screenshot
```

All other states should stay restrained so this moment carries the chapter's screenshot value.

Mobile landscape fallback rule:

```text
If 844x390 or similar landscape viewports feel crowded, reduce floating words first.
Do not shrink primary copy below the planned breakpoint sizes.
Do not move the radio into an unreadable corner to preserve decorative text.
```

## 2. Existing Constraints

Current relevant files:

- `apps/site/visual/VisualCanvas.tsx` owns the production fixed canvas.
- `apps/site/visual/VisualCanvasFallback.tsx` currently supports LuBirth fallback only.
- `apps/site/components/MiraLithHome.tsx` currently drives LuBirth opening progress with GSAP ScrollTrigger and `window.__MiraLithOpeningProgress`.
- `packages/visual-core/src/quality/quality.ts` provides quality tier and reduced-motion hooks.
- `public/model/radio_gaga.glb` is available and is about 1.2MB.
- `public/model/xiaozhi_esp32.glb` is available and is about 500KB.

Asset limitation:

```text
Both GLB files are single-node / single-mesh / single-material models.
```

Implementation consequence:

```text
Do not attempt true shell disassembly.
Render two instances of radio_gaga.glb:
RadioSolid with normal material
RadioGhost with transparent warm material
Then fade Solid out, Ghost in, and ESP32 in.
```

## 3. Route Strategy

Build this first:

```text
/radio-gaga
```

The branch route exists for:

- visual tuning without disturbing the v1.0 LuBirth homepage;
- screenshot and mobile composition checks;
- verifying the model scale, ghost reveal, voice lines, and DOM copy timing;
- testing fallback, reduced motion, and asset loading in isolation.

The branch route must not:

- import the original Radio Gaga app runtime;
- load ListenHub, n8n, Cloudflare Worker, MCP bridge, Jotai, TanStack Query, or API clients;
- become a second production canvas architecture;
- fetch live news or play live audio.

The final homepage will reuse the same scene package and content objects from the branch route.

## 4. Voice Without Audio

The route branch does not ship audio playback. The "my voice returns home" premise must be expressed through non-audio signals:

```text
speaker-area breathing lines
warm speaker glow
floating "my voice / local news / family memory" text
copy that explicitly says the news returns home in my voice
memory fragments that move like quiet radio transmission
```

Validation question for the branch review:

```text
If the page is muted forever, can a visitor still understand that this is a voice-mediated object for family care?
```

Do not add placeholder audio controls or fake playback UI in the first route branch.

## 5. Accessibility Contract

The route and final homepage chapter must remain understandable without WebGL, motion, pointer input, or audio.

Implementation rules:

```text
VisualCanvas remains decorative for radioGAGA.
The R3F scene is aria-hidden through the existing VisualCanvas decorative path.
RadioGagaCopyLayer renders visible animated copy with aria-hidden="true".
The route also renders one sr-only narrative block in normal DOM reading order.
The sr-only block includes the title, subtitle, voice premise, memory premise, care-core explanation, and final line.
No focusable controls are added unless there is a real action.
Reduced motion keeps the five state changes but disables drift, shimmer, and breathing animation.
```

Minimum screen reader narrative:

```text
02 — Care. radioGAGA. A radio of local news, family memory, and my own voice.
I filter local news through my own perspective, then let it return home in my voice.
It translates the news into a daily language my parents can hold.
Inside, a small core of care. ESP32 is only the path that lets a voice arrive.
A small machine for staying close.
```

## 6. Loading and Failure Contract

The branch route must be useful while GLB assets are pending or if they fail.

```text
Pending GLB state: keep DOM copy visible; canvas may be empty inside Suspense.
Model load failure: VisualCanvasErrorBoundary renders VisualCanvasFallback with scene="radio-gaga".
onReady not called within 4 seconds: do not block copy; the page still reads as a DOM case vignette.
Forced fallback: /radio-gaga?visual=fallback renders the same readable fallback.
```

Playwright must include an asset-failure test that aborts `radio_gaga.glb` and expects the fallback path plus DOM copy to remain visible.

## 7. File Structure

Create these files:

```text
packages/radio-gaga-scene/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts
    radioGagaTimeline.ts
    RadioGagaSceneContent.tsx
    RadioGagaModel.tsx
    RadioGagaVoiceLines.tsx
    RadioGagaCore.tsx

apps/site/content/
  radioGaga.ts

apps/site/visual/scenes/
  RadioGagaSceneSlot.tsx

apps/site/components/
  RadioGagaRoute.tsx
  RadioGagaCopyLayer.tsx

apps/site/app/radio-gaga/
  page.tsx

tests/e2e/
  radio-gaga.spec.ts
```

Modify these files:

```text
apps/site/package.json
apps/site/next.config.ts
apps/site/visual/VisualCanvasFallback.tsx
apps/site/app/globals.css
```

Route branch review and budget documentation modifies these files during Task 7:

```text
docs/tech-stack.md
docs/prd.md
```

Final homepage integration modifies these files after the branch route passes review:

```text
apps/site/components/MiraLithHome.tsx
apps/site/visual/scenes/LuBirthSceneSlot.tsx
tests/e2e/miralith.spec.ts
apps/site/app/globals.css
```

## 8. Scene Contract

`packages/radio-gaga-scene` owns only visual scene content. It must not create a `<Canvas>`.

```ts
import type { QualityProfile } from "@miralith/visual-core";

export type RadioGagaQualityProfile = QualityProfile;

export interface RadioGagaSceneProps {
  progress: number;
  active: boolean;
  quality: RadioGagaQualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  onReady?: () => void;
}

export interface RadioGagaFrame {
  progress: number;
  radioOpacity: number;
  radioGhostOpacity: number;
  radioScale: number;
  radioRotationY: number;
  esp32Opacity: number;
  coreLightIntensity: number;
  signatureMomentProgress: number;
  speakerGlow: number;
  voiceLinesOpacity: number;
  memoryLayerOpacity: number;
  titleOpacity: number;
  bodyOpacity: number;
  calloutOpacity: number;
  finalLineOpacity: number;
  cameraZ: number;
  backgroundWarmth: number;
}
```

Use a pure mapper:

```ts
export function mapRadioGagaProgress(progressInput: number): RadioGagaFrame;
```

The DOM copy layer and R3F scene both read the same mapped frame so copy and visuals stay synchronized.

## 9. Timeline Mapping

Use this exact mapping for the first branch route:

```ts
import type { RadioGagaFrame } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const range = (value: number, start: number, end: number) =>
  clamp01((value - start) / Math.max(end - start, 0.0001));

const smooth = (value: number) => value * value * (3 - 2 * value);

const lerp = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export function mapRadioGagaProgress(progressInput: number): RadioGagaFrame {
  const progress = clamp01(progressInput);
  const appear = smooth(range(progress, 0, 0.15));
  const voice = smooth(range(progress, 0.15, 0.35));
  const memory = smooth(range(progress, 0.35, 0.55));
  const core = smooth(range(progress, 0.55, 0.8));
  const settle = smooth(range(progress, 0.8, 1));

  return {
    progress,
    radioOpacity: core > 0 ? lerp(1, 0, core) : appear,
    radioGhostOpacity: core > 0 ? lerp(0.42, 0.65, settle) : lerp(0, 0.42, core),
    radioScale: lerp(0.94, 1, appear),
    radioRotationY: lerp(-0.18, -0.24, voice),
    esp32Opacity: lerp(0, 1, core) * lerp(1, 0.65, settle),
    coreLightIntensity: lerp(0, 1, core) * lerp(1, 0.45, settle),
    signatureMomentProgress: core,
    speakerGlow: lerp(0, 0.45, voice) + lerp(0, 0.2, memory) - lerp(0, 0.4, settle),
    voiceLinesOpacity: lerp(0, 0.65, voice) * lerp(1, 0.38, settle),
    memoryLayerOpacity: lerp(0, 0.7, memory) * lerp(1, 0.82, settle),
    titleOpacity: appear * lerp(1, 0.24, range(progress, 0.22, 0.36)),
    bodyOpacity: lerp(0, 1, voice) * lerp(1, 0.35, core),
    calloutOpacity: lerp(0, 1, core) * lerp(1, 0, settle),
    finalLineOpacity: settle,
    cameraZ: progress < 0.8
      ? lerp(5.2, 4.3, smooth(range(progress, 0, 0.8)))
      : lerp(4.3, 4.8, settle),
    backgroundWarmth: lerp(0.38, 0.9, memory) * lerp(1, 0.78, settle)
  };
}
```

Reduced motion behavior:

```text
Use the same scroll progress and opacity states.
Disable slow floating drift, line shimmer, and breathing scale.
Keep the 5 key states readable.
```

## 10. Copy Contract

Create `apps/site/content/radioGaga.ts`:

```ts
export const radioGagaCopy = {
  eyebrow: "02 — Care",
  title: "radioGAGA",
  subtitleEn: "A radio of local news, family memory, and my own voice",
  subtitleZh: "一台装着本地新闻、父母记忆与我自己声音的收音机",
  introEn: [
    "Technology is not displayed as power here.",
    "It becomes a warmer way to speak with my parents."
  ],
  introZh: [
    "技术在这里不是能力的炫耀，",
    "而是一种更温柔地与父母说话的方法。"
  ],
  voiceEn: [
    "I filter local news through my own perspective,",
    "then let it return home in my voice."
  ],
  voiceZh: [
    "我以自己的视角筛选本地新闻，",
    "再让它以我的声音回到家中。"
  ],
  memoryEn: [
    "It does not simply read the news.",
    "It translates the news into a daily language my parents can hold."
  ],
  memoryZh: [
    "它不是把新闻读出来，",
    "而是把新闻翻译成父母能够接住的日常。"
  ],
  coreTitleEn: "Inside, a small core of care",
  coreTitleZh: "内里，是一颗照护的核心",
  coreBodyEn: [
    "ESP32 is not the protagonist.",
    "It is only the path that lets a voice arrive."
  ],
  coreBodyZh: [
    "ESP32 不是主角。",
    "它只是让声音抵达家人的方法。"
  ],
  finalEn: "A small machine for staying close.",
  finalZh: "一台让距离变近的小机器。"
} as const;

export const radioGagaFloatingWords = [
  { en: "local news", zh: "本地新闻" },
  { en: "family memory", zh: "父母记忆" },
  { en: "my voice", zh: "我的声音" },
  { en: "for my parents", zh: "给家人的讯息" }
] as const;

export const radioGagaMemoryFragments = [
  "weather at dinner",
  "community news",
  "market voices",
  "home routines",
  "晚饭时的天气",
  "社区新闻",
  "菜市场的声音",
  "家里的日常"
] as const;
```

## 11. Tasks

### Task 1: Add radioGAGA Scene Package Scaffold

**Files:**

- Create: `packages/radio-gaga-scene/package.json`
- Create: `packages/radio-gaga-scene/tsconfig.json`
- Create: `packages/radio-gaga-scene/src/index.ts`
- Create: `packages/radio-gaga-scene/src/types.ts`
- Modify: `apps/site/package.json`
- Modify: `apps/site/next.config.ts`

- [ ] **Step 1: Create the package manifest**

Use this package file:

```json
{
  "name": "@miralith/radio-gaga-scene",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@miralith/visual-core": "workspace:*"
  },
  "peerDependencies": {
    "@react-three/drei": "10.7.7",
    "@react-three/fiber": "9.6.0",
    "react": "19.2.5",
    "three": "0.184.0"
  },
  "devDependencies": {
    "@types/react": "latest",
    "@types/three": "0.184.0",
    "typescript": "6.0.3"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

- [ ] **Step 2: Create package TypeScript config**

Use this config:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Export only the compile-safe public types**

Create `src/types.ts` with the interfaces from section 8.

Create `src/index.ts`:

```ts
export type {
  RadioGagaFrame,
  RadioGagaQualityProfile,
  RadioGagaSceneProps
} from "./types";
```

Do not export `mapRadioGagaProgress` or `RadioGagaSceneContent` in Task 1. Those files do not exist until Task 2 and Task 4, and exporting them here would make the first typecheck fail.

- [ ] **Step 4: Add site dependency**

In `apps/site/package.json`, add:

```json
"@miralith/radio-gaga-scene": "workspace:*"
```

- [ ] **Step 5: Transpile the package in Next**

In `apps/site/next.config.ts`, include:

```ts
transpilePackages: [
  "@miralith/lubirth-hero",
  "@miralith/visual-core",
  "@miralith/radio-gaga-scene"
]
```

- [ ] **Step 6: Verify package scaffold**

Run:

```bash
pnpm --filter @miralith/radio-gaga-scene typecheck
pnpm --filter @miralith/site typecheck
```

Expected:

```text
Both commands exit 0.
```

- [ ] **Step 7: Commit**

```bash
git add packages/radio-gaga-scene apps/site/package.json apps/site/next.config.ts pnpm-lock.yaml
git commit -m "feat: scaffold radio gaga scene package"
```

### Task 2: Implement Timeline Mapper

**Files:**

- Create: `packages/radio-gaga-scene/src/radioGagaTimeline.ts`
- Modify: `packages/radio-gaga-scene/src/index.ts`
- Modify: `packages/radio-gaga-scene/src/types.ts`

- [ ] **Step 1: Add `RadioGagaFrame` type**

Use the full type from section 8.

- [ ] **Step 2: Add `mapRadioGagaProgress`**

Use the exact code from section 9.

- [ ] **Step 3: Export the timeline mapper**

Update `src/index.ts`:

```ts
export type {
  RadioGagaFrame,
  RadioGagaQualityProfile,
  RadioGagaSceneProps
} from "./types";
export { mapRadioGagaProgress } from "./radioGagaTimeline";
```

- [ ] **Step 4: Add quick runtime assertions**

Create a temporary local check command:

```bash
pnpm --filter @miralith/radio-gaga-scene typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 5: Commit**

```bash
git add packages/radio-gaga-scene/src
git commit -m "feat: map radio gaga scroll timeline"
```

### Task 3: Add radioGAGA Content Objects

**Files:**

- Create: `apps/site/content/radioGaga.ts`

- [ ] **Step 1: Create content file**

Use the full content object from section 10.

- [ ] **Step 2: Verify content type**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected:

```text
No TypeScript errors.
```

- [ ] **Step 3: Commit**

```bash
git add apps/site/content/radioGaga.ts
git commit -m "feat: add radio gaga chapter copy"
```

### Task 4: Build R3F Scene Content

**Files:**

- Create: `packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaModel.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaVoiceLines.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaCore.tsx`
- Modify: `packages/radio-gaga-scene/src/index.ts`

- [ ] **Step 1: Build model component**

`RadioGagaModel` must load both models and render meshes only:

```text
RadioSolid: normal model instance
RadioGhost: cloned model instance with transparent warm material
ESP32: model instance positioned inside the radio
```

`RadioGagaModel` must not render `pointLight`, circuit traces, or the emissive core. Those belong to `RadioGagaCore`, which is composed by `RadioGagaSceneContent`.

Use these initial transforms:

```ts
const RADIO_POSITION: [number, number, number] = [0, -0.2, 0];
const RADIO_ROTATION: [number, number, number] = [0, -0.22, 0];
const RADIO_SCALE = 3.4;

const ESP32_POSITION: [number, number, number] = [0, -0.08, 0.04];
const ESP32_ROTATION: [number, number, number] = [0, -0.18, 0];
const ESP32_SCALE = 0.92;
```

The ghost material should use:

```ts
new MeshPhysicalMaterial({
  color: "#d9b06a",
  transparent: true,
  opacity: frame.radioGhostOpacity,
  roughness: 0.42,
  metalness: 0,
  transmission: 0.2,
  depthWrite: false
});
```

Use this material role palette in the scene implementation:

```ts
const RADIO_BODY_RED = "#8f1f1d";
const AGED_BRASS = "#b08a4a";
const PAPER_CREAM = "#f1e4c8";
const MUTED_CIRCUIT_GREEN = "#9caf88";
const OFF_BLACK = "#050302";
```

The radio model texture may already carry its body color. Do not recolor the normal `RadioSolid` instance unless the imported texture is unusable. Use the palette for added materials, lights, traces, line colors, fog, fallback CSS, and ghost shell tuning.

- [ ] **Step 2: Build voice lines**

`RadioGagaVoiceLines` renders 5-7 soft lines around the speaker area. Use `lineBasicMaterial` or drei `Line`; do not add a shader dependency.

Initial line positions:

```ts
const lines = [
  { y: -0.18, width: 0.78, phase: 0 },
  { y: -0.08, width: 0.92, phase: 0.7 },
  { y: 0.02, width: 1.06, phase: 1.3 },
  { y: 0.12, width: 0.84, phase: 1.9 },
  { y: 0.22, width: 0.66, phase: 2.6 }
];
```

Style:

```text
color #f1e4c8
opacity frame.voiceLinesOpacity
depthWrite false
small sinusoidal y displacement in useFrame unless reducedMotion is true
```

- [ ] **Step 3: Build core light**

`RadioGagaCore` renders:

```text
pointLight color #d9b06a intensity frame.coreLightIntensity * 1.35
small emissive sphere color #d9b06a opacity frame.esp32Opacity
2-3 thin circuit traces color #9caf88 opacity frame.esp32Opacity * 0.55
```

`RadioGagaCore` must share the same outer radio transform as `RadioGagaModel` and place its inner group at the ESP32 transform. Do not render the core as an independent world-space object; otherwise the care core can drift away from the ESP32 as the radio scales and rotates.

During `frame.signatureMomentProgress > 0.2`, the core can breathe through scale/opacity if reduced motion is false. Keep the motion small: scale range `0.96 -> 1.04`, no pulsing bloom blast, no cyber-blue/green glow.

- [ ] **Step 4: Build scene content**

`RadioGagaSceneContent` must:

```text
set warm black background / fog only when active
place camera by frame.cameraZ
render warm ambient and key lights
render RadioGagaModel
render RadioGagaCore
render RadioGagaVoiceLines
call onReady once after first render
```

The scene must make `frame.signatureMomentProgress` visually legible between 55-80% by combining radio ghost opacity, muted circuit green traces, speaker voice lines, and the core callout. This is the only frame range allowed to feel heightened.

Do not create a Canvas in this package.

- [ ] **Step 5: Export scene content**

Update `src/index.ts`:

```ts
export type {
  RadioGagaFrame,
  RadioGagaQualityProfile,
  RadioGagaSceneProps
} from "./types";
export { mapRadioGagaProgress } from "./radioGagaTimeline";
export { RadioGagaSceneContent } from "./RadioGagaSceneContent";
```

- [ ] **Step 6: Verify typecheck**

Run:

```bash
pnpm --filter @miralith/radio-gaga-scene typecheck
pnpm --filter @miralith/site typecheck
```

Expected:

```text
Both commands exit 0.
```

- [ ] **Step 7: Commit**

```bash
git add packages/radio-gaga-scene/src
git commit -m "feat: render radio gaga scene content"
```

### Task 5: Add Site Route Branch

**Files:**

- Create: `apps/site/app/radio-gaga/page.tsx`
- Create: `apps/site/components/RadioGagaRoute.tsx`
- Create: `apps/site/components/RadioGagaCopyLayer.tsx`
- Create: `apps/site/visual/scenes/RadioGagaSceneSlot.tsx`
- Modify: `apps/site/visual/VisualCanvasFallback.tsx`
- Modify: `apps/site/app/globals.css`

- [ ] **Step 1: Extend visual fallback scene names**

Change fallback props from:

```ts
scene: "lubirth";
```

to:

```ts
scene: "lubirth" | "radio-gaga";
```

Fallback content for radioGAGA must render:

```text
02 — Care
radioGAGA
A small machine for staying close.
一台让距离变近的小机器。
```

- [ ] **Step 2: Create `RadioGagaSceneSlot`**

Use existing quality hooks:

```tsx
"use client";

import { RadioGagaSceneContent } from "@miralith/radio-gaga-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";

interface RadioGagaSceneSlotProps {
  progress: number;
  active: boolean;
}

export function RadioGagaSceneSlot({ progress, active }: RadioGagaSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const quality = useQualityTier("auto", reducedMotion);

  if (quality.tier === "fallback") {
    return null;
  }

  return (
    <RadioGagaSceneContent
      progress={progress}
      active={active}
      quality={quality}
      reducedMotion={reducedMotion}
    />
  );
}
```

- [ ] **Step 3: Create route page**

`apps/site/app/radio-gaga/page.tsx`:

```tsx
import { RadioGagaRoute } from "../../components/RadioGagaRoute";

export default function RadioGagaPage() {
  return <RadioGagaRoute />;
}
```

- [ ] **Step 4: Create route scroll shell**

`RadioGagaRoute` must:

```text
create one VisualCanvas
set local progress from GSAP ScrollTrigger
render RadioGagaSceneSlot inside canvas
render RadioGagaCopyLayer above canvas
use 420vh height for the isolated route
support ?visual=fallback through existing VisualCanvas behavior
track sceneReady for diagnostics, but never hide DOM copy while waiting
```

Use ScrollTrigger:

```ts
ScrollTrigger.create({
  id: "miralith-radio-gaga-route",
  trigger: routeRef.current,
  start: "top top",
  end: () => `+=${Math.round(window.innerHeight * 3.4)}`,
  scrub: true,
  invalidateOnRefresh: true,
  onRefresh: (self) => setProgress(self.progress),
  onUpdate: (self) => setProgress(self.progress)
});
```

Follow the existing `MiraLithHome` cleanup pattern:

```text
guard async GSAP imports with a disposed flag
kill any existing ScrollTrigger with the same id before creating a new one
store the created ScrollTrigger instance
call scrollTrigger.kill() from the effect cleanup
```

- [ ] **Step 5: Create DOM copy layer**

`RadioGagaCopyLayer` must receive `progress` and use `mapRadioGagaProgress(progress)` to set:

```text
.radio-gaga-copy__title opacity = frame.titleOpacity
.radio-gaga-copy__voice opacity = frame.bodyOpacity during 15-35%
.radio-gaga-copy__memory opacity = frame.memoryLayerOpacity during 35-55%
.radio-gaga-copy__core opacity = frame.calloutOpacity
.radio-gaga-copy__final opacity = frame.finalLineOpacity
.radio-gaga-copy__floating opacity = frame.voiceLinesOpacity
.radio-gaga-copy__fragments opacity = frame.memoryLayerOpacity
```

Keep text in DOM, not WebGL text.

Use this spatial contract:

```text
desktop title/voice/memory panel: left side, max-width 520px, top 14vh
desktop core callout: right side, max-width 360px, top 18vh
desktop final line: bottom left, max-width 520px, bottom 12vh
floating words: fixed slots near speaker/right side, never over the title panel
memory fragments: low-contrast background layer, pointer-events none, aria-hidden true
mobile portrait: title/voice/memory panel top, final line bottom, hide decorative floating words after 6 items
mobile landscape: text panel max-width 42vw, final line hidden until 80%, no element may cover the radio center
z-index: copy layer 2, canvas 1, fallback 1
```

Floating word rules:

```text
render at most 4 visible word groups at once
use deterministic slots; do not randomize every render
bind their opacity to frame.voiceLinesOpacity or frame.memoryLayerOpacity
animate only transform and opacity
phrasing must come from radioGagaFloatingWords or radioGagaMemoryFragments
do not create a tag wall, scattered keyword cloud, or full-screen label field
```

Suggested desktop slots:

```ts
const floatingWordSlots = [
  { x: "58vw", y: "28vh", delay: 0 },
  { x: "66vw", y: "40vh", delay: 0.12 },
  { x: "60vw", y: "56vh", delay: 0.24 },
  { x: "72vw", y: "62vh", delay: 0.36 }
];
```

Visible animated copy groups should be `aria-hidden="true"` because the route provides one complete `.sr-only` narrative block for assistive technology.

- [ ] **Step 6: Add CSS**

Add route-scoped styles:

```css
.radio-gaga-route {
  position: relative;
  min-height: 420vh;
  background: #050302;
  color: #f7efe3;
  font-family: "Avenir Next", "SF Pro Text", "PingFang SC", system-ui, sans-serif;
}

.radio-gaga-copy {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.radio-gaga-copy__panel {
  position: absolute;
  left: min(8vw, 104px);
  top: clamp(72px, 14vh, 140px);
  width: min(520px, 84vw);
}

.radio-gaga-copy__core {
  position: absolute;
  right: min(7vw, 96px);
  top: clamp(96px, 18vh, 180px);
  width: min(360px, 34vw);
}

.radio-gaga-copy__final {
  position: absolute;
  left: min(8vw, 104px);
  bottom: clamp(56px, 12vh, 120px);
  width: min(520px, 84vw);
}

.radio-gaga-copy__floating,
.radio-gaga-copy__fragments {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.radio-gaga-copy__eyebrow {
  margin: 0 0 14px;
  color: #d9b775;
  font-size: 12px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.radio-gaga-copy h1 {
  margin: 0;
  font-family: "Avenir Next", "SF Pro Display", "PingFang SC", system-ui, sans-serif;
  font-size: 42px;
  line-height: 0.96;
  font-weight: 600;
  letter-spacing: 0;
}

.radio-gaga-copy p {
  color: rgba(247, 239, 227, 0.76);
  font-size: 15px;
  line-height: 1.75;
}

@media (min-width: 768px) {
  .radio-gaga-copy h1 {
    font-size: 64px;
  }

  .radio-gaga-copy p {
    font-size: 17px;
  }
}

@media (min-width: 1200px) {
  .radio-gaga-copy h1 {
    font-size: 90px;
  }

  .radio-gaga-copy p {
    font-size: 18px;
  }
}

@media (max-width: 820px) {
  .radio-gaga-copy__panel,
  .radio-gaga-copy__final {
    left: 24px;
    width: calc(100vw - 48px);
  }

  .radio-gaga-copy__core {
    left: 24px;
    right: auto;
    top: auto;
    bottom: 22vh;
    width: calc(100vw - 48px);
  }
}

@media (max-height: 520px) and (orientation: landscape) {
  .radio-gaga-copy__panel {
    left: 28px;
    top: 42px;
    width: 42vw;
  }

  .radio-gaga-copy__core {
    right: 28px;
    top: 42px;
    width: 34vw;
  }

  .radio-gaga-copy__final {
    left: 28px;
    bottom: 28px;
    width: 42vw;
  }

  .radio-gaga-copy__floating [data-floating-index="2"],
  .radio-gaga-copy__floating [data-floating-index="3"],
  .radio-gaga-copy__fragments [data-fragment-index="4"],
  .radio-gaga-copy__fragments [data-fragment-index="5"],
  .radio-gaga-copy__fragments [data-fragment-index="6"],
  .radio-gaga-copy__fragments [data-fragment-index="7"] {
    display: none;
  }
}
```

- [ ] **Step 7: Verify route manually**

Run:

```bash
pnpm dev
```

Open:

```text
http://127.0.0.1:3000/radio-gaga
```

If port `3000` is busy, use the port printed by `apps/site/scripts/dev.mjs`. The script searches `3000-3099`; `3100` is reserved by the Playwright web server config and should not be used for manual `pnpm dev` checks.

Expected:

```text
One canvas appears.
The red radio appears first.
Voice lines appear near the speaker.
Memory fragments fade in.
The ghost shell and ESP32 appear between 55-80%.
The final line appears near the end.
```

- [ ] **Step 8: Commit**

```bash
git add apps/site/app/radio-gaga apps/site/components/RadioGagaRoute.tsx apps/site/components/RadioGagaCopyLayer.tsx apps/site/visual/scenes/RadioGagaSceneSlot.tsx apps/site/visual/VisualCanvasFallback.tsx apps/site/app/globals.css
git commit -m "feat: add radio gaga route branch"
```

### Task 6: Add Route Tests

**Files:**

- Create: `tests/e2e/radio-gaga.spec.ts`

- [ ] **Step 1: Add route smoke test**

Test:

```ts
import { expect, test } from "@playwright/test";

test("renders radioGAGA route in one production canvas", async ({ page }) => {
  await page.goto("/radio-gaga");

  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.getByText("一台装着本地新闻、父母记忆与我自己声音的收音机")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
});
```

- [ ] **Step 2: Add fallback test**

Test:

```ts
test("radioGAGA fallback keeps chapter readable", async ({ page }) => {
  await page.goto("/radio-gaga?visual=fallback");

  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="radio-gaga"]')).toBeVisible();
  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.getByText("一台让距离变近的小机器。")).toBeVisible();
});
```

- [ ] **Step 3: Add nonblank canvas test**

Test:

```ts
test("radioGAGA canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/radio-gaga?visualTest=pixels");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 0.65, behavior: "instant" }));
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
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) {
        return true;
      }
    }
    return false;
  });

  expect(await nonblank.jsonValue()).toBe(true);
});
```

- [ ] **Step 4: Add model failure fallback test**

Test:

```ts
test("radioGAGA falls back when the radio model fails to load", async ({ page }) => {
  await page.route("**/model/radio_gaga.glb", (route) => route.abort());
  await page.goto("/radio-gaga");

  await expect(page.locator('[data-visual-fallback="radio-gaga"]')).toBeVisible();
  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.getByText("一台让距离变近的小机器。")).toBeVisible();
});
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @miralith/site typecheck
pnpm test:e2e -- tests/e2e/radio-gaga.spec.ts
```

Expected:

```text
Typecheck exits 0.
All radio-gaga e2e tests pass.
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/radio-gaga.spec.ts
git commit -m "test: verify radio gaga route"
```

### Task 7: Visual Review and Asset Budget Gate

**Files:**

- Modify: `docs/tech-stack.md`
- Modify: `docs/prd.md`

- [ ] **Step 1: Capture route screenshots**

Run the route in desktop and mobile sizes:

```bash
pnpm dev
```

Review these viewports:

```text
1440x900 desktop
390x844 mobile portrait
844x390 mobile landscape
```

Required observations:

```text
Radio is front-biased, not rear-facing.
The scene is warm amber/red, not cyber blue.
The palette reads as Bakelite red + aged brass + paper cream + muted circuit green + off-black, not a sepia wash.
The chapter typography does not visually inherit the global Inter-led site voice.
ESP32 appears as a care core, not the protagonist.
DOM text does not overlap the radio on mobile.
Floating words read as radio/family fragments, not a decorative word cloud.
Mobile landscape reduces floating words/fragments before compressing primary copy.
The 55-80% ghost-shell care-core reveal is the strongest screenshot moment.
Final frame returns attention to the radio, not the ESP32.
```

- [ ] **Step 2: Record asset budget in docs**

Add a RadioGAGA note to `docs/tech-stack.md`:

```text
RadioGAGA route branch loads radio_gaga.glb and xiaozhi_esp32.glb only on /radio-gaga or when the second act is near the viewport. These assets must not enter the LuBirth first-screen transfer budget.
```

Add a RadioGAGA note to `docs/prd.md`:

```text
RadioGAGA is the second act and will first ship as an isolated /radio-gaga route branch. Homepage integration happens after the branch passes visual, fallback, reduced-motion, and route e2e checks.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

Expected:

```text
All commands exit 0.
```

- [ ] **Step 4: Commit**

```bash
git add docs/tech-stack.md docs/prd.md
git commit -m "docs: record radio gaga route branch"
```

### Integration Gate: Decide Whether radioGAGA Enters the Homepage

Stop after Task 7. Do not start Task 8 until the route branch passes this product gate.

Required review questions:

```text
1. Target visitor understanding:
   Can a first-time visitor summarize radioGAGA as "a voice/care object for parents" rather than "an ESP32 hardware demo"?

2. Homepage rhythm:
   Does radioGAGA make the LuBirth -> family/care movement clearer, or does it slow the homepage before the visitor understands MiraLith?

3. Second-act ownership:
   Does radioGAGA deserve the homepage second act, or should it remain an independent route linked from a smaller project window?

4. No-audio premise:
   Without actual audio playback, do the speaker lines, glow, copy, and memory fragments still communicate "my voice returns home"?

5. Asset budget:
   Can the homepage keep LuBirth first-screen transfer budget clean before the user approaches the second act?
```

Decision outcomes:

```text
Proceed to Task 8:
  Route branch passes the five questions, screenshots, fallback, reduced-motion, and e2e checks.

Keep as independent route:
  Route branch works as a case vignette, but homepage rhythm or visitor understanding is weaker with it inline.

Revise route branch:
  The second-act idea is still right, but the route reads as hardware demo, unclear voice object, or overly slow.
```

### Task 8: Integrate radioGAGA Into Homepage Second Act

**Files:**

- Modify: `apps/site/components/MiraLithHome.tsx`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `apps/site/app/globals.css`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Extend homepage scroll structure**

Change homepage structure to:

```text
LuBirth opening section
LuBirth project window section
LuBirth -> RadioGAGA transition section
RadioGAGA second act section
RadioGAGA -> next act transition section
```

The radioGAGA section should occupy:

```text
min-height: 420vh
```

- [ ] **Step 2: Keep one fixed production canvas**

Homepage VisualCanvas should conceptually contain LuBirth plus a lazy radioGAGA scene. Do not write a static `<RadioGagaSceneSlot />` import in `MiraLithHome.tsx`.

```tsx
<LuBirthSceneSlot
  mode="field"
  debugMianyang={debugMianyang}
  paused={radioGagaActive}
/>
```

In the homepage, `RadioGagaSceneSlot` must be lazy-loaded and mounted only when:

```text
radioGaga section is near viewport
or transition progress from LuBirth to radioGAGA is active
```

Use `React.lazy` so the homepage root bundle does not statically import the radio scene package:

```tsx
import { lazy, Suspense } from "react";

const LazyRadioGagaSceneSlot = lazy(() =>
  import("../visual/scenes/RadioGagaSceneSlot").then((module) => ({
    default: module.RadioGagaSceneSlot
  }))
);
```

Render only behind a near-viewport boolean:

```tsx
{radioGagaShouldLoad ? (
  <Suspense fallback={null}>
    <LazyRadioGagaSceneSlot
      progress={radioGagaProgress}
      active={radioGagaActive || lubirthToRadioProgress > 0}
    />
  </Suspense>
) : null}
```

`radioGagaShouldLoad` becomes true when the transition section is within 1 viewport below the current scroll position, and stays true after that. Mount gating alone is not enough; static imports from `MiraLithHome.tsx` are forbidden for radioGAGA homepage integration.

- [ ] **Step 3: Add LuBirth -> radioGAGA transition progress**

Use ScrollTrigger to produce:

```text
lubirthToRadioProgress: 0..1
radioGagaProgress: 0..1
```

Transition visual contract:

```text
Moon orbit line energy fades down.
Warm dust/voice-line particles fade up.
RadioGAGA starts at progress 0 with opacity driven by transition and then section progress.
```

Every homepage ScrollTrigger created for this integration must follow the existing `MiraLithHome` cleanup pattern: guard async imports with a disposed flag, kill duplicate ids before creation, and kill all created triggers on unmount.

- [ ] **Step 4: Add homepage copy layer**

Render `RadioGagaCopyLayer` in the homepage during the second act. It should use the same `progress` prop used by the route branch, and it must be lazy-loaded behind the same `radioGagaShouldLoad` gate as the scene slot.

Do not statically import `RadioGagaCopyLayer` in `MiraLithHome.tsx`; it imports the radioGAGA timeline/content path and would otherwise weaken the first-screen bundle boundary.

```tsx
const LazyRadioGagaCopyLayer = lazy(() =>
  import("./RadioGagaCopyLayer").then((module) => ({
    default: module.RadioGagaCopyLayer
  }))
);

{radioGagaShouldLoad ? (
  <Suspense fallback={null}>
    <LazyRadioGagaCopyLayer progress={radioGagaProgress} />
  </Suspense>
) : null}
```

- [ ] **Step 5: Update homepage e2e**

Add checks:

```ts
test("homepage includes radioGAGA as second act without creating a second canvas", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2.8, behavior: "instant" }));

  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] **Step 6: Add first-screen asset gate**

Add this Playwright check to `tests/e2e/miralith.spec.ts`:

```ts
test("homepage does not load radioGAGA models before second act", async ({ page }) => {
  const requestedUrls: string[] = [];

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("radio_gaga.glb") || url.includes("xiaozhi_esp32.glb")) {
      requestedUrls.push(url);
    }
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  expect(requestedUrls).toEqual([]);
});
```

After `pnpm build`, also inspect the homepage app chunk:

```bash
find apps/site/.next/static/chunks/app -path '*/page*.js' -print -exec rg "radio_gaga\\.glb|xiaozhi_esp32\\.glb|RadioGagaSceneContent|RadioGagaCopyLayer|radioGagaCopy" {} +
```

Expected before the second-act lazy chunk is requested:

```text
The command may print page chunk paths, but it prints no matching lines.
```

If Next changes chunk naming, rely on the Playwright request gate as the source of truth, then inspect `.next/server/app/page.js` and any `.next/static/chunks/app/**/page*.js` files for the same strings. The verification fails if the root homepage payload includes model URLs or radioGAGA scene/copy module strings before second-act lazy loading.

- [ ] **Step 7: Run verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected:

```text
All commands exit 0.
The original LuBirth tests still pass.
The new radioGAGA homepage test passes.
```

- [ ] **Step 8: Commit**

```bash
git add apps/site/components/MiraLithHome.tsx apps/site/visual/scenes/LuBirthSceneSlot.tsx tests/e2e/miralith.spec.ts apps/site/app/globals.css
git commit -m "feat: integrate radio gaga second act"
```

### Task 9: Draft radioGAGA -> CoScroll Transition Hypothesis

**Files:**

- Create: `docs/radio-gaga-to-coscroll-transition-hypothesis.md`

- [ ] **Step 1: Create non-binding transition hypothesis**

Write this hypothesis:

```text
RadioGAGA outro may give a future CoScroll chapter three optional signals:

1. waveToTextProgress
   Sound waves slow down and become text rails.

2. knobToAxisProgress
   Radio knob / center hardware gesture becomes the future prayer-wheel axis.

3. warmthToMineralProgress
   Amber household light cools into dark gold / mineral black.
```

The document must state:

```text
This is not a CoScroll interface requirement.
Do not modify `docs/coscroll-scene-interface.md` until CoScroll implementation planning resumes.
These signals are visual hypotheses only; they must be revalidated against CoScroll's own scene contract later.
```

- [ ] **Step 2: Commit**

```bash
git add docs/radio-gaga-to-coscroll-transition-hypothesis.md
git commit -m "docs: sketch radio gaga coscroll handoff"
```

## 12. Acceptance Criteria

The route branch is complete when:

- `/radio-gaga` renders one canvas.
- `/radio-gaga?visual=fallback` renders no canvas and keeps the chapter readable.
- The five emotional states are visible while scrolling.
- The radio remains the main subject at the end.
- ESP32 appears as a warm core, not a product demo centerpiece.
- The palette avoids a full-page sepia wash and keeps distinct material roles.
- The chapter uses a route-local Avenir/SF/PingFang stack and does not read as inherited Inter.
- Floating words stay in deterministic radio-transmission slots and never become a word cloud.
- Mobile landscape removes lower-priority floating words/fragments before shrinking the main copy.
- The 55-80% ghost-shell care-core reveal is the chapter's signature screenshot.
- Desktop, mobile portrait, and mobile landscape have no incoherent text overlap.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and route e2e tests pass.

The homepage integration is complete when:

- radioGAGA appears after LuBirth as the second act.
- The homepage still has one fixed production canvas.
- radioGAGA assets do not load during the LuBirth first-screen budget check.
- LuBirth -> radioGAGA transition is visible and uses warm voice/dust language.
- radioGAGA outro does not lock CoScroll implementation details; any CoScroll handoff remains a non-binding hypothesis.
- Full e2e suite passes.

## 13. Risks and Decisions

| Risk | Decision |
| --- | --- |
| Radio model is single mesh | Use solid and ghost duplicate instances; do not attempt real shell split. |
| ESP32 becomes too dominant | Cap final opacity at 0.65 and reduce core light after 80%. |
| Route branch drifts from final homepage | Use the same package, content object, and copy layer in both route and homepage. |
| First-screen budget regresses | Do not import radioGAGA in root critical path until second act is near. |
| Text becomes unreadable on mobile | Keep copy in DOM and add mobile-specific layout rules. |
| Scene feels like a hardware demo | No exploded view, no 360 spin, no data wall, no cyber-blue palette. |
| Warm direction turns into sepia monotone | Use material roles: Bakelite red, aged brass, paper cream, muted circuit green, off-black. |
| Inherited typography feels generic | Override radioGAGA route typography with Avenir/SF/PingFang stack; do not inherit global Inter. |
| Floating words become AI-looking decoration | Use fixed slots, max 4 visible groups, and bind them to voice/memory timeline states. |
| Mobile landscape becomes crowded | Hide lower-priority floating words/fragments first; preserve main copy sizes and radio readability. |
| No single memorable frame | Treat 55-80% care-core reveal as the only heightened signature moment. |

## 14. Non-Goals

This plan does not add:

- live news ingestion;
- audio playback;
- original Radio Gaga frontend routes;
- API integrations;
- Cloudflare Worker, n8n, ListenHub, or MCP runtime;
- a separate homepage Canvas;
- a full CoScroll implementation.

## 15. Execution Order

Recommended order:

```text
Task 1: package scaffold
Task 2: timeline mapper
Task 3: content object
Task 4: R3F scene
Task 5: isolated route
Task 6: route tests
Task 7: visual review and budget docs
Task 8: homepage second act integration
Task 9: CoScroll handoff hypothesis
```

Stop after Task 7 for the integration gate. Start Task 8 only if the isolated route proves tone, composition, visitor understanding, homepage rhythm, no-audio clarity, and first-screen asset isolation.
