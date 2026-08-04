# LuBirth Globe-Conforming Cloud Asset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected screen-space opening cloud video with a seekable, cloud-only equirectangular field that is rendered inside the real rotating Earth group and has visibly deeper, light-responsive cloud volume.

**Architecture:** The browser never receives a baked Earth image. The offline source produces globe-UV field channels (optical depth, top height, morphology and concavity) for 48 all-I frames. A hidden video is decoded once and sampled by an R3F cloud shell that is a child of `EarthMoonScene`’s `earthGroup`; the existing thin-shell, front-to-back lighting model supplies volume without a browser raymarch. `TransitionVeil` remains a DOM sibling above the Canvas, but the former fullscreen `PackedCloudOverlay` is removed.

**Tech Stack:** Next.js 16, React 19, Three.js/R3F, existing Relief-lite thin-shell shader model, `VideoTexture`, WebGL2, all-I H.264/FFmpeg, deterministic offline WebGL bake, TypeScript and Playwright.

---

## Why this supersedes the current route

The current `10d44e5` implementation is a valid transparent-media/frame-addressing experiment but is **REJECTED for spatial attachment**: its cloud pixels are sampled in screen UVs and can float in front of the Moon and the Earth. This plan keeps its seek, hysteresis, fallback, resource-release and shared-veil contracts while replacing only the representation and scene integration.

| Requirement | Locked decision |
| --- | --- |
| Earth/IP semantics | The real Earth/Moon/atmosphere remain inside `EarthMoonScene` for the entire scroll range. No frame contains those pixels. |
| Attachment | The cinematic cloud mesh is rendered inside `earthGroup`, inheriting Earth translation, scale, IP rotation and late auto-rotation. |
| Asset domain | Each frame is 2:1 equirectangular Earth UV data, not a camera plate or local 160×120×32 volume output. |
| Field packing | Packed video left half RGB = optical depth/top height/morphology; right red = concavity. It is sampled in `NoColorSpace`, never displayed as RGB artwork. |
| Volume | Use a 1.0005–1.0115 spherical shell (strictly inside the 1.014 limb atmosphere), vertex height displacement, 3 desktop / 2 mobile ordered view samples, one sun-column tap, 0.84 opening opacity, 1.24 relief lighting scale and a 0.46 night-side illumination floor. This keeps the cloud field globe-conforming while making its body readable at the opening's low sun angle. |
| Handoff | 0–0.18 opening shell; 0.18–0.195 veil closes; exactly 0.195 atomically swaps to Relief-lite below the opaque veil; 0.195–0.22 veil opens; ≥0.22 releases video and `VideoTexture`. Reverse performs the same swap only after frame readiness. |
| Budget | Desktop raw field 1536×768 / packed 3072×768, transfer ≤6 MiB, decoded packed texture ≤16 MiB. Mobile raw 1024×512 / packed 2048×512, transfer ≤2 MiB, decoded packed texture ≤8 MiB. |
| Scope | Continue using only `/lubirth-cloud-asset-opening`; do not modify `/`, CoScroll, Radio Gaga, `globals.css` or promotion routing. |

## File map

| Path | Responsibility |
| --- | --- |
| `packages/lubirth-hero/scripts/opening-globe-cloud-field.html` | Deterministic high-resolution equirectangular procedural field source. It renders data, never a camera scene. |
| `packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs` | Captures 48 field frames, packs left RGB/right concavity, encodes all-I MP4, measures field variation and writes hashes/contact sheets. |
| `apps/site/public/assets/lubirth/opening-globe-clouds/{desktop,mobile}.mp4` | New packed equirectangular field videos. |
| `apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json` | Provenance, globe mapping, channel contract, budgets, transfer bytes and SHA-256 values. |
| `apps/site/content/lubirthOpeningGlobeCloudManifest.ts` | Typed manifest validator and progress-to-frame mapping. |
| `packages/lubirth-hero/src/LandingReliefCloudShell.tsx` | Extracted reusable Relief-lite geometry/material shell that accepts any scalar field texture. |
| `packages/lubirth-hero/src/LandingOpeningGlobeCloud.tsx` | Owns `VideoTexture`, maps packed field channels, gives opening-shell telemetry and delegates volume rendering to the reusable shell. |
| `packages/lubirth-hero/src/{EarthMoonScene.tsx,types.ts,index.ts}` | Defines and carries `LandingOpeningCloudLayer` into the existing `earthGroup`. |
| `apps/site/visual/scenes/LuBirthSceneSlot.tsx` | Exposes a scoped `openingCloudLayer` prop and passes it to `EarthMoonScene`; query settings retain precedence. |
| `apps/site/components/lubirth-cloud-asset-opening/{types,frameProvider,OpeningCloudStack}.tsx` | Reuses the controller/provider but turns `OpeningCloudStack` into a render-prop owner of the hidden video and shared veil; no DOM cloud renderer remains. |
| `apps/site/components/LuBirthCloudAssetOpeningRoute.tsx` | Derives `openingCloudLayer` from the controller snapshot and gives it to the real scene. |
| `tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts` | Validates globe-UV data packing, field dimensions, budgets, checksums and all-I temporal change. |
| `tests/unit/lubirthOpeningCloudController.spec.ts` | Retains/extends exact handoff and reverse hysteresis tests for an in-Canvas shell. |
| `tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts` | Proves no screen overlay, Earth-group attachment, temporal globe field change, Moon non-occlusion, veil cut, fallback and mobile operation. |
| `docs/lubirth-globe-cloud-asset-evidence/2026-08-04` | Contact sheets, composite screenshots, telemetry, checksums and explicit promotion result. |

### Task 1: Define the globe-field asset contract before generating media

**Files:**
- Create: `apps/site/content/lubirthOpeningGlobeCloudManifest.ts`
- Create: `apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json`
- Create: `tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { expect, test } from "@playwright/test";
import {
  mapOpeningGlobeCloudProgressToFrame,
  validateOpeningGlobeCloudManifest
} from "../../apps/site/content/lubirthOpeningGlobeCloudManifest";

test("rejects a screen-space or color-art globe cloud asset", () => {
  expect(() => validateOpeningGlobeCloudManifest({
    cloudOnly: true,
    mapping: "screen-space",
    packing: "left-rgb-right-alpha"
  })).toThrow(/equirectangular-earth-uv.*field/i);
});

test("maps the authored handoff to seekable globe field frames", () => {
  const manifest = validateOpeningGlobeCloudManifest(validFixture);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0)).toBe(0);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.18)).toBe(39);
  expect(mapOpeningGlobeCloudProgressToFrame(manifest, 0.195)).toBe(42);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts`

Expected: FAIL because the globe-field manifest module does not exist.

- [ ] **Step 3: Implement the typed validator and mapping**

```ts
export const OPENING_GLOBE_CLOUD_MAPPING = "equirectangular-earth-uv" as const;
export const OPENING_GLOBE_CLOUD_PACKING = "left-rgb-right-concavity" as const;

export interface OpeningGlobeCloudVariant {
  rawWidth: number;
  rawHeight: number;
  packedWidth: number;
  packedHeight: number;
  transferBytes: number;
  estimatedPackedTextureBytes: number;
  sha256: string;
}

export function mapOpeningGlobeCloudProgressToFrame(
  manifest: OpeningGlobeCloudManifest,
  progress: number
) {
  const clamped = Math.min(manifest.handoff.cutProgress, Math.max(0, progress));
  return clamped <= manifest.handoff.plateEndProgress
    ? Math.round(clamped / manifest.handoff.plateEndProgress * manifest.handoff.plateEndFrame)
    : Math.round(manifest.handoff.plateEndFrame +
        (clamped - manifest.handoff.plateEndProgress) /
          (manifest.handoff.cutProgress - manifest.handoff.plateEndProgress) *
          (manifest.handoff.cutFrame - manifest.handoff.plateEndFrame));
}
```

The validator requires `cloudOnly: true`, `mapping: "equirectangular-earth-uv"`, 2:1 raw dimensions, `packing: "left-rgb-right-concavity"`, 48 all-I frames at 30 fps, `NoColorSpace` field sampling, internal provenance and the fixed handoff values. It rejects any `screen-space`, `alpha-art`, `imagegen-full-scene` or over-budget input.

- [ ] **Step 4: Run GREEN**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts
pnpm --filter @miralith/site typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add apps/site/content/lubirthOpeningGlobeCloudManifest.ts apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts
git commit -m "test(lubirth): define globe cloud field contract"
```

### Task 2: Bake the high-resolution equirectangular temporal field

**Files:**
- Create: `packages/lubirth-hero/scripts/opening-globe-cloud-field.html`
- Create: `packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs`
- Modify: `packages/lubirth-hero/package.json`
- Create: `apps/site/public/assets/lubirth/opening-globe-clouds/{desktop,mobile}.mp4`
- Modify: `apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json`
- Modify: `tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts`

- [ ] **Step 1: Add failing published-media assertions**

```ts
test("publishes all-I globe fields with high-frequency height and temporal change", () => {
  const desktop = readPublishedVariant("desktop");
  expect(desktop.rawWidth / desktop.rawHeight).toBe(2);
  expect(desktop.packedWidth).toBe(desktop.rawWidth * 2);
  expect(readAllKeyFrames(desktop.src)).toHaveLength(48);
  expect(readAllKeyFrames(desktop.src).every((frame) => frame.keyFrame)).toBe(true);
  expect(meanAbsoluteDifference(readPackedChannel(desktop, 0, "height"), readPackedChannel(desktop, 24, "height"))).toBeGreaterThan(0.012);
  expect(standardDeviation(readPackedChannel(desktop, 12, "height"))).toBeGreaterThan(0.08);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts`

Expected: FAIL because no packed globe field exists.

- [ ] **Step 3: Implement deterministic field rendering and packing**

The source accepts a normalized UV and frame index. It maps UV to a unit sphere direction, evaluates fixed-seed high-resolution Worley/fBm weather cells with longitude wrapping, applies 1.6 seconds of wind advection, and writes scalar data rather than scene colour:

```glsl
vec4 evaluateCloudField(vec2 earthUv, float frameProgress) {
  vec3 direction = equirectangularDirection(earthUv);
  float coverage = integrateHighResolutionDensity(direction, frameProgress);
  float topHeight = shapedTopHeight(direction, frameProgress, coverage);
  float morphology = erosionMeasure(direction, frameProgress);
  float concavity = cavityMeasure(direction, frameProgress);
  return vec4(coverage, topHeight, morphology, concavity);
}

// Packed frame: left RGB stores coverage/top/morphology; right red stores concavity.
outColor = fragUv.x < 0.5
  ? vec4(field.rgb, 1.0)
  : vec4(field.aaa, 1.0);
```

The bake script captures the raw field at 1536×768 and 1024×512, encodes packed 3072×768 / 2048×512 all-I H.264 (`-g 1 -keyint_min 1 -sc_threshold 0`), verifies exact 48-frame metadata and byte limits, and emits manifest checksums. It does not call the old `opening-cloud-volume.html` or use the former screen-space RGB/alpha media.

- [ ] **Step 4: Generate and inspect assets**

Run:

```sh
pnpm --filter @miralith/lubirth-hero exec node scripts/bake-opening-globe-cloud-assets.mjs
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts
```

Expected: 48 all-I frames, field variation thresholds pass, desktop ≤6 MiB, mobile ≤2 MiB, packed decoded textures fit their 16/8 MiB ceilings.

- [ ] **Step 5: Commit**

```sh
git add packages/lubirth-hero/scripts/opening-globe-cloud-field.html packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs packages/lubirth-hero/package.json apps/site/public/assets/lubirth/opening-globe-clouds tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts
git commit -m "feat(lubirth): bake globe conforming cloud fields"
```

### Task 3: Extract the shared Relief-lite shell and add a video-backed opening shell

**Files:**
- Create: `packages/lubirth-hero/src/LandingReliefCloudShell.tsx`
- Create: `packages/lubirth-hero/src/LandingOpeningGlobeCloud.tsx`
- Modify: `packages/lubirth-hero/src/LandingReliefCloud.tsx`
- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/index.ts`
- Create: `tests/unit/lubirthOpeningGlobeCloudShell.spec.ts`

- [ ] **Step 1: Write failing shell-policy tests**

```ts
test("uses a globe-UV shell below the limb atmosphere with ordered shallow volume", () => {
  const policy = resolveOpeningGlobeCloudShellPolicy({ mobile: false });
  expect(policy).toMatchObject({
    bottomScale: 1.0005,
    topScale: 1.0115,
    viewSteps: 3,
    sunSteps: 1,
    fieldPacking: "left-rgb-right-concavity",
    textureColorSpace: "none"
  });
  expect(policy.topScale).toBeLessThan(LANDING_LIMB_LITE_ATMOSPHERE_RADIUS_SCALE);
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts`

Expected: FAIL because the opening shell policy does not exist.

- [ ] **Step 3: Extract the reusable shell without changing current Relief-lite output**

`LandingReliefCloudShell` receives an already loaded `Texture`, radii, render order and policy. Move `createReliefCloudMaterial` and the sphere geometry into that file, preserving the existing Relief-lite channel interpretation and telemetry in `LandingReliefCloud`.

```tsx
export function LandingReliefCloudShell({
  composition,
  fieldTexture,
  fieldDecoder = "rgba-field",
  lightingFrame,
  policy,
  quality,
  renderOrder = 3
}: LandingReliefCloudShellProps) {
  const material = useMemo(
    () => createReliefCloudMaterial({ composition, fieldTexture, fieldDecoder, policy }),
    [composition, fieldDecoder, fieldTexture, policy]
  );
  return <mesh material={material} renderOrder={renderOrder}><sphereGeometry args={policy.geometryArgs(quality)} /></mesh>;
}
```

For `fieldDecoder: "packed-video-field"`, the shader uses `uFieldMap` at `(uv.x * 0.5, uv.y)` for RGB and at `(0.5 + uv.x * 0.5, uv.y)` for concavity. It keeps premultiplied output, depth testing, vertex displacement and ordered 3/2-step shell integration. It never samples camera/screen UVs.

- [ ] **Step 4: Add `LandingOpeningGlobeCloud`**

```tsx
export function LandingOpeningGlobeCloud({ layer, composition, lightingFrame, quality }: LandingOpeningGlobeCloudProps) {
  const texture = useMemo(() => {
    const next = new VideoTexture(layer.video);
    next.colorSpace = NoColorSpace;
    next.wrapS = RepeatWrapping;
    next.wrapT = ClampToEdgeWrapping;
    next.minFilter = LinearFilter;
    next.magFilter = LinearFilter;
    return next;
  }, [layer.video]);

  useEffect(() => () => texture.dispose(), [texture]);
  return <LandingReliefCloudShell composition={composition} fieldTexture={texture} fieldDecoder="packed-video-field" lightingFrame={lightingFrame} policy={resolveOpeningGlobeCloudShellPolicy(layer.mobile)} quality={quality} renderOrder={4} />;
}
```

Publish `window.__MiraLithLuBirthOpeningGlobeCloud` with `attachment: "earth-group"`, `mapping: "equirectangular-earth-uv"`, frame number, field packing, radii and active shell budget. Add `LandingOpeningCloudLayer` to the package type API with only `{ active, frame, mobile, video }`.

- [ ] **Step 5: Run GREEN and regression tests**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts tests/unit/lubirth-relief-lite.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
```

Expected: opening policy passes and existing Relief-lite tests retain their expected texture/step contract.

- [ ] **Step 6: Commit**

```sh
git add packages/lubirth-hero/src/LandingReliefCloudShell.tsx packages/lubirth-hero/src/LandingOpeningGlobeCloud.tsx packages/lubirth-hero/src/LandingReliefCloud.tsx packages/lubirth-hero/src/types.ts packages/lubirth-hero/src/index.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts
git commit -m "feat(lubirth): render opening clouds as a volume shell"
```

### Task 4: Route the opening shell through the real Earth group and remove the 2D overlay

**Files:**
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `apps/site/components/lubirth-cloud-asset-opening/{types,frameProvider,OpeningCloudStack}.tsx`
- Modify: `apps/site/components/LuBirthCloudAssetOpeningRoute.tsx`
- Modify: `apps/site/components/lubirth-cloud-asset-opening/TransitionVeil.tsx`
- Modify: `apps/site/components/LuBirthCloudAssetOpeningRoute.module.css`
- Delete: `apps/site/components/lubirth-cloud-asset-opening/PackedCloudOverlay.tsx`
- Delete: `apps/site/content/lubirthOpeningCloudManifest.ts`
- Delete: `apps/site/public/assets/lubirth/opening-clouds/*`
- Delete: `packages/lubirth-hero/scripts/{opening-cloud-volume.html,bake-opening-cloud-assets.mjs}`
- Delete: `tests/unit/lubirthOpeningCloudManifest.spec.ts`
- Delete: `tests/e2e/lubirth-cloud-asset-opening.spec.ts`
- Delete: `docs/lubirth-cloud-asset-opening-evidence/2026-08-03/*`

- [ ] **Step 1: Write failing scene/route tests**

```ts
await expect(page.locator("[data-opening-cloud-overlay]")).toHaveCount(0);
await expect(page.locator("[data-opening-globe-cloud-media]")).toHaveCount(1);
await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud)).toMatchObject({
  active: true,
  attachment: "earth-group",
  mapping: "equirectangular-earth-uv",
  fieldPacking: "left-rgb-right-concavity"
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop`

Expected: FAIL because the current route still mounts the screen canvas.

- [ ] **Step 3: Add the scoped package prop and atomic source swap**

```tsx
// packages/lubirth-hero/src/EarthMoonScene.tsx, inside <group ref={earthGroup}>
{openingCloudLayer?.active ? (
  <LandingOpeningGlobeCloud
    composition={composition}
    layer={openingCloudLayer}
    lightingFrame={planetLightingFrame}
    quality={quality}
  />
) : showCloudShells && activeVisualPolicy.cloudMode === "relief-lite" ? (
  <LandingReliefCloud composition={composition} assets={assets} lightingFrame={planetLightingFrame} quality={quality} />
) : null}
```

`LuBirthSceneSlot` accepts `openingCloudLayer?: LandingOpeningCloudLayer` and passes it unchanged to `EarthMoonScene`; normal query overrides remain higher priority than route props. Only `snapshot.source === "cloud"` sets `active: true`. `reverse-veil-close` keeps Relief-lite active until target decoding has completed, so the switch occurs once under an opaque veil.

Change `OpeningCloudStack.children` to a render prop:

```tsx
<OpeningCloudStack ...>
  {({ snapshot, video }) => (
    <VisualCanvas ...>
      <LuBirthSceneSlot openingCloudLayer={{
        active: snapshot.source === "cloud",
        frame: snapshot.renderedFrame,
        mobile: tier === "mobile",
        video
      }} />
    </VisualCanvas>
  )}
</OpeningCloudStack>
```

Keep the hidden video as `data-opening-globe-cloud-media`; remove `PackedCloudOverlay`, its CSS and its WebGL context. The veil becomes `data-layer-above="earth canvas and globe cloud shell"`, remains pointer-inert and remains the only DOM visual layer above the Canvas.

- [ ] **Step 4: Delete rejected screen-space source/media after the replacement tests are green**

Run:

```sh
git rm apps/site/components/lubirth-cloud-asset-opening/PackedCloudOverlay.tsx apps/site/content/lubirthOpeningCloudManifest.ts tests/unit/lubirthOpeningCloudManifest.spec.ts tests/e2e/lubirth-cloud-asset-opening.spec.ts
git rm -r apps/site/public/assets/lubirth/opening-clouds
git rm packages/lubirth-hero/scripts/opening-cloud-volume.html packages/lubirth-hero/scripts/bake-opening-cloud-assets.mjs
git rm -r docs/lubirth-cloud-asset-opening-evidence/2026-08-03
```

Keep commit `10d44e5` in history as the REJECT evidence; do not leave its screen-space media, tests, or now-stale checksums in the active tree.

- [ ] **Step 5: Run GREEN**

Run:

```sh
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudController.spec.ts tests/unit/lubirthOpeningCloudFrameProvider.spec.ts
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop
```

Expected: one real Canvas, no cloud overlay canvas, one hidden field video, one Earth-group shell and one shared veil.

- [ ] **Step 6: Commit**

```sh
git add packages/lubirth-hero/src/EarthMoonScene.tsx apps/site/visual/scenes/LuBirthSceneSlot.tsx apps/site/components/lubirth-cloud-asset-opening apps/site/components/LuBirthCloudAssetOpeningRoute.tsx apps/site/components/LuBirthCloudAssetOpeningRoute.module.css tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts
git commit -m "feat(lubirth): attach opening clouds to the Earth"
```

### Task 5: Verify spatial attachment, volume and gates

**Files:**
- Create: `docs/lubirth-globe-cloud-asset-evidence/2026-08-04/{README.md,checksums.sha256,runtime-desktop-contact-sheet.png,runtime-mobile-contact-sheet.png,telemetry.json}`
- Modify: `tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts`

- [ ] **Step 1: Add geometry and visual acceptance checks**

```ts
test("moves cloud detail on the Earth without changing the Moon crop", async ({ page }) => {
  await page.goto("/lubirth-cloud-asset-opening?location=ip&geoLat=31.2&geoLon=103.8");
  const frame0 = await captureCanvas(page);
  await nativeScrollToProgress(page, 0.12);
  const frame26 = await captureCanvas(page);

  expect(bodyCloudDelta(frame0, frame26)).toBeGreaterThan(8);
  expect(moonCropDelta(frame0, frame26, await readMoonProjection(page))).toBeLessThan(2);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthOpeningGlobeCloud)).toMatchObject({
    attachment: "earth-group",
    topScale: 1.0115,
    viewSteps: 3
  });
});
```

The test captures Canvas pixels instead of the hidden video. A moving body-cloud region proves temporal field updates; a stable Moon crop and zero DOM overlay proves it is not a camera-space layer. Add forward/reverse, reduced-motion, late-first-frame, decode, low-memory and background-resume fallback cases carried from the previous contract.

- [ ] **Step 2: Run desktop and mobile visual contracts**

Run:

```sh
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=mobile-landscape
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=mobile-portrait
```

Expected: all source swaps and fallback paths pass; desktop reports 3 view samples and mobile 2; no screenshot shows a cloud layer across the Moon outside Earth depth.

- [ ] **Step 3: Produce evidence and state the promotion result**

The README records exact media bytes, packed texture residency, all-I frame count, source/output SHA-256, field-channel variance, browser first-frame/seek/rAF/decode metrics, visual contact sheets and a physical device GPU report. It must say `PASS` only if the desktop post-handoff Relief-lite physical GPU p95 is ≤3 ms; otherwise it says `REJECT FOR DEFAULT PROMOTION` and the route stays query-only.

- [ ] **Step 4: Run final gates**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts tests/unit/lubirthOpeningCloudController.spec.ts tests/unit/lubirthOpeningCloudFrameProvider.spec.ts tests/unit/lubirthOpeningCloudFallbackPolicy.spec.ts
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop --project=mobile-landscape --project=mobile-portrait
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site build
git diff --check
shasum -a 256 -c docs/lubirth-globe-cloud-asset-evidence/2026-08-04/checksums.sha256
```

Expected: every software command exits 0. A missing physical timer extension is evidence insufficiency, never a synthetic GPU pass.

- [ ] **Step 5: Commit the verified replacement**

```sh
git add docs/lubirth-globe-cloud-asset-evidence/2026-08-04 tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts
git commit -m "docs(lubirth): record globe cloud asset evidence"
```

## Self-review

- **Spec coverage:** Tasks 1–2 replace the camera plate with globe-UV data; Task 3 reuses the Relief-lite volume model rather than adding real-time raymarching; Task 4 makes that mesh a child of the live Earth group and preserves atomic handoff; Task 5 verifies attachment, Moon non-occlusion, mobile behavior and promotion gates.
- **No placeholder check:** Each task names exact files, channel meanings, dimensions, handoff states, test commands and expected output.
- **Boundary check:** Apps own route/controller/DOM veil; `@miralith/lubirth-hero` owns the Earth-group mesh and public layer type. No package imports app code, no whole-scene image enters media, and the old DOM overlay is removed from active runtime.
