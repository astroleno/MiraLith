# CoScroll Shader4 × MiraLith Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Source Match caustic wallpaper with a MiraLith-native gravity-light field whose macro streams bend around the actual “观” anchor envelope while preserving the existing blue-jade material, opaque lyrics, and model-driven motion.

**Architecture:** Keep the existing single React Three Fiber canvas and the legacy CoScroll shader untouched. Source Match gets one alpha-1 fullscreen `ShaderMaterial`: it stays visually opaque but renders in the transparent queue, after the transmissive shell pass, so the shell sees the same transparent backing as the original CoScroll model canvas instead of sampling the caustic plane. A multi-capsule SDF approximates the “观” model silhouette, the real projected model center and Y-rotation drive its lens field, and the real smoothed angular speed drives advection, pulse, warp, and restrained chroma. No composer, postprocessing, render target, second canvas, third-party shader code, or new dependency is introduced.

**Tech Stack:** React Three Fiber, Three.js `ShaderMaterial`, GLSL, TypeScript, Playwright, pnpm.

---

## Locked design

**Visual thesis:** A cold blue-jade glyph behaves like a gravitational object in deep black space; soft ivory bands and broken fluid filaments shear around its calligraphic envelope like a solar corona, with only a trace of warm amber and micro-caustic texture at the brightest edges. The background must never resolve into a visible ball, closed ellipse, or black-hole disk behind the model.

**Content order:** alpha-1 shader background (transparent queue, depth-tested) → back lyrics → dual-layer jade anchor → front lyrics. Lyrics keep their current position, scale, opacity, depth test, and depth write behavior.

**Interaction:** the model's actual angle controls glyph projection and flow phase; the model's actual smoothed angular speed controls time scale, lens strength, pulse, and chroma; either wheel direction only increases the model's existing rotation direction; reduced-motion freezes both model and background.

**Source Match palette:**

- Deep base: `#010205`
- Blue-jade low light: `#2d6d8b`
- Cold ivory highlight: `#cbd5f5`
- Restrained amber edge: `#b77c49`, capped below 8% of the highlight contribution

**Explicit non-goals:**

- Do not copy Shader4 Pro source code; reproduce only the publicly visible visual language.
- Do not alter `sourceMatch=false` behavior.
- Do not change jade geometry, inner/outer material values, lyrics typography, lyric sizing, lyric opacity, or depth ordering.
- Do not add `EffectComposer`, chromatic-aberration postprocessing, `WebGLRenderTarget`, a second canvas, textures, HDR assets, or packages.
- Do not feed raw wheel velocity to the Source Match shader.
- Do not render a radial `wellDistance`/`wellRim` sphere behind the model. Subject linkage comes from the projected glyph SDF, tangent advection, and an irregular exterior corona only.

## File map

- Modify `packages/coscroll-scene/src/sourceCausticMotion.ts`: expose the anchor-facing and lens parameters derived from actual model motion.
- Modify `packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts`: implement the alpha-1 gravity stream, calligraphic SDF lens, fluid corona, pulse, micro-caustic, and edge-only chroma.
- Modify `packages/coscroll-scene/src/CoScrollCausticLightField.tsx`: project the anchor world position into NDC, provide responsive field scale and new uniforms, use normal alpha-1 blending for Source Match, and keep the caustic plane out of the model transmission prepass.
- Modify `packages/coscroll-scene/src/CoScrollSceneContent.tsx`: define one shared anchor position/scale and pass the same geometry framing to the anchor and light field.
- Modify `tests/e2e/coscroll.spec.ts`: add pure motion, shader-architecture, desktop/mobile visibility, motion-coupling, and regression coverage.

---

### Task 0: Preserve the current Organic Caustic V2 baseline

**Files:**

- Commit existing changes in `packages/coscroll-scene/src/CoScrollCausticLightField.tsx`
- Commit existing changes in `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- Commit existing changes in `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Commit existing changes in `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`
- Commit existing changes in `packages/coscroll-scene/src/types.ts`
- Commit existing `packages/coscroll-scene/src/sourceCausticMotion.ts`
- Commit existing `packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts`
- Commit existing changes in `tests/e2e/coscroll.spec.ts`

- [x] **Step 1: Run the current Source Match regression group**

Run:

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "coscroll source-match|source caustic"
```

Expected: every selected test passes. If a known unrelated route assertion is selected, narrow the expression to the Source Match model, lyrics, caustic, mobile, and reduced-motion tests and record the exclusion.

- [x] **Step 2: Run package typechecks and diff validation**

```bash
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
git diff --check
```

Expected: all commands exit `0`.

- [x] **Step 3: Commit and push the green baseline**

```bash
git add packages/coscroll-scene/src/CoScrollCausticLightField.tsx \
  packages/coscroll-scene/src/CoScrollJadeAnchor.tsx \
  packages/coscroll-scene/src/CoScrollSceneContent.tsx \
  packages/coscroll-scene/src/CoScrollTextBillboard.tsx \
  packages/coscroll-scene/src/types.ts \
  packages/coscroll-scene/src/sourceCausticMotion.ts \
  packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts \
  tests/e2e/coscroll.spec.ts
git commit -m "feat(coscroll): stabilize source-match material and caustics"
git push -u origin codex/coscroll-shader4-miralith
```

---

### Task 1: Extend the model-driven motion contract

**Files:**

- Modify `tests/e2e/coscroll.spec.ts`
- Modify `packages/coscroll-scene/src/sourceCausticMotion.ts`

- [x] **Step 1: Add failing pure-motion assertions**

Extend the base-speed test with:

```ts
expect(motion.anchorFacing).toBeCloseTo(Math.sin(-0.62), 4);
expect(motion.lensStrength).toBeCloseTo(0.32, 4);
```

Extend the direction-independent acceleration test with:

```ts
expect(forward.anchorFacing).toBeCloseTo(Math.sin(1), 4);
expect(forward.lensStrength).toBeGreaterThan(0.41);
expect(forward.lensStrength).toBeLessThanOrEqual(0.42);
```

- [x] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "source caustic remains calm|source caustic acceleration"
```

Expected: both tests fail because `anchorFacing` and `lensStrength` do not exist.

- [x] **Step 3: Add the new outputs**

Update `SourceCausticMotion`:

```ts
export interface SourceCausticMotion {
  energy: number;
  anchorFacing: number;
  fieldRotation: number;
  timeScale: number;
  warpAmount: number;
  pulseStrength: number;
  chromaOffset: number;
  lensStrength: number;
}
```

Return these exact mappings from `stepSourceCausticMotion`:

```ts
return {
  energy,
  anchorFacing: Math.sin(angle),
  fieldRotation: angle * 0.42,
  timeScale: 0.3 + energy * 1,
  warpAmount: 0.3 + energy * 0.18,
  pulseStrength: 0.12 + energy * 0.18,
  chromaOffset: 0.00045 + energy * 0.00135,
  lensStrength: 0.32 + energy * 0.1
};
```

Update the calm test's expected time scale to `0.3` and chroma offset to `0.00045`.

- [x] **Step 4: Run GREEN, typecheck, commit, and push**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "source caustic remains calm|source caustic acceleration"
pnpm --filter @miralith/coscroll-scene typecheck
git diff --check
git add packages/coscroll-scene/src/sourceCausticMotion.ts tests/e2e/coscroll.spec.ts
git commit -m "feat(coscroll): derive gravity field from anchor motion"
git push
```

---

### Task 2: Replace the Source Match shader with a glyph-linked gravity field

**Files:**

- Modify `tests/e2e/coscroll.spec.ts`
- Modify `packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts`

- [x] **Step 1: Add failing shader-contract assertions**

The Source Match shader test must assert:

```ts
expect(shader).toContain("uniform vec2 uAnchorCenter");
expect(shader).toContain("uniform vec2 uAnchorFieldScale");
expect(shader).toContain("uniform float uAnchorFacing");
expect(shader).toContain("uniform float uLensStrength");
expect(shader).toContain("float capsuleSdf(");
expect(shader).toContain("float sourceAnchorSdf(");
expect(shader).toContain("float macroStream");
expect(shader).toContain("float anchorRim");
expect(shader).toContain("float microCaustic");
expect(shader).toContain("vec3 amberEdge");
expect(shader).toContain("gl_FragColor = vec4(color, 1.0);");
expect(shader).not.toContain("WebGLRenderTarget");
```

- [x] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "source caustic uses organic layers"
```

Expected: failure on the new uniform and SDF assertions.

- [x] **Step 3: Implement the calligraphic SDF**

Use six smooth-unioned capsules, expressed in local anchor coordinates:

```glsl
float capsuleSdf(vec2 p, vec2 a, vec2 b, float radius) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - radius;
}

float smoothUnion(float a, float b, float softness) {
  float h = clamp(0.5 + 0.5 * (b - a) / softness, 0.0, 1.0);
  return mix(b, a, h) - softness * h * (1.0 - h);
}

float sourceAnchorSdf(vec2 p, float facing) {
  float projection = mix(0.24, 1.0, smoothstep(0.0, 0.92, abs(facing)));
  p.x /= projection;
  p.x *= facing < 0.0 ? -1.0 : 1.0;

  float distanceField = capsuleSdf(p, vec2(0.27, 0.78), vec2(0.25, -0.18), 0.13);
  distanceField = smoothUnion(distanceField, capsuleSdf(p, vec2(-0.02, 0.58), vec2(-0.07, -0.6), 0.12), 0.11);
  distanceField = smoothUnion(distanceField, capsuleSdf(p, vec2(-0.39, 0.34), vec2(-0.08, 0.04), 0.13), 0.12);
  distanceField = smoothUnion(distanceField, capsuleSdf(p, vec2(-0.42, -0.04), vec2(-0.08, -0.25), 0.13), 0.11);
  distanceField = smoothUnion(distanceField, capsuleSdf(p, vec2(-0.06, -0.58), vec2(0.34, -0.56), 0.12), 0.1);
  distanceField = smoothUnion(distanceField, capsuleSdf(p, vec2(0.34, -0.56), vec2(0.43, -0.28), 0.11), 0.09);
  return distanceField;
}
```

Compute the lens normal from two forward SDF differences, and use it to bend both the broad and pulse coordinates. The final shader must expose these named layers:

```glsl
float macroStream;
float pulseStreak;
float microCaustic;
float anchorRim;
```

Retain the current `hash21`, `gradient2`, `gradientNoise`, `fbm3`, `rotate2`, `lyricColumn`, and `ridgeField` implementations. Add the four uniforms above and replace `main` with this initial implementation before visual tuning:

```glsl
void main() {
  vec2 centered = vUv * 2.0 - 1.0;
  vec2 aspectUv = vec2(centered.x * uAspect, centered.y);

  float readingChannel = 0.0;
  readingChannel = max(readingChannel, lyricColumn(centered, uLyricCenters.x, 0.034));
  readingChannel = max(readingChannel, lyricColumn(centered, uLyricCenters.y, 0.034));
  readingChannel = max(readingChannel, lyricColumn(centered, uLyricCenters.z, 0.038));
  readingChannel = max(readingChannel, lyricColumn(centered, uLyricCenters.w, 0.034));

  vec2 anchorScale = max(uAnchorFieldScale, vec2(0.08));
  vec2 anchorPoint = (aspectUv - uAnchorCenter) / anchorScale;
  float anchorDistance = sourceAnchorSdf(anchorPoint, uAnchorFacing);
  float distanceStep = 0.018;
  vec2 lensNormal = normalize(
    vec2(
      sourceAnchorSdf(anchorPoint + vec2(distanceStep, 0.0), uAnchorFacing) - anchorDistance,
      sourceAnchorSdf(anchorPoint + vec2(0.0, distanceStep), uAnchorFacing) - anchorDistance
    ) + vec2(0.0001)
  );
  vec2 lensTangent = vec2(-lensNormal.y, lensNormal.x);
  float lensEnvelope = 1.0 - smoothstep(0.04, 1.35, max(anchorDistance, 0.0));
  float anchorRim = exp(-abs(anchorDistance) * 10.5);
  float anchorInterior = 1.0 - smoothstep(-0.1, 0.12, anchorDistance);

  vec2 field = rotate2(uFieldRotation - 0.12) * aspectUv * 0.72;
  field += vec2(uTime * 0.046, -uTime * 0.034);
  field += lensNormal * lensEnvelope * uLensStrength * 0.22;
  field += lensTangent * lensEnvelope * uLensStrength * 0.08 * sin(uTime * 0.38 + anchorDistance * 4.2);

  float warpX = fbm3(field * 0.68 + vec2(uTime * 0.026, -uTime * 0.019));
  float warpY = fbm3(field * 0.76 + vec2(-uTime * 0.021, uTime * 0.028));
  vec2 warped = field + (vec2(warpX, warpY) - 0.5) * uWarpAmount;
  float broadNoise = fbm3(warped * 0.58 + vec2(uTime * 0.014, -uTime * 0.011));

  float macroPhase =
    warped.x * 1.14 +
    warped.y * 0.68 +
    sin(warped.y * 1.52 + broadNoise * 2.6 + uTime * 0.12) * 0.88 +
    broadNoise * 1.82 +
    anchorDistance * lensEnvelope * 0.34;
  float macroBand = 0.5 + 0.5 * sin(macroPhase);
  float counterBand = 0.5 + 0.5 * cos(macroPhase * 0.58 - warped.y * 0.76 + broadNoise * 0.72);
  float macroStream = smoothstep(
    mix(0.57, 0.55, uIsMobile),
    mix(0.86, 0.84, uIsMobile),
    macroBand * 0.68 + counterBand * 0.12 + broadNoise * 0.2
  );

  float pulseGate = smoothstep(0.22, 0.9, 0.5 + 0.5 * sin(uTime * 0.62 + broadNoise * 4.0));
  float pulseStreak = pow(1.0 - abs(sin(macroPhase * 2.08 - uTime * 0.2)), 6.5);
  pulseStreak *= pulseGate * uPulseStrength;

  float chroma = uChromaOffset * mix(1.0, 0.68, uIsMobile);
  vec2 microField = warped * mix(1.32, 1.18, uIsMobile);
  float ridgeR = ridgeField(microField - lensNormal * chroma, uTime, broadNoise);
  float ridgeG = ridgeField(microField, uTime, broadNoise);
  float ridgeB = ridgeField(microField + lensNormal * chroma, uTime, broadNoise);
  vec3 spectralRidge = vec3(ridgeR, ridgeG, ridgeB);
  float microCaustic = dot(spectralRidge, vec3(0.2126, 0.7152, 0.0722));
  microCaustic *= mix(0.1, 0.18, uMotionEnergy);

  float macroLight = smoothstep(0.28, 0.92, macroStream) * 0.42;
  float pulseLight = smoothstep(0.025, 0.18, pulseStreak) * 0.3;
  float microLight = smoothstep(0.035, 0.2, microCaustic) * 0.11;
  float rimLight = anchorRim * mix(0.05, 0.12, macroStream) * (1.0 - anchorInterior * 0.45);
  float lightSignal = macroLight + pulseLight + microLight + rimLight;
  float highlight = smoothstep(0.08, 0.74, lightSignal);

  float intensity = clamp(uIntensity * uAnchorPresence, 0.0, 1.0);
  float glyphShadow = mix(0.14, 1.0, smoothstep(-0.08, 0.2, anchorDistance));
  float readingSuppression = mix(1.0, 0.92, readingChannel * readingChannel);
  vec3 deepBase = vec3(0.003, 0.006, 0.014);
  vec3 blueAir = uColorA * (0.018 + broadNoise * 0.024 + macroStream * 0.028);
  vec3 streamColor = mix(uColorA * 0.7, uColorB, highlight);
  vec3 color = deepBase + (blueAir + streamColor * lightSignal * intensity) * glyphShadow;
  color += uColorB * rimLight * intensity * 0.42;

  vec3 amberEdge = vec3(0.718, 0.486, 0.286) * anchorRim * highlight * 0.075;
  color += amberEdge * intensity;

  float spectralMono = dot(spectralRidge, vec3(0.2126, 0.7152, 0.0722));
  vec3 spectralDelta = spectralRidge - vec3(spectralMono);
  color += spectralDelta * microCaustic * highlight * 0.08;
  color *= readingSuppression;

  gl_FragColor = vec4(color, 1.0);
}
```

Compose an opaque background from the deep base, blue low light, cold-white stream, and restrained amber edge. Cap amber with:

```glsl
vec3 amberEdge = vec3(0.718, 0.486, 0.286) * anchorRim * highlight * 0.075;
```

Keep chroma edge-only by multiplying the spectral delta by `microCaustic * highlight`; never offset the final framebuffer or the lyric/model layers.

- [x] **Step 4: Run GREEN, typecheck, commit, and push**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "source caustic uses organic layers"
pnpm --filter @miralith/coscroll-scene typecheck
git diff --check
git add packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts tests/e2e/coscroll.spec.ts
git commit -m "feat(coscroll): add glyph-linked gravity light shader"
git push
```

---

### Task 3: Wire exact anchor framing and alpha-1 Source Match rendering

**Files:**

- Modify `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Modify `packages/coscroll-scene/src/CoScrollCausticLightField.tsx`
- Modify `tests/e2e/coscroll.spec.ts`

- [x] **Step 1: Add failing integration assertions**

```ts
expect(sceneContent).toContain("const sourceAnchorPosition");
expect(sceneContent).toContain("const sourceAnchorScale");
expect(sceneContent).toContain("anchorPosition={sourceAnchorPosition}");
expect(sceneContent).toContain("anchorScale={sourceAnchorScale}");
expect(field).toContain("uAnchorCenter");
expect(field).toContain("uAnchorFieldScale");
expect(field).toContain("uAnchorFacing");
expect(field).toContain("uLensStrength");
expect(field).toContain("THREE.NormalBlending");
expect(field).toContain("transparent");
```

- [x] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "shares anchor rotation phase"
```

Expected: failure on the new framing and opaque-blending assertions.

- [x] **Step 3: Share anchor position and scale in the scene**

Define once in `CoScrollSceneContent.tsx`:

```ts
const sourceAnchorPosition: [number, number, number] = [
  0,
  mobileSourceMatch ? 0.95 : -0.41 + SOURCE_MATCH_DESKTOP_Y_LIFT,
  0
];
const sourceAnchorScale = mobileSourceMatch
  ? 2.2 * 1.2 * 1.1
  : SOURCE_MATCH_MODEL_SCALE;
```

Use these values for `CoScrollJadeAnchor` and pass them to `CoScrollCausticLightField`.

- [x] **Step 4: Project the model center and set responsive field scale**

Add props:

```ts
anchorPosition?: [number, number, number];
anchorScale?: number;
```

Add uniforms:

```ts
uAnchorCenter: IUniform<THREE.Vector2>;
uAnchorFieldScale: IUniform<THREE.Vector2>;
uAnchorFacing: IUniform<number>;
uLensStrength: IUniform<number>;
```

In `useFrame`, project the exact world position through the active camera:

```ts
anchorProjectionPoint.set(...anchorPosition).project(camera);
liveUniforms.uAnchorCenter.value.set(
  anchorProjectionPoint.x * liveUniforms.uAspect.value,
  anchorProjectionPoint.y
);
```

Set field scale from the shared model scale and viewport mode:

```ts
const SOURCE_MATCH_MODEL_SCALE_REFERENCE = 2.8 * 1.2 * 1.1;
const normalizedScale = anchorScale / SOURCE_MATCH_MODEL_SCALE_REFERENCE;
liveUniforms.uAnchorFieldScale.value.set(
  (layout === "mobile" ? 0.31 : 0.27) * normalizedScale,
  (layout === "mobile" ? 0.36 : 0.42) * normalizedScale
);
```

Assign `motion.anchorFacing` and `motion.lensStrength` every frame. Use `THREE.NormalBlending`, alpha `1.0`, and the transparent render queue for Source Match so the plane remains visually opaque without contaminating the shell transmission prepass; preserve Additive blending for legacy CoScroll.

- [x] **Step 5: Run GREEN, typecheck, commit, and push**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "shares anchor rotation phase|original black-blue|lyric fills stay opaque"
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
git diff --check
git add packages/coscroll-scene/src/CoScrollSceneContent.tsx \
  packages/coscroll-scene/src/CoScrollCausticLightField.tsx \
  tests/e2e/coscroll.spec.ts
git commit -m "feat(coscroll): align gravity field with jade anchor"
git push
```

---

### Task 4: Tune desktop and mobile composition in the browser

**Files:**

- Modify `packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts`
- Modify `packages/coscroll-scene/src/CoScrollCausticLightField.tsx` only if responsive field scale needs correction
- Modify `tests/e2e/coscroll.spec.ts`

- [x] **Step 1: Preserve automated visual boundaries**

Desktop top-band limits:

```ts
expect(profile.darkShare).toBeGreaterThan(0.5);
expect(profile.brightShare).toBeGreaterThan(0.008);
expect(profile.brightShare).toBeLessThan(0.2);
expect(profile.meanLuma).toBeGreaterThan(3);
expect(profile.meanLuma).toBeLessThan(46);
```

Mobile top-band limits:

```ts
expect(profile.darkShare).toBeGreaterThan(0.48);
expect(profile.darkShare).toBeLessThan(0.985);
expect(profile.brightShare).toBeGreaterThan(0.004);
expect(profile.brightShare).toBeLessThan(0.2);
expect(profile.meanLuma).toBeGreaterThan(2.5);
expect(profile.meanLuma).toBeLessThan(46);
```

Keep the existing real-frame acceleration requirement at `boosted.meanDelta > idle.meanDelta * 1.2`.

- [x] **Step 2: Start the site and capture desktop idle/scroll frames**

```bash
pnpm --filter @miralith/site dev
agent-browser --session coscroll-gravity set viewport 1440 900
agent-browser --session coscroll-gravity open "http://localhost:3000/coscroll-spike?sourceMatch=1&motionTest=1"
agent-browser --session coscroll-gravity wait --load networkidle
agent-browser --session coscroll-gravity screenshot output/agent-browser/coscroll-gravity-desktop-idle.png
agent-browser --session coscroll-gravity scroll down 420
agent-browser --session coscroll-gravity wait 350
agent-browser --session coscroll-gravity screenshot output/agent-browser/coscroll-gravity-desktop-scroll.png
```

The desktop composition must show one or two soft macro streams wrapping the anchor, a broken Shader4-like fluid corona localized by the glyph field, visible but subordinate micro-caustics, no circular/elliptical well or black-hole disk, no large RGB split, and no lyric halo or scale change.

- [x] **Step 3: Capture mobile idle/scroll frames**

```bash
agent-browser --session coscroll-gravity set viewport 390 844
agent-browser --session coscroll-gravity open "http://localhost:3000/coscroll-spike?sourceMatch=1&motionTest=1"
agent-browser --session coscroll-gravity wait --load networkidle
agent-browser --session coscroll-gravity screenshot output/agent-browser/coscroll-gravity-mobile-idle.png
agent-browser --session coscroll-gravity scroll down 280
agent-browser --session coscroll-gravity wait 350
agent-browser --session coscroll-gravity screenshot output/agent-browser/coscroll-gravity-mobile-scroll.png
agent-browser --session coscroll-gravity close
```

The mobile composition must keep the anchor and its brightest rim inside the viewport, preserve dark negative space above the lyrics, and avoid a full-frame black disk or clipped dominant band.

- [x] **Step 4: Adjust one parameter family at a time**

Tune in this order only:

1. SDF field scale and anchor center.
2. Macro stream phase, threshold, and lens displacement.
3. Pulse visibility and idle/boost ratio.
4. Micro-caustic amount.
5. Chroma and amber edge strength.

The Shader4 reference is used for its iterative sine-field motion, soft high-contrast streak hierarchy, and restrained edge chroma. Its closed radial sphere is intentionally not carried over; the MiraLith glyph and its exterior SDF replace that compositional role.

- [x] **Step 5: Run visual tests, typecheck, commit, and push**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "source caustic|source-match"
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
git diff --check
git add packages/coscroll-scene/src/shaders/coScrollSourceCausticShader.ts \
  packages/coscroll-scene/src/CoScrollCausticLightField.tsx \
  tests/e2e/coscroll.spec.ts
git commit -m "fix(coscroll): tune gravity light composition"
git push
```

---

### Task 5: Final verification and handoff

**Files:**

- Verify all files changed by Tasks 0–4
- Update this plan's checkboxes to reflect executed work

- [x] **Step 1: Run full scoped verification**

```bash
pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --grep "source caustic|coscroll source-match"
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site build
git diff --check
```

Expected: all scoped tests and validation commands exit `0`. If the unfiltered historical test file still contains unrelated poster/home/legacy-asset failures, report them separately and do not conflate them with this feature.

- [x] **Step 2: Inspect repository scope**

```bash
git status --short
git diff --stat origin/codex/coscroll-shader4-miralith...HEAD
git log --oneline --decorate -6
```

Expected: commits contain only the plan and CoScroll feature files; unrelated existing files remain unstaged.

- [x] **Step 3: Commit the completed plan record and push**

```bash
git add docs/superpowers/plans/2026-07-12-coscroll-shader4-miralith.md
git commit -m "docs(coscroll): record gravity shader implementation"
git push
```

## Execution record — 2026-07-12

- Source Match scoped suite: 27/27 passed.
- Real model-motion acceleration: 3/3 repeated runs passed.
- CoScroll typecheck, Site typecheck, Site lint, Site production build, and `git diff --check`: passed.
- Desktop and mobile idle/scroll frames inspected; the closed well/sphere is absent, the fluid corona remains visible, the alpha-1 background stays fixed, and the original neutral shell/blue core separation is restored.
- Knowledge graph refreshed with `graphify update .`.

## Follow-up execution record — 2026-07-13

- [x] Split the anchor field into a stable, three-capsule low-frequency hull SDF and the existing six-capsule stroke SDF.
- [x] Feed the same real anchor facing into both scales while retaining a wider `0.48` projection floor for the hull and the detailed `0.24` projection floor for strokes.
- [x] Use the hull for macro lensing and an open, side-biased corona; use the stroke field only for local normal perturbation and broken filament energy. The fields are never collapsed with `min()`, so they cannot resolve into a second solid glyph or closed disk.
- [x] Replace repeated finite-difference SDF evaluation with screen-space derivatives, reducing the combined normal calculation to one hull and one stroke evaluation per pixel.
- [x] Source Match scoped suite: 29/29 passed. Real model-motion acceleration: 3/3 repeated runs passed.
- [x] Desktop idle/scroll and mobile idle frames inspected. CoScroll typecheck, Site typecheck, Site lint, Site production build, and scoped `git diff --check`: passed.
