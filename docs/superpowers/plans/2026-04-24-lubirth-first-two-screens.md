# LuBirth First Two Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build MiraLith v1.0's LuBirth opening and zoomable project window with one production site-owned WebGL canvas, lightweight scene components, fallback, accessibility, and verification.

**Architecture:** `apps/site` owns the fixed production canvas, DOM sections, fallback, and a11y. `packages/lubirth-hero` owns scene content only and exports `EarthMoonScene` plus focused `Landing*` components. `EarthMoonHero` remains a standalone demo/dev wrapper that may create its own canvas outside production homepage usage.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, pnpm workspace, three, @react-three/fiber, @react-three/drei, Theatre helpers in `@miralith/visual-core`, Playwright.

**Current visual blockers (2026-04-29):** Before treating this plan as visually complete, resolve the issues recorded in `docs/lubirth-earthmoon-visual-gap-review.md`: scroll jank, starfield moving with scroll / too-dark background, invisible rotating code-cloud shell, missing Karman-line atmosphere glow, and barely visible aurora.

---

## File Structure

Create:

- `apps/site/visual/VisualCanvas.tsx` — production fixed canvas owner, canvas a11y, context-loss fallback routing.
- `apps/site/visual/VisualCanvasFallback.tsx` — site-owned static poster/DOM fallback.
- `apps/site/visual/scenes/LuBirthSceneSlot.tsx` — site adapter from section mode and quality to `EarthMoonScene`.
- `apps/site/components/LuBirthExpandedView.tsx` — accessible expanded overlay and focus return.
- `packages/lubirth-hero/src/constants.ts` — fixed date and reusable scene constants.
- `packages/lubirth-hero/src/LandingEarth.tsx` — rotating earth mesh and material.
- `packages/lubirth-hero/src/LandingMoon.tsx` — same-canvas screen-anchored fixed-date moon.
- `packages/lubirth-hero/src/LandingAtmosphere.tsx` — atmosphere shell and Karman-line arc.
- `packages/lubirth-hero/src/LandingAurora.tsx` — procedural aurora geometry/material.
- `packages/lubirth-hero/src/assetManifest.ts` — LuBirth asset budget metadata.
- `packages/lubirth-hero/src/useLandingMotion.ts` — low-frequency mode motion helpers.

Modify:

- `apps/site/components/MiraLithHome.tsx` — mount `VisualCanvas`, DOM sections, and state.
- `apps/site/components/LuBirthWindow.tsx` — make project window interactive and accessible.
- `apps/site/app/globals.css` — replace placeholder layout with full viewport sections, fixed canvas, responsive rules.
- `packages/lubirth-hero/src/EarthMoonScene.tsx` — delegate to `Landing*` components and stop holding all scene logic in one file.
- `packages/lubirth-hero/src/EarthMoonHero.tsx` — keep as demo/dev wrapper and mirror fallback/a11y props.
- `packages/lubirth-hero/src/types.ts` — align with documented composition and accessibility contracts.
- `packages/lubirth-hero/src/presets.ts` — add `field`, `window`, `zoomed`, `expanded` preset coverage.
- `packages/lubirth-hero/src/index.ts` — export new components, constants, manifest, and types.
- `packages/visual-core/src/quality/quality.ts` — expose first-screen-friendly quality helpers if needed.
- `tests/e2e/miralith.spec.ts` — replace placeholder e2e assertions with production canvas, mobile, expanded, fallback, and first-visible checks.
- `docs/migration-plan.md` and `docs/interfaces.md` — update only when implementation changes an interface.

## Execution Order

Execute in this order:

1. Task 1: Lock Production Canvas Ownership.
2. Task 3: Align Composition, Presets, Required Assets, and Fixed Moon Date.
3. Task 2: Split LuBirth Scene Into Focused Components.
4. Task 4: Add Two-Screen Interaction State.
5. Task 5: Add Mobile Landscape and Nonblank Canvas Verification.
6. Task 6: Add Fallback and First-Visible Marker.
7. Task 7: Add Asset Manifest and Budget Gate.
8. Task 8: Final Verification and Documentation Sync.

Reason: Task 2 component snippets assume the nested `LandingComposition` and required `assets` contract from Task 3. Do not execute the split against the current flat skeleton types.

## Task 1: Lock Production Canvas Ownership

**Files:**
- Create: `apps/site/visual/VisualCanvas.tsx`
- Create: `apps/site/visual/VisualCanvasFallback.tsx`
- Create: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `apps/site/components/MiraLithHome.tsx`
- Modify: `apps/site/app/globals.css`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Write failing e2e assertions for production canvas ownership**

Replace the existing placeholder-only test in `tests/e2e/miralith.spec.ts` with:

```ts
import { expect, test } from "@playwright/test";

test("renders LuBirth in one production-owned canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Opening frame")).toBeVisible();
  await expect(page.getByLabel("Project frame")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator(".visual-canvas")).toHaveCount(1);
  await expect(page.locator(".lubirth-hero canvas")).toHaveCount(0);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm test:e2e -- --project=desktop --grep "production-owned canvas"
```

Expected before implementation: failure because the current homepage has zero canvases and no `.visual-canvas`.

- [ ] **Step 3: Create the production fallback component**

Add `apps/site/visual/VisualCanvasFallback.tsx`:

```tsx
import type { ReactNode } from "react";

interface VisualCanvasFallbackProps {
  scene: "lubirth";
  posterSrc?: string;
  label: string;
  children?: ReactNode;
}

export function VisualCanvasFallback({ scene, posterSrc, label, children }: VisualCanvasFallbackProps) {
  return (
    <div
      className="visual-canvas-fallback"
      data-visual-fallback={scene}
      role="img"
      aria-label={label}
      style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create the production canvas owner**

Add `apps/site/visual/VisualCanvas.tsx`:

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { Component, type ErrorInfo, type ReactNode, Suspense, useState } from "react";

interface VisualCanvasErrorBoundaryProps {
  fallback: ReactNode;
  onError?: (error: Error) => void;
  children: ReactNode;
}

interface VisualCanvasErrorBoundaryState {
  failed: boolean;
}

class VisualCanvasErrorBoundary extends Component<
  VisualCanvasErrorBoundaryProps,
  VisualCanvasErrorBoundaryState
> {
  state: VisualCanvasErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface VisualCanvasProps {
  ariaLabel?: string;
  decorative?: boolean;
  fallback: ReactNode;
  children: ReactNode;
}

export function VisualCanvas({ ariaLabel, decorative = true, fallback, children }: VisualCanvasProps) {
  const [contextLost, setContextLost] = useState(false);
  const preserveDrawingBuffer =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visualTest") === "pixels";

  if (contextLost) {
    return <>{fallback}</>;
  }

  return (
    <div
      className="visual-canvas"
      data-visual-canvas="production"
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : ariaLabel}
    >
      <VisualCanvasErrorBoundary fallback={fallback}>
        <Canvas
          dpr={[1, 1.25]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer }}
          camera={{ fov: 42, position: [0, 2.8, 7.4], near: 0.1, far: 90 }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (event) => {
              event.preventDefault();
              setContextLost(true);
            });
          }}
        >
          <Suspense fallback={null}>{children}</Suspense>
        </Canvas>
      </VisualCanvasErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 5: Add the LuBirth scene slot**

Add `apps/site/visual/scenes/LuBirthSceneSlot.tsx`:

```tsx
"use client";

import { EarthMoonScene, resolveLandingPreset } from "@miralith/lubirth-hero";
import { useQualityTier, useReducedMotionPreference } from "@miralith/visual-core";
import type { EarthMoonHeroMode } from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";

interface LuBirthSceneSlotProps {
  mode: EarthMoonHeroMode;
  quality?: LandingQuality;
  paused?: boolean;
}

export function LuBirthSceneSlot({ mode, quality = "auto", paused = false }: LuBirthSceneSlotProps) {
  const reducedMotion = useReducedMotionPreference();
  const qualityProfile = useQualityTier(quality, reducedMotion);
  const preset = mode === "field" ? "ritual-field" : "project-window";
  const composition = resolveLandingPreset(preset);

  if (qualityProfile.tier === "fallback") {
    return null;
  }

  return (
    <EarthMoonScene
      mode={mode}
      composition={composition}
      quality={qualityProfile}
      reducedMotion={reducedMotion}
      paused={paused}
    />
  );
}
```

- [ ] **Step 6: Mount the production canvas in the homepage**

Modify `apps/site/components/MiraLithHome.tsx`:

```tsx
"use client";

import { LuBirthWindow } from "./LuBirthWindow";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

export function MiraLithHome() {
  return (
    <main className="site-shell" aria-label="MiraLith interface frame">
      <VisualCanvas
        decorative
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label="LuBirth earth and moon field"
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthSceneSlot mode="field" />
      </VisualCanvas>

      <section className="opening-screen" id="opening" data-screen-label="01 Opening" aria-label="Opening frame">
        <div className="opening-screen__copy">
          <p>MiraLith</p>
          <h1>把看见之物，刻成作品。</h1>
          <p>A personal field of vision, intelligence, and form.</p>
        </div>
      </section>

      <section className="window-screen" aria-label="Project window frame">
        <LuBirthWindow />
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Add fixed canvas CSS**

Append to `apps/site/app/globals.css`:

```css
.visual-canvas,
.visual-canvas-fallback {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.visual-canvas canvas {
  display: block;
}

.site-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  margin: 0;
  padding: 0;
}

.opening-screen {
  min-height: 100vh;
  display: grid;
  align-items: center;
  padding: 0 32px;
  border-bottom: 0;
}

.opening-screen__copy {
  max-width: 620px;
}
```

- [ ] **Step 8: Verify test passes**

Run:

```bash
pnpm typecheck
pnpm test:e2e -- --project=desktop --grep "production-owned canvas"
```

Expected: typecheck passes and Playwright finds exactly one canvas.

- [ ] **Step 9: Commit**

```bash
git add apps/site/visual apps/site/components/MiraLithHome.tsx apps/site/app/globals.css tests/e2e/miralith.spec.ts
git commit -m "feat: add production visual canvas"
```

## Task 2: Split LuBirth Scene Into Focused Components

**Files:**
- Create: `packages/lubirth-hero/src/constants.ts`
- Create: `packages/lubirth-hero/src/LandingEarth.tsx`
- Create: `packages/lubirth-hero/src/LandingMoon.tsx`
- Create: `packages/lubirth-hero/src/LandingAtmosphere.tsx`
- Create: `packages/lubirth-hero/src/LandingAurora.tsx`
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Modify: `packages/lubirth-hero/src/index.ts`

- [ ] **Step 1: Add a typecheck gate before splitting**

Run:

```bash
pnpm typecheck
```

Expected: passes before refactor.

- [ ] **Step 2: Add constants**

Create `packages/lubirth-hero/src/constants.ts`:

```ts
export const DEFAULT_LUBIRTH_DATE = "1993-08-01T12:00:00Z" as const;
export const DEFAULT_LUBIRTH_MOON_PHASE = {
  date: DEFAULT_LUBIRTH_DATE,
  illumination: 0.97,
  phaseAngleRad: 0.24,
  sunDirection: [0.68, 0.42, 0.6],
  positionAngleRad: 0,
  source: "precomputed"
} as const;
export const FIXED_SUN_POSITION = [4.2, 2.8, 4.8] as const;
export const CAMERA_TARGET = [0, 0.04, 0] as const;
```

- [ ] **Step 3: Move earth mesh into `LandingEarth`**

Create `packages/lubirth-hero/src/LandingEarth.tsx`:

```tsx
"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, MathUtils, Mesh, MeshStandardMaterial } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";
import { createEarthTexture } from "./textures";

interface LandingEarthProps {
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
}

export function LandingEarth({ composition, quality, reducedMotion, paused }: LandingEarthProps) {
  const earth = useRef<Mesh>(null);
  const earthTexture = useMemo(() => createEarthTexture(quality.tier === "high" ? 1024 : 512), [quality.tier]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: earthTexture,
        roughness: 0.84,
        metalness: 0.08,
        emissive: new Color("#07131d"),
        emissiveIntensity: 0.22
      }),
    [earthTexture]
  );

  useFrame((_state, delta) => {
    if (!earth.current || paused || !composition.motion.autoRotate) {
      return;
    }

    const rotationSpeed = reducedMotion ? 0.004 : MathUtils.degToRad(composition.earth.rotationSpeedDegPerSec);
    earth.current.rotation.y += rotationSpeed * delta;
    earth.current.rotation.x = -0.12;
  });

  return (
    <mesh ref={earth} material={material}>
      <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
```

- [ ] **Step 4: Move moon mesh into `LandingMoon`**

Create `packages/lubirth-hero/src/LandingMoon.tsx`:

```tsx
"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { EarthMoonHeroMode, LandingComposition } from "./types";
import { createMoonTexture } from "./textures";

interface LandingMoonProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
  position: Vector3;
}

const targetScale = new Vector3();

export function LandingMoon({ mode, composition, quality, reducedMotion, paused, position }: LandingMoonProps) {
  const moon = useRef<Mesh>(null);
  const moonTexture = useMemo(() => createMoonTexture(quality.tier === "high" ? 512 : 256), [quality.tier]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        map: moonTexture,
        roughness: 0.92,
        metalness: 0,
        emissive: new Color("#2c2a24"),
        emissiveIntensity: 0.16
      }),
    [moonTexture]
  );

  useFrame((_state, delta) => {
    if (!moon.current) {
      return;
    }

    moon.current.position.lerp(position, 0.08);
    const scale = mode === "expanded" ? 1.12 : 1;
    moon.current.scale.lerp(targetScale.set(scale, scale, scale), 0.08);

    if (!paused && !reducedMotion) {
      moon.current.rotation.y += delta * 0.018;
    }
  });

  return (
    <mesh ref={moon} material={material}>
      <sphereGeometry args={[composition.moon.radius, quality.segments, quality.segments]} />
    </mesh>
  );
}
```

- [ ] **Step 5: Move atmosphere and aurora into separate components**

Create `packages/lubirth-hero/src/LandingAtmosphere.tsx`:

```tsx
"use client";

import { AdditiveBlending, BackSide, MeshBasicMaterial } from "three";
import { useMemo } from "react";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAtmosphereProps {
  composition: LandingComposition;
  quality: QualityProfile;
}

export function LandingAtmosphere({ composition, quality }: LandingAtmosphereProps) {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#9fc8d2",
        transparent: true,
        opacity: composition.atmosphere.enabled ? (quality.tier === "low" ? 0.08 : composition.atmosphere.intensity) : 0,
        blending: AdditiveBlending,
        side: BackSide,
        depthWrite: false
      }),
    [quality.tier]
  );

  return (
    <>
      <mesh material={material} scale={1.055}>
        <sphereGeometry args={[composition.earth.radius, quality.segments, quality.segments]} />
      </mesh>
      <mesh rotation={[Math.PI / 2.12, 0.18, -0.5]}>
        <torusGeometry args={[composition.earth.radius * 1.04, 0.006, 8, 160]} />
        <meshBasicMaterial color="#c4a35f" transparent opacity={composition.atmosphere.karmanGlow ? composition.atmosphere.nearStrength : 0} blending={AdditiveBlending} />
      </mesh>
    </>
  );
}
```

Create `packages/lubirth-hero/src/LandingAurora.tsx`:

```tsx
"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Mesh, MeshBasicMaterial } from "three";
import type { QualityProfile } from "@miralith/visual-core";
import type { LandingComposition } from "./types";

interface LandingAuroraProps {
  composition: LandingComposition;
  quality: QualityProfile;
  reducedMotion?: boolean;
  paused?: boolean;
}

export function LandingAurora({ composition, quality, reducedMotion, paused }: LandingAuroraProps) {
  const auroraNorth = useRef<Mesh>(null);
  const auroraSouth = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: "#76a99b",
        transparent: true,
        opacity: quality.aurora && composition.aurora.enabled ? composition.aurora.intensity : 0,
        blending: AdditiveBlending,
        depthWrite: false
      }),
    [composition.aurora.enabled, composition.aurora.intensity, quality.aurora]
  );

  useFrame((state, delta) => {
    if (!auroraNorth.current || !auroraSouth.current || paused || reducedMotion) {
      return;
    }

    auroraNorth.current.rotation.z += delta * composition.aurora.noiseSpeed;
    auroraSouth.current.rotation.z -= delta * composition.aurora.noiseSpeed * 0.8;
    const pulse = 0.65 + Math.sin(state.clock.elapsedTime * 0.8) * 0.18;
    auroraNorth.current.scale.setScalar(pulse);
    auroraSouth.current.scale.setScalar(0.78 + pulse * 0.22);
  });

  return (
    <>
      <mesh ref={auroraNorth} position={[0.08, composition.earth.radius * 0.62, 0.1]} rotation={[1.28, 0.1, 0.2]}>
        <torusGeometry args={[composition.earth.radius * 0.54, 0.012, 10, 120]} />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh ref={auroraSouth} position={[-0.08, -composition.earth.radius * 0.6, -0.05]} rotation={[1.82, -0.2, -0.1]}>
        <torusGeometry args={[composition.earth.radius * 0.48, 0.01, 10, 120]} />
        <primitive object={material.clone()} attach="material" />
      </mesh>
    </>
  );
}
```

- [ ] **Step 6: Refactor `EarthMoonScene` to compose the focused components**

Update `packages/lubirth-hero/src/EarthMoonScene.tsx` so its return path uses:

```tsx
<group ref={earthGroup}>
  <LandingEarth composition={composition} quality={quality} reducedMotion={reducedMotion} paused={paused} />
  <LandingAtmosphere composition={composition} quality={quality} />
  <LandingAurora composition={composition} quality={quality} reducedMotion={reducedMotion} paused={paused} />
</group>
<LandingMoon
  mode={mode}
  composition={composition}
  quality={quality}
  reducedMotion={reducedMotion}
  paused={paused}
  position={moonTargetPosition}
/>
```

Keep camera positioning, viewport-aware target calculation, lights, and stars in `EarthMoonScene`.

- [ ] **Step 7: Export focused components**

Modify `packages/lubirth-hero/src/index.ts`:

```ts
export { EarthMoonHero } from "./EarthMoonHero";
export { EarthMoonScene } from "./EarthMoonScene";
export { LandingEarth } from "./LandingEarth";
export { LandingMoon } from "./LandingMoon";
export { LandingAtmosphere } from "./LandingAtmosphere";
export { LandingAurora } from "./LandingAurora";
export { DEFAULT_LUBIRTH_DATE, DEFAULT_LUBIRTH_MOON_PHASE } from "./constants";
export { DEFAULT_LUBIRTH_ASSETS, resolveLandingAssets } from "./assetManifest";
export { LUBIRTH_PRESETS, resolveLandingPreset } from "./presets";
export type {
  EarthMoonHeroError,
  EarthMoonHeroEvent,
  EarthMoonHeroInteraction,
  EarthMoonHeroMode,
  EarthMoonHeroProps,
  EarthMoonSceneProps,
  LandingAssetManifest,
  LandingComposition,
  LandingCompositionOverrides,
  LandingResolvedAssets,
  LandingPresetName
} from "./types";
```

- [ ] **Step 8: Verify no behavior regression**

Run:

```bash
pnpm typecheck
pnpm test:e2e -- --project=desktop --grep "production-owned canvas"
```

Expected: typecheck and canvas ownership test pass.

- [ ] **Step 9: Commit**

```bash
git add packages/lubirth-hero/src
git commit -m "refactor: split lubirth landing scene"
```

## Task 3: Align Composition, Presets, Required Assets, and Fixed Moon Date

**Files:**
- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/presets.ts`
- Modify: `packages/lubirth-hero/src/constants.ts`
- Create: `packages/lubirth-hero/src/assetManifest.ts`
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`

- [ ] **Step 1: Expand mode and preset contract**

Update `packages/lubirth-hero/src/types.ts`:

```ts
import type { CSSProperties } from "react";
import type { LandingQuality, QualityProfile, ResolvedQualityTier } from "@miralith/visual-core";

export type EarthMoonHeroMode = "field" | "window" | "zoomed" | "expanded";
export type LandingPresetName =
  | "field"
  | "window"
  | "zoomed"
  | "expanded"
  | "mobileField"
  | "mobileWindow"
  | "fallback";

export interface TextureRef {
  id: string;
  src: string;
  width: number;
  height: number;
  format: "webp" | "avif" | "ktx2" | "jpg" | "png";
  colorSpace: "srgb" | "linear";
}

export interface LandingAsset {
  id: string;
  kind: "texture" | "poster" | "model" | "shader" | "data";
  tier: "critical" | "idle" | "expanded" | "fallback";
  src: string;
  bytesBudget: number;
  preload: boolean;
  requiredFor: LandingPresetName[];
}

export interface LandingAssetManifest {
  earthDay: TextureRef;
  earthNight?: TextureRef;
  earthClouds?: TextureRef;
  moonColor: TextureRef;
  fallbackPoster: LandingAsset;
  expandedEarthDay?: TextureRef;
  expandedMoonColor?: TextureRef;
}

export type LandingResolvedAssets = LandingAssetManifest;

export interface LandingCameraConfig {
  distance: number;
  fov: number;
  azimuthDeg: number;
  elevationDeg: number;
  lookAt: [number, number, number];
  viewOffsetY: number;
  dpr: [number, number] | number;
}

export interface LandingEarthConfig {
  radius: number;
  segments: number;
  yawDeg: number;
  rotationSpeedDegPerSec: number;
  dayTexture?: TextureRef;
  nightTexture?: TextureRef;
  cloudTexture?: TextureRef;
  useNightMap: boolean;
  useClouds: boolean;
  cloudOpacity: number;
  terminatorSoftness: number;
  nightIntensity: number;
  specularStrength: number;
  rimStrength: number;
  rimWidth: number;
}

export interface LandingMoonPhase {
  date: string;
  illumination: number;
  phaseAngleRad: number;
  sunDirection: [number, number, number];
  positionAngleRad?: number;
  source: "precomputed" | "runtime-ephemeris" | "constant-vector";
}

export interface LandingMoonConfig {
  visible: boolean;
  date: string;
  radius: number;
  screenX: number;
  screenY: number;
  screenSize: number;
  anchorDistance: number;
  phaseMode: "fixed-date" | "constant-vector" | "runtime-ephemeris";
  fixedPhase?: LandingMoonPhase;
  yawDeg: number;
  lonDeg: number;
  latDeg: number;
  nightLift: number;
}

export interface LandingLightConfig {
  mode: "fixed-sun";
  fixedSunDir: [number, number, number];
  intensity: number;
  color: [number, number, number];
  ambientIntensity: number;
}

export interface LandingAtmosphereConfig {
  enabled: boolean;
  intensity: number;
  thickness: number;
  color: [number, number, number];
  fresnelPower: number;
  nearShell: boolean;
  nearStrength: number;
  karmanGlow: boolean;
}

export interface LandingAuroraConfig {
  enabled: boolean;
  intensity: number;
  latitudeBandDeg: [number, number];
  colorA: [number, number, number];
  colorB: [number, number, number];
  noiseScale: number;
  noiseSpeed: number;
  sampleCount: number;
}

export interface LandingMotionConfig {
  autoRotate: boolean;
  hoverSlowdown: boolean;
  scrollDriven: boolean;
  transitionDurationMs: number;
}

export interface LandingComposition {
  camera: LandingCameraConfig;
  earth: LandingEarthConfig;
  moon: LandingMoonConfig;
  light: LandingLightConfig;
  atmosphere: LandingAtmosphereConfig;
  aurora: LandingAuroraConfig;
  motion: LandingMotionConfig;
}

export interface LandingCompositionOverrides {
  camera?: Partial<LandingCameraConfig>;
  earth?: Partial<LandingEarthConfig>;
  moon?: Partial<LandingMoonConfig>;
  light?: Partial<LandingLightConfig>;
  atmosphere?: Partial<LandingAtmosphereConfig>;
  aurora?: Partial<LandingAuroraConfig>;
  motion?: Partial<LandingMotionConfig>;
}

export interface EarthMoonSceneProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: QualityProfile;
  scrollProgress?: number;
  sectionProgress?: number;
  reducedMotion?: boolean;
  paused?: boolean;
  onSceneReady?: () => void;
}

export type EarthMoonHeroInteraction =
  | "none"
  | "hover-zoom"
  | "tap-expand"
  | "hover-and-click-expand"
  | "scroll-driven";

export interface AccessibilityProps {
  ariaLabel?: string;
  describedById?: string;
  decorative?: boolean;
}

export interface EarthMoonHeroEvent {
  mode: EarthMoonHeroMode;
  quality: ResolvedQualityTier;
}

export interface EarthMoonHeroError {
  message: string;
}

export interface EarthMoonHeroProps {
  mode?: EarthMoonHeroMode;
  preset?: LandingPresetName;
  date?: string;
  quality?: LandingQuality;
  interaction?: EarthMoonHeroInteraction;
  className?: string;
  style?: CSSProperties;
  accessibility?: AccessibilityProps;
  reducedMotion?: boolean;
  paused?: boolean;
  posterSrc?: string;
  assets?: Partial<LandingAssetManifest>;
  composition?: LandingCompositionOverrides;
  onReady?: (event: EarthMoonHeroEvent) => void;
  onQualityChange?: (quality: ResolvedQualityTier) => void;
  onExpandChange?: (expanded: boolean) => void;
  onError?: (error: EarthMoonHeroError) => void;
}
```

- [ ] **Step 2: Replace presets with all four modes**

Update `packages/lubirth-hero/src/presets.ts`:

```ts
import { DEFAULT_LUBIRTH_DATE, DEFAULT_LUBIRTH_MOON_PHASE } from "./constants";
import type { LandingComposition, LandingCompositionOverrides, LandingPresetName } from "./types";

const field: LandingComposition = {
  camera: { distance: 7.4, fov: 42, azimuthDeg: 13, elevationDeg: 22, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.25] },
  earth: { radius: 1.88, segments: 96, yawDeg: 0, rotationSpeedDegPerSec: 2.6, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.08, rimStrength: 0.42, rimWidth: 0.22 },
  moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.28, screenX: -0.55, screenY: 0.92, screenSize: 0.18, anchorDistance: 3.8, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
  light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 1.9, color: [1, 0.96, 0.82], ambientIntensity: 0.42 },
  atmosphere: { enabled: true, intensity: 0.13, thickness: 0.055, color: [0.62, 0.78, 0.82], fresnelPower: 2.4, nearShell: true, nearStrength: 0.34, karmanGlow: true },
  aurora: { enabled: true, intensity: 0.34, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.8, noiseSpeed: 0.08, sampleCount: 3 },
  motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 900 }
};

const windowPreset: LandingComposition = {
  camera: { distance: 5.2, fov: 42, azimuthDeg: 9, elevationDeg: 19, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.25] },
  earth: { radius: 1.42, segments: 72, yawDeg: 0, rotationSpeedDegPerSec: 1.85, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.08, rimStrength: 0.38, rimWidth: 0.2 },
  moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.22, screenX: -0.18, screenY: 0.54, screenSize: 0.14, anchorDistance: 3.4, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
  light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 1.9, color: [1, 0.96, 0.82], ambientIntensity: 0.42 },
  atmosphere: { enabled: true, intensity: 0.11, thickness: 0.048, color: [0.62, 0.78, 0.82], fresnelPower: 2.4, nearShell: true, nearStrength: 0.28, karmanGlow: true },
  aurora: { enabled: true, intensity: 0.18, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.4, noiseSpeed: 0.065, sampleCount: 2 },
  motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 760 }
};

export const LUBIRTH_PRESETS: Record<LandingPresetName, LandingComposition> = {
  field: {
    ...field
  },
  window: {
    ...windowPreset
  },
  zoomed: {
    camera: { distance: 4.6, fov: 40, azimuthDeg: 7, elevationDeg: 17, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.25] },
    earth: { radius: 1.58, segments: 72, yawDeg: 0, rotationSpeedDegPerSec: 1.6, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.08, rimStrength: 0.4, rimWidth: 0.2 },
    moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.24, screenX: -0.1, screenY: 0.58, screenSize: 0.16, anchorDistance: 3.2, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
    light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 1.9, color: [1, 0.96, 0.82], ambientIntensity: 0.42 },
    atmosphere: { enabled: true, intensity: 0.12, thickness: 0.052, color: [0.62, 0.78, 0.82], fresnelPower: 2.4, nearShell: true, nearStrength: 0.3, karmanGlow: true },
    aurora: { enabled: true, intensity: 0.22, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.4, noiseSpeed: 0.065, sampleCount: 2 },
    motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 720 }
  },
  expanded: {
    camera: { distance: 4.1, fov: 38, azimuthDeg: 5, elevationDeg: 16, lookAt: [0, 0.04, 0], viewOffsetY: 0, dpr: [1, 1.5] },
    earth: { radius: 1.82, segments: 96, yawDeg: 0, rotationSpeedDegPerSec: 1.4, useNightMap: false, useClouds: false, cloudOpacity: 0, terminatorSoftness: 0.38, nightIntensity: 0.18, specularStrength: 0.1, rimStrength: 0.46, rimWidth: 0.24 },
    moon: { visible: true, date: DEFAULT_LUBIRTH_DATE, radius: 0.3, screenX: -0.08, screenY: 0.62, screenSize: 0.22, anchorDistance: 3.0, phaseMode: "fixed-date", fixedPhase: DEFAULT_LUBIRTH_MOON_PHASE, yawDeg: 0, lonDeg: 0, latDeg: 0, nightLift: 0.16 },
    light: { mode: "fixed-sun", fixedSunDir: [0.68, 0.42, 0.6], intensity: 2.0, color: [1, 0.96, 0.82], ambientIntensity: 0.44 },
    atmosphere: { enabled: true, intensity: 0.14, thickness: 0.058, color: [0.62, 0.78, 0.82], fresnelPower: 2.2, nearShell: true, nearStrength: 0.36, karmanGlow: true },
    aurora: { enabled: true, intensity: 0.28, latitudeBandDeg: [58, 74], colorA: [0.46, 0.66, 0.61], colorB: [0.78, 0.64, 0.38], noiseScale: 2.2, noiseSpeed: 0.06, sampleCount: 3 },
    motion: { autoRotate: true, hoverSlowdown: true, scrollDriven: true, transitionDurationMs: 680 }
  },
  mobileField: mergeLandingComposition(field, {
    camera: { distance: 7.9, elevationDeg: 19 },
    earth: { radius: 1.56, segments: 64 },
    moon: { screenX: -0.72, screenY: 0.72, screenSize: 0.15 }
  }),
  mobileWindow: mergeLandingComposition(windowPreset, {
    camera: { distance: 5.7, elevationDeg: 17 },
    earth: { radius: 1.18, segments: 56 },
    moon: { screenX: -0.54, screenY: 0.46, screenSize: 0.13 }
  }),
  fallback: mergeLandingComposition(field, {
    aurora: { enabled: false, intensity: 0, sampleCount: 0 },
    motion: { autoRotate: false, hoverSlowdown: false, scrollDriven: false }
  })
};

function mergeLandingComposition(
  base: LandingComposition,
  overrides: LandingCompositionOverrides = {}
): LandingComposition {
  return {
    camera: { ...base.camera, ...overrides.camera },
    earth: { ...base.earth, ...overrides.earth },
    moon: { ...base.moon, ...overrides.moon },
    light: { ...base.light, ...overrides.light },
    atmosphere: { ...base.atmosphere, ...overrides.atmosphere },
    aurora: { ...base.aurora, ...overrides.aurora },
    motion: { ...base.motion, ...overrides.motion }
  };
}

export function resolveLandingPreset(
  preset: LandingPresetName = "field",
  composition: LandingCompositionOverrides = {}
): LandingComposition {
  return mergeLandingComposition(LUBIRTH_PRESETS[preset], composition);
}
```

- [ ] **Step 3: Add the M1 asset resolver**

Create `packages/lubirth-hero/src/assetManifest.ts`. `EarthMoonScene` receives required `assets`, but M1 does not require external texture files because the resolver supplies procedural texture refs and a fallback poster budget. Later real WebP/AVIF/KTX2 assets replace these refs without changing the scene prop contract.

```ts
import type { LandingAsset, LandingAssetManifest } from "./types";

export const DEFAULT_LUBIRTH_ASSETS: LandingAssetManifest = {
  earthDay: {
    id: "earth-procedural",
    src: "procedural:earth-canvas-texture",
    width: 1024,
    height: 512,
    format: "png",
    colorSpace: "srgb"
  },
  moonColor: {
    id: "moon-procedural",
    src: "procedural:moon-canvas-texture",
    width: 512,
    height: 512,
    format: "png",
    colorSpace: "srgb"
  },
  fallbackPoster: {
    id: "lubirth-poster-field",
    kind: "poster",
    tier: "fallback",
    src: "/assets/lubirth/poster-field.webp",
    bytesBudget: 240_000,
    preload: false,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  }
};

export function resolveLandingAssets(assets: Partial<LandingAssetManifest> = {}): LandingAssetManifest {
  return {
    ...DEFAULT_LUBIRTH_ASSETS,
    ...assets
  };
}
```

- [ ] **Step 4: Export the resolver and nested contract types**

Modify `packages/lubirth-hero/src/index.ts`:

```ts
export { DEFAULT_LUBIRTH_ASSETS, resolveLandingAssets } from "./assetManifest";
export type {
  EarthMoonSceneProps,
  LandingAssetManifest,
  LandingCompositionOverrides,
  LandingResolvedAssets
} from "./types";
```

- [ ] **Step 5: Update call sites from old preset names and pass required assets**

In `apps/site/visual/scenes/LuBirthSceneSlot.tsx`, set:

```ts
import { EarthMoonScene, resolveLandingAssets, resolveLandingPreset } from "@miralith/lubirth-hero";
```

```ts
const composition = resolveLandingPreset(mode);
const assets = resolveLandingAssets();
```

Then pass assets to the production scene:

```tsx
<EarthMoonScene
  mode={mode}
  composition={composition}
  assets={assets}
  quality={qualityProfile}
  reducedMotion={reducedMotion}
  paused={paused}
/>
```

In `packages/lubirth-hero/src/EarthMoonHero.tsx`, change the default preset:

```ts
preset = "field",
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm typecheck
pnpm test:e2e -- --project=desktop --grep "production-owned canvas"
```

Expected: no TypeScript errors from the preset rename.

- [ ] **Step 7: Commit**

```bash
git add packages/lubirth-hero/src apps/site/visual/scenes/LuBirthSceneSlot.tsx
git commit -m "feat: align lubirth scene modes"
```

## Task 4: Add Two-Screen Interaction State

**Files:**
- Create: `apps/site/components/LuBirthExpandedView.tsx`
- Modify: `apps/site/components/MiraLithHome.tsx`
- Modify: `apps/site/components/LuBirthWindow.tsx`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `apps/site/app/globals.css`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Add failing expanded-state e2e test**

Append to `tests/e2e/miralith.spec.ts`:

```ts
test("opens and closes the LuBirth expanded view with keyboard flow", async ({ page }) => {
  await page.goto("/");
  const openButton = page.getByRole("button", { name: "Open LuBirth expanded view" });
  await openButton.focus();
  await openButton.press("Enter");

  const dialog = page.getByRole("dialog", { name: "LuBirth expanded view" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openButton).toBeFocused();
});
```

Run:

```bash
pnpm test:e2e -- --project=desktop --grep "expanded view"
```

Expected before implementation: failure because no button or dialog exists.

- [ ] **Step 2: Create accessible expanded view**

Add `apps/site/components/LuBirthExpandedView.tsx`:

```tsx
"use client";

import { useEffect, useRef, type RefObject } from "react";

interface LuBirthExpandedViewProps {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function LuBirthExpandedView({ open, onClose, returnFocusRef }: LuBirthExpandedViewProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        returnFocusRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, returnFocusRef]);

  if (!open) {
    return null;
  }

  return (
    <div className="expanded-view" role="dialog" aria-modal="true" aria-label="LuBirth expanded view">
      <div className="expanded-view__panel">
        <button
          ref={closeRef}
          className="expanded-view__close"
          type="button"
          onClick={() => {
            onClose();
            returnFocusRef.current?.focus();
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Make project window interactive**

Modify `apps/site/components/LuBirthWindow.tsx`:

```tsx
import type { RefObject } from "react";

interface LuBirthWindowProps {
  onHoverChange: (hovered: boolean) => void;
  onExpand: () => void;
  expandButtonRef: RefObject<HTMLButtonElement | null>;
}

export function LuBirthWindow({ onHoverChange, onExpand, expandButtonRef }: LuBirthWindowProps) {
  return (
    <article
      className="project-window"
      data-screen-label="02 Project Window"
      id="lubirth"
      aria-label="Project frame"
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
    >
      <button
        ref={expandButtonRef}
        className="project-window__preview"
        type="button"
        aria-label="Open LuBirth expanded view"
        onClick={onExpand}
      />
      <div className="project-window__meta">
        <p>LuBirth 地月人</p>
        <p>A cosmological interface for birth, time, and self-recognition.</p>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Wire mode state in homepage**

Modify `apps/site/components/MiraLithHome.tsx` to derive `field -> window -> zoomed -> expanded` from scroll, hover, and modal state:

```tsx
import { useEffect, useRef, useState } from "react";
import { createScrollProgressDriver } from "@miralith/visual-core";

const [windowHovered, setWindowHovered] = useState(false);
const [expanded, setExpanded] = useState(false);
const [sectionProgress, setSectionProgress] = useState(0);
const expandButtonRef = useRef<HTMLButtonElement>(null);
const baseMode = sectionProgress > 0.55 ? "window" : "field";
const mode = expanded ? "expanded" : windowHovered ? "zoomed" : baseMode;

useEffect(() => {
  const driver = createScrollProgressDriver({
    startRatio: 0,
    endRatio: 1.15,
    onProgress: (progress) => {
      window.__MiraLithOpeningProgress = progress;
      setSectionProgress(progress);
    }
  });

  return () => driver.destroy();
}, []);
```

Pass `mode` to `LuBirthSceneSlot` and render `LuBirthExpandedView`.

- [ ] **Step 5: Add overlay CSS**

Append to `apps/site/app/globals.css`:

```css
.project-window__preview {
  cursor: zoom-in;
}

.expanded-view {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  background: rgba(4, 6, 10, 0.72);
}

.expanded-view__panel {
  position: relative;
  width: min(92vw, 1040px);
  height: min(82vh, 720px);
  border: 1px solid var(--line);
  background: rgba(8, 10, 16, 0.62);
}

.expanded-view__close {
  position: absolute;
  top: 24px;
  right: 24px;
}
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm typecheck
pnpm test:e2e -- --project=desktop --grep "expanded view"
```

Expected: expanded dialog opens, Esc closes it, focus returns.

- [ ] **Step 7: Commit**

```bash
git add apps/site/components apps/site/app/globals.css tests/e2e/miralith.spec.ts
git commit -m "feat: add lubirth window interaction"
```

## Task 5: Add Mobile Landscape and Nonblank Canvas Verification

**Files:**
- Modify: `tests/e2e/miralith.spec.ts`
- Modify: `playwright.config.ts` only if the mobile landscape project is missing.

- [ ] **Step 1: Add mobile landscape smoke test**

Append:

```ts
test("mobile landscape keeps LuBirth visual and project frame usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Opening frame")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);

  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.15, behavior: "instant" }));
  await expect(page.locator('[data-screen-label="02 Project Window"]')).toBeInViewport();
  await expect(page.getByRole("button", { name: "Open LuBirth expanded view" })).toBeVisible();
});
```

- [ ] **Step 2: Add nonblank canvas check**

Append:

```ts
test("production canvas renders nonblank pixels", async ({ page }) => {
  await page.goto("/?visualTest=pixels");
  const nonblank = await page.locator("canvas").evaluate((canvas) => {
    const source = canvas as HTMLCanvasElement;
    const sample = document.createElement("canvas");
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext("2d");
    if (!context) {
      return false;
    }
    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 18) {
        return true;
      }
    }
    return false;
  });

  expect(nonblank).toBe(true);
});
```

- [ ] **Step 3: Run targeted tests**

Run:

```bash
pnpm test:e2e -- --project=mobile-landscape --grep "mobile landscape"
pnpm test:e2e -- --project=desktop --grep "nonblank pixels"
```

Expected: both tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/miralith.spec.ts playwright.config.ts
git commit -m "test: verify lubirth canvas visibility"
```

## Task 6: Add Fallback and First-Visible Marker

**Files:**
- Modify: `apps/site/visual/VisualCanvas.tsx`
- Modify: `apps/site/visual/VisualCanvasFallback.tsx`
- Modify: `apps/site/components/MiraLithHome.tsx`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Add a shared first-usable marker helper**

In `apps/site/visual/VisualCanvas.tsx`, add:

```ts
declare global {
  interface Window {
    __MiraLithFirstUsableAt?: number;
  }
}

function markFirstUsable() {
  if (typeof window === "undefined" || window.__MiraLithFirstUsableAt) {
    return;
  }

  window.__MiraLithFirstUsableAt = performance.now();
}
```

Then inside `Canvas onCreated`:

```ts
markFirstUsable();
```

- [ ] **Step 2: Mark fallback as first usable too**

Modify `apps/site/visual/VisualCanvasFallback.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

declare global {
  interface Window {
    __MiraLithFirstUsableAt?: number;
  }
}

function markFirstUsable() {
  if (typeof window === "undefined" || window.__MiraLithFirstUsableAt) {
    return;
  }

  window.__MiraLithFirstUsableAt = performance.now();
}

interface VisualCanvasFallbackProps {
  scene: "lubirth";
  posterSrc?: string;
  label: string;
  children?: ReactNode;
}

export function VisualCanvasFallback({ scene, posterSrc, label, children }: VisualCanvasFallbackProps) {
  useEffect(() => {
    markFirstUsable();
  }, []);

  return (
    <div
      className="visual-canvas-fallback"
      data-visual-fallback={scene}
      role="img"
      aria-label={label}
      style={posterSrc ? { backgroundImage: `url(${posterSrc})` } : undefined}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Allow forced fallback for tests**

In `VisualCanvas`, compute:

```ts
const forcedFallback =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("visual") === "fallback";
```

Return fallback when `forcedFallback || contextLost`. This path must render `VisualCanvasFallback`, which sets `__MiraLithFirstUsableAt`.

- [ ] **Step 4: Add fallback e2e test**

Append:

```ts
test("forced visual fallback keeps DOM content available", async ({ page }) => {
  await page.goto("/?visual=fallback");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator('[data-visual-fallback="lubirth"]')).toBeVisible();
  await expect(page.getByText("MiraLith")).toBeVisible();
  await expect(page.getByText("LuBirth 地月人")).toBeVisible();
  const marker = await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 3000 });
  expect(await marker.jsonValue()).toBeLessThan(3000);
});
```

- [ ] **Step 5: Add WebGL first-visible e2e test**

Append:

```ts
test("first usable viewport marker is under 3 seconds", async ({ page }) => {
  await page.goto("/");
  const marker = await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 3000 });
  const value = await marker.jsonValue();
  expect(typeof value).toBe("number");
  expect(value).toBeLessThan(3000);
});
```

- [ ] **Step 6: Verify**

Run:

```bash
pnpm typecheck
pnpm test:e2e -- --project=desktop --grep "fallback|first usable"
```

Expected: forced fallback has zero canvases, WebGL success path sets the marker, and fallback path sets the same marker under 3 seconds.

- [ ] **Step 7: Commit**

```bash
git add apps/site/visual apps/site/components/MiraLithHome.tsx tests/e2e/miralith.spec.ts
git commit -m "feat: add visual fallback marker"
```

## Task 7: Add Asset Manifest and Budget Gate

**Files:**
- Modify: `packages/lubirth-hero/src/assetManifest.ts`
- Modify: `packages/lubirth-hero/src/index.ts`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Add budget helpers to the existing asset manifest**

Modify `packages/lubirth-hero/src/assetManifest.ts`:

```ts
export const LUBIRTH_ASSET_BUDGET: LandingAsset[] = [
  {
    id: DEFAULT_LUBIRTH_ASSETS.earthDay.id,
    kind: "texture",
    tier: "critical",
    src: DEFAULT_LUBIRTH_ASSETS.earthDay.src,
    bytesBudget: 0,
    preload: true,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  },
  {
    id: DEFAULT_LUBIRTH_ASSETS.moonColor.id,
    kind: "texture",
    tier: "critical",
    src: DEFAULT_LUBIRTH_ASSETS.moonColor.src,
    bytesBudget: 0,
    preload: true,
    requiredFor: ["field", "window", "zoomed", "expanded"]
  },
  DEFAULT_LUBIRTH_ASSETS.fallbackPoster
];

export function getCriticalAssetBudget() {
  return LUBIRTH_ASSET_BUDGET
    .filter((asset) => asset.tier === "critical")
    .reduce((total, asset) => total + asset.bytesBudget, 0);
}
```

- [ ] **Step 2: Export manifest**

Modify `packages/lubirth-hero/src/index.ts`:

```ts
export { DEFAULT_LUBIRTH_ASSETS, LUBIRTH_ASSET_BUDGET, getCriticalAssetBudget, resolveLandingAssets } from "./assetManifest";
```

- [ ] **Step 3: Add budget smoke test**

Append:

```ts
test("first screen transfer budget stays below 3MB", async ({ page }) => {
  const responseSizes: Promise<number>[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== "http://127.0.0.1:3100") {
      return;
    }

    responseSizes.push(
      response
        .body()
        .then((body) => body.byteLength)
        .catch(() => 0)
    );
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const total = (await Promise.all(responseSizes)).reduce((sum, value) => sum + value, 0);
  expect(total).toBeLessThanOrEqual(3_000_000);
});
```

- [ ] **Step 4: Verify**

Run:

```bash
pnpm typecheck
pnpm test:e2e -- --project=desktop --grep "transfer budget"
```

Expected: manifest types compile and budget smoke test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/lubirth-hero/src/assetManifest.ts packages/lubirth-hero/src/index.ts tests/e2e/miralith.spec.ts
git commit -m "feat: add lubirth asset budget"
```

## Task 8: Final Verification and Documentation Sync

**Files:**
- Modify: `docs/migration-plan.md`
- Modify: `docs/interfaces.md`
- Modify: `docs/superpowers/specs/2026-04-24-lubirth-first-two-screens-design.md`
- Modify: `docs/superpowers/plans/2026-04-24-lubirth-first-two-screens.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm typecheck
pnpm build
pnpm test:e2e
```

Expected: all commands pass.

- [ ] **Step 2: Scan for architecture violations**

Run:

```bash
rg -n "from \"@react-three/fiber\"|<Canvas|new WebGLRenderTarget|MoonPIP|SimpleTest|LocationSelector|LocalAudioPlayer" apps packages
```

Expected:

- `Canvas` appears in `apps/site/visual/VisualCanvas.tsx`.
- `Canvas` may appear in `packages/lubirth-hero/src/EarthMoonHero.tsx`.
- No production site component imports `EarthMoonHero`.
- No `MoonPIP`, `WebGLRenderTarget`, `SimpleTest`, `LocationSelector`, or `LocalAudioPlayer` references exist in MiraLith production code.

- [ ] **Step 3: Update docs with implemented status**

Update `docs/migration-plan.md` Phase 0 snapshot:

```md
- 生产首页已有 site-owned `VisualCanvas` / fixed Canvas layer。
- `EarthMoonScene` 已通过 `LuBirthSceneSlot` 挂入生产 site-owned Canvas。
- site-owned fallback、Canvas a11y、context-lost routing 已接入生产首页。
```

Update `docs/interfaces.md` only if actual exported type names changed from the document.

- [ ] **Step 4: Final scan for placeholders**

Run:

```bash
rg -n 'TB[D]|TO[D]O|implement[[:space:]]later|placeholder|EarthMoonHero.*production|production.*EarthMoonHero' docs apps packages --glob '!docs/superpowers/**'
```

Expected:

- No red-flag placeholder terms in implementation docs.
- `placeholder` does not appear in production UI copy or tests except historical notes.
- Any `EarthMoonHero` production mention states that it is not the production homepage path.

- [ ] **Step 5: Commit**

```bash
git add docs apps packages tests playwright.config.ts
git commit -m "docs: sync lubirth production implementation"
```

## Self-Review Checklist

- Spec coverage: production single canvas, two LuBirth screens, fixed date, no FBO PIP, fallback, a11y, mobile landscape, 3MB budget, and 3s first usable viewport are covered.
- Placeholder scan: this plan must not contain red-flag placeholder terms or unspecified edge handling.
- Type consistency: mode names are `field | window | zoomed | expanded`; fixed date is `1993-08-01T12:00:00Z`; production path is `VisualCanvas` plus `EarthMoonScene`.
- Execution rule: do not implement Radio Gaga, CoScroll, ArtBreeze, or constellation while executing this v1.0 plan.
