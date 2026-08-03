# LuBirth Cloud Asset Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build a query-only LuBirth opening in which the real IP-driven Earth remains live and a separately baked, visibly time-varying cloud asset is composited over it until the existing Relief-lite path owns the scene.

**Architecture:** The rejected opaque full-frame plate is removed. Earth, Moon and atmosphere stay in the existing live R3F Canvas for every progress value. An offline procedural RGB+alpha cloud sequence overlays only that Canvas during 0–0.195; an independent TransitionVeil hides removal until 0.22. The sequence is a single all-I H.264 video with RGB in its left half and alpha in its right half, so one frame-addressable provider controls both channels without browser alpha-video support.

**Tech Stack:** Next.js 16, React 19, existing Three.js/R3F LuBirth scene, WebGL2 DOM overlay, all-I H.264 via FFmpeg, deterministic local Chromium bake via Playwright, TypeScript and Playwright.

---

## Locked architecture

| Boundary | Required implementation |
| --- | --- |
| Real Earth | LuBirthSceneSlot owns real IP Earth, Moon, atmosphere and Relief-lite for the complete interaction. |
| Cloud asset | OpeningCloudPack contains cloud colour, alpha and optional depth/shadow only. It must contain no Earth, Moon, stars, sky or text pixels. |
| Source | Internal deterministic procedural volume renderer, fixed seed, recorded source script, SHA-256 and internal license. ImageGen and whole-scene stills are prohibited. |
| Handoff | 0–0.18 cloud pack over live Earth; 0.18–0.195 close shared veil; hide pack at 0.195 under fully closed veil; 0.195–0.22 open veil; at or after 0.22 release decoded frames and presentation GL context. |
| Fallback | Reduced motion, late first frame, decode error, low memory and background restore hide the pack and preserve live Relief-lite. |
| Scope | Create only /lubirth-cloud-asset-opening. Do not alter /, MiraLithHome, CoScroll, Radio Gaga, globals.css or the rejected evidence branches. |

## File map

| Path | Responsibility |
| --- | --- |
| packages/lubirth-hero/scripts/opening-cloud-volume.html | Transparent WebGL2 procedural volume source used only for offline bake. |
| packages/lubirth-hero/scripts/bake-opening-cloud-assets.mjs | Captures 48 RGBA frames per tier, packs RGB+alpha all-I MP4, writes hashes and contact sheets. |
| apps/site/public/assets/lubirth/opening-clouds/desktop.mp4 | 1440×810 cloud-only packed video. |
| apps/site/public/assets/lubirth/opening-clouds/mobile.mp4 | 960×444 cloud-only packed video. |
| apps/site/public/assets/lubirth/opening-clouds/manifest.json | Provenance, timing, packing, budget and checksum contract. |
| apps/site/content/lubirthOpeningCloudManifest.ts | Typed validator and progress-to-frame mapping. |
| apps/site/components/lubirth-cloud-asset-opening/{types,controller,frameProvider}.ts | Testable frame addressing, arming, release and reverse state machine. |
| apps/site/components/lubirth-cloud-asset-opening/PackedCloudOverlay.tsx | WebGL2 canvas that samples RGB and alpha halves of one video. |
| apps/site/components/lubirth-cloud-asset-opening/TransitionVeil.tsx | Independent DOM layer above Canvas and cloud overlay. |
| apps/site/components/lubirth-cloud-asset-opening/OpeningCloudStack.tsx | Wires provider, controller, overlay and veil. |
| apps/site/components/LuBirthCloudAssetOpeningRoute.tsx | Live scene, native scroll progress, fallback and telemetry. |
| apps/site/components/LuBirthCloudAssetOpeningRoute.module.css | Isolated sticky review stage and pointer-safe layers. |
| apps/site/app/lubirth-cloud-asset-opening/page.tsx | Query-only page entry. |
| tests/unit/lubirthOpeningCloudManifest.spec.ts | Asset contract and non-whole-plate checks. |
| tests/unit/lubirthOpeningCloudController.spec.ts | Controller state and reverse/fallback checks. |
| tests/e2e/lubirth-cloud-asset-opening.spec.ts | Real live Canvas, native scroll, temporal frame change and release checks. |
| docs/lubirth-cloud-asset-opening-evidence/2026-08-03 | Asset/contact-sheet/telemetry evidence and checksum ledger. |

### Task 1: Define cloud-only media contract first

**Files:**
- Create: apps/site/content/lubirthOpeningCloudManifest.ts
- Create: apps/site/public/assets/lubirth/opening-clouds/manifest.json
- Create: tests/unit/lubirthOpeningCloudManifest.spec.ts

- [ ] **Step 1: Write the failing manifest test**

~~~ts
import { expect, test } from "@playwright/test";
import {
  mapOpeningCloudProgressToFrame,
  validateOpeningCloudManifest
} from "../../apps/site/content/lubirthOpeningCloudManifest";

const validManifestFixture = {
  id: "opening-cloud-test",
  cloudOnly: true,
  frameRate: 30,
  frameCount: 48,
  packing: "left-rgb-right-alpha",
  colorSpace: "rec709-srgb-sdr",
  source: { provenance: "internal-procedural" },
  handoff: { cutProgress: 0.195, liveProgress: 0.22 }
};

test.describe("opening cloud manifest", () => {
  test("rejects a full-scene source", () => {
    expect(() => validateOpeningCloudManifest({
      id: "bad",
      cloudOnly: false,
      source: { provenance: "imagegen-full-scene" }
    })).toThrow(/internal-procedural.*cloud-only/i);
  });

  test("maps opening progress to seekable cloud frames", () => {
    const manifest = validateOpeningCloudManifest(validManifestFixture);
    expect(mapOpeningCloudProgressToFrame(manifest, 0)).toBe(0);
    expect(mapOpeningCloudProgressToFrame(manifest, 0.18)).toBe(39);
    expect(mapOpeningCloudProgressToFrame(manifest, 0.195)).toBe(42);
  });
});
~~~

- [ ] **Step 2: Run RED**

Run: pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudManifest.spec.ts

Expected: failure resolving lubirthOpeningCloudManifest.

- [ ] **Step 3: Implement validator and mapper**

~~~ts
export const OPENING_CLOUD_PACKING = "left-rgb-right-alpha" as const;

export function mapOpeningCloudProgressToFrame(
  manifest: OpeningCloudManifest,
  progress: number
) {
  const clamped = Math.max(0, Math.min(manifest.handoff.cutProgress, progress));
  return Math.round(
    (clamped / manifest.handoff.liveProgress) * (manifest.frameCount - 1)
  );
}

export function validateOpeningCloudManifest(value: unknown): OpeningCloudManifest {
  const manifest = value as OpeningCloudManifest;
  if (
    manifest.cloudOnly !== true ||
    manifest.source.provenance !== "internal-procedural" ||
    manifest.packing !== OPENING_CLOUD_PACKING ||
    manifest.colorSpace !== "rec709-srgb-sdr" ||
    manifest.frameRate !== 30 ||
    manifest.frameCount !== 48
  ) {
    throw new Error("Opening cloud media must be internal-procedural and cloud-only");
  }
  return manifest;
}
~~~

The JSON contract records source generator path/version, seed, parameters, source SHA-256, output SHA-256, packed dimensions, 48 frames at 30fps, cloudOnly true, alpha packing and desktop/mobile ceilings.

- [ ] **Step 4: Run GREEN**

Run:
~~~sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudManifest.spec.ts
pnpm --filter @miralith/site typecheck
~~~

Expected: both exit 0.

- [ ] **Step 5: Commit**

~~~sh
git add apps/site/content/lubirthOpeningCloudManifest.ts apps/site/public/assets/lubirth/opening-clouds/manifest.json tests/unit/lubirthOpeningCloudManifest.spec.ts
git commit -m "test(lubirth): define cloud-only opening asset contract"
~~~

### Task 2: Bake and accept temporal cloud-only media before runtime work

**Files:**
- Create: packages/lubirth-hero/scripts/opening-cloud-volume.html
- Create: packages/lubirth-hero/scripts/bake-opening-cloud-assets.mjs
- Create: apps/site/public/assets/lubirth/opening-clouds/{desktop,mobile}.mp4
- Modify: apps/site/public/assets/lubirth/opening-clouds/manifest.json
- Create: docs/lubirth-cloud-asset-opening-evidence/2026-08-03/{README.md,checksums.sha256,desktop-cloud-contact-sheet.png,mobile-cloud-contact-sheet.png}
- Modify: tests/unit/lubirthOpeningCloudManifest.spec.ts

- [ ] **Step 1: Add a failing output assertion**

~~~ts
import { expect, test } from "@playwright/test";

test("publishes all-I packed cloud-only variants with temporal alpha change", async () => {
  const manifest = await readPublicManifest();
  for (const tier of ["desktop", "mobile"] as const) {
    const variant = manifest.variants[tier];
    expect(variant.packing).toBe("left-rgb-right-alpha");
    expect(variant.frameCount).toBe(48);
    expect(variant.keyframePolicy).toBe("all-i");
    expect(variant.transferBytes).toBeLessThanOrEqual(variant.maxTransferBytes);
  }
  expect(await alphaDifference("desktop", 0, 24)).toBeGreaterThan(0.015);
});
~~~

- [ ] **Step 2: Run RED**

Run: pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudManifest.spec.ts

Expected: media/output metadata assertion fails because no assets exist.

- [ ] **Step 3: Implement deterministic procedural volume bake**

The HTML file exposes window.renderOpeningCloudFrame(frameIndex). It clears alpha to zero and renders a fixed-seed, front-to-back density integration with Worley/fBm shape, detail erosion, wind advection and directional single-scattering. It has no draw code or texture input for an Earth, Moon, star field, background or text.

~~~js
const FRAME_COUNT = 48;
const FRAME_RATE = 30;

async function bakeVariant({ width, height, outputPath, maxTransferBytes }) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(volumeRendererUrl);
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    await page.evaluate((index) => window.renderOpeningCloudFrame(index), frame);
    await page.screenshot({
      path: framePath(frame),
      omitBackground: true
    });
  }
  await packRgbAndAlpha(frameDirectory, outputPath);
  await assertAllI(outputPath, FRAME_COUNT);
  await assertByteBudget(outputPath, maxTransferBytes);
}
~~~

packRgbAndAlpha uses FFmpeg alphaextract and hstack, then encodes with -g 1 -keyint_min 1 -sc_threshold 0. Desktop is 1440×810 before packing; mobile is 960×444. The script creates early/middle/late labelled contact sheets, alpha-difference measurements and hashes.

- [ ] **Step 4: Generate assets and run GREEN**

Run:
~~~sh
pnpm --filter @miralith/lubirth-hero exec node scripts/bake-opening-cloud-assets.mjs
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudManifest.spec.ts
~~~

Expected: frames 0, 12, 24 and 36 show changing cloud alpha after global alignment; both tiers meet byte ceilings at the prescribed quality floor; no non-cloud pixels occur where alpha is zero.

- [ ] **Step 5: Commit accepted assets**

~~~sh
git add packages/lubirth-hero/scripts/opening-cloud-volume.html packages/lubirth-hero/scripts/bake-opening-cloud-assets.mjs apps/site/public/assets/lubirth/opening-clouds docs/lubirth-cloud-asset-opening-evidence/2026-08-03 tests/unit/lubirthOpeningCloudManifest.spec.ts
git commit -m "feat(lubirth): bake temporal cloud-only opening assets"
~~~

### Task 3: Implement seek-safe provider/controller with TDD

**Files:**
- Create: apps/site/components/lubirth-cloud-asset-opening/types.ts
- Create: apps/site/components/lubirth-cloud-asset-opening/controller.ts
- Create: apps/site/components/lubirth-cloud-asset-opening/frameProvider.ts
- Create: tests/unit/lubirthOpeningCloudController.spec.ts

- [ ] **Step 1: Write failing controller tests**

~~~ts
import { expect, test } from "@playwright/test";

test("keeps live Earth visible when the first cloud frame is late", async () => {
  const controller = new OpeningCloudController({ provider: new FakeProvider("late") });
  await controller.arm();
  expect(controller.snapshot()).toMatchObject({
    source: "live",
    fallbackReason: "late-first-frame"
  });
});

test("requests new cloud frames before the veil closes", async () => {
  const controller = new OpeningCloudController({ provider: new FakeProvider("ready") });
  await controller.arm();
  await controller.setProgress(0.12, "forward");
  expect(controller.snapshot()).toMatchObject({
    source: "cloud",
    requestedFrame: expect.any(Number),
    veilOpacity: 0
  });
});

test("releases at 0.22 and reacquires a target frame on reverse", async () => {
  const controller = new OpeningCloudController({ provider: new FakeProvider("ready") });
  await controller.arm();
  await controller.setProgress(0.22, "forward");
  expect(controller.snapshot().presentationResourcesReleased).toBe(true);
  await controller.setProgress(0.18, "reverse");
  expect(controller.snapshot().source).toBe("cloud");
});
~~~

- [ ] **Step 2: Run RED**

Run: pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudController.spec.ts

Expected: failure resolving OpeningCloudController.

- [ ] **Step 3: Implement minimal state machine**

~~~ts
export interface OpeningCloudFrameProvider {
  arm(): Promise<{ frame: number; firstFrameMs: number }>;
  requestFrame(frame: number): Promise<number>;
  releasePresentationResources(): void;
  dispose(): void;
}

export class OpeningCloudController {
  async setProgress(progress: number, direction: "forward" | "reverse") {
    const veilOpacity = computeVeilOpacity(progress);
    if (progress >= LIVE_PROGRESS) return this.releaseToLive(veilOpacity);
    const frame = mapOpeningCloudProgressToFrame(this.manifest, progress);
    const renderedFrame = await this.provider.requestFrame(frame);
    return this.publishCloud({ progress, veilOpacity, requestedFrame: frame, renderedFrame, direction });
  }
}
~~~

The concrete provider owns one video, seeks frame/frameRate, waits for requestVideoFrameCallback when present and never converts a decode failure into a cloud success.

- [ ] **Step 4: Run GREEN**

Run:
~~~sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudController.spec.ts
pnpm --filter @miralith/site typecheck
~~~

Expected: both exit 0.

- [ ] **Step 5: Commit**

~~~sh
git add apps/site/components/lubirth-cloud-asset-opening tests/unit/lubirthOpeningCloudController.spec.ts
git commit -m "feat(lubirth): add seek-safe cloud opening controller"
~~~

### Task 4: Render the packed alpha cloud overlay

**Files:**
- Create: apps/site/components/lubirth-cloud-asset-opening/PackedCloudOverlay.tsx
- Create: apps/site/components/lubirth-cloud-asset-opening/TransitionVeil.tsx
- Create: apps/site/components/lubirth-cloud-asset-opening/OpeningCloudStack.tsx
- Create: tests/e2e/lubirth-cloud-asset-opening.spec.ts

- [ ] **Step 1: Write a failing overlay contract assertion**

~~~ts
await expect(page.locator("[data-opening-cloud-overlay]")).toHaveAttribute("data-source", "cloud");
await expect(page.locator("[data-opening-cloud-overlay]")).toHaveAttribute("data-full-frame-plate", "false");
await expect(page.locator("[data-transition-veil]")).toHaveAttribute("data-layer", "shared");
~~~

- [ ] **Step 2: Run RED**

Run: pnpm exec playwright test --project=desktop tests/e2e/lubirth-cloud-asset-opening.spec.ts

Expected: route and overlay are absent.

- [ ] **Step 3: Implement packed-video shader**

~~~glsl
vec4 color = texture2D(uPackedVideo, vec2(vUv.x * 0.5, vUv.y));
float alpha = texture2D(uPackedVideo, vec2(vUv.x * 0.5 + 0.5, vUv.y)).r;
gl_FragColor = vec4(color.rgb, alpha);
~~~

The overlay canvas is absolutely positioned above the live R3F Canvas, has pointer-events none, clears transparent, and stops drawing/releases its GL context when presentationResourcesReleased is true. TransitionVeil is a separate sibling above both layers and derives solely from progress.

- [ ] **Step 4: Run GREEN**

Run: pnpm exec playwright test --project=desktop tests/e2e/lubirth-cloud-asset-opening.spec.ts --grep "cloud media"

Expected: one live Canvas, one non-opaque cloud overlay, one shared veil.

- [ ] **Step 5: Commit**

~~~sh
git add apps/site/components/lubirth-cloud-asset-opening tests/e2e/lubirth-cloud-asset-opening.spec.ts
git commit -m "feat(lubirth): render packed cloud asset overlay"
~~~

### Task 5: Add the native-scroll query-only review route

**Files:**
- Create: apps/site/components/LuBirthCloudAssetOpeningRoute.tsx
- Create: apps/site/components/LuBirthCloudAssetOpeningRoute.module.css
- Create: apps/site/app/lubirth-cloud-asset-opening/page.tsx
- Modify: tests/e2e/lubirth-cloud-asset-opening.spec.ts

- [ ] **Step 1: Write failing live-route test**

~~~ts
test("scroll advances cloud frames while the real Relief-lite Canvas remains mounted", async ({ page }) => {
  await page.goto("/lubirth-cloud-asset-opening?copy=visible&quality=high");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudAssetOpening?.source)).toBe("cloud");
  const before = await page.evaluate(() => window.__MiraLithLuBirthCloudAssetOpening?.renderedFrame);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.75));
  await expect.poll(() => page.evaluate(() => window.__MiraLithLuBirthCloudAssetOpening?.renderedFrame)).not.toBe(before);
});
~~~

- [ ] **Step 2: Run RED**

Run: pnpm exec playwright test --project=desktop tests/e2e/lubirth-cloud-asset-opening.spec.ts --grep "scroll advances"

Expected: missing route failure.

- [ ] **Step 3: Implement route and scroll mapping**

~~~tsx
<section ref={rootRef} className={styles.review} data-cloud-asset-opening>
  <div className={styles.stickyStage}>
    <VisualCanvas decorative dpr={1}>
      <LuBirthSceneSlot paused={false} cloudDeckEnabled quality={quality} />
    </VisualCanvas>
    <OpeningCloudStack progress={progress} reducedMotion={reducedMotion} />
  </div>
</section>
~~~

~~~ts
const nextProgress = clamp(
  window.scrollY / Math.max(window.innerHeight * 4, 1),
  0,
  0.3
);
setMotion((previous) => ({
  progress: nextProgress,
  direction: nextProgress < previous.progress ? "reverse" : "forward"
}));
~~~

The route exposes window.__MiraLithSetLuBirthCloudAssetOpeningProgress only for deterministic tests. It uses a HUD only when copy=visible and never mounts on /.

- [ ] **Step 4: Run desktop and mobile GREEN**

Run:
~~~sh
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cloud-asset-opening.spec.ts
pnpm exec playwright test --project=mobile-landscape tests/e2e/lubirth-cloud-asset-opening.spec.ts
~~~

Expected: forward, reverse, late-frame, reduced-motion, low-memory and background-resume cases pass.

- [ ] **Step 5: Commit**

~~~sh
git add apps/site/app/lubirth-cloud-asset-opening apps/site/components/LuBirthCloudAssetOpeningRoute.tsx apps/site/components/LuBirthCloudAssetOpeningRoute.module.css tests/e2e/lubirth-cloud-asset-opening.spec.ts
git commit -m "feat(lubirth): add cloud asset opening review route"
~~~

### Task 6: Record evidence and run final gates

**Files:**
- Modify: docs/lubirth-cloud-asset-opening-evidence/2026-08-03/README.md
- Modify: docs/lubirth-cloud-asset-opening-evidence/2026-08-03/checksums.sha256

- [ ] **Step 1: Record visual and performance evidence**

The evidence README contains values for desktop/mobile transfer bytes, first-frame readiness, decoded residency, target-frame latency, rAF p95, dropped-frame rate, post-0.22 Relief-lite GPU p95, alpha-difference metrics, cloud-only inspection and SHA-256 values. It includes frame 0/12/24/36/39/42/47 contact sheets and an explicit PASS or REJECT result.

- [ ] **Step 2: Run final verification**

~~~sh
pnpm exec playwright test -c playwright.unit.config.ts tests/unit/lubirthOpeningCloudManifest.spec.ts tests/unit/lubirthOpeningCloudController.spec.ts
pnpm exec playwright test --project=desktop tests/e2e/lubirth-cloud-asset-opening.spec.ts
pnpm exec playwright test --project=mobile-landscape tests/e2e/lubirth-cloud-asset-opening.spec.ts
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site build
git diff --check
shasum -a 256 -c docs/lubirth-cloud-asset-opening-evidence/2026-08-03/checksums.sha256
~~~

Expected: every command exits 0. If temporal cloud motion, source purity, byte/quality limit, fallback, build, or the 3ms post-handoff desktop GPU gate fails, record REJECT and do not integrate into /.

- [ ] **Step 3: Commit final evidence only after the complete gate is green**

~~~sh
git add docs/lubirth-cloud-asset-opening-evidence/2026-08-03
git commit -m "docs(lubirth): record cloud asset opening evidence"
~~~

## Self-review

- Spec coverage: Tasks 1–2 gate true cloud-only temporal media before runtime. Tasks 3–5 implement frame addressing, fallback, real-IP live Earth, independent veil and native scroll. Task 6 blocks default-home promotion on any visual, asset or GPU failure.
- Placeholder scan: every task names paths, tests, commands, expected states and concrete interface/algorithm decisions.
- Type consistency: OpeningCloudManifest, OpeningCloudController, OpeningCloudFrameProvider, PackedCloudOverlay, OpeningCloudStack and __MiraLithLuBirthCloudAssetOpening use the same names throughout.
