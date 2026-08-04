# LuBirth Cloud Continuity and Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the perceptible opening-cloud-to-Relief-lite cut while giving the opening clouds a globe-conforming opaque base, a thicker animated body, and sparse high wisps—without reintroducing a screen-space Earth image.

**Architecture:** Keep the existing Relief-lite mesh mounted as the low cloud base throughout the opening and after handoff; it is the same object and same globe-UV field that the user sees after progress `0.195`. The packed all-I video is an opening-only detail field derived from the live source texture: its `128×64` geographic anchor stays in the same Relief-lite UV coordinate system, while bounded local height/morphology/concavity evolve. Frames `39–42` converge to that low-frequency anchor while the independent veil closes; the persistent base—not a raw video-frame match—owns exact post-cut continuity. `LandingOpeningGlobeCloud` renders a tightly surface-locked body and sparse upper wisp shell above the base, then their opacity reaches zero under the opaque veil before the live-only state.

**Tech Stack:** Next.js 16, React 19, Three.js/R3F, Relief-lite front-to-back thin-shell shader, WebGL2 offline field bake, all-I H.264/FFmpeg, TypeScript, Playwright.

---

## Locked visual and correctness contracts

| Concern | Contract |
| --- | --- |
| No full-scene media | The video remains scalar globe-UV data only; no Earth, sky, stars, Moon, title, or UI pixels enter the asset. |
| Continuity | The normal `LandingReliefCloud` is mounted before, during, and after the opening. The opening video is anchored to `earth-cloud-field-nasa-lite-2k.png`, uses the same cloud UV/scroll offsets, and converges to the low-frequency geographic anchor by frame 42; the persistent base owns exact post-cut continuity. |
| Optical hierarchy | Persistent Relief-lite is the low base; the opening body provides dense occlusion at cloud cores; the upper shell supplies sparse illuminated wisps. The near-side Earth and limb background must not show through dense cloud cores. |
| Handoff | `0–0.18`: base + body + wisps. `0.18–0.195`: the independent veil closes and body/wisp opacity decays to zero. At exactly `0.195`: remove opening meshes beneath a fully opaque veil; the already-mounted base is unchanged. `0.195–0.22`: open veil over the base. |
| Reverse/fallback | Existing frame addressability, hysteresis, release, reduced-motion, decode-error, background-resume and low-memory fallbacks remain unchanged. If no decoded field is available, only the live base renders. |
| Veil | `TransitionVeil` stays a DOM sibling above Canvas with no pointer events and progress-only opacity. Its full-color backplane guarantees the atomic cut; a child cloud-form layer gives the close/open visual motivation without exposing either representation at peak opacity. |
| Scope | Only `/lubirth-cloud-asset-opening`, LuBirth hero cloud internals, assets, tests, plan and evidence change. No default homepage promotion, CoScroll, Radio Gaga, global CSS, or query-route removal. |

## File map

| Path | Responsibility |
| --- | --- |
| `packages/lubirth-hero/src/LandingReliefCloud.tsx` | Adds optional opening-only body-alpha and height-band uniforms while preserving default Relief-lite output. |
| `packages/lubirth-hero/src/LandingReliefCloudShell.tsx` | Carries the optional cloud-body runtime values into a reusable shell. |
| `packages/lubirth-hero/src/LandingOpeningGlobeCloud.tsx` | Renders the opening body and high-wisp shells, uses the live cloud offset, fades both to zero by cut frame, and emits continuity telemetry. |
| `packages/lubirth-hero/src/EarthMoonScene.tsx` | Keeps the normal Relief-lite base mounted when an opening layer is active, then draws opening meshes above it. |
| `packages/lubirth-hero/scripts/opening-globe-cloud-field.html` | Samples a 128×64 geographically anchored Relief-lite field and applies bounded procedural detail before low-frequency convergence. |
| `packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs` | Supplies the live-field PNG to the offline renderer, generates v3 media, verifies all-I compression and records the anchor source SHA-256. |
| `apps/site/public/assets/lubirth/opening-globe-clouds/{desktop,mobile}.mp4` | Re-baked packed globe-field variants. |
| `apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json` | Records the source-field anchor, field channel layout, convergence frame, provenance and output checksums. |
| `apps/site/content/lubirthOpeningGlobeCloudManifest.ts` | Validates the live-field anchor and final-frame convergence contract. |
| `apps/site/components/lubirth-cloud-asset-opening/TransitionVeil.tsx` | Adds only DOM-local cloud-form markup; preserves the full shared backplane. |
| `apps/site/components/LuBirthCloudAssetOpeningRoute.module.css` | Styles the independent cloud-form veil without allowing pointer input or a screen-space cloud renderer. |
| `tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts` | Verifies source anchor, packed final-frame convergence, all-I media and fidelity budgets. |
| `tests/unit/lubirthOpeningGlobeCloudShell.spec.ts` | Locks persistent base/body/wisp policies, radius ordering and zero-at-cut detail opacity. |
| `tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts` | Verifies a live base is already active during opening, shared offset/anchoring, layered telemetry, veil ownership and release/fallback paths. |
| `docs/lubirth-globe-cloud-asset-evidence/2026-08-04` | Stores new contact sheets, telemetry, checksums and the non-promotion result. |

### Task 1: Lock the continuity and layered-shell policy with failing tests

**Files:**
- Modify: `tests/unit/lubirthOpeningGlobeCloudShell.spec.ts`
- Modify: `tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts`
- Modify: `packages/lubirth-hero/src/LandingReliefCloudShell.tsx`
- Modify: `packages/lubirth-hero/src/LandingOpeningGlobeCloud.tsx`

- [x] **Step 1: Write the failing policy tests**

```ts
test("keeps the Relief-lite base below a dense body and sparse upper wisps", () => {
  const policy = resolveOpeningGlobeCloudShellPolicy(false);
  expect(policy).toMatchObject({
    base: { persistent: true, bottomScale: 1.0003, topScale: 1.0035 },
    body: { bottomScale: 1.0035, topScale: 1.0062, opacity: 0.78, baseOpacityFloor: 0.3 },
    wisps: { bottomScale: 1.0062, topScale: 1.0074, opacity: 0.28 }
  });
  expect(resolveOpeningCloudDetailOpacity(39)).toBe(0.9);
  expect(resolveOpeningCloudDetailOpacity(42)).toBe(0);
});
```

Add an E2E expectation at progress `0` that both `__MiraLithLuBirthReliefCloud` and `__MiraLithLuBirthOpeningGlobeCloud` are active; assert opening telemetry reports `base: "persistent-relief-lite"`, `cloudOffset: liveBase.cloudOffset`, and `detailOpacity > 0`.

- [x] **Step 2: Run RED**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop
```

Expected: tests fail because there is one opening shell, no persistent base telemetry, and no frame-to-opacity convergence helper.

- [x] **Step 3: Add the typed opening policy and pure fade helper**

```ts
export function resolveOpeningCloudDetailOpacity(frame: number, maximumOpacity: number) {
  const t = MathUtils.clamp((frame - 39) / (42 - 39), 0, 1);
  return maximumOpacity * (1 - t * t * (3 - 2 * t));
}
```

Define the persistent base with existing `LANDING_RELIEF_LITE_CLOUD_*` radii; body and wisps must remain below the 1.014 limb atmosphere and satisfy `base.top <= body.bottom < body.top <= wisps.bottom < wisps.top`.

- [x] **Step 4: Run GREEN for the pure policy contract**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts
```

Expected: policy test passes while E2E remains red until the scene integration task.

### Task 2: Render a persistent Relief-lite base plus body/wisp shells

**Files:**
- Modify: `packages/lubirth-hero/src/LandingReliefCloud.tsx`
- Modify: `packages/lubirth-hero/src/LandingReliefCloudShell.tsx`
- Modify: `packages/lubirth-hero/src/LandingOpeningGlobeCloud.tsx`
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Modify: `tests/unit/lubirthOpeningGlobeCloudShell.spec.ts`
- Modify: `tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts`

- [x] **Step 1: Add a failing shader/runtime test for body occlusion controls**

```ts
expect(readFileSync("packages/lubirth-hero/src/LandingReliefCloud.tsx", "utf8")).toContain("cloudBodyOpacityFloor");
expect(readFileSync("packages/lubirth-hero/src/LandingReliefCloud.tsx", "utf8")).toContain("cloudHeightBand");
```

The E2E test must require `layerCount: 3`, `basePersistent: true`, and `detailOpacity: 0` after progress `0.2`.

- [x] **Step 2: Run RED**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts
```

Expected: fail because these runtime uniforms and telemetry do not exist.

- [x] **Step 3: Add opening-only body controls without changing the default material path**

Extend `LandingReliefCloudShellRuntime` with:

```ts
cloudBodyOpacityFloor?: number;
cloudHeightBand?: readonly [number, number];
cloudOpacityCeiling?: number;
```

Default values remain `[0, 1]`, `0`, and `0.92`, preserving normal Relief-lite. In the fragment shader, mask each sample by `cloudHeightBand`; after ordered front-to-back integration, enforce `max(integratedAlpha, cloudCore * cloudBodyOpacityFloor)` only for the body and clamp with the optional ceiling. This makes dense body cores block the Earth/background while leaving gaps and high wisps translucent.

- [x] **Step 4: Keep the normal base mounted and draw the opening detail above it**

In `EarthMoonScene`, render `LandingReliefCloud` whenever Relief-lite cloud shells are enabled, including when `openingCloudLayer.active` is true. Render `LandingOpeningGlobeCloud` as a sibling afterward, with a higher `renderOrder`; do not replace the base conditionally.

`LandingOpeningGlobeCloud` must create two `LandingReliefCloudShell` meshes sharing the one `VideoTexture`:

```tsx
<LandingReliefCloudShell policy={policy.body} runtime={{
  cloudOffset: lightingFrame.cloudOffsetRef.current,
  opacity: resolveOpeningCloudDetailOpacity(layer.frame, policy.body.opacity),
  cloudBodyOpacityFloor: policy.body.baseOpacityFloor,
  cloudHeightBand: [0.05, 0.84]
}} />
<LandingReliefCloudShell policy={policy.wisps} runtime={{
  cloudOffset: lightingFrame.cloudOffsetRef.current,
  opacity: resolveOpeningCloudDetailOpacity(layer.frame, policy.wisps.opacity),
  cloudHeightBand: [0.66, 1]
}} />
```

Expose telemetry: `base: "persistent-relief-lite"`, `layerCount: 3`, `cloudOffset`, `bodyOpacity`, `wispOpacity`, `detailOpacity`, and all three radii. By frame 42 both opening opacities must be zero; no source swap is visible when the veil opens.

- [x] **Step 5: Run GREEN**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts tests/unit/lubirth-relief-lite.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop
```

Expected: default Relief-lite regression tests pass; E2E observes an always-active base and the opening-only details fade under the veil.

### Task 3: Re-bake the opening field from the live Relief-lite source texture

**Files:**
- Modify: `packages/lubirth-hero/scripts/opening-globe-cloud-field.html`
- Modify: `packages/lubirth-hero/scripts/bake-opening-globe-cloud-assets.mjs`
- Modify: `apps/site/public/assets/lubirth/opening-globe-clouds/{desktop,mobile}.mp4`
- Modify: `apps/site/public/assets/lubirth/opening-globe-clouds/manifest.json`
- Modify: `apps/site/content/lubirthOpeningGlobeCloudManifest.ts`
- Modify: `tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts`

- [x] **Step 1: Write failing source-anchor and final-frame convergence assertions**

```ts
expect(manifest.source.anchor).toMatchObject({
  src: "/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png",
  channelLayout: "v3-r-depth-g-height-b-morphology-a-concavity",
  convergenceFrame: 42
});
expect(normalizedLowFrequencyCoverageDifference(
  decodePackedFieldFrame(desktopAsset, 42),
  decodeAndScaleRgba(manifest.source.anchor.src, desktop.rawWidth, desktop.rawHeight)
)).toBeLessThan(0.11);
```

The test still requires perceptible early temporal change at frame `0` versus `24`, but it must compare `42` against the live source rather than requiring arbitrary drift at the cut.

- [x] **Step 2: Run RED**

Run:

```sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts
```

Expected: fail because the pre-v3 manifest has no geographic-anchor provenance or low-frequency convergence contract.

- [x] **Step 3: Make the offline source sample the actual live field**

The bake script reads `apps/site/public/assets/lubirth/textures/earth-cloud-field-nasa-lite-2k.png`, passes it as an in-memory data URL before page load, and includes its SHA-256 in the manifest. The HTML source uploads it with `UNPACK_COLORSPACE_CONVERSION_WEBGL = NONE`, samples a `128×64` smooth geographic grid, preserves the source field's channel semantics, and applies bounded local evolution:

```glsl
vec4 baseField = sampleGeographicAnchor(earthUv);
vec4 stable = preserveSourceChannelSemantics(baseField);
float detailWeight = 1.0 - smoothstep(35.0 / 47.0, 42.0 / 47.0, frameProgress);
vec4 animated = boundedAnchoredEvolution(stable, direction, frameProgress, detailWeight);
return mix(animated, stable, 1.0 - detailWeight);
```

Coverage remains geographically anchored; only bounded local relief evolves. Frame 42 converges to the low-frequency geographic anchor, while the persistent live base guarantees the exact visual post-cut field.

- [x] **Step 4: Generate v3 assets and pass the asset contract**

Run:

```sh
pnpm --filter @miralith/lubirth-hero exec node scripts/bake-opening-globe-cloud-assets.mjs
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts
```

Expected: 48 all-I frames; desktop ≤6 MiB and mobile ≤2 MiB; existing PSNR/SSIM gates pass; final packed frame remains within the defined low-frequency coverage gate of the live PNG anchor.

### Task 4: Make the shared veil visually cloud-motivated while preserving atomic coverage

**Files:**
- Modify: `apps/site/components/lubirth-cloud-asset-opening/TransitionVeil.tsx`
- Modify: `apps/site/components/LuBirthCloudAssetOpeningRoute.module.css`
- Modify: `tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts`

- [x] **Step 1: Write a failing DOM ownership test**

```ts
await expect(page.locator("[data-transition-veil]")).toHaveAttribute(
  "data-layer-above", "earth canvas and globe cloud shell"
);
await expect(page.locator("[data-transition-veil-cloud-form]")).toHaveCount(1);
await expect(page.locator("[data-transition-veil]"))
  .toHaveCSS("pointer-events", "none");
```

- [x] **Step 2: Run RED**

Run:

```sh
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop
```

Expected: fail because the veil contains only a flat color element.

- [x] **Step 3: Add only a DOM-local cloud form**

Keep the parent’s opaque `backgroundColor` and progress-driven opacity untouched. Add a decorative child with layered radial gradients, blur and `mix-blend-mode: screen`; it never receives pointer events and the solid parent remains fully opaque at peak. Do not add a video, canvas, image plate, or screen-space cloud asset.

- [x] **Step 4: Run GREEN**

Run:

```sh
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts --project=desktop
```

Expected: DOM ownership and all existing handoff/fallback assertions pass.

### Task 5: Verify visual behavior, budgets and evidence without promotion

**Files:**
- Modify: `docs/lubirth-globe-cloud-asset-evidence/2026-08-04/README.md`
- Create/Modify: `docs/lubirth-globe-cloud-asset-evidence/2026-08-04/{continuity-telemetry.json,continuity-browser-*.png,checksums.sha256}`

- [x] **Step 1: Capture progress `0`, `0.12`, `0.18`, `0.195`, `0.22`, and reverse `0.18`**

At the first three points require `basePersistent: true`, `layerCount: 3`, and nonzero opening detail. At `.195` require a fully opaque veil and `detailOpacity: 0`; at `.22` require live-only Relief-lite and released presentation texture. Reverse must re-arm before revealing the opening field.

- [x] **Step 2: Run the full scoped checks**

Run:

```sh
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site lint
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningGlobeCloudManifest.spec.ts tests/unit/lubirthOpeningGlobeCloudShell.spec.ts tests/unit/lubirthOpeningCloudController.spec.ts tests/unit/lubirth-relief-lite.spec.ts
pnpm exec playwright test tests/e2e/lubirth-globe-cloud-asset-opening.spec.ts
pnpm --filter @miralith/site build
git diff --check
```

Expected: all checks pass. Record the results but do not assert a physical-device GPU p95 or promote the query-only route to the default homepage.

- [x] **Step 3: Review and commit the isolated branch**

Confirm `git status --short` contains only continuity/depth files, excludes CoScroll, Radio Gaga, `globals.css`, `next-env.d.ts`, `downloads/`, and historical evidence directories. Commit only after the scoped tests, typechecks, lint, build and `git diff --check` have fresh successful output.

## Plan review

- **Coverage:** persistent same-field base (Task 2), source-aligned animated detail and cut convergence (Task 3), real cloud occlusion/stratification (Task 2), independent cloud-motivated veil (Task 4), reverse/fallback/asset budgets/evidence (Tasks 1, 3, 5).
- **No placeholder scan:** all files, acceptance points, source texture, frame numbers, ranges, commands and expected outcomes are explicit.
- **Type consistency:** `resolveOpeningCloudDetailOpacity`, `cloudBodyOpacityFloor`, `cloudHeightBand`, `layerCount`, `detailOpacity`, `basePersistent`, and `source.anchor` are introduced before their tests and telemetry consumers.
