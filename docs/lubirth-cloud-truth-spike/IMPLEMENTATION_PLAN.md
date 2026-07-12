# LuBirth Cloud Truth Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/lubirth-cloud-truth-spike` route, based on the current homepage LuBirth scene, to tune three first-glance realism cues: atmospheric edge, cloud volume thickness shadow, and ground-projected cloud shadow.

**Architecture:** Keep production home untouched while the spike route exercises the same `LuBirthSceneSlot -> EarthMoonScene -> LandingEarth / LandingCloudLayer / LandingAtmosphereStack` path used by the homepage. Add a narrow `LandingCloudTruthMode` switch that gates only the three candidate effects, so visual evidence can compare `baseline`, `edge`, `volume`, `shadow`, and `all` without promoting heavy volumetric raymarching.

**Tech Stack:** Next.js App Router, React, R3F, Three.js shader materials, Playwright visual/e2e evidence, existing LuBirth quality and route infrastructure.

---

状态：Implementation plan v0.1  
日期：2026-05-11  
范围：只新增独立 route 和候选效果开关；不替换主页；不引入外部 runtime；不复制 reference shader 源码。

## 1. Visual Contract

这条 spike 的目标不是物理全真，而是第一眼像摄影：

- **Atmospheric edge:** 2-5px white/cyan contact line, 10-22px restrained blue shelf, no broad blue/pink haze in copy area.
- **Volume thickness shadow:** cloud tops, body, and underside read at first glance; clouds stop looking like a flat white texture.
- **Ground projection shadow:** soft offset shadow on lit surface only; shadow explains cloud height but never dirties continents.

The route must default to a strong review frame:

```text
/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0&copy=hidden
```

Allowed query values:

```ts
type LandingCloudTruthMode = "baseline" | "edge" | "volume" | "shadow" | "all";
type LandingQuality = "auto" | "high" | "medium" | "low";
```

## 2. Non-Goals

- Do not enable `LandingVolumetricAtmospherePass` on the homepage.
- Do not change `/` or `/lubirth-revised` default behavior during this spike.
- Do not add Babylon, Leva, raw-loader, remote texture URLs, blue-noise CDN assets, or new package dependencies.
- Do not load `earth-cloud-deck-4k.webp` on this route by default.
- Do not use the old full-screen cloud raymarch as production code.
- Do not alter CoScroll, RadioGaga, or unrelated visual routes.

## 3. File Map

Create:

- `apps/site/app/lubirth-cloud-truth-spike/page.tsx`  
  Next route entry and metadata.

- `apps/site/components/LuBirthCloudTruthSpikeRoute.tsx`  
  Client route controller. Reads query params, sets fixed opening progress, renders one production-owned `VisualCanvas`, and passes `cloudTruthMode` into `LuBirthSceneSlot`.

- `tests/e2e/lubirth-cloud-truth-spike.spec.ts`  
  Route smoke, mode parsing, quality fallback, canvas pixel smoke, and evidence screenshot hooks.

Modify:

- `packages/lubirth-hero/src/types.ts`  
  Add and export `LandingCloudTruthMode`.

- `packages/lubirth-hero/src/index.ts`  
  Re-export the new type.

- `apps/site/visual/scenes/LuBirthSceneSlot.tsx`  
  Accept `cloudTruthMode`, pass it to `EarthMoonScene`, and expose debug globals for tests.

- `packages/lubirth-hero/src/EarthMoonScene.tsx`  
  Accept `cloudTruthMode` and pass targeted booleans to `LandingAtmosphereStack`, `LandingCloudLayer`, and `LandingEarth`.

- `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`  
  Add production-safe `edge` candidate layers when `cloudTruthMode` is `edge` or `all`.

- `packages/lubirth-hero/src/LandingCloudLayer.tsx`  
  Add a `truthVolumeStrength` uniform to make existing thickness / underside cues visible in `volume` or `all`.

- `packages/lubirth-hero/src/LandingEarth.tsx`  
  Add a `truthGroundShadowStrength` uniform to strengthen existing cloud shadow projection in `shadow` or `all`.

## 4. Task 1: Route Shell

**Files:**

- Create: `apps/site/app/lubirth-cloud-truth-spike/page.tsx`
- Create: `apps/site/components/LuBirthCloudTruthSpikeRoute.tsx`

- [ ] **Step 1: Add the route page**

Create `apps/site/app/lubirth-cloud-truth-spike/page.tsx`:

```tsx
import { LuBirthCloudTruthSpikeRoute } from "../../components/LuBirthCloudTruthSpikeRoute";

export const metadata = {
  title: "LuBirth Cloud Truth Spike | MiraLith",
  description: "Standalone LuBirth cloud and atmospheric realism spike."
};

export default function LuBirthCloudTruthSpikePage() {
  return <LuBirthCloudTruthSpikeRoute />;
}
```

- [ ] **Step 2: Add the client route controller**

Create `apps/site/components/LuBirthCloudTruthSpikeRoute.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { LandingCloudTruthMode } from "@miralith/lubirth-hero";
import type { LandingQuality } from "@miralith/visual-core";
import { VisualCanvas } from "../visual/VisualCanvas";
import { VisualCanvasFallback } from "../visual/VisualCanvasFallback";
import { LuBirthSceneSlot } from "../visual/scenes/LuBirthSceneSlot";

interface CloudTruthSpikeConfig {
  cloudTruthMode: LandingCloudTruthMode;
  copyHidden: boolean;
  fixedProgress: number;
  quality: LandingQuality;
  paused: boolean;
}

const DEFAULT_CONFIG: CloudTruthSpikeConfig = {
  cloudTruthMode: "all",
  copyHidden: true,
  fixedProgress: 0,
  quality: "high",
  paused: true
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function readMode(params: URLSearchParams): LandingCloudTruthMode {
  const mode = params.get("mode");
  return mode === "baseline" || mode === "edge" || mode === "volume" || mode === "shadow" || mode === "all"
    ? mode
    : "all";
}

function readQuality(params: URLSearchParams): LandingQuality {
  const quality = params.get("quality");
  return quality === "auto" || quality === "high" || quality === "medium" || quality === "low"
    ? quality
    : "high";
}

function readConfig(): CloudTruthSpikeConfig {
  if (typeof window === "undefined") {
    return DEFAULT_CONFIG;
  }

  const params = new URLSearchParams(window.location.search);
  const progress = Number.parseFloat(params.get("progress") ?? "0");
  const copy = params.get("copy");
  const live = params.get("live") === "1";

  return {
    cloudTruthMode: readMode(params),
    copyHidden: copy === "visible" ? false : true,
    fixedProgress: Number.isFinite(progress) ? clamp01(progress) : 0,
    quality: readQuality(params),
    paused: !live
  };
}

export function LuBirthCloudTruthSpikeRoute() {
  const [config, setConfig] = useState<CloudTruthSpikeConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const nextConfig = readConfig();
    setConfig(nextConfig);
    window.__MiraLithOpeningProgress = nextConfig.fixedProgress;
  }, []);

  const label = useMemo(
    () => `LuBirth cloud truth spike: ${config.cloudTruthMode}`,
    [config.cloudTruthMode]
  );

  return (
    <main
      className="lubirth-cloud-truth-spike"
      data-cloud-truth-mode={config.cloudTruthMode}
      data-copy={config.copyHidden ? "hidden" : "visible"}
      data-progress={config.fixedProgress}
      aria-label={label}
      style={{ minHeight: "100svh", overflow: "hidden", background: "#000307" }}
    >
      {!config.copyHidden ? (
        <div className="lubirth-cloud-truth-spike__hud" aria-hidden="true">
          <span>LuBirth cloud truth spike</span>
          <span>{config.cloudTruthMode}</span>
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
          paused={config.paused}
          cloudDeckEnabled={config.cloudTruthMode !== "baseline"}
          visualDebugLayer="all"
          renderProfile="nasa"
          atmospherePolicy="stack"
          routeVariant="spike"
          productionSurface={false}
          cloudTruthMode={config.cloudTruthMode}
        />
      </VisualCanvas>
    </main>
  );
}
```

- [ ] **Step 3: Run typecheck and capture the expected failure**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript fails because `LandingCloudTruthMode` and `cloudTruthMode` props do not exist yet.

## 5. Task 2: Mode Type And Prop Plumbing

**Files:**

- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/index.ts`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`

- [ ] **Step 1: Add the shared type**

In `packages/lubirth-hero/src/types.ts`, add near the other visual mode exports:

```ts
export type LandingCloudTruthMode = "baseline" | "edge" | "volume" | "shadow" | "all";
```

- [ ] **Step 2: Re-export the type**

In `packages/lubirth-hero/src/index.ts`, add the type to the existing type export block:

```ts
export type { LandingCloudTruthMode } from "./types";
```

- [ ] **Step 3: Add slot props and debug globals**

In `apps/site/visual/scenes/LuBirthSceneSlot.tsx`, import the type:

```ts
import type {
  LandingCloudTruthMode,
  LandingAssetManifest,
  LandingAtmosphereLook,
  LandingAtmospherePolicy,
  LandingAtmosphereVariant,
  LandingAuroraProfile,
  LandingCompositionOverrides,
  EarthMoonHeroMode,
  LandingLocationConfig,
  LandingMoonLightingMode,
  LandingMoonPhase,
  LandingRenderProfile,
  LandingVisualDebugLayer,
  LuBirthAtmosphereRouteVariant,
  LuBirthProjectionFrame
} from "@miralith/lubirth-hero";
```

Extend the global window interface:

```ts
__MiraLithLuBirthCloudTruthMode?: LandingCloudTruthMode;
```

Extend `LuBirthSceneSlotProps`:

```ts
cloudTruthMode?: LandingCloudTruthMode;
```

Destructure with default:

```ts
cloudTruthMode = "baseline",
```

Inside the existing `useLayoutEffect`, set:

```ts
window.__MiraLithLuBirthCloudTruthMode = cloudTruthMode;
```

Pass into `EarthMoonScene`:

```tsx
cloudTruthMode={cloudTruthMode}
```

- [ ] **Step 4: Add scene props and derived booleans**

In `packages/lubirth-hero/src/EarthMoonScene.tsx`, import `LandingCloudTruthMode` and add to `EarthMoonSceneProps`:

```ts
cloudTruthMode?: LandingCloudTruthMode;
```

Destructure with default:

```ts
cloudTruthMode = "baseline"
```

Add derived booleans:

```ts
const cloudTruthEdge = cloudTruthMode === "edge" || cloudTruthMode === "all";
const cloudTruthVolume = cloudTruthMode === "volume" || cloudTruthMode === "all";
const cloudTruthShadow = cloudTruthMode === "shadow" || cloudTruthMode === "all";
```

Pass to child components:

```tsx
<LandingEarth
  ...
  truthGroundShadowStrength={cloudTruthShadow ? 1 : 0}
/>

<LandingCloudLayer
  ...
  truthVolumeStrength={cloudTruthVolume ? 1 : 0}
/>

{showAtmosphereStack ? (
  <LandingAtmosphereStack
    ...
    truthEdgeStrength={cloudTruthEdge ? 1 : 0}
  />
) : null}
```

- [ ] **Step 5: Run typecheck and capture the expected failure**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript fails because `truthGroundShadowStrength`, `truthVolumeStrength`, and `truthEdgeStrength` props do not exist yet.

## 6. Task 3: Atmospheric Edge Candidate

**Files:**

- Modify: `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`

- [ ] **Step 1: Add prop and production candidate layers**

Extend `LandingAtmosphereStackProps`:

```ts
truthEdgeStrength?: number;
```

Destructure with default in `LandingAtmosphereStack` and `AtmosphereLayer`:

```ts
truthEdgeStrength = 0
```

Add a candidate layer set:

```ts
const TRUTH_EDGE_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "surface-glow", radius: 1.048, renderOrder: 11 },
  { kind: "inner-white", radius: 1.0019, renderOrder: 13 },
  { kind: "blue-thickness", radius: 1.0034, renderOrder: 15 }
];
```

Resolve layers:

```ts
const layers = truthEdgeStrength > 0
  ? TRUTH_EDGE_LAYERS
  : !emphasis
    ? PRODUCTION_LAYERS
    : quality.tier === "high"
      ? HIGH_LAYERS
      : quality.tier === "medium"
        ? MEDIUM_LAYERS
        : LOW_LAYERS;
```

- [ ] **Step 2: Add a uniform and clamp the effect**

In `createAtmosphereStackMaterial`, add:

```ts
truthEdgeStrength: { value: 0 },
```

In the fragment shader, add:

```glsl
uniform float truthEdgeStrength;
```

Apply it only to the candidate edge layers:

```glsl
float truthEdgeGain = mix(1.0, 1.18, truthEdgeStrength);
float truthEdgeAlphaGain = mix(1.0, 1.36, truthEdgeStrength);

if (kind == 0) {
  color = whiteLineColor * innerWhite * (0.54 + daySide * 0.86) * shellReflectance * truthEdgeGain;
  alpha = innerWhite * 0.032 * innerWhiteStrength * mix(0.76, 1.08, shellReflectance - 0.48) * truthEdgeAlphaGain;
} else if (kind == 2) {
  color = rayleighBlue * blueThickness * (0.22 + daySide * 0.68) * shellReflectance * truthEdgeGain;
  alpha = blueThickness * 0.04 * blueThicknessStrength * mix(0.76, 1.1, shellReflectance - 0.48) * truthEdgeAlphaGain;
}
```

Update `useFrame`:

```ts
material.uniforms.truthEdgeStrength.value = truthEdgeStrength;
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript still fails only for the cloud and earth candidate props not yet added.

## 7. Task 4: Cloud Volume Thickness Candidate

**Files:**

- Modify: `packages/lubirth-hero/src/LandingCloudLayer.tsx`

- [ ] **Step 1: Add prop and uniform**

Extend `LandingCloudLayerProps`:

```ts
truthVolumeStrength?: number;
```

Destructure:

```ts
truthVolumeStrength = 0
```

In `createCloudMaterial`, add:

```ts
truthVolumeStrength: { value: 0 },
```

In the fragment shader uniforms:

```glsl
uniform float truthVolumeStrength;
```

- [ ] **Step 2: Strengthen existing thickness cues**

Near the existing `volumeMass`, `volumeSelfShadow`, `cloudTopLight`, and `cloudSlopeShadow` calculations, add:

```glsl
float truthVolumeGate =
  truthVolumeStrength *
  visibleCloudGate *
  smoothstep(0.18, 0.82, max(max(rawSharp, deckThickness), volumeColumn * 0.36));

volumeMass = max(volumeMass, truthVolumeGate * (0.48 + limb * 0.34));
float truthUndersideShadow =
  truthVolumeGate *
  smoothstep(0.16, 0.86, 1.0 - cloudTopLight) *
  (0.28 + limb * 0.22);
float truthTopCap =
  truthVolumeGate *
  smoothstep(0.56, 0.98, cloudTopLight) *
  sunlitCloud *
  (0.12 + closeStage * 0.08);
```

Blend into final cloud color near the existing cloud color assembly:

```glsl
finalColor = mix(finalColor, finalColor * vec3(0.48, 0.58, 0.74), clamp(truthUndersideShadow, 0.0, 0.58));
finalColor += vec3(0.78, 0.88, 1.0) * truthTopCap;
alpha += truthVolumeGate * opacity * shellOpacity * 0.035;
```

Use the local variable names that already exist in the current shader. If `finalColor` is named differently in the final file, apply the same math to that route's final cloud color variable.

- [ ] **Step 3: Update useFrame**

Inside the child material loop:

```ts
cloudMaterial.uniforms.truthVolumeStrength.value =
  quality.tier === "low" || quality.tier === "fallback" ? 0 : truthVolumeStrength;
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: TypeScript still fails only for `truthGroundShadowStrength` in `LandingEarth`.

## 8. Task 5: Ground Projection Shadow Candidate

**Files:**

- Modify: `packages/lubirth-hero/src/LandingEarth.tsx`

- [ ] **Step 1: Add prop and uniform**

Extend `LandingEarthProps`:

```ts
truthGroundShadowStrength?: number;
```

Destructure:

```ts
truthGroundShadowStrength = 0
```

In material uniforms, add:

```ts
truthGroundShadowStrength: { value: truthGroundShadowStrength },
```

In the fragment shader uniforms:

```glsl
uniform float truthGroundShadowStrength;
```

- [ ] **Step 2: Strengthen existing projected shadow without dirtying the planet**

Near the existing `visibleCloudShadow` and `directVisibleShadow` logic, add:

```glsl
float truthShadowSurfaceGate =
  truthGroundShadowStrength *
  dayW *
  smoothstep(-0.08, 0.46, ndl) *
  (1.0 - smoothstep(0.18, 0.72, visibleCloudCore) * 0.52);

float truthProjectedShadow =
  directShadowCaster *
  truthShadowSurfaceGate *
  (0.12 + lowSunShadow * 0.16 + closeStage * 0.035);

float truthBroadShadow =
  broadDirectionalShadow *
  truthGroundShadowStrength *
  (0.38 + lowSunShadow * 0.32);

visibleCloudShadow = max(visibleCloudShadow, truthProjectedShadow);
visibleCloudShadow = max(visibleCloudShadow, truthBroadShadow);
```

Clamp the color impact:

```glsl
daySurface = mix(
  daySurface,
  daySurface * vec3(0.68, 0.76, 0.88),
  clamp(visibleCloudShadow * mix(0.34, 0.44, truthGroundShadowStrength), 0.0, 0.22)
);
```

- [ ] **Step 3: Update useFrame**

Set the uniform:

```ts
earthMaterial.uniforms.truthGroundShadowStrength.value =
  quality.tier === "low" || quality.tier === "fallback" ? 0 : truthGroundShadowStrength;
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

## 9. Task 6: E2E Evidence

**Files:**

- Create: `tests/e2e/lubirth-cloud-truth-spike.spec.ts`

- [ ] **Step 1: Add route smoke tests**

Create `tests/e2e/lubirth-cloud-truth-spike.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("cloud truth spike renders one production canvas with stack atmosphere", async ({ page }) => {
  await page.goto("/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0&copy=hidden");

  await expect(page.locator(".lubirth-cloud-truth-spike")).toHaveAttribute("data-cloud-truth-mode", "all");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudTruthMode), { timeout: 25_000 })
    .toBe("all");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false), { timeout: 25_000 })
    .toBe(false);
});

test("cloud truth baseline does not request cloud deck", async ({ page }) => {
  const requests = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/assets/lubirth/")) {
      requests.add(url.pathname);
    }
  });

  await page.goto("/lubirth-cloud-truth-spike?mode=baseline&quality=high&progress=0&copy=hidden");
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.waitForTimeout(900);

  expect(Array.from(requests).filter((path) => path.includes("earth-cloud-deck-2k.png"))).toEqual([]);
});

test("cloud truth low quality keeps candidate cloud effects disabled", async ({ page }) => {
  await page.goto("/lubirth-cloud-truth-spike?mode=all&quality=low&progress=0&copy=hidden");

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudTruthMode), { timeout: 25_000 })
    .toBe("all");
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] **Step 2: Add screenshot evidence test**

Append:

```ts
for (const mode of ["baseline", "edge", "volume", "shadow", "all"] as const) {
  test(`captures cloud truth evidence for ${mode}`, async ({ page }, testInfo) => {
    await page.goto(`/lubirth-cloud-truth-spike?mode=${mode}&quality=high&progress=0&copy=hidden&visualTest=pixels`);
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect
      .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
      .toBe("high");
    await page.waitForTimeout(1200);

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`cloud-truth-${mode}-progress0.png`, {
      body: screenshot,
      contentType: "image/png"
    });
  });
}
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm exec playwright test tests/e2e/lubirth-cloud-truth-spike.spec.ts
```

Expected: PASS with screenshot attachments.

## 10. Task 7: Homepage Guard

**Files:**

- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: Add explicit guard that the homepage is not promoted**

In `tests/e2e/miralith.spec.ts`, add to the homepage first-screen budget test or create an adjacent test:

```ts
test("homepage does not enable cloud truth spike mode by default", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__MiraLithFirstUsableAt, null, { timeout: 20_000 });

  const state = await page.evaluate(() => ({
    cloudTruthMode: window.__MiraLithLuBirthCloudTruthMode,
    volumetric: window.__MiraLithLuBirthVolumetricAtmosphereActive ?? false
  }));

  expect(state.cloudTruthMode).toBe("baseline");
  expect(state.volumetric).toBe(false);
});
```

- [ ] **Step 2: Run the homepage guard**

Run:

```bash
pnpm exec playwright test tests/e2e/miralith.spec.ts -g "cloud truth|first screen transfer budget"
```

Expected: PASS. The existing first-screen transfer budget remains below `3_000_000` and still has zero `earth-cloud-deck-2k.png` requests before first usable.

## 11. Acceptance Gates

The spike is ready for visual review when:

- `/lubirth-cloud-truth-spike?mode=baseline&quality=high&progress=0&copy=hidden` renders the current baseline.
- `/lubirth-cloud-truth-spike?mode=edge&quality=high&progress=0&copy=hidden` shows a thinner, cleaner atmospheric edge without broad haze.
- `/lubirth-cloud-truth-spike?mode=volume&quality=high&progress=0&copy=hidden` shows distinguishable cloud top/body/underside.
- `/lubirth-cloud-truth-spike?mode=shadow&quality=high&progress=0&copy=hidden` shows soft offset ground shadows without dirtying land.
- `/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0&copy=hidden` combines the three cues as one lighting event.
- `quality=low` still avoids candidate cloud deck and shadow heaviness.
- `/` remains unchanged and passes first-screen transfer budget.

## 12. Visual Review Matrix

Capture these before any homepage promotion discussion:

| Route | Purpose |
| --- | --- |
| `/lubirth-cloud-truth-spike?mode=baseline&quality=high&progress=0&copy=hidden` | current baseline |
| `/lubirth-cloud-truth-spike?mode=edge&quality=high&progress=0&copy=hidden` | atmospheric edge only |
| `/lubirth-cloud-truth-spike?mode=volume&quality=high&progress=0&copy=hidden` | cloud thickness only |
| `/lubirth-cloud-truth-spike?mode=shadow&quality=high&progress=0&copy=hidden` | ground shadow only |
| `/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0&copy=hidden` | combined candidate |
| `/lubirth-cloud-truth-spike?mode=all&quality=medium&progress=0&copy=hidden` | realistic homepage-like performance tier |
| `/lubirth-cloud-truth-spike?mode=all&quality=low&progress=0&copy=hidden` | fallback safety |
| `/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0.5&copy=hidden` | transition frame |
| `/lubirth-cloud-truth-spike?mode=all&quality=high&progress=1&copy=hidden` | far frame |

## 13. Promotion Rule

This plan does not promote anything to the homepage. Promotion requires a later plan and a separate decision note. Minimum promotion evidence:

- Side-by-side screenshot review against baseline.
- `pnpm typecheck` passing.
- `pnpm exec playwright test tests/e2e/lubirth-cloud-truth-spike.spec.ts` passing.
- `pnpm exec playwright test tests/e2e/miralith.spec.ts -g "first screen transfer budget|cloud truth"` passing.
- No new first-screen request for `earth-cloud-deck-2k.png` on `/`.
- Owner approval that the visual reads more photographed, not more shader-heavy.

