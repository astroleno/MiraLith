# RadioGAGA Route Branch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the radioGAGA second act as an isolated `/radio-gaga` route branch with one production-owned canvas, readable DOM copy, model fallback, route e2e tests, and a hard stop before homepage integration.

**Architecture:** `apps/site` owns routing, DOM copy, scroll progress, fallback, and tests. `packages/radio-gaga-scene` owns R3F scene content only and never creates a canvas. The route branch validates the visual language before any homepage second-act lazy loading is implemented.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, three, @react-three/fiber, @react-three/drei, GSAP ScrollTrigger, existing `@miralith/visual-core` quality helpers, Playwright.

---

## Source Documents

Use these as the governing specs:

- `docs/radio-gaga-second-act-plan.md`
- `docs/tech-stack.md`
- `docs/source-project-audit.md`
- `apps/site/visual/VisualCanvas.tsx`
- `apps/site/components/MiraLithHome.tsx`

This implementation plan covers route branch work through visual review. Homepage integration is intentionally left behind a product gate.

## File Map

Create:

```text
packages/radio-gaga-scene/package.json
packages/radio-gaga-scene/tsconfig.json
packages/radio-gaga-scene/src/index.ts
packages/radio-gaga-scene/src/types.ts
packages/radio-gaga-scene/src/radioGagaTimeline.ts
packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx
packages/radio-gaga-scene/src/RadioGagaModel.tsx
packages/radio-gaga-scene/src/RadioGagaVoiceLines.tsx
packages/radio-gaga-scene/src/RadioGagaCore.tsx
apps/site/content/radioGaga.ts
apps/site/visual/scenes/RadioGagaSceneSlot.tsx
apps/site/components/RadioGagaRoute.tsx
apps/site/components/RadioGagaCopyLayer.tsx
apps/site/app/radio-gaga/page.tsx
tests/e2e/radio-gaga.spec.ts
```

Modify:

```text
apps/site/package.json
apps/site/next.config.ts
apps/site/visual/VisualCanvasFallback.tsx
apps/site/app/globals.css
docs/tech-stack.md
docs/prd.md
```

Do not modify homepage integration files in this route branch:

```text
apps/site/components/MiraLithHome.tsx
apps/site/visual/scenes/LuBirthSceneSlot.tsx
tests/e2e/miralith.spec.ts
```

## Hard Constraints

- Do not import the original Radio Gaga runtime.
- Do not add live news, audio playback, API calls, Cloudflare Worker, n8n, ListenHub, MCP bridge, Jotai, or TanStack Query.
- Do not create a second canvas inside `packages/radio-gaga-scene`.
- Do not use a 360 rotation, exploded hardware view, data wall, cyber-blue glow, or tag-cloud copy.
- Do not use `Inter` for the radioGAGA route; add route-local Avenir/SF/PingFang font stack.
- Do not use viewport-scaled font sizes in radioGAGA CSS.
- Do not ship homepage integration before the route branch passes visual review.

## Task 1: Package Scaffold

**Files:**

- Create: `packages/radio-gaga-scene/package.json`
- Create: `packages/radio-gaga-scene/tsconfig.json`
- Create: `packages/radio-gaga-scene/src/types.ts`
- Create: `packages/radio-gaga-scene/src/index.ts`
- Modify: `apps/site/package.json`
- Modify: `apps/site/next.config.ts`

- [ ] **Step 1: Create package manifest**

Create `packages/radio-gaga-scene/package.json`:

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

Create `packages/radio-gaga-scene/tsconfig.json`:

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

- [ ] **Step 3: Create compile-safe types**

Create `packages/radio-gaga-scene/src/types.ts`:

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

- [ ] **Step 4: Export only existing files**

Create `packages/radio-gaga-scene/src/index.ts`:

```ts
export type {
  RadioGagaFrame,
  RadioGagaQualityProfile,
  RadioGagaSceneProps
} from "./types";
```

- [ ] **Step 5: Add site dependency**

In `apps/site/package.json`, add this dependency alphabetically with the existing workspace packages:

```json
"@miralith/radio-gaga-scene": "workspace:*"
```

- [ ] **Step 6: Add Next transpilation**

In `apps/site/next.config.ts`, make `transpilePackages` include:

```ts
transpilePackages: [
  "@miralith/lubirth-hero",
  "@miralith/visual-core",
  "@miralith/radio-gaga-scene"
]
```

- [ ] **Step 7: Verify scaffold**

Run:

```bash
pnpm --filter @miralith/radio-gaga-scene typecheck
pnpm --filter @miralith/site typecheck
```

Expected:

```text
Both commands exit 0.
```

- [ ] **Step 8: Commit**

```bash
git add packages/radio-gaga-scene apps/site/package.json apps/site/next.config.ts pnpm-lock.yaml
git commit -m "feat: scaffold radio gaga scene package"
```

## Task 2: Timeline Mapper

**Files:**

- Create: `packages/radio-gaga-scene/src/radioGagaTimeline.ts`
- Modify: `packages/radio-gaga-scene/src/index.ts`

- [ ] **Step 1: Add timeline mapper**

Create `packages/radio-gaga-scene/src/radioGagaTimeline.ts`:

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

- [ ] **Step 2: Export timeline mapper**

Update `packages/radio-gaga-scene/src/index.ts`:

```ts
export type {
  RadioGagaFrame,
  RadioGagaQualityProfile,
  RadioGagaSceneProps
} from "./types";
export { mapRadioGagaProgress } from "./radioGagaTimeline";
```

- [ ] **Step 3: Verify**

Run:

```bash
pnpm --filter @miralith/radio-gaga-scene typecheck
```

Expected:

```text
Command exits 0.
```

- [ ] **Step 4: Commit**

```bash
git add packages/radio-gaga-scene/src
git commit -m "feat: map radio gaga timeline"
```

## Task 3: Chapter Content

**Files:**

- Create: `apps/site/content/radioGaga.ts`

- [ ] **Step 1: Add typed copy**

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

- [ ] **Step 2: Verify**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected:

```text
Command exits 0.
```

- [ ] **Step 3: Commit**

```bash
git add apps/site/content/radioGaga.ts
git commit -m "feat: add radio gaga chapter copy"
```

## Task 4: Scene Components

**Files:**

- Create: `packages/radio-gaga-scene/src/RadioGagaModel.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaCore.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaVoiceLines.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx`
- Modify: `packages/radio-gaga-scene/src/index.ts`

- [ ] **Step 1: Implement model component**

Create `packages/radio-gaga-scene/src/RadioGagaModel.tsx` with these constants and responsibilities:

```tsx
"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Mesh, MeshPhysicalMaterial } from "three";
import type { RadioGagaFrame } from "./types";

const RADIO_POSITION: [number, number, number] = [0, -0.2, 0];
const RADIO_SCALE = 3.4;
const ESP32_POSITION: [number, number, number] = [0, -0.08, 0.04];
const ESP32_ROTATION: [number, number, number] = [0, -0.18, 0];
const ESP32_SCALE = 0.92;

interface RadioGagaModelProps {
  frame: RadioGagaFrame;
}

export function RadioGagaModel({ frame }: RadioGagaModelProps) {
  const radio = useGLTF("/model/radio_gaga.glb");
  const esp32 = useGLTF("/model/xiaozhi_esp32.glb");
  const ghostMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#d9b06a",
        transparent: true,
        opacity: 0,
        roughness: 0.42,
        metalness: 0,
        transmission: 0.2,
        depthWrite: false
      }),
    []
  );
  ghostMaterial.opacity = frame.radioGhostOpacity;

  const solidRadioScene = useMemo(() => {
    const clone = radio.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = Array.isArray(child.material)
          ? child.material.map((material) => material.clone())
          : child.material.clone();
      }
    });
    return clone;
  }, [radio.scene]);
  const ghostRadioScene = useMemo(() => {
    const clone = radio.scene.clone(true);
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = ghostMaterial;
      }
    });
    return clone;
  }, [ghostMaterial, radio.scene]);
  const esp32Scene = useMemo(() => esp32.scene.clone(true), [esp32.scene]);
  solidRadioScene.traverse((child) => {
    if (child instanceof Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.transparent = frame.radioOpacity < 0.999;
        material.opacity = frame.radioOpacity;
        material.depthWrite = frame.radioOpacity > 0.98;
      });
    }
  });

  return (
    <group
      position={RADIO_POSITION}
      scale={frame.radioScale * RADIO_SCALE}
      rotation={[0, frame.radioRotationY, 0]}
    >
      <group visible={frame.radioOpacity > 0.01}>
        <primitive object={solidRadioScene} />
      </group>
      <group visible={frame.radioGhostOpacity > 0.01}>
        <primitive object={ghostRadioScene} />
      </group>
      <group
        position={ESP32_POSITION}
        rotation={ESP32_ROTATION}
        scale={ESP32_SCALE}
        visible={frame.esp32Opacity > 0.01}
      >
        <primitive object={esp32Scene} />
      </group>
    </group>
  );
}
```

- [ ] **Step 2: Implement core component**

Create `packages/radio-gaga-scene/src/RadioGagaCore.tsx`:

```tsx
"use client";

import type { RadioGagaFrame } from "./types";

interface RadioGagaCoreProps {
  frame: RadioGagaFrame;
  reducedMotion?: boolean;
}

export function RadioGagaCore({ frame, reducedMotion = false }: RadioGagaCoreProps) {
  const scale = reducedMotion ? 1 : 0.96 + frame.signatureMomentProgress * 0.08;

  return (
    <group position={[0, -0.2, 0]} scale={frame.radioScale * 3.4} rotation={[0, frame.radioRotationY, 0]}>
      <group position={[0, -0.08, 0.04]} rotation={[0, -0.18, 0]} scale={0.92 * scale} visible={frame.esp32Opacity > 0.01}>
        <pointLight color="#d9b06a" intensity={frame.coreLightIntensity * 1.35} distance={3.2} />
        <mesh>
          <sphereGeometry args={[0.055, 24, 24]} />
          <meshBasicMaterial color="#d9b06a" transparent opacity={frame.esp32Opacity * 0.72} />
        </mesh>
        {[-0.12, 0, 0.12].map((offset) => (
          <mesh key={offset} position={[offset, -0.1, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.26, 0.006, 0.006]} />
            <meshBasicMaterial color="#9caf88" transparent opacity={frame.esp32Opacity * 0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
```

- [ ] **Step 3: Implement voice lines**

Create `packages/radio-gaga-scene/src/RadioGagaVoiceLines.tsx`:

```tsx
"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Group, Vector3 } from "three";
import type { RadioGagaFrame } from "./types";

const lines = [
  { y: -0.18, width: 0.78, phase: 0 },
  { y: -0.08, width: 0.92, phase: 0.7 },
  { y: 0.02, width: 1.06, phase: 1.3 },
  { y: 0.12, width: 0.84, phase: 1.9 },
  { y: 0.22, width: 0.66, phase: 2.6 }
];

interface RadioGagaVoiceLinesProps {
  frame: RadioGagaFrame;
  reducedMotion?: boolean;
}

export function RadioGagaVoiceLines({ frame, reducedMotion = false }: RadioGagaVoiceLinesProps) {
  const groupRef = useRef<Group>(null);
  const points = useMemo(
    () =>
      lines.map((line) => [
        new Vector3(-line.width / 2, line.y, 0),
        new Vector3(-line.width / 4, line.y + 0.025, 0),
        new Vector3(0, line.y - 0.02, 0),
        new Vector3(line.width / 4, line.y + 0.018, 0),
        new Vector3(line.width / 2, line.y, 0)
      ]),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) {
      return;
    }
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.012;
  });

  return (
    <group ref={groupRef} position={[0.18, -0.02, 0.72]} visible={frame.voiceLinesOpacity > 0.01}>
      {points.map((linePoints, index) => (
        <Line
          key={index}
          points={linePoints}
          color="#f1e4c8"
          transparent
          opacity={frame.voiceLinesOpacity * (1 - index * 0.08)}
          lineWidth={1}
          depthWrite={false}
        />
      ))}
    </group>
  );
}
```

- [ ] **Step 4: Implement scene content**

Create `packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx`:

```tsx
"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, DirectionalLight, Vector3 } from "three";
import { mapRadioGagaProgress } from "./radioGagaTimeline";
import { RadioGagaCore } from "./RadioGagaCore";
import { RadioGagaModel } from "./RadioGagaModel";
import { RadioGagaVoiceLines } from "./RadioGagaVoiceLines";
import type { RadioGagaSceneProps } from "./types";

const cameraTarget = new Vector3(0, -0.08, 0);

export function RadioGagaSceneContent({
  progress,
  active,
  reducedMotion,
  onReady
}: RadioGagaSceneProps) {
  const frame = mapRadioGagaProgress(progress);
  const readyRef = useRef(false);
  const keyLight = useRef<DirectionalLight>(null);
  const { camera, scene } = useThree();
  const backgroundColor = useMemo(() => new Color("#050302"), []);

  useEffect(() => {
    if (readyRef.current) {
      return;
    }
    readyRef.current = true;
    onReady?.();
  }, [onReady]);

  useFrame(() => {
    if (!active) {
      return;
    }
    scene.background = backgroundColor;
    scene.fog = null;
    camera.position.set(0, 0.25, frame.cameraZ);
    camera.lookAt(cameraTarget);
    if (keyLight.current) {
      keyLight.current.intensity = 0.45 + frame.backgroundWarmth * 0.65;
    }
  }, -1);

  if (!active) {
    return null;
  }

  return (
    <>
      <ambientLight color="#f1e4c8" intensity={0.38} />
      <directionalLight ref={keyLight} color="#d9b06a" position={[2.4, 2.2, 3.4]} intensity={0.8} />
      <RadioGagaModel frame={frame} />
      <RadioGagaCore frame={frame} reducedMotion={reducedMotion} />
      <RadioGagaVoiceLines frame={frame} reducedMotion={reducedMotion} />
    </>
  );
}
```

- [ ] **Step 5: Export scene content**

Update `packages/radio-gaga-scene/src/index.ts`:

```ts
export type {
  RadioGagaFrame,
  RadioGagaQualityProfile,
  RadioGagaSceneProps
} from "./types";
export { mapRadioGagaProgress } from "./radioGagaTimeline";
export { RadioGagaSceneContent } from "./RadioGagaSceneContent";
```

- [ ] **Step 6: Verify**

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
git commit -m "feat: render radio gaga scene"
```

## Task 5: Route Branch

**Files:**

- Create: `apps/site/app/radio-gaga/page.tsx`
- Create: `apps/site/visual/scenes/RadioGagaSceneSlot.tsx`
- Create: `apps/site/components/RadioGagaCopyLayer.tsx`
- Create: `apps/site/components/RadioGagaRoute.tsx`
- Modify: `apps/site/visual/VisualCanvasFallback.tsx`
- Modify: `apps/site/app/globals.css`

- [ ] **Step 1: Extend fallback scene union**

In `apps/site/visual/VisualCanvasFallback.tsx`, change:

```ts
scene: "lubirth";
```

to:

```ts
scene: "lubirth" | "radio-gaga";
```

Keep the rest of the component behavior unchanged.

- [ ] **Step 2: Add scene slot**

Create `apps/site/visual/scenes/RadioGagaSceneSlot.tsx`:

```tsx
"use client";

import { RadioGagaSceneContent } from "@miralith/radio-gaga-scene";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";

interface RadioGagaSceneSlotProps {
  progress: number;
  active: boolean;
  onReady?: () => void;
}

export function RadioGagaSceneSlot({ progress, active, onReady }: RadioGagaSceneSlotProps) {
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
      onReady={onReady}
    />
  );
}
```

- [ ] **Step 3: Add route page**

Create `apps/site/app/radio-gaga/page.tsx`:

```tsx
import { RadioGagaRoute } from "../../components/RadioGagaRoute";

export default function RadioGagaPage() {
  return <RadioGagaRoute />;
}
```

- [ ] **Step 4: Add copy layer**

Create `apps/site/components/RadioGagaCopyLayer.tsx`:

```tsx
"use client";

import { mapRadioGagaProgress } from "@miralith/radio-gaga-scene";
import {
  radioGagaCopy,
  radioGagaFloatingWords,
  radioGagaMemoryFragments
} from "../content/radioGaga";

interface RadioGagaCopyLayerProps {
  progress: number;
}

const floatingWordSlots = [
  { x: "58vw", y: "28vh", delay: 0 },
  { x: "66vw", y: "40vh", delay: 0.12 },
  { x: "60vw", y: "56vh", delay: 0.24 },
  { x: "72vw", y: "62vh", delay: 0.36 }
];

export function RadioGagaCopyLayer({ progress }: RadioGagaCopyLayerProps) {
  const frame = mapRadioGagaProgress(progress);

  return (
    <div className="radio-gaga-copy" aria-hidden="true">
      <div className="radio-gaga-copy__panel" style={{ opacity: Math.max(frame.titleOpacity, frame.bodyOpacity) }}>
        <p className="radio-gaga-copy__eyebrow">{radioGagaCopy.eyebrow}</p>
        <h1>{radioGagaCopy.title}</h1>
        <p>{radioGagaCopy.subtitleEn}</p>
        <p>{radioGagaCopy.subtitleZh}</p>
      </div>
      <div className="radio-gaga-copy__panel radio-gaga-copy__voice" style={{ opacity: frame.bodyOpacity }}>
        <p>{radioGagaCopy.voiceEn.join(" ")}</p>
        <p>{radioGagaCopy.voiceZh.join("")}</p>
      </div>
      <div className="radio-gaga-copy__core" style={{ opacity: frame.calloutOpacity }}>
        <p className="radio-gaga-copy__eyebrow">{radioGagaCopy.coreTitleEn}</p>
        <p>{radioGagaCopy.coreTitleZh}</p>
        <p>{radioGagaCopy.coreBodyEn.join(" ")}</p>
        <p>{radioGagaCopy.coreBodyZh.join("")}</p>
      </div>
      <div className="radio-gaga-copy__final" style={{ opacity: frame.finalLineOpacity }}>
        <p>{radioGagaCopy.finalEn}</p>
        <p>{radioGagaCopy.finalZh}</p>
      </div>
      <div className="radio-gaga-copy__floating" style={{ opacity: frame.voiceLinesOpacity }}>
        {radioGagaFloatingWords.map((word, index) => (
          <span
            key={word.en}
            data-floating-index={index}
            style={{
              left: floatingWordSlots[index].x,
              top: floatingWordSlots[index].y,
              transitionDelay: `${floatingWordSlots[index].delay}s`
            }}
          >
            {word.en} / {word.zh}
          </span>
        ))}
      </div>
      <div className="radio-gaga-copy__fragments" style={{ opacity: frame.memoryLayerOpacity }}>
        {radioGagaMemoryFragments.map((fragment, index) => (
          <span key={fragment} data-fragment-index={index}>
            {fragment}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add route shell with cleanup**

Create `apps/site/components/RadioGagaRoute.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { RadioGagaSceneSlot } from "../visual/scenes/RadioGagaSceneSlot";
import { RadioGagaCopyLayer } from "./RadioGagaCopyLayer";

export function RadioGagaRoute() {
  const routeRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger")
      ]);

      if (disposed || !routeRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.getById("miralith-radio-gaga-route")?.kill();

      const scrollTrigger = ScrollTrigger.create({
        id: "miralith-radio-gaga-route",
        trigger: routeRef.current,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 3.4)}`,
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: (self) => setProgress(self.progress),
        onUpdate: (self) => setProgress(self.progress)
      });

      cleanup = () => scrollTrigger.kill();
      ScrollTrigger.refresh();
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  return (
    <main ref={routeRef} className="radio-gaga-route" aria-label="radioGAGA care radio scene">
      <VisualCanvas
        decorative
        fallback={
          <VisualCanvasFallback scene="radio-gaga" label="radioGAGA care radio fallback">
            <div className="radio-gaga-fallback-copy">
              <p>02 — Care</p>
              <h1>radioGAGA</h1>
              <p>A small machine for staying close.</p>
              <p>一台让距离变近的小机器。</p>
            </div>
          </VisualCanvasFallback>
        }
      >
        <RadioGagaSceneSlot progress={progress} active />
      </VisualCanvas>
      <RadioGagaCopyLayer progress={progress} />
      <div className="sr-only">
        02 — Care. radioGAGA. A radio of local news, family memory, and my own voice.
        I filter local news through my own perspective, then let it return home in my voice.
        It translates the news into a daily language my parents can hold.
        Inside, a small core of care. ESP32 is only the path that lets a voice arrive.
        A small machine for staying close.
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Add CSS**

Add to `apps/site/app/globals.css`:

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

.radio-gaga-copy__voice {
  top: clamp(190px, 34vh, 320px);
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

.radio-gaga-copy__floating span,
.radio-gaga-copy__fragments span {
  position: absolute;
  color: rgba(241, 228, 200, 0.5);
  font-size: 12px;
  line-height: 1.3;
  transform: translate3d(0, 0, 0);
}

.radio-gaga-copy__fragments span:nth-child(1) { left: 54vw; top: 22vh; }
.radio-gaga-copy__fragments span:nth-child(2) { left: 72vw; top: 34vh; }
.radio-gaga-copy__fragments span:nth-child(3) { left: 58vw; top: 68vh; }
.radio-gaga-copy__fragments span:nth-child(4) { left: 76vw; top: 74vh; }
.radio-gaga-copy__fragments span:nth-child(5) { left: 48vw; top: 42vh; }
.radio-gaga-copy__fragments span:nth-child(6) { left: 68vw; top: 52vh; }
.radio-gaga-copy__fragments span:nth-child(7) { left: 52vw; top: 82vh; }
.radio-gaga-copy__fragments span:nth-child(8) { left: 80vw; top: 20vh; }

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

.radio-gaga-fallback-copy {
  position: fixed;
  left: min(8vw, 104px);
  bottom: clamp(56px, 12vh, 120px);
  z-index: 2;
  width: min(520px, 84vw);
  color: #f7efe3;
  font-family: "Avenir Next", "SF Pro Text", "PingFang SC", system-ui, sans-serif;
}

.radio-gaga-fallback-copy h1 {
  margin: 0;
  font-family: "Avenir Next", "SF Pro Display", "PingFang SC", system-ui, sans-serif;
  font-size: 42px;
  line-height: 0.96;
  font-weight: 600;
}

.radio-gaga-fallback-copy p {
  margin: 10px 0 0;
  color: rgba(247, 239, 227, 0.76);
  font-size: 15px;
  line-height: 1.7;
}

@media (min-width: 820px) {
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

- [ ] **Step 7: Manual route check**

Run:

```bash
pnpm dev
```

Open the printed local URL, normally:

```text
http://127.0.0.1:3000/radio-gaga
```

Expected:

```text
One canvas renders.
radioGAGA copy is visible.
The route does not visually inherit the global Inter-led typography.
Floating words are deterministic and sparse.
The 55-80% reveal is visibly the strongest frame range.
```

- [ ] **Step 8: Commit**

```bash
git add apps/site/app/radio-gaga apps/site/components/RadioGagaRoute.tsx apps/site/components/RadioGagaCopyLayer.tsx apps/site/visual/scenes/RadioGagaSceneSlot.tsx apps/site/visual/VisualCanvasFallback.tsx apps/site/app/globals.css
git commit -m "feat: add radio gaga route branch"
```

## Task 6: Route Tests

**Files:**

- Create: `tests/e2e/radio-gaga.spec.ts`

- [ ] **Step 1: Add e2e tests**

Create `tests/e2e/radio-gaga.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("renders radioGAGA route in one production canvas", async ({ page }) => {
  await page.goto("/radio-gaga");

  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.getByText("一台装着本地新闻、父母记忆与我自己声音的收音机")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
});

test("radioGAGA fallback keeps chapter readable", async ({ page }) => {
  await page.goto("/radio-gaga?visual=fallback");

  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="radio-gaga"]')).toBeVisible();
  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.getByText("一台让距离变近的小机器。")).toBeVisible();
});

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

test("radioGAGA falls back when the radio model fails to load", async ({ page }) => {
  await page.route("**/model/radio_gaga.glb", (route) => route.abort());
  await page.goto("/radio-gaga");

  await expect(page.locator('[data-visual-fallback="radio-gaga"]')).toBeVisible();
  await expect(page.getByText("radioGAGA")).toBeVisible();
  await expect(page.getByText("一台让距离变近的小机器。")).toBeVisible();
});
```

- [ ] **Step 2: Run tests**

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

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/radio-gaga.spec.ts
git commit -m "test: verify radio gaga route"
```

## Task 7: Route Review and Docs Gate

**Files:**

- Modify: `docs/tech-stack.md`
- Modify: `docs/prd.md`

- [ ] **Step 1: Run visual review**

Run:

```bash
pnpm dev
```

Review:

```text
1440x900 desktop
390x844 mobile portrait
844x390 mobile landscape
```

Pass criteria:

```text
Radio is front-biased.
Palette is Bakelite red + aged brass + paper cream + muted circuit green + off-black, not sepia wash.
Typography does not read as inherited Inter.
Floating words are sparse deterministic radio fragments.
Mobile landscape hides low-priority floating words before shrinking primary copy.
55-80% ghost shell / care core reveal is the signature screenshot.
Final frame returns attention to the radio.
```

- [ ] **Step 2: Add tech-stack note**

Add to `docs/tech-stack.md`:

```text
RadioGAGA route branch loads `radio_gaga.glb` and `xiaozhi_esp32.glb` only on `/radio-gaga`. Future homepage integration must lazy-load both the scene slot and copy layer near the second act; these assets must not enter the LuBirth first-screen transfer budget.
```

- [ ] **Step 3: Add PRD note**

Add to `docs/prd.md`:

```text
RadioGAGA is the planned second act, but first ships as an isolated `/radio-gaga` route branch. Homepage integration is gated by visual review, fallback/reduced-motion behavior, route e2e tests, and product validation that the chapter strengthens the LuBirth -> family/care transition.
```

- [ ] **Step 4: Run full route-branch verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e -- tests/e2e/radio-gaga.spec.ts
```

Expected:

```text
All commands exit 0.
```

- [ ] **Step 5: Commit**

```bash
git add docs/tech-stack.md docs/prd.md
git commit -m "docs: record radio gaga route branch"
```

## Stop Gate Before Homepage Integration

Do not start homepage integration until this gate passes:

```text
Target visitor can summarize radioGAGA as a voice/care object for parents.
Route branch does not read as an ESP32 hardware demo.
No-audio expression still communicates voice returning home.
Route fallback and model failure paths are readable.
Visual review confirms 55-80% is the signature moment.
Mobile landscape remains readable after reducing floating words.
```

If the gate fails, revise `/radio-gaga` route first. Do not start homepage code.
