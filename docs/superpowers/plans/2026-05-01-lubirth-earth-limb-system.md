# LuBirth Earth Limb System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the currently underwhelming LuBirth Earth-limb visual path with a production 3D limb system: clear Earth grazing rim, thin white line, thick blue atmosphere, restrained Karman/airglow, and low-alpha aurora.

**Architecture:** The previous projected-horizon direction remains useful for loading geometry and isolated debugging, but it has repeatedly failed as the final visual path. This plan makes a real R3F/Three 3D shell stack the production path, keeps the Earth surface opaque and sharp, and uses quality-tier gates to avoid mobile overload. `profile=nasa` becomes the production look; `profile=clean` preserves the old Earth/Moon-only view.

**Tech Stack:** Next.js 16 App Router, React 19, Three 0.184, React Three Fiber 9, TypeScript 6, Playwright, existing `@miralith/lubirth-hero` and `@miralith/visual-core` packages.

---

## Context And Direction Change

The current code already contains Earth, Moon, stars, clouds, atmosphere, airglow, aurora, and projected horizon composite code. The problem is not missing code; the problem is that the visual layers do not reliably become a visible, high-quality production frame.

This plan intentionally changes the production path:

- `LandingProjectedHorizonComposite` remains available for loading/debug overlays, but it is no longer the main answer for the final atmospheric look.
- `EarthMoonScene` gets an explicit `renderProfile` so debug isolation and production rendering stop sharing one overloaded `visualDebugLayer` flag.
- `profile=nasa` renders the real 3D stack by default: Earth surface, surface rim, atmosphere stack, and aurora.
- `profile=clean` keeps the current simple Earth/Moon-only look for regression comparisons and screenshot baselines.
- First pass does not add FBO blur, bloom, or a heavy scattering library.

## Apple Idle Asset Reference Findings

Reference folder inspected with `ffprobe` / `ffmpeg`:

```text
/Library/Application Support/com.apple.idleassetsd/Customer/4KSDR240FPS
```

The four local references are 3840x2160 HEVC Main 10, BT.709 SDR, sRGB transfer, at approximately 239.76fps. This matters: their refinement comes from very smooth temporal sampling, 10-bit gradients, disciplined exposure, and real Earth surface detail.

Reference visual rules for LuBirth:

- Keep space nearly black. The strongest frames are mostly negative space and dark Earth, with small high-value accents.
- Keep the daylight blue atmosphere thin. It should be a bright blue/white tangent line with a soft shelf, not a large neon halo.
- Let perceived atmosphere thickness come from contrast, tangent framing, and layered transparency rather than from huge shell radii.
- Make aurora local and curtain-like. Green root emission hugs the horizon; magenta/red appears higher and weaker. It must not become a full-screen green fog.
- City lights and cloud highlights should be granular, warm, and localized. Avoid broad bloom that turns the image into a posterized UI glow.
- Use slow orbital drift. Web cannot depend on 240fps playback, so the substitute is slow camera/rotation motion with no sudden acceleration or scroll-coupled jitter.
- Preserve surface sharpness. The Earth texture must remain readable; only atmosphere/aurora layers get softness.

This changes the atmosphere-stack numbers below: the shell stack should be slimmer than the initial thick-halo proposal. The target is NASA/Apple aerial discipline, not sci-fi glow.

## Files

- Modify `packages/lubirth-hero/src/types.ts`
  - Add `LandingRenderProfile`.
  - Add `renderProfile?: LandingRenderProfile` to `EarthMoonSceneProps`.
  - Add Earth edge-light config fields.
  - Add atmosphere stack strength fields.

- Modify `packages/lubirth-hero/src/presets.ts`
  - Fill defaults for the new Earth rim and atmosphere stack fields.
  - Keep mobile presets conservative.

- Create `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`
  - Own the new 3D atmosphere stack.
  - Render 2-4 transparent shell meshes depending on quality.
  - Expose `window.__MiraLithLuBirthAtmosphereStackActive` for tests.

- Modify `packages/lubirth-hero/src/LandingEarth.tsx`
  - Add stronger controllable grazing rim uniforms.
  - Keep the Earth surface opaque and sharp.

- Modify `packages/lubirth-hero/src/EarthMoonScene.tsx`
  - Derive layer visibility from `renderProfile`.
  - Use `LandingAtmosphereStack` in production and debug-atmosphere.
  - Keep projected horizon frame calculation for loading.
  - Keep `LandingProjectedHorizonComposite` available only when explicitly requested by the old debug path during transition.

- Modify `packages/lubirth-hero/src/index.ts`
  - Export `LandingAtmosphereStack` and `LandingRenderProfile`.

- Modify `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
  - Parse `profile=` from URL.
  - Pass `renderProfile` into `EarthMoonScene`.

- Modify `apps/site/components/LuBirthRevisedRoute.tsx`
  - Extend screenshot/debug options to include render profile.
  - Support `profile=nasa`, `profile=clean`, `profile=debug-atmosphere`, `profile=debug-aurora`, `profile=debug-clouds`, and `profile=debug-stars`.
  - Keep `debug=` compatibility by mapping it into profile values.

- Modify `tests/e2e/lubirth-revised.spec.ts`
  - Add tests for `profile=nasa`, `profile=clean`, `profile=debug-atmosphere`, and mobile/low quality gates.
  - Update old expectations that assumed `debug=all` was Earth/Moon-only.

- Create screenshot outputs during verification under `screenshots/lubirth-earth-limb-system-20260501/`.

## Task 1: Add Render Profile And Config Types

**Files:**
- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/index.ts`

- [ ] **Step 1: Add the render profile type**

In `packages/lubirth-hero/src/types.ts`, add this near `LandingVisualDebugLayer`:

```ts
export type LandingRenderProfile =
  | "clean"
  | "nasa"
  | "debug-stars"
  | "debug-clouds"
  | "debug-atmosphere"
  | "debug-aurora";
```

- [ ] **Step 2: Extend Earth config**

In `LandingEarthConfig`, add these fields after `rimWidth`:

```ts
  edgeLightStrength: number;
  edgeLightWidth: number;
  edgeLightColor: [number, number, number];
  edgeNeedleStrength: number;
  edgeShadowSoftness: number;
```

- [ ] **Step 3: Extend atmosphere config**

In `LandingAtmosphereConfig`, add these fields after `karmanGlow`:

```ts
  innerWhiteStrength: number;
  blueThicknessStrength: number;
  karmanStrength: number;
  outerHaloStrength: number;
```

- [ ] **Step 4: Extend scene props**

In `EarthMoonSceneProps`, add this after `visualDebugLayer?: LandingVisualDebugLayer;`:

```ts
  renderProfile?: LandingRenderProfile;
```

- [ ] **Step 5: Export the new type**

In `packages/lubirth-hero/src/index.ts`, include `LandingRenderProfile` in the exported type list.

- [ ] **Step 6: Run typecheck to verify the expected failures**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: FAIL because presets do not yet provide the new required config fields.

## Task 2: Add Preset Defaults

**Files:**
- Modify: `packages/lubirth-hero/src/presets.ts`

- [ ] **Step 1: Update the base `field` Earth preset**

Replace the existing single-line `earth` object in `field` with this expanded object:

```ts
  earth: {
    radius: 1,
    segments: 144,
    yawDeg: 0,
    rotationSpeedDegPerSec: 2.2,
    useNightMap: true,
    useClouds: true,
    cloudOpacity: 0.94,
    terminatorSoftness: 0.13,
    nightIntensity: 0.38,
    specularStrength: 0.08,
    rimStrength: 1.34,
    rimWidth: 1.42,
    edgeLightStrength: 0.72,
    edgeLightWidth: 3.2,
    edgeLightColor: [0.62, 0.82, 1.0],
    edgeNeedleStrength: 0.45,
    edgeShadowSoftness: 0.32
  },
```

- [ ] **Step 2: Update the base `field` atmosphere preset**

Replace the existing single-line `atmosphere` object in `field` with this expanded object:

```ts
  atmosphere: {
    enabled: true,
    intensity: 1.32,
    thickness: 0.078,
    color: [0.34, 0.58, 1],
    fresnelPower: 2.35,
    nearShell: true,
    nearStrength: 0.9,
    karmanGlow: true,
    innerWhiteStrength: 0.72,
    blueThicknessStrength: 0.82,
    karmanStrength: 0.18,
    outerHaloStrength: 0.46
  },
```

- [ ] **Step 3: Keep mobile conservative**

In `mobileField` and `mobileWindow`, extend the existing `mergeLandingComposition` calls:

```ts
  mobileField: mergeLandingComposition(field, {
    earth: { segments: 96 },
    atmosphere: {
      blueThicknessStrength: 0.68,
      karmanStrength: 0.1,
      outerHaloStrength: 0.28
    },
    aurora: { intensity: 0.32, sampleCount: 2 },
    moon: { screenX: 0.5, screenY: 0.75, screenSize: 0.18 }
  }),
  mobileWindow: mergeLandingComposition(windowPreset, {
    earth: { segments: 96 },
    atmosphere: {
      blueThicknessStrength: 0.68,
      karmanStrength: 0.1,
      outerHaloStrength: 0.28
    },
    aurora: { intensity: 0.32, sampleCount: 2 },
    moon: { screenX: 0.5, screenY: 0.75, screenSize: 0.18 }
  }),
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: PASS or fail only on files owned by subsequent tasks. There should be no missing config-field errors from `presets.ts`.

## Task 3: Create `LandingAtmosphereStack`

**Files:**
- Create: `packages/lubirth-hero/src/LandingAtmosphereStack.tsx`
- Modify: `packages/lubirth-hero/src/index.ts`

- [ ] **Step 1: Create the component file**

Create `packages/lubirth-hero/src/LandingAtmosphereStack.tsx` with these responsibilities:

```ts
type AtmosphereLayerKind = "inner-white" | "karman" | "blue-thickness" | "outer-halo";

interface AtmosphereLayerSpec {
  kind: AtmosphereLayerKind;
  radius: number;
  renderOrder: number;
}
```

Use these layer radii relative to `composition.earth.radius`:

```ts
const HIGH_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "inner-white", radius: 1.0035, renderOrder: 13 },
  { kind: "karman", radius: 1.016, renderOrder: 14 },
  { kind: "blue-thickness", radius: 1.028, renderOrder: 15 },
  { kind: "outer-halo", radius: 1.052, renderOrder: 16 }
];

const MEDIUM_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "inner-white", radius: 1.0035, renderOrder: 13 },
  { kind: "karman", radius: 1.016, renderOrder: 14 },
  { kind: "blue-thickness", radius: 1.026, renderOrder: 15 }
];

const LOW_LAYERS: AtmosphereLayerSpec[] = [
  { kind: "inner-white", radius: 1.0035, renderOrder: 13 },
  { kind: "blue-thickness", radius: 1.023, renderOrder: 15 }
];
```

- [ ] **Step 2: Implement the shader material factory**

The material factory must use these uniforms:

```ts
uniforms: {
  kind: { value: layerKindToUniform(spec.kind) },
  closeStage: { value: 1 },
  intensity: { value: composition.atmosphere.intensity },
  debugBoost: { value: 0 },
  lightDir: { value: lightDirection.set(...composition.light.fixedSunDir).normalize().clone() },
  innerWhiteStrength: { value: composition.atmosphere.innerWhiteStrength },
  blueThicknessStrength: { value: composition.atmosphere.blueThicknessStrength },
  karmanStrength: { value: composition.atmosphere.karmanStrength },
  outerHaloStrength: { value: composition.atmosphere.outerHaloStrength }
}
```

Use this fragment shader model:

```glsl
vec3 n = normalize(vWorldNormal);
vec3 v = normalize(cameraPosition - vWorldPosition);
vec3 l = normalize(lightDir);
float rim = 1.0 - max(dot(n, v), 0.0);
float sun = dot(n, l);
float daySide = smoothstep(-0.25, 0.45, sun);
float nightSide = 1.0 - smoothstep(-0.10, 0.28, sun);
float twilight = 1.0 - smoothstep(0.02, 0.42, abs(sun));
float closeHold = mix(0.72, 1.0, closeStage);
float boost = 1.0 + debugBoost * 0.28;

float innerWhite =
  smoothstep(0.90, 0.965, rim) *
  (1.0 - smoothstep(0.982, 0.998, rim));

float blueThickness =
  smoothstep(0.62, 0.86, rim) *
  (1.0 - smoothstep(0.965, 1.0, rim));

float karmanBand =
  smoothstep(0.78, 0.91, rim) *
  (1.0 - smoothstep(0.94, 0.985, rim));

float outerHalo =
  smoothstep(0.48, 0.78, rim) *
  (1.0 - smoothstep(0.93, 1.0, rim));

vec3 whiteLineColor = vec3(0.92, 0.98, 1.0);
vec3 rayleighBlue = vec3(0.16, 0.48, 0.95);
vec3 deepBlue = vec3(0.02, 0.12, 0.38);
vec3 oxygenGreen = vec3(0.20, 0.85, 0.58);
vec3 amberGlow = vec3(1.0, 0.48, 0.16);

vec3 color = vec3(0.0);
float alpha = 0.0;

if (kind == 0) {
  color = whiteLineColor * innerWhite * (0.55 + daySide * 0.55);
  alpha = innerWhite * 0.10 * innerWhiteStrength;
} else if (kind == 1) {
  color =
    oxygenGreen * karmanBand * nightSide * 0.16 +
    amberGlow * karmanBand * twilight * 0.10;
  alpha = karmanBand * 0.035 * karmanStrength;
} else if (kind == 2) {
  color = rayleighBlue * blueThickness * (0.25 + daySide * 0.75);
  alpha = blueThickness * 0.055 * blueThicknessStrength;
} else {
  color = deepBlue * outerHalo * 0.16;
  alpha = outerHalo * 0.018 * outerHaloStrength;
}

alpha *= intensity * closeHold * boost;
color *= intensity * closeHold * boost;

if (alpha < 0.001) {
  discard;
}

gl_FragColor = vec4(min(color, vec3(0.98)), clamp(alpha, 0.0, 0.24));
```

- [ ] **Step 3: Gate layer counts by quality**

Use this selection:

```ts
const layers =
  quality.tier === "high"
    ? HIGH_LAYERS
    : quality.tier === "medium"
      ? MEDIUM_LAYERS
      : LOW_LAYERS;
```

Return `null` when `quality.tier === "fallback"` or `composition.atmosphere.enabled` is false.

- [ ] **Step 4: Add test instrumentation**

Set `window.__MiraLithLuBirthAtmosphereStackActive = true` while the component is mounted and enabled. Set it to `false` on cleanup.

- [ ] **Step 5: Export the component**

In `packages/lubirth-hero/src/index.ts`, add:

```ts
export { LandingAtmosphereStack } from "./LandingAtmosphereStack";
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: PASS or fail only because `window.__MiraLithLuBirthAtmosphereStackActive` is not yet declared in tests. If TypeScript flags the window field in package code, add the declaration in `LandingAtmosphereStack.tsx`.

## Task 4: Strengthen The Earth Surface Rim

**Files:**
- Modify: `packages/lubirth-hero/src/LandingEarth.tsx`

- [ ] **Step 1: Add new uniforms**

In the `ShaderMaterial` uniform object, add:

```ts
          edgeLightStrength: { value: composition.earth.edgeLightStrength },
          edgeLightWidth: { value: composition.earth.edgeLightWidth },
          edgeLightColor: {
            value: new Color(
              composition.earth.edgeLightColor[0],
              composition.earth.edgeLightColor[1],
              composition.earth.edgeLightColor[2]
            )
          },
          edgeNeedleStrength: { value: composition.earth.edgeNeedleStrength },
          edgeShadowSoftness: { value: composition.earth.edgeShadowSoftness },
```

- [ ] **Step 2: Add fragment uniforms**

In the fragment shader uniform declarations, add:

```glsl
          uniform float edgeLightStrength;
          uniform float edgeLightWidth;
          uniform vec3 edgeLightColor;
          uniform float edgeNeedleStrength;
          uniform float edgeShadowSoftness;
```

- [ ] **Step 3: Replace the rim block**

Replace the existing `innerRim`, `outerRim`, `rimEffect`, `rimCol`, `horizonNeedle`, `surfaceNeedle`, `needleCol` block with:

```glsl
            float legacyInnerRim = pow(fresnel, max(rimWidth * 1.5, 0.8));
            float legacyOuterRim = pow(fresnel, max(rimWidth * 0.8, 0.3));
            float legacyRim = (legacyInnerRim * 0.7 + legacyOuterRim * 0.3) * rimStrength;
            legacyRim *= 0.24 + 0.76 * max(ndl, 0.0);

            float sunRim = smoothstep(-edgeShadowSoftness, 0.58, ndl);
            float edgeRim = pow(fresnel, max(edgeLightWidth, 0.4)) * sunRim;
            float innerNeedle = pow(fresnel, 42.0) * sunRim;
            float surfaceNeedle = pow(fresnel, 72.0) * (0.22 + 0.78 * dayW) * closeStage;
            float needleCut = 1.0 - smoothstep(0.995, 1.0, fresnel);

            vec3 rimCol =
              mix(vec3(0.035, 0.14, 0.34), vec3(0.16, 0.44, 0.82), legacyInnerRim) *
              legacyRim *
              0.26;
            vec3 edgeLight =
              edgeLightColor * edgeRim * edgeLightStrength +
              vec3(0.94, 0.98, 1.0) * innerNeedle * edgeNeedleStrength +
              vec3(0.95, 0.985, 1.0) * surfaceNeedle * needleCut * edgeNeedleStrength * 0.72;
```

Keep the final color expression using `rimCol + edgeLight`:

```glsl
            vec3 color = dayCol + cityCol + moonlitLand + moonlitClouds + twilightFill + terminatorCol + rimCol + edgeLight;
```

- [ ] **Step 4: Update hook dependencies**

Add these values to the `useMemo` dependency list:

```ts
      composition.earth.edgeLightStrength,
      composition.earth.edgeLightWidth,
      composition.earth.edgeLightColor,
      composition.earth.edgeNeedleStrength,
      composition.earth.edgeShadowSoftness,
```

- [ ] **Step 5: Update uniforms each frame**

After `earthMaterial.uniforms.rimWidth.value = composition.earth.rimWidth;`, add:

```ts
    earthMaterial.uniforms.edgeLightStrength.value = composition.earth.edgeLightStrength;
    earthMaterial.uniforms.edgeLightWidth.value = composition.earth.edgeLightWidth;
    earthMaterial.uniforms.edgeLightColor.value.set(
      composition.earth.edgeLightColor[0],
      composition.earth.edgeLightColor[1],
      composition.earth.edgeLightColor[2]
    );
    earthMaterial.uniforms.edgeNeedleStrength.value = composition.earth.edgeNeedleStrength;
    earthMaterial.uniforms.edgeShadowSoftness.value = composition.earth.edgeShadowSoftness;
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: PASS or fail only in files owned by subsequent tasks.

## Task 5: Wire The 3D Stack Into `EarthMoonScene`

**Files:**
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`

- [ ] **Step 1: Import the new component and type**

Add:

```ts
import { LandingAtmosphereStack } from "./LandingAtmosphereStack";
```

Update the type import to include `LandingRenderProfile` if needed by helper functions.

- [ ] **Step 2: Accept `renderProfile`**

In the function parameter list, add:

```ts
  renderProfile,
```

after `visualDebugLayer = "all",`.

- [ ] **Step 3: Add profile derivation helper**

Above `export function EarthMoonScene`, add:

```ts
function resolveRenderProfile(
  renderProfile: LandingRenderProfile | undefined,
  visualDebugLayer: EarthMoonSceneProps["visualDebugLayer"]
): LandingRenderProfile {
  if (renderProfile) {
    return renderProfile;
  }

  if (visualDebugLayer === "stars") {
    return "debug-stars";
  }
  if (visualDebugLayer === "clouds") {
    return "debug-clouds";
  }
  if (visualDebugLayer === "atmosphere") {
    return "debug-atmosphere";
  }
  if (visualDebugLayer === "aurora") {
    return "debug-aurora";
  }

  return "clean";
}
```

- [ ] **Step 4: Replace the show flags**

Replace the existing `showEarth`, `showMoon`, `showClouds`, `showAtmosphere`, `showAurora`, and projected-composite flag block with:

```ts
  const activeRenderProfile = resolveRenderProfile(renderProfile, visualDebugLayer);
  const isNasaProfile = activeRenderProfile === "nasa";
  const isCleanProfile = activeRenderProfile === "clean";
  const debugStars = activeRenderProfile === "debug-stars";
  const debugClouds = activeRenderProfile === "debug-clouds";
  const debugAtmosphere = activeRenderProfile === "debug-atmosphere";
  const debugAurora = activeRenderProfile === "debug-aurora";

  const showEarth = !debugStars;
  const showMoon = isNasaProfile || isCleanProfile;
  const showClouds = isNasaProfile || debugClouds;
  const showAtmosphere = isNasaProfile || debugAtmosphere;
  const showAurora = isNasaProfile || debugAurora;
  const showProjectedHorizonComposite = false;
  const showLegacyClouds = showClouds;
  const showLegacyAtmosphere = false;
  const showLegacyAurora = showAurora && debugAurora;
  const showSurfaceTextureClouds =
    showClouds &&
    quality.tier !== "low" &&
    quality.tier !== "fallback";
```

This deliberately moves production away from the projected composite path.

- [ ] **Step 5: Render `LandingAtmosphereStack`**

After the legacy atmosphere block or in its place, add:

```tsx
        {showAtmosphere ? (
          <LandingAtmosphereStack
            composition={composition}
            quality={quality}
            sceneLightDirection={sceneLightDirection}
            emphasis={debugAtmosphere}
          />
        ) : null}
```

- [ ] **Step 6: Keep aurora restrained**

Keep `LandingHorizonAuroraRibbon` for `debugAurora` and production `nasa` in the first pass. Set `auroraVisibilityBoost` so production is restrained and debug is visible:

```ts
  const auroraVisibilityBoost = debugAurora
    ? (auroraProfile === "debug" ? 5.2 : 4.0)
    : 0.72;
```

- [ ] **Step 7: Run typecheck**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: FAIL until `LuBirthSceneSlot` passes the new prop, or PASS if `renderProfile` remains optional and no imports are wrong.

## Task 6: Add URL Profile Parsing

**Files:**
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `apps/site/components/LuBirthRevisedRoute.tsx`

- [ ] **Step 1: Import `LandingRenderProfile`**

In `LuBirthSceneSlot.tsx`, add `LandingRenderProfile` to the type imports from `@miralith/lubirth-hero`.

- [ ] **Step 2: Extend slot props**

Add:

```ts
  renderProfile?: LandingRenderProfile;
```

to `LuBirthSceneSlotProps`.

- [ ] **Step 3: Add URL parser**

Add this function to `LuBirthSceneSlot.tsx`:

```ts
function readRenderProfileOverride(): LandingRenderProfile | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const profile = new URLSearchParams(window.location.search).get("profile");
  if (
    profile === "clean" ||
    profile === "nasa" ||
    profile === "debug-stars" ||
    profile === "debug-clouds" ||
    profile === "debug-atmosphere" ||
    profile === "debug-aurora"
  ) {
    return profile;
  }

  return undefined;
}
```

- [ ] **Step 4: Pass the profile into `EarthMoonScene`**

Inside `LuBirthSceneSlot`, compute:

```ts
  const renderProfileOverride = readRenderProfileOverride();
  const activeRenderProfile = renderProfileOverride ?? renderProfile;
```

Pass:

```tsx
      renderProfile={activeRenderProfile}
```

to `EarthMoonScene`.

- [ ] **Step 5: Extend screenshot debug options**

In `LuBirthRevisedRoute.tsx`, add `renderProfile: LandingRenderProfile;` to `ScreenshotDebugOptions`.

Set the default options to:

```ts
const DEFAULT_SCREENSHOT_DEBUG_OPTIONS: ScreenshotDebugOptions = {
  fixedProgress: null,
  copyHidden: false,
  visualDebugLayer: "all",
  renderProfile: "nasa"
};
```

- [ ] **Step 6: Map old `debug=` values**

Inside `readScreenshotDebugOptions`, after parsing `visualDebugLayer`, add:

```ts
  const profileParam = params.get("profile");
  const profileFromQuery: LandingRenderProfile | undefined =
    profileParam === "clean" ||
    profileParam === "nasa" ||
    profileParam === "debug-stars" ||
    profileParam === "debug-clouds" ||
    profileParam === "debug-atmosphere" ||
    profileParam === "debug-aurora"
      ? profileParam
      : undefined;
  const profileFromDebug: LandingRenderProfile =
    visualDebugLayer === "stars"
      ? "debug-stars"
      : visualDebugLayer === "clouds"
        ? "debug-clouds"
        : visualDebugLayer === "atmosphere"
          ? "debug-atmosphere"
          : visualDebugLayer === "aurora"
            ? "debug-aurora"
            : "nasa";
```

Return:

```ts
    renderProfile: profileFromQuery ?? profileFromDebug
```

- [ ] **Step 7: Add root dataset**

After `rootElement.dataset.debugLayer = screenshotDebug.visualDebugLayer;`, add:

```ts
      rootElement.dataset.renderProfile = screenshotDebug.renderProfile;
```

- [ ] **Step 8: Pass the profile to the scene slot**

In the `LuBirthSceneSlot` call, add:

```tsx
            renderProfile={debugOptions.renderProfile}
```

- [ ] **Step 9: Run typecheck**

Run:

```bash
pnpm --filter @miralith/site typecheck
```

Expected: PASS or fail only in tests that still need the new window declaration.

## Task 7: Update Playwright Tests

**Files:**
- Modify: `tests/e2e/lubirth-revised.spec.ts`

- [ ] **Step 1: Add the window declaration**

In the `declare global` block, add:

```ts
    __MiraLithLuBirthAtmosphereStackActive?: boolean;
```

- [ ] **Step 2: Replace the old clean default test**

Replace the test named `defaults the study route to an earth-moon only view` with:

```ts
test("defaults the study route to the nasa Earth-limb profile", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&visualTest=pixels");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-copy", "hidden");
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "nasa");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
});
```

- [ ] **Step 3: Add a clean profile regression test**

Add:

```ts
test("keeps a clean Earth-Moon comparison profile", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=clean&visualTest=pixels");

  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "clean");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(false);
});
```

- [ ] **Step 4: Update atmosphere review expectations**

In the atmosphere review test, change the URL to:

```ts
await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-atmosphere&quality=high&visualTest=pixels");
```

Replace the projected-composite assertions with:

```ts
  await expect(page.locator(".lubirth-revised")).toHaveAttribute("data-render-profile", "debug-atmosphere");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
```

- [ ] **Step 5: Update aurora debug expectations**

In the aurora test, change the URL to:

```ts
await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=debug-aurora&quality=high&visualTest=pixels");
```

Assert that projected composite is not active:

```ts
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthProjectedHorizonCompositeActive ?? false), { timeout: 25_000 })
    .toBe(false);
```

- [ ] **Step 6: Add a low-quality atmosphere gate test**

Add:

```ts
test("low quality keeps the atmosphere stack lightweight", async ({ page }) => {
  await page.goto("/lubirth-revised?progress=0&copy=hidden&profile=nasa&quality=low&visualTest=pixels");

  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthQualityTier), { timeout: 25_000 })
    .toBe("low");
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAtmosphereStackActive ?? false), { timeout: 25_000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__MiraLithLuBirthAuroraEnabled), { timeout: 25_000 })
    .toBe(false);
});
```

- [ ] **Step 7: Run the focused test file**

Run:

```bash
pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop
```

Expected: PASS after implementation. If visual timing makes a window flag flicker, fix the component lifecycle instead of loosening assertions.

## Task 8: Visual Verification And Screenshot Acceptance

**Files:**
- Create output files under `screenshots/lubirth-earth-limb-system-20260501/`

- [ ] **Step 1: Start the dev server**

Run:

```bash
pnpm --filter @miralith/site dev
```

Expected: dev server prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 2: Capture nasa profile screenshots**

Open and capture these frames:

```text
http://localhost:3000/lubirth-revised?profile=nasa&progress=0&copy=hidden&quality=high&visualTest=pixels
http://localhost:3000/lubirth-revised?profile=nasa&progress=0.5&copy=hidden&quality=high&visualTest=pixels
http://localhost:3000/lubirth-revised?profile=nasa&progress=1&copy=hidden&quality=high&visualTest=pixels
```

Save:

```text
screenshots/lubirth-earth-limb-system-20260501/nasa-progress0-high.png
screenshots/lubirth-earth-limb-system-20260501/nasa-progress05-high.png
screenshots/lubirth-earth-limb-system-20260501/nasa-progress1-high.png
```

- [ ] **Step 3: Capture isolated debug screenshots**

Open and capture:

```text
http://localhost:3000/lubirth-revised?profile=debug-atmosphere&progress=0&copy=hidden&quality=high&visualTest=pixels
http://localhost:3000/lubirth-revised?profile=debug-aurora&progress=0&copy=hidden&quality=high&auroraProfile=debug&visualTest=pixels
http://localhost:3000/lubirth-revised?profile=clean&progress=0&copy=hidden&quality=high&visualTest=pixels
```

Save:

```text
screenshots/lubirth-earth-limb-system-20260501/debug-atmosphere-progress0-high.png
screenshots/lubirth-earth-limb-system-20260501/debug-aurora-progress0-high.png
screenshots/lubirth-earth-limb-system-20260501/clean-progress0-high.png
```

- [ ] **Step 4: Visual pass criteria**

Review the images against these concrete criteria:

- `debug-atmosphere-progress0-high.png`: Earth edge has a thin white line, a visibly thicker blue atmospheric shelf, and a soft blue falloff outside the hard sphere edge.
- `nasa-progress0-high.png`: Earth surface remains sharp; limb softness comes from transparent shells, not blurred land/cloud texture.
- `nasa-progress05-high.png`: atmosphere thickness does not pop or disappear during the opening transition.
- `nasa-progress1-high.png`: final Earth still has a visible but restrained blue rim; the Moon is not tinted by Earth glow.
- `debug-aurora-progress0-high.png`: aurora reads as a low-alpha curtain/ribbon near the Earth arc, not a full-screen green fog.
- `clean-progress0-high.png`: old Earth/Moon-only comparison remains available.
- All NASA-profile screenshots: black space remains genuinely dark; do not lift the whole frame into gray/blue haze.

- [ ] **Step 5: Run final verification**

Run:

```bash
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site typecheck
pnpm build
pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop
```

Expected: all commands pass.

## Rollback Plan

If the 3D stack performs poorly or looks worse than the baseline:

1. Use `profile=clean` to keep the current Earth/Moon view available.
2. Set `renderProfile="clean"` at the `LuBirthSceneSlot` callsite to disable the new production look without deleting code.
3. Keep `LandingAtmosphereStack.tsx` in the package for isolated lookdev.
4. Re-run `pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop` to confirm the clean profile still works.

## Self-Review

- Spec coverage: The plan covers the new 3D atmosphere stack, Earth surface rim, render profile split, URL/debug integration, tests, and screenshot acceptance. It does not include high-tier FBO blur or a new curved 3D aurora geometry because those are not needed to validate the direction change.
- Gap scan: The plan contains no open-ended implementation gaps. Each task has concrete paths, snippets, commands, and expected outcomes.
- Type consistency: `LandingRenderProfile`, `renderProfile`, and `__MiraLithLuBirthAtmosphereStackActive` are introduced once and reused consistently across package code, app code, and tests.
