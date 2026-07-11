# LuBirth Close Atmosphere Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the LuBirth close Earth atmosphere so the near limb has a disciplined blue-white edge glow, a top-to-ground atmospheric gradient, restrained volume-depth shadowing, and readable ground/cloud projection without changing the existing camera angle or scroll-driven zoom choreography.

**Architecture:** Keep the production rendering path on the existing `stack` atmosphere. Add a dedicated spike route for close-atmosphere tuning, then promote only the shader/tuning pieces that pass visual and performance checks. Do not change `mapOpeningProgress`, `openingTimeline`, composition camera defaults, or the `EarthMoonScene` camera/scale interpolation.

**Tech Stack:** Next.js App Router, React 19, React Three Fiber, Three.js `ShaderMaterial`, existing `@miralith/lubirth-hero` shaders, Playwright visual/performance checks.

---

## Hard Constraints

- Do not modify `packages/visual-core/src/theatre/openingTimeline.ts`.
- Do not modify `getRuntimeOpeningProgress` or `mapOpeningProgress` in `@miralith/visual-core`.
- Do not change the camera positioning, `camera.lookAt`, Earth scale, Earth yaw/pitch interpolation, moon placement, or scroll progress mapping in `packages/lubirth-hero/src/EarthMoonScene.tsx`.
- Do not change `composition.camera` defaults in `packages/lubirth-hero/src/presets.ts` for this work.
- The new route may pin `window.__MiraLithOpeningProgress` for review, but it must use the same existing scene camera choreography and Earth transform path.
- The new route must be deterministic by default: no IP geolocation fetch, no runtime visitor location, and the same frozen solar/location behavior as the existing atmosphere/cloud truth spike routes unless URL params explicitly request runtime solar/location inputs.
- Keep production default on `atmosphereVariant="stack"` until screenshots, pixel smoke, and RAF checks pass.

## Source Context

- Scene orchestration: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Production stack atmosphere: `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`
- Earth surface, cloud shadow atlas, ground projection, depth shadow: `packages/lubirth-hero/src/LandingEarth.tsx`
- Existing atmosphere spike route pattern: `apps/site/components/LuBirthAtmosphereSpikeRoute.tsx`
- Existing cloud truth spike route pattern: `apps/site/components/LuBirthCloudTruthSpikeRoute.tsx`
- Runtime location / solar freeze logic: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Existing policy resolver: `packages/lubirth-hero/src/atmospherePolicy.ts`
- Existing tests: `tests/e2e/lubirth-atmosphere-spike.spec.ts`, `tests/e2e/lubirth-cloud-truth-spike.spec.ts`, `tests/e2e/lubirth-revised.spec.ts`, `tests/e2e/lubirth-atmosphere-performance.spec.ts`

## Design Direction

The close atmosphere should borrow the physical intuition from Rayleigh/Mie scattering without adopting a heavy production raymarch:

- Edge brightness comes from grazing path length, represented by `fresnel/rim`.
- Vertical/ground contact gradient comes from density falloff, represented by `exp(-height / scaleHeight)` style curves already approximated by `heightFromGround` and `outwardHeight`.
- Volume thickness should mostly darken and blue-shift near-limb terrain/clouds, not wash out the whole Earth.
- Ground projection should continue using cloud-map/atlas offset sampling. Do not add global shadow maps for the planet.

## File Structure

### Create

- `apps/site/app/lubirth-close-atmosphere-spike/page.tsx`  
  App Router page for the isolated close-atmosphere tuning route.

- `apps/site/components/LuBirthCloseAtmosphereSpikeRoute.tsx`  
  Route component that reads URL tuning params, pins opening progress through the existing global progress hook, and renders `LuBirthSceneSlot` without changing camera choreography.

- `tests/e2e/lubirth-close-atmosphere-spike.spec.ts`  
  Pixel smoke and route-state coverage for the new tuning route.

### Modify

- `packages/lubirth-hero/src/types.ts`  
  Add a small close-atmosphere tuning type and optional props.

- `packages/lubirth-hero/src/EarthMoonScene.tsx`  
  Pass close-atmosphere tuning to `LandingEarth` and `LandingAtmosphereStack`; do not edit camera or scroll math.

- `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`  
  Add production-safe close-limb density controls to the existing `surface-glow` shell. Keep this task to the current production shell; a second shell requires a separate follow-up decision.

- `packages/lubirth-hero/src/LandingEarth.tsx`  
  Promote the useful `truthAtmosphereDepthStrength` and `truthGroundShadowStrength` ideas into named close-atmosphere tuning uniforms while keeping low/fallback gated off.

- `apps/site/visual/scenes/LuBirthSceneSlot.tsx`  
  Accept and forward close-atmosphere tuning from spike and future production callers.

- `tests/e2e/lubirth-revised.spec.ts`  
  Add a guard that production route camera/scroll invariants still resolve to stack by default.

---

## Milestones

| # | Milestone | Success Criteria |
|---|-----------|------------------|
| 1 | Spike route exists | `/lubirth-close-atmosphere-spike` renders the existing LuBirth field scene with pinned progress and stack atmosphere active |
| 2 | Spike route is deterministic | Default close spike makes no `/api/lubirth-geo` request, leaves `window.__MiraLithLuBirthRuntimeLocation` empty, and freezes solar/location state unless explicit runtime params are supplied |
| 3 | Shader tuning isolated | URL params visibly affect only edge glow, gradient, depth shadow, and ground projection; camera/scroll choreography files remain untouched |
| 4 | Pixel smoke passes | All-off vs all-on canvas crop samples prove limb blue/luma increases, black field stays near black, terrain/cloud changes are controlled, and low quality keeps effective tuning at zero |
| 5 | Production candidate selected | A tuned preset is documented and can be passed into `LuBirthSceneSlot` without making volumetric default |
| 6 | Performance and fallback pass | Close-route RAF samples cover high all-on and low high-intensity fallback; low/fallback disable heavy close-atmosphere additions |

---

## Task 1: Add Close-Atmosphere Tuning Types

**Files:**
- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/index.ts`

- [ ] **Step 1: Add a typed tuning contract**

Add this near the existing atmosphere-related type exports:

```ts
export interface LandingCloseAtmosphereTuning {
  edgeGlowStrength: number;
  verticalGradientStrength: number;
  depthShadowStrength: number;
  groundProjectionStrength: number;
  cloudVolumeShadowStrength: number;
}
```

- [ ] **Step 2: Add optional scene prop**

In `EarthMoonSceneProps`, add:

```ts
  closeAtmosphereTuning?: Partial<LandingCloseAtmosphereTuning>;
```

- [ ] **Step 3: Export the type**

In `packages/lubirth-hero/src/index.ts`, export `LandingCloseAtmosphereTuning` with the existing public types.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @miralith/lubirth-hero typecheck
```

Expected: pass, because the new prop is optional.

---

## Task 2: Add The Isolated Close-Atmosphere Route

**Files:**
- Create: `apps/site/app/lubirth-close-atmosphere-spike/page.tsx`
- Create: `apps/site/components/LuBirthCloseAtmosphereSpikeRoute.tsx`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`

- [ ] **Step 1: Create the page**

Create `apps/site/app/lubirth-close-atmosphere-spike/page.tsx`:

```tsx
import { LuBirthCloseAtmosphereSpikeRoute } from "../../components/LuBirthCloseAtmosphereSpikeRoute";

export const metadata = {
  title: "LuBirth Close Atmosphere Spike | MiraLith",
  description: "A LuBirth close Earth atmosphere tuning route for stack edge glow, gradient, depth, and projection."
};

export default function LuBirthCloseAtmosphereSpikePage() {
  return <LuBirthCloseAtmosphereSpikeRoute />;
}
```

- [ ] **Step 2: Create the route component**

Create `apps/site/components/LuBirthCloseAtmosphereSpikeRoute.tsx` using the existing spike route style:

```tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { LandingCloseAtmosphereTuning } from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

interface CloseAtmosphereSpikeConfig {
  copyHidden: boolean;
  fixedProgress: number;
  live: boolean;
  quality: LandingQuality;
  tuning: LandingCloseAtmosphereTuning;
}

const DEFAULT_TUNING: LandingCloseAtmosphereTuning = {
  edgeGlowStrength: 1,
  verticalGradientStrength: 1,
  depthShadowStrength: 1,
  groundProjectionStrength: 1,
  cloudVolumeShadowStrength: 1
};

const DEFAULT_CONFIG: CloseAtmosphereSpikeConfig = {
  copyHidden: true,
  fixedProgress: 0,
  live: false,
  quality: "high",
  tuning: DEFAULT_TUNING
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function readScalar(params: URLSearchParams, key: string, fallback: number) {
  const value = Number.parseFloat(params.get(key) ?? "");
  return Number.isFinite(value) ? Math.min(2, Math.max(0, value)) : fallback;
}

function readQuality(params: URLSearchParams): LandingQuality {
  const quality = params.get("quality");
  return quality === "auto" || quality === "high" || quality === "medium" || quality === "low"
    ? quality
    : "high";
}

function readConfig(): CloseAtmosphereSpikeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  const progress = Number.parseFloat(params.get("progress") ?? "0");
  const copy = params.get("copy");

  return {
    copyHidden: copy === "visible" ? false : true,
    fixedProgress: Number.isFinite(progress) ? clamp01(progress) : 0,
    live: params.get("live") === "1",
    quality: readQuality(params),
    tuning: {
      edgeGlowStrength: readScalar(params, "edge", DEFAULT_TUNING.edgeGlowStrength),
      verticalGradientStrength: readScalar(params, "gradient", DEFAULT_TUNING.verticalGradientStrength),
      depthShadowStrength: readScalar(params, "depth", DEFAULT_TUNING.depthShadowStrength),
      groundProjectionStrength: readScalar(params, "projection", DEFAULT_TUNING.groundProjectionStrength),
      cloudVolumeShadowStrength: readScalar(params, "cloudDepth", DEFAULT_TUNING.cloudVolumeShadowStrength)
    }
  };
}

export function LuBirthCloseAtmosphereSpikeRoute() {
  const [config, setConfig] = useState<CloseAtmosphereSpikeConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    setConfig(readConfig());
  }, []);

  useLayoutEffect(() => {
    window.__MiraLithOpeningProgress = config.fixedProgress;
  }, [config.fixedProgress]);

  const label = useMemo(
    () => `LuBirth close atmosphere spike ${config.fixedProgress.toFixed(2)}`,
    [config.fixedProgress]
  );

  return (
    <main
      className="lubirth-close-atmo-spike"
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-progress={config.fixedProgress}
      data-quality={config.quality}
      data-edge={config.tuning.edgeGlowStrength}
      data-gradient={config.tuning.verticalGradientStrength}
      data-depth={config.tuning.depthShadowStrength}
      data-projection={config.tuning.groundProjectionStrength}
      data-cloud-depth={config.tuning.cloudVolumeShadowStrength}
      aria-label={label}
      style={{ minHeight: "100svh", overflow: "hidden", background: "#000102" }}
    >
      {!config.copyHidden ? (
        <div className="lubirth-close-atmo-spike__hud" aria-hidden="true">
          <span>LuBirth close atmosphere</span>
          <span>{config.quality}</span>
          <span>{config.fixedProgress.toFixed(2)}</span>
        </div>
      ) : null}
      <VisualCanvas
        decorative
        dpr={config.quality === "high" ? [1.4, 1.8] : 1}
        fallback={
          <VisualCanvasFallback
            scene="lubirth"
            label={label}
            posterSrc="/assets/lubirth/poster-field.webp"
          />
        }
      >
        <LuBirthSceneSlot
          mode="field"
          quality={config.quality}
          paused={!config.live}
          cloudDeckEnabled
          visualDebugLayer="all"
          renderProfile="nasa"
          atmospherePolicy="stack"
          atmosphereVariant="stack"
          routeVariant="spike"
          productionSurface={false}
          closeAtmosphereTuning={config.tuning}
        />
      </VisualCanvas>
    </main>
  );
}
```

- [ ] **Step 3: Add the close route to spike freeze/location detection**

In `apps/site/visual/scenes/LuBirthSceneSlot.tsx`, add a route helper next to `isAtmosphereSpikeRoute` and `isCloudTruthSpikeRoute`:

```ts
function isCloseAtmosphereSpikeRoute() {
  return typeof window !== "undefined" && window.location.pathname.includes("/lubirth-close-atmosphere-spike");
}

function isLuBirthEvidenceSpikeRoute() {
  return isAtmosphereSpikeRoute() || isCloudTruthSpikeRoute() || isCloseAtmosphereSpikeRoute();
}
```

Use `isLuBirthEvidenceSpikeRoute()` in these places:

```ts
if (isLuBirthEvidenceSpikeRoute()) {
  return "birth";
}
```

```ts
const activeRouteVariant: LuBirthAtmosphereRouteVariant =
  routeVariant ?? (isLuBirthEvidenceSpikeRoute() ? "spike" : "study");
```

```ts
const freezeSpikeSolar =
  isLuBirthEvidenceSpikeRoute() &&
  !hasExplicitRuntimeSolarInput();
```

This ensures `/lubirth-close-atmosphere-spike` does not silently use IP geolocation or runtime solar state in `profile=nasa` default evidence captures.

- [ ] **Step 4: Forward the prop from `LuBirthSceneSlot`**

Add `closeAtmosphereTuning?: Partial<LandingCloseAtmosphereTuning>` to the local props in `apps/site/visual/scenes/LuBirthSceneSlot.tsx`, then pass it to `EarthMoonScene`.

- [ ] **Step 5: Verify the route compiles**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: pass after prop forwarding is complete.

---

## Task 3: Wire Tuning Through The Scene Without Touching Camera Math

**Files:**
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Modify: `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`
- Modify: `packages/lubirth-hero/src/LandingEarth.tsx`

- [ ] **Step 1: Create resolved defaults in `EarthMoonScene`**

Add a default constant near existing module constants:

```ts
const DEFAULT_CLOSE_ATMOSPHERE_TUNING = {
  edgeGlowStrength: 0,
  verticalGradientStrength: 0,
  depthShadowStrength: 0,
  groundProjectionStrength: 0,
  cloudVolumeShadowStrength: 0
};
```

Inside `EarthMoonScene`, resolve with `useMemo`:

```ts
const resolvedCloseAtmosphereTuning = useMemo(
  () => ({
    ...DEFAULT_CLOSE_ATMOSPHERE_TUNING,
    ...closeAtmosphereTuning
  }),
  [closeAtmosphereTuning]
);
```

- [ ] **Step 2: Resolve effective tuning and expose debug state**

Still inside `EarthMoonScene`, compute an effective version gated by quality:

```ts
const closeAtmosphereAllowed = quality.tier !== "low" && quality.tier !== "fallback";
const effectiveCloseAtmosphereTuning = useMemo(
  () => closeAtmosphereAllowed
    ? resolvedCloseAtmosphereTuning
    : DEFAULT_CLOSE_ATMOSPHERE_TUNING,
  [closeAtmosphereAllowed, resolvedCloseAtmosphereTuning]
);
```

Add a window debug state so tests can prove low/fallback actually disable the additions:

```ts
useEffect(() => {
  if (typeof window === "undefined") {
    return;
  }

  window.__MiraLithLuBirthCloseAtmosphereTuning = {
    allowed: closeAtmosphereAllowed,
    effective: effectiveCloseAtmosphereTuning,
    requested: resolvedCloseAtmosphereTuning
  };
}, [closeAtmosphereAllowed, effectiveCloseAtmosphereTuning, resolvedCloseAtmosphereTuning]);
```

Add the global declaration near the existing `declare global` block:

```ts
interface Window {
  __MiraLithLuBirthCloseAtmosphereTuning?: {
    allowed: boolean;
    effective: LandingCloseAtmosphereTuning;
    requested: LandingCloseAtmosphereTuning;
  };
}
```

- [ ] **Step 3: Pass effective tuning to atmosphere and Earth**

Pass `effectiveCloseAtmosphereTuning` to both:

```tsx
<LandingEarth
  ...
  closeAtmosphereTuning={effectiveCloseAtmosphereTuning}
/>
```

```tsx
<LandingAtmosphereStack
  ...
  closeAtmosphereTuning={effectiveCloseAtmosphereTuning}
/>
```

- [ ] **Step 4: Camera guard check**

Run:

```bash
git diff -- packages/lubirth-hero/src/EarthMoonScene.tsx packages/visual-core/src/theatre/openingTimeline.ts packages/visual-core/src/scroll/progressDriver.ts
```

Expected: the diff in `EarthMoonScene.tsx` only shows prop/default/tuning pass-through changes. There must be no changes to `camera.position`, `camera.lookAt`, `earthGroup.current.scale`, `frame.camera*`, `frame.earth*`, or `mapOpeningProgress`.

---

## Task 4: Improve Close Limb Glow And Vertical Gradient In The Stack

**Files:**
- Modify: `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`

- [ ] **Step 1: Add prop and uniforms**

Add `closeAtmosphereTuning?: Partial<LandingCloseAtmosphereTuning>` to `LandingAtmosphereStackProps` and `AtmosphereLayerProps`.

Add uniforms in `createAtmosphereStackMaterial`:

```ts
closeEdgeGlowStrength: { value: 0 },
closeVerticalGradientStrength: { value: 0 }
```

- [ ] **Step 2: Update the `surface-glow` shader logic**

In the `kind == 5` branch, keep existing variables and add a denser close-limb contribution:

```glsl
float closeEdgeStrength = closeEdgeGlowStrength;
float closeGradientStrength = closeVerticalGradientStrength;
float closeGroundDensity = exp(-outwardHeight * 10.0) * groundSideGate;
float closeUpperDensity = exp(-outwardHeight * 2.6) * groundSideGate;
float closeColumn = clamp(closeGroundDensity * 0.55 + closeUpperDensity * 0.45, 0.0, 1.0);
vec3 closeColumnBlue = mix(deepBlue, rayleighBlue, 0.42 + daySide * 0.28 + twilight * 0.08);
vec3 closeContactWhite = mix(whiteLineColor, vec3(0.86, 1.12, 1.54), 0.32);

color += closeColumnBlue * closeColumn * closeGradientStrength * (0.08 + daySide * 0.14) * shellReflectance;
color += closeContactWhite * closeGroundDensity * closeEdgeStrength * (0.018 + daySide * 0.045) * shellReflectance;
alpha += closeColumn * closeGradientStrength * (0.022 + daySide * 0.035);
alpha += closeGroundDensity * closeEdgeStrength * (0.008 + daySide * 0.016);
```

This keeps the effect inside the existing stack shader instead of adding a new pass.

- [ ] **Step 3: Update uniforms per frame**

In `useFrame`, set:

```ts
material.uniforms.closeEdgeGlowStrength.value =
  quality.tier === "low" || quality.tier === "fallback"
    ? 0
    : closeAtmosphereTuning?.edgeGlowStrength ?? 0;
material.uniforms.closeVerticalGradientStrength.value =
  quality.tier === "low" || quality.tier === "fallback"
    ? 0
    : closeAtmosphereTuning?.verticalGradientStrength ?? 0;
```

- [ ] **Step 4: Visual check**

Run the route:

```bash
pnpm --filter @miralith/site dev
```

Open:

```text
http://localhost:3000/lubirth-close-atmosphere-spike?progress=0&quality=high&edge=1&gradient=1&depth=0&projection=0&copy=visible
```

Expected: close limb gets a thin brighter contact line and a blue fade upward/outward. The black field should remain black, with no milky full-frame haze.

---

## Task 5: Productize Depth Shadow And Ground Projection In `LandingEarth`

**Files:**
- Modify: `packages/lubirth-hero/src/LandingEarth.tsx`

- [ ] **Step 1: Add prop and uniforms**

Add:

```ts
closeAtmosphereTuning?: Partial<LandingCloseAtmosphereTuning>;
```

Add uniforms:

```ts
closeDepthShadowStrength: { value: 0 },
closeGroundProjectionStrength: { value: 0 },
closeCloudVolumeShadowStrength: { value: 0 },
```

- [ ] **Step 2: Reuse existing depth-shadow math**

Near the existing `truthAtmosphereDepth` section, combine truth and close tuning:

```glsl
float closeDepthRequest = max(truthAtmosphereDepthStrength, closeDepthShadowStrength);
float closeGroundProjectionRequest = max(truthGroundShadowStrength, closeGroundProjectionStrength);
float closeCloudVolumeRequest = max(truthAtmosphereDepthStrength, closeCloudVolumeShadowStrength);
```

Use `closeDepthRequest` in the existing near-limb surface depth darkening:

```glsl
float closeAtmosphereDepth =
  closeDepthRequest *
  dayW *
  smoothstep(0.54, 0.92, fresnel) *
  (1.0 - smoothstep(0.972, 1.0, fresnel)) *
  (0.44 + lowSunShadow * 0.24 + cloudCoverageMix * 0.18);
daySurface = mix(
  daySurface,
  daySurface * vec3(0.50, 0.60, 0.76),
  clamp(closeAtmosphereDepth, 0.0, 0.34)
);
```

- [ ] **Step 3: Wire `cloudDepth` to concrete cloud volume expressions**

Use `closeCloudVolumeRequest` in the existing cloud alpha/depth/relief block so the `cloudDepth` URL knob cannot become a dead parameter.

Replace the `truthCloudAlpha` multiplier that currently uses `max(truthAtmosphereDepthStrength, truthGroundShadowStrength)` with:

```glsl
truthCloudAlpha *= mix(
  1.0,
  3.45,
  max(closeCloudVolumeRequest, closeGroundProjectionRequest) * (1.0 - truthLimbBlueTakeover * 0.68)
);
```

Replace the cloud height normal strength with:

```glsl
vec3 truthCloudHeightNormal = normalize(
  n -
  tangentA * truthCloudHeightDx * 5.8 * max(referenceCloudLook, closeCloudVolumeRequest) -
  tangentB * truthCloudHeightDy * 5.8 * max(referenceCloudLook, closeCloudVolumeRequest)
);
```

Replace the cloud depth shade multiplier with:

```glsl
float truthCloudDepthShade = clamp(
  (
    truthCloudColumnOcclusion * 0.7 +
    truthCloudForwardBlock * 0.68 +
    (1.0 - truthCloudBumpLight) * smoothstep(0.2, 0.82, truthCloudMass) * 0.74 +
    truthLowSunShadow * truthCloudCaster * 0.38 +
    smoothstep(0.52, 0.92, truthCloudMass) * 0.36
  ) * max(referenceCloudLook, closeCloudVolumeRequest * 0.92),
  0.0,
  0.92
);
```

This makes `cloudDepth=0` preserve the baseline cloud treatment while `cloudDepth=1` visibly increases cloud embedding/self-shadow in near-limb air.

- [ ] **Step 4: Reuse existing ground projection math**

Where `truthVisibleGroundShadow` and `truthBroadGroundProjection` are computed, replace request strength with `closeGroundProjectionRequest` while preserving the truth behavior:

```glsl
float closeRequestedGroundShadow =
  closeGroundProjectionRequest *
  dayW *
  smoothstep(0.14, 0.54, truthShadowColumn) *
  (1.0 - smoothstep(0.26, 0.74, truthCloudRaw) * 0.34) *
  (1.0 - smoothstep(0.78, 1.0, fresnel) * 0.62) *
  (0.64 + truthLowSunShadow * 0.56 + closeStage * 0.12);
truthVisibleGroundShadow = max(truthVisibleGroundShadow, closeRequestedGroundShadow);
```

- [ ] **Step 5: Gate low/fallback**

In `useFrame`, set close tuning uniforms to `0` when `quality.tier` is `"low"` or `"fallback"`:

```ts
const closeAtmosphereAllowed = quality.tier !== "low" && quality.tier !== "fallback";
earthMaterial.uniforms.closeDepthShadowStrength.value =
  closeAtmosphereAllowed ? closeAtmosphereTuning?.depthShadowStrength ?? 0 : 0;
earthMaterial.uniforms.closeGroundProjectionStrength.value =
  closeAtmosphereAllowed ? closeAtmosphereTuning?.groundProjectionStrength ?? 0 : 0;
earthMaterial.uniforms.closeCloudVolumeShadowStrength.value =
  closeAtmosphereAllowed ? closeAtmosphereTuning?.cloudVolumeShadowStrength ?? 0 : 0;
```

- [ ] **Step 6: Visual check**

Open:

```text
http://localhost:3000/lubirth-close-atmosphere-spike?progress=0&quality=high&edge=1&gradient=1&depth=1&projection=1&cloudDepth=1&copy=visible
```

Expected: near-limb surface has a slightly denser blue-gray atmospheric depth, clouds read as embedded in air, and projected cloud/ground shadow remains subtle rather than black.

---

## Task 6: Add Pixel Smoke And Invariant Tests

**Files:**
- Create: `tests/e2e/lubirth-close-atmosphere-spike.spec.ts`
- Modify: `tests/e2e/lubirth-revised.spec.ts`

- [ ] **Step 1: Add route and canvas sampling helpers**

Create `tests/e2e/lubirth-close-atmosphere-spike.spec.ts` with helpers that can compare all-off and all-on canvas pixels:

```ts
import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __MiraLithLuBirthAtmosphereVariant?: string;
    __MiraLithLuBirthCloseAtmosphereTuning?: {
      allowed: boolean;
      effective: {
        edgeGlowStrength: number;
        verticalGradientStrength: number;
        depthShadowStrength: number;
        groundProjectionStrength: number;
        cloudVolumeShadowStrength: number;
      };
      requested: {
        edgeGlowStrength: number;
        verticalGradientStrength: number;
        depthShadowStrength: number;
        groundProjectionStrength: number;
        cloudVolumeShadowStrength: number;
      };
    };
    __MiraLithLuBirthRuntimeLocation?: unknown;
    __MiraLithLuBirthVolumetricAtmosphereActive?: boolean;
  }
}

function closeAtmosphereUrl(params: Record<string, string>) {
  const url = new URLSearchParams({
    copy: "hidden",
    progress: "0",
    quality: "high",
    visualTest: "pixels",
    ...params
  });
  return `/lubirth-close-atmosphere-spike?${url.toString()}`;
}

async function waitForCloseScene(page: import("@playwright/test").Page) {
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereVariant), { timeout: 25_000 })
    .toBe("stack");
  await page.waitForTimeout(900);
}

async function sampleCanvasRegions(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const source = document.querySelector("canvas");
    if (!source) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 100;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const readRegion = (x0: number, y0: number, x1: number, y1: number) => {
      let r = 0;
      let g = 0;
      let b = 0;
      let luma = 0;
      let count = 0;
      for (let y = Math.floor(y0 * canvas.height); y < Math.floor(y1 * canvas.height); y += 1) {
        for (let x = Math.floor(x0 * canvas.width); x < Math.floor(x1 * canvas.width); x += 1) {
          const pixel = (y * canvas.width + x) * 4;
          const pr = data[pixel];
          const pg = data[pixel + 1];
          const pb = data[pixel + 2];
          r += pr;
          g += pg;
          b += pb;
          luma += 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
          count += 1;
        }
      }

      const safeCount = Math.max(count, 1);
      return {
        blue: b / safeCount,
        luma: luma / safeCount,
        red: r / safeCount,
        green: g / safeCount
      };
    };

    return {
      blackField: readRegion(0.72, 0.06, 0.96, 0.26),
      closeLimb: readRegion(0.08, 0.62, 0.58, 0.92),
      terrainBand: readRegion(0.18, 0.70, 0.70, 0.96),
      upperAtmosphere: readRegion(0.08, 0.48, 0.62, 0.68)
    };
  });
}
```

- [ ] **Step 2: Add deterministic route test**

This test proves the new route uses the same evidence freeze/location behavior as the old spike routes:

```ts
test("close atmosphere spike is deterministic by default", async ({ page }) => {
  const geoRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/api/lubirth-geo")) {
      geoRequests.push(url.pathname);
    }
  });

  await page.goto(closeAtmosphereUrl({
    cloudDepth: "1",
    depth: "1",
    edge: "1",
    gradient: "1",
    projection: "1"
  }));
  await waitForCloseScene(page);

  expect(geoRequests).toEqual([]);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthRuntimeLocation ?? null), { timeout: 10_000 })
    .toBeNull();
});
```

- [ ] **Step 3: Add all-off vs all-on pixel smoke**

This test fails if the shader tuning is disconnected or if the black field gets contaminated:

```ts
test("close atmosphere all-on changes limb pixels while preserving black field", async ({ page }) => {
  await page.goto(closeAtmosphereUrl({
    cloudDepth: "0",
    depth: "0",
    edge: "0",
    gradient: "0",
    projection: "0"
  }));
  await waitForCloseScene(page);
  const off = await sampleCanvasRegions(page);

  await page.goto(closeAtmosphereUrl({
    cloudDepth: "1",
    depth: "1",
    edge: "1",
    gradient: "1",
    projection: "1"
  }));
  await waitForCloseScene(page);
  const on = await sampleCanvasRegions(page);

  expect(off).not.toBeNull();
  expect(on).not.toBeNull();
  expect(on!.blackField.luma).toBeLessThanOrEqual(Math.max(12, off!.blackField.luma + 4));
  expect(on!.closeLimb.luma).toBeGreaterThan(off!.closeLimb.luma + 3);
  expect(on!.closeLimb.blue).toBeGreaterThan(off!.closeLimb.blue + 4);
  expect(on!.upperAtmosphere.blue).toBeGreaterThanOrEqual(off!.upperAtmosphere.blue);
  expect(Math.abs(on!.terrainBand.luma - off!.terrainBand.luma)).toBeLessThanOrEqual(42);
});
```

The numeric thresholds are first-pass guards. If the initial run fails narrowly, inspect the attached screenshot/evidence crop before changing shader code; update thresholds only with a short note in the decision record explaining the observed crop values.

- [ ] **Step 4: Add `cloudDepth=0/1` differential smoke**

This test proves `cloudVolumeShadowStrength` is not a dead parameter:

```ts
test("cloudDepth knob affects cloud volume treatment independently", async ({ page }) => {
  await page.goto(closeAtmosphereUrl({
    cloudDepth: "0",
    depth: "0",
    edge: "1",
    gradient: "1",
    projection: "0"
  }));
  await waitForCloseScene(page);
  const cloudOff = await sampleCanvasRegions(page);

  await page.goto(closeAtmosphereUrl({
    cloudDepth: "1",
    depth: "0",
    edge: "1",
    gradient: "1",
    projection: "0"
  }));
  await waitForCloseScene(page);
  const cloudOn = await sampleCanvasRegions(page);

  expect(cloudOff).not.toBeNull();
  expect(cloudOn).not.toBeNull();
  expect(Math.abs(cloudOn!.terrainBand.luma - cloudOff!.terrainBand.luma)).toBeGreaterThan(0.8);
  expect(Math.abs(cloudOn!.terrainBand.luma - cloudOff!.terrainBand.luma)).toBeLessThan(36);
});
```

- [ ] **Step 5: Add low-quality effective tuning gate**

This test checks the debug state, not only stack/volumetric status:

```ts
test("low quality disables effective close atmosphere additions", async ({ page }) => {
  await page.goto(closeAtmosphereUrl({
    cloudDepth: "2",
    depth: "2",
    edge: "2",
    gradient: "2",
    projection: "2",
    quality: "low"
  }));
  await waitForCloseScene(page);

  const state = await page.evaluate(() => ({
    tuning: window.__MiraLithLuBirthCloseAtmosphereTuning,
    volumetric: window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false
  }));

  expect(state.volumetric).toBe(false);
  expect(state.tuning?.allowed).toBe(false);
  expect(state.tuning?.requested.edgeGlowStrength).toBe(2);
  expect(state.tuning?.effective.edgeGlowStrength).toBe(0);
  expect(state.tuning?.effective.verticalGradientStrength).toBe(0);
  expect(state.tuning?.effective.depthShadowStrength).toBe(0);
  expect(state.tuning?.effective.groundProjectionStrength).toBe(0);
  expect(state.tuning?.effective.cloudVolumeShadowStrength).toBe(0);
});
```

- [ ] **Step 6: Add production leakage guard**

In `tests/e2e/lubirth-revised.spec.ts`, add or update a production assertion that `/lubirth-revised` does not receive close-atmosphere tuning unless production promotion happens in Task 8:

```ts
const tuning = await page.evaluate(() => window.__MiraLithLuBirthCloseAtmosphereTuning);
expect(tuning?.effective.edgeGlowStrength ?? 0).toBe(0);
expect(tuning?.effective.verticalGradientStrength ?? 0).toBe(0);
expect(tuning?.effective.depthShadowStrength ?? 0).toBe(0);
expect(tuning?.effective.groundProjectionStrength ?? 0).toBe(0);
expect(tuning?.effective.cloudVolumeShadowStrength ?? 0).toBe(0);
```

The test should also keep asserting `volumetric` remains inactive by default. It should not assert pixel-perfect camera values.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm exec playwright test tests/e2e/lubirth-close-atmosphere-spike.spec.ts --project=desktop --workers=1
```

Expected: all new close-atmosphere route tests pass.

---

## Task 7: Visual Evidence And Performance Check

**Files:**
- Modify: `tests/e2e/lubirth-atmosphere-performance.spec.ts`
- Create screenshots under: `screenshots/lubirth-close-atmosphere-polish-20260512/`

- [ ] **Step 1: Capture evidence frames**

Capture these URLs at desktop:

```text
/lubirth-close-atmosphere-spike?progress=0&quality=high&edge=1&gradient=1&depth=1&projection=1&cloudDepth=1&copy=hidden
/lubirth-close-atmosphere-spike?progress=0.5&quality=high&edge=1&gradient=1&depth=1&projection=1&cloudDepth=1&copy=hidden
/lubirth-close-atmosphere-spike?progress=1&quality=high&edge=1&gradient=1&depth=1&projection=1&cloudDepth=1&copy=hidden
/lubirth-close-atmosphere-spike?progress=0&quality=medium&edge=1&gradient=1&depth=1&projection=1&cloudDepth=1&copy=hidden
/lubirth-close-atmosphere-spike?progress=0&quality=low&edge=2&gradient=2&depth=2&projection=2&cloudDepth=2&copy=hidden
```

- [ ] **Step 2: Review against visual criteria**

Pass criteria:

- Thin blue-white contact line visible on close limb.
- Blue atmospheric shelf fades outward/upward rather than filling black space.
- Surface texture and cloud texture remain readable.
- Ground/cloud projection is visible but not black.
- Moon remains uncontaminated.
- Mobile/low quality path does not enable heavy depth/projection additions.

- [ ] **Step 3: Run typecheck and route tests**

Run:

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/lubirth-close-atmosphere-spike.spec.ts --project=desktop --workers=1
```

- [ ] **Step 4: Add mandatory close-route RAF samples**

In `tests/e2e/lubirth-atmosphere-performance.spec.ts`, add recorder rows for:

```text
/lubirth-close-atmosphere-spike?quality=high&progress=0&edge=1&gradient=1&depth=1&projection=1&cloudDepth=1&copy=hidden&perfTest=raf
/lubirth-close-atmosphere-spike?quality=low&progress=0&edge=2&gradient=2&depth=2&projection=2&cloudDepth=2&copy=hidden&perfTest=raf
```

Expected variants:

- high all-on: `stack`
- low high-intensity fallback: `stack`, with `window.__MiraLithLuBirthCloseAtmosphereTuning.effective` all zeros

The promotion gate must include these rows. Do not rely only on the older `/lubirth-atmosphere-spike` and production route samples, because they do not prove the new close-atmosphere shader path is covered.

- [ ] **Step 5: Record RAF performance**

Run:

```bash
pnpm exec playwright test tests/e2e/lubirth-atmosphere-performance.spec.ts --project=desktop --workers=1
```

Expected: recorder completes and prints close-route high and low rows. Treat low sample counts as invalid promotion evidence, following the existing atmosphere decision record; do not promote production tuning without valid close-route samples or an explicit documented blocker.

---

## Task 8: Promotion Decision

**Files:**
- Modify only after evidence passes: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify only after evidence passes: `packages/lubirth-hero/src/presets.ts` or a new exported close-atmosphere preset object
- Document: `docs/lubirth-close-atmosphere-polish/DECISION.md`

- [ ] **Step 1: Select production values**

Start with:

```ts
const LUBIRTH_CLOSE_ATMOSPHERE_PRODUCTION_TUNING = {
  edgeGlowStrength: 1,
  verticalGradientStrength: 1,
  depthShadowStrength: 0.72,
  groundProjectionStrength: 0.82,
  cloudVolumeShadowStrength: 0.72
};
```

Only lower values during review; do not raise above `1` for production without fresh screenshots.

- [ ] **Step 2: Keep production stack default**

If promoted, pass the production tuning only when:

- route is production `home` or `study`,
- resolved atmosphere variant remains `stack`,
- quality tier is `high` or `medium`,
- not fallback,
- not low quality.

- [ ] **Step 3: Write decision record**

Create `docs/lubirth-close-atmosphere-polish/DECISION.md` with:

- screenshot directory,
- selected tuning values,
- pass/fail notes for each visual criterion,
- deterministic route evidence: no geo request and empty runtime location on the close spike route,
- pixel smoke results for all-off vs all-on and `cloudDepth=0/1`,
- close-route RAF rows for high all-on and low high-intensity fallback,
- typecheck/test commands and results,
- explicit statement that camera angle and scroll zoom choreography were not changed.

---

## Dependency Map

```text
Task 1 types
  -> Task 2 route and scene slot prop
  -> Task 3 scene pass-through
    -> Task 4 stack glow/gradient
    -> Task 5 Earth depth/projection
      -> Task 6 tests
      -> Task 7 evidence/performance
        -> Task 8 production promotion decision
```

## Risks And Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Camera or scroll choreography changes accidentally | High | Medium | Review `git diff` against `EarthMoonScene.tsx` and `openingTimeline.ts`; no camera/scale/progress math changes allowed |
| New close spike route uses runtime location/solar state | High | Medium | Add `isCloseAtmosphereSpikeRoute()` to shared evidence spike detection; test that no `/api/lubirth-geo` request occurs and runtime location stays empty |
| Blue shelf washes out terrain | High | Medium | Keep depth shadow and gradient strengths separate; cap production values at `1`; screenshot close/transition/far |
| Black field gets milky | High | Medium | Keep stack alpha ceiling conservative; pixel sample black-field crops |
| Pixel smoke only proves the route mounted | High | Medium | Compare all-off vs all-on canvas crop samples for black field, close limb, upper atmosphere, and terrain/cloud band |
| `cloudDepth` parameter has no effect | High | Medium | Wire it to cloud alpha, cloud height normal strength, and cloud depth shade; add `cloudDepth=0/1` differential test |
| Ground projection looks like dirty texture | Medium | Medium | Fade by day side, fresnel, cloud alpha, and low-sun gate; avoid full shadow maps |
| Mobile/low performance regression | High | Medium | Set all close-depth/projection uniforms to `0` on low/fallback; assert effective debug tuning is zero; include low high-intensity RAF row |
| Multiple final render passes conflict | High | Low | Do not add a new fullscreen pass for production in this plan |

## Definition Of Done

- New route exists and renders with the existing camera/scroll choreography.
- New route is deterministic by default: no IP location request, no runtime visitor location, and frozen spike solar/location behavior.
- `LandingAtmosphereStack` produces a cleaner close limb glow and vertical density gradient.
- `LandingEarth` applies subtle atmospheric depth and ground projection without crushing surface readability.
- `cloudDepth=0/1` produces a bounded pixel difference, proving the cloud-depth knob is connected.
- Low/fallback quality disables new heavy close-atmosphere strengths.
- Playwright route, deterministic, all-off/all-on pixel, cloudDepth differential, and low-effective-tuning tests pass.
- Evidence screenshots exist for progress `0`, `0.5`, `1`, medium, and low.
- RAF recorder includes mandatory close-route high all-on and low high-intensity rows.
- Decision record states whether the tuned values remain spike-only or are safe for production stack.
