# MiraLith 接口文档

状态：MiraLith v1.0 LuBirth 前两屏已实现  
日期：2026-04-24  
范围：MiraLith 主站与视觉包之间的接口、LuBirth Hero 公共 API、资源和事件合约。

## 1. 设计目标

接口要支撑 MiraLith 首页的长滚动叙事，同时避免把视觉实现和站点内容绑死。

核心要求：

- `apps/site` 可以像普通 React 组件一样使用 LuBirth hero。
- `packages/lubirth-hero` 不知道 MiraLith 页面文案和项目数据。
- `packages/visual-core` 提供跨章节能力，不依赖 LuBirth。
- 所有重资源和重交互都能被 quality tier 控制。
- WebGL 不可用时，DOM 内容仍完整。
- 生产首页只有一个 fixed Canvas，由 `apps/site` / `visual-core` 拥有；LuBirth 视觉以 `EarthMoonScene` 挂入。

## 2. Package Boundaries

```text
apps/site
  imports:
    @miralith/lubirth-hero
    @miralith/visual-core

packages/lubirth-hero
  imports:
    @miralith/visual-core
    three
    @react-three/fiber
    @react-three/drei

packages/visual-core
  imports:
    zustand
    @theatre/core where timeline binding is enabled
    three types where needed
```

禁止方向：

```text
packages/lubirth-hero -> apps/site
packages/visual-core -> apps/site
packages/visual-core -> packages/lubirth-hero
```

## 3. `@miralith/lubirth-hero` Public API

### Exports

```ts
export { EarthMoonHero } from './EarthMoonHero';
export { EarthMoonScene } from './EarthMoonScene';
export { LandingAtmosphere } from './LandingAtmosphere';
export { LandingAurora } from './LandingAurora';
export { LandingEarth } from './LandingEarth';
export { LandingMoon } from './LandingMoon';
export {
  DEFAULT_LUBIRTH_ASSETS,
  LUBIRTH_ASSET_BUDGET,
  getCriticalAssetBudget,
  resolveLandingAssets,
} from './assetManifest';
export { DEFAULT_LUBIRTH_DATE, DEFAULT_LUBIRTH_MOON_PHASE } from './constants';
export { LUBIRTH_PRESETS, resolveLandingPreset } from './presets';
export type {
  EarthMoonHeroError,
  EarthMoonHeroEvent,
  EarthMoonHeroProps,
  EarthMoonHeroMode,
  EarthMoonHeroInteraction,
  EarthMoonSceneProps,
  LandingAssetManifest,
  LandingComposition,
  LandingCompositionOverrides,
  LandingResolvedAssets,
  LandingPresetName,
} from './types';
```

Implementation status:

- Production homepage uses site-owned `VisualCanvas` plus `EarthMoonScene`; it does not mount `EarthMoonHero`.
- `EarthMoonSceneProps.quality` is `QualityProfile`.
- `EarthMoonHeroProps.onQualityChange` remains `(quality: ResolvedQualityTier) => void`.
- `LandingComposition` uses the nested `camera / earth / moon / light / atmosphere / aurora / motion` contract below.

### `EarthMoonHero`

Standalone wrapper for demos, isolated previews, simple embeds, and fallback pages. It may create its own Canvas, but it is not the production homepage default.

```ts
type EarthMoonHeroMode = 'field' | 'window' | 'zoomed' | 'expanded';

type EarthMoonHeroInteraction =
  | 'none'
  | 'hover-zoom'
  | 'tap-expand'
  | 'hover-and-click-expand'
  | 'scroll-driven';

type LandingQuality = 'auto' | 'high' | 'medium' | 'low' | 'fallback';

interface EarthMoonHeroProps {
  mode?: EarthMoonHeroMode;
  preset?: LandingPresetName;
  date?: string;
  quality?: LandingQuality;
  interaction?: EarthMoonHeroInteraction;
  className?: string;
  style?: React.CSSProperties;
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

Default usage:

```tsx
<EarthMoonHero
  mode="field"
  date="1993-08-01T12:00:00Z"
  quality="auto"
  interaction="scroll-driven"
/>
```

Second screen usage:

```tsx
<EarthMoonHero
  mode="window"
  date="1993-08-01T12:00:00Z"
  quality="auto"
  interaction="hover-and-click-expand"
/>
```

### `EarthMoonScene`

Production scene component used inside an existing Canvas. Use this when the page owns a shared fixed WebGL canvas.

```ts
interface EarthMoonSceneProps {
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
```

Rule:

- Production homepage must use the shared fixed Canvas from `apps/site` / `visual-core`.
- Production homepage mounts `EarthMoonScene`; it does not mount `EarthMoonHero`.
- `EarthMoonHero` may create its own Canvas only for demo/dev standalone previews, isolated embeds, fallback preview pages, or visual regression fixtures.
- `EarthMoonScene` must not create a Canvas.
- Multiple production Canvas instances are a blocking architecture violation.

### Canvas Ownership Decision

```text
apps/site / visual-core
  owns:
    Fixed WebGL Canvas
    Theatre scroll binding
    section progress
    quality tier
    fallback trigger routing

@miralith/lubirth-hero
  owns:
    EarthMoonScene
    LandingEarth / LandingMoon / LandingAtmosphere / LandingAurora
    presets
    asset manifest contract
    animatable scene props
```

The LuBirth package must not import Theatre.js directly. Theatre timeline values are resolved by `apps/site` / `visual-core` and passed down as props or resolved composition values.

### PIP/FBO Decision

MiraLith v1.0 does not implement FBO PIP. The moon is rendered in the same Canvas using screen-anchored positioning. This mirrors the usable LuBirth behavior and avoids an extra render target, extra camera, and extra memory pressure.

## 4. Landing Composition

`LandingComposition` is intentionally smaller than LuBirth `SimpleComposition`.

```ts
interface LandingComposition {
  camera: LandingCameraConfig;
  earth: LandingEarthConfig;
  moon: LandingMoonConfig;
  light: LandingLightConfig;
  atmosphere: LandingAtmosphereConfig;
  aurora: LandingAuroraConfig;
  motion: LandingMotionConfig;
}
```

### Camera

```ts
interface LandingCameraConfig {
  distance: number;
  fov: number;
  azimuthDeg: number;
  elevationDeg: number;
  lookAt: [number, number, number];
  viewOffsetY: number;
  dpr: [number, number] | number;
}
```

### Earth

```ts
interface LandingEarthConfig {
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
```

### Moon

```ts
interface LandingMoonConfig {
  visible: boolean;
  date: string;
  radius: number;
  screenX: number;
  screenY: number;
  screenSize: number;
  anchorDistance: number;
  texture?: TextureRef;
  phaseMode: 'fixed-date' | 'constant-vector' | 'runtime-ephemeris';
  fixedPhase?: LandingMoonPhase;
  yawDeg: number;
  lonDeg: number;
  latDeg: number;
  nightLift: number;
}
```

Default date:

```ts
const DEFAULT_LUBIRTH_DATE = '1993-08-01T12:00:00Z' as const;

interface LandingMoonPhase {
  date: typeof DEFAULT_LUBIRTH_DATE | string;
  illumination: number;
  phaseAngleRad: number;
  sunDirection: [number, number, number];
  positionAngleRad?: number;
  source: 'precomputed' | 'runtime-ephemeris' | 'constant-vector';
}
```

For v1.0, `fixed-date` mode defaults to precomputed constants for `1993-08-01T12:00:00Z`. Runtime ephemeris is optional and must not enter the first critical path.

### Light

```ts
interface LandingLightConfig {
  mode: 'fixed-sun';
  fixedSunDir: [number, number, number];
  intensity: number;
  color: [number, number, number];
  ambientIntensity: number;
}
```

### Atmosphere

```ts
interface LandingAtmosphereConfig {
  enabled: boolean;
  intensity: number;
  thickness: number;
  color: [number, number, number];
  fresnelPower: number;
  nearShell: boolean;
  nearStrength: number;
  karmanGlow: boolean;
}
```

### Aurora

```ts
interface LandingAuroraConfig {
  enabled: boolean;
  intensity: number;
  latitudeBandDeg: [number, number];
  colorA: [number, number, number];
  colorB: [number, number, number];
  noiseScale: number;
  noiseSpeed: number;
  sampleCount: number;
}
```

### Motion

```ts
interface LandingMotionConfig {
  autoRotate: boolean;
  hoverSlowdown: boolean;
  scrollDriven: boolean;
  transitionDurationMs: number;
}
```

## 5. Presets

```ts
type LandingPresetName =
  | 'field'
  | 'window'
  | 'zoomed'
  | 'expanded'
  | 'mobileField'
  | 'mobileWindow'
  | 'fallback';
```

Required presets:

| Preset | Use |
| --- | --- |
| `field` | 首页第一屏全屏仪式场 |
| `window` | 第二屏项目窗口小图 |
| `zoomed` | hover/scroll zoom-in 状态 |
| `expanded` | 点击后的大图状态 |
| `mobileField` | 手机端第一屏构图 |
| `mobileWindow` | 手机端第二屏构图 |
| `fallback` | 无 WebGL 静态状态 |

Preset resolution:

```ts
function resolveLandingPreset(
  preset?: LandingPresetName,
  composition?: LandingCompositionOverrides
): LandingComposition;
```

## 6. Asset Manifest

```ts
type AssetTier = 'critical' | 'idle' | 'expanded' | 'fallback';
type AssetKind = 'texture' | 'poster' | 'model' | 'shader' | 'data';

interface TextureRef {
  id: string;
  src: string;
  width: number;
  height: number;
  format: 'webp' | 'avif' | 'ktx2' | 'jpg' | 'png';
  colorSpace: 'srgb' | 'linear';
}

interface LandingAsset {
  id: string;
  kind: AssetKind;
  tier: AssetTier;
  src: string;
  bytesBudget: number;
  preload: boolean;
  requiredFor: LandingPresetName[];
}

interface LandingAssetManifest {
  earthDay: TextureRef;
  earthNight?: TextureRef;
  earthClouds?: TextureRef;
  moonColor: TextureRef;
  fallbackPoster: LandingAsset;
  expandedEarthDay?: TextureRef;
  expandedMoonColor?: TextureRef;
}
```

Rules:

- `critical` assets must keep first screen under 3MB.
- `expanded` assets must never preload before user intent.
- `fallbackPoster` is required.
- Every asset must declare a byte budget before implementation.

## 7. Events

```ts
interface EarthMoonHeroEvent {
  mode: EarthMoonHeroMode;
  quality: ResolvedQualityTier;
}

interface EarthMoonHeroError {
  message: string;
}
```

Events are callbacks only. Do not dispatch global `window` events from the package.

## 8. `@miralith/visual-core` Public API

### Quality

```ts
type ResolvedQualityTier = 'high' | 'medium' | 'low' | 'fallback';
type LandingQuality = 'auto' | ResolvedQualityTier;

interface QualityProfile {
  tier: ResolvedQualityTier;
  dpr: number;
  segments: number;
  aurora: boolean;
  stars: number;
  reason: string;
}

function resolveQualityTier(options?: {
  requested?: LandingQuality;
  reducedMotion?: boolean;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}): QualityProfile;

function useQualityTier(requested?: LandingQuality, reducedMotion?: boolean): QualityProfile;
```

### Viewport

```ts
interface ViewportInfo {
  width: number;
  height: number;
  dpr: number;
  orientation: 'portrait' | 'landscape';
  pointer: 'fine' | 'coarse' | 'none';
  isMobile: boolean;
}

function getViewportInfo(): ViewportInfo;
```

### Scroll

```ts
interface VisualSectionState {
  id: string;
  index: number;
  progress: number;
  globalProgress: number;
  active: boolean;
}

interface VisualScrollStore {
  activeSectionId: string;
  sections: Record<string, VisualSectionState>;
  setSectionProgress: (id: string, progress: number) => void;
}
```

### Theatre Binding

Theatre binding belongs to `@miralith/visual-core` and the site orchestration layer, not `@miralith/lubirth-hero`.

```ts
interface TheatreScrollBindingOptions {
  sheetId: string;
  sequenceLength: number;
  sectionId: string;
}

function bindTheatreToScroll(options: TheatreScrollBindingOptions): void;
```

## 9. Site Data Interfaces

Project data lives in `apps/site/content` and must not be imported by visual packages.

```ts
type ProjectKind =
  | 'origin'
  | 'family-system'
  | 'ritual'
  | 'ambient-browser'
  | 'commission'
  | 'experiment'
  | 'now-building';

interface ProjectEntry {
  id: string;
  slug: string;
  title: string;
  titleZh?: string;
  subtitle: string;
  subtitleZh?: string;
  kind: ProjectKind;
  year?: string;
  status?: 'concept' | 'prototype' | 'live' | 'archived';
  tags: string[];
  links?: ProjectLink[];
  preview?: ProjectPreview;
}

interface ProjectLink {
  label: string;
  href: string;
  kind: 'internal' | 'external' | 'github' | 'demo';
}

interface ProjectPreview {
  poster: string;
  video?: string;
  accentColor?: string;
}
```

## 10. Homepage Section Interface

```ts
type HomeSectionId =
  | 'intro'
  | 'lubirth-field'
  | 'lubirth-window'
  | 'radio-gaga'
  | 'coscroll'
  | 'artbreeze'
  | 'constellation'
  | 'commissions'
  | 'now-building'
  | 'about-contact';

interface HomeSection {
  id: HomeSectionId;
  projectId?: string;
  title: string;
  eyebrow?: string;
  body: string;
  visualScene?: VisualSceneId;
  minHeightVh: number;
}

type VisualSceneId =
  | 'lubirth'
  | 'radio-gaga'
  | 'coscroll'
  | 'artbreeze'
  | 'constellation'
  | 'none';
```

## 11. Accessibility Contract

Production accessibility belongs to the site-owned canvas layer: `apps/site` / `@miralith/visual-core` must expose accessibility props on `VisualCanvas` or the equivalent fixed Canvas wrapper. `EarthMoonScene` receives render state only and must not own DOM accessibility for the homepage. The standalone `EarthMoonHero` wrapper mirrors the same props only for demo/dev usage.

```ts
interface AccessibilityProps {
  ariaLabel?: string;
  describedById?: string;
  decorative?: boolean;
}
```

Rules:

- If `decorative` is true, the production `VisualCanvas` uses `aria-hidden`.
- If `decorative` is false, the production `VisualCanvas` gets a concise `aria-label`.
- `EarthMoonHero` applies the same behavior only when it creates its own standalone Canvas for demos, isolated previews, fallback pages, or visual regression fixtures.
- DOM content must contain all meaningful copy.
- Expanded modal traps focus and supports Esc.
- Opening the expanded view moves focus into the expanded controls.
- Closing expanded returns focus to the trigger that opened it.
- Tab order never enters hidden canvas-only controls.
- The fallback poster carries the same accessible label/description as the WebGL view.
- reduced-motion disables scroll-driven camera flights.

## 12. Error and Fallback Contract

Fallback must activate when:

- WebGL is unavailable.
- WebGL context is lost and cannot restore quickly.
- Critical texture fails.
- User is in reduced-motion and quality resolves to fallback.
- Device quality detection returns fallback.
- Runtime shader compilation fails.

Production fallback routing is owned by `apps/site` / `@miralith/visual-core`, not by `EarthMoonScene`.

```tsx
<VisualCanvasFallback
  scene="lubirth"
  posterSrc="/assets/lubirth/poster-field.webp"
  accessibility={accessibility}
/>
```

The standalone `EarthMoonHero` wrapper may expose `quality="fallback"` and `posterSrc` for demo/dev previews. Homepage fallback must route through the site-owned DOM/poster layer.

Fallback must show:

- Static LuBirth poster.
- DOM copy from the section.
- CTA/link if available.

## 13. Implementation Notes From LuBirth

Known changes required during migration:

- Replace global `window.__LuBirthMoonScreenSize` with `moon.screenSize`.
- Remove `console.log` debug output from render path.
- Avoid `location.search` inside reusable components.
- Avoid global `lubirth:assets-ready` event; use `onReady`.
- Do not import `SimpleTest`.
- Do not import `LocalAudioPlayer`, `LocationSelector`, or auto test modules.
- Keep astronomy runtime out of the first critical path unless strict phase accuracy is explicitly needed.
- Do not implement `MoonPIP`, `WebGLRenderTarget`, or a second moon camera for v1.0.

## 14. CoScroll Scene Interface Gate

CoScroll is a v1.1 mainline chapter. The current shared types already reserve `HomeSectionId = 'coscroll'` and `VisualSceneId = 'coscroll'`, but that reservation is not an implementation-ready contract.

### Shell Props

The outer scene entry can stay small:

```ts
interface CoScrollSceneShellProps {
  progress: number;
  active: boolean;
  quality: ResolvedQualityTier;
  reducedMotion?: boolean;
  mode?: 'spike' | 'chapter' | 'fallback';
}
```

These props describe how MiraLith schedules the chapter. They do not fully describe the visual state needed by the CoScroll experience.

### Visual State

`docs/coscroll-scene-interface.md` must define whether these fields are props, adapter output, store values, or internal derived state:

```ts
interface CoScrollVisualState {
  visualTime: number;
  duration: number;
  lyrics: CoScrollLyricSegment[];
  currentAnchor: CoScrollAnchorId;
  scrollVelocity: number;
  assetManifest: CoScrollAssetManifest;
}

interface CoScrollLyricSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  layer: 'front' | 'back';
}

type CoScrollAnchorId = 'heart' | 'emptiness' | 'dao' | string;

interface CoScrollAssetManifest {
  anchorModels: Partial<Record<CoScrollAnchorId, string>>;
  posterSrc?: string;
  videoFallbackSrc?: string;
  textTextureSrc?: string;
}
```

Required mapping decisions:

- `progress -> visualTime` mapping and easing.
- How `duration` is chosen for the MiraLith chapter.
- Which lyric/short-text subset replaces the full Heart Sutra timeline in the first version.
- How `currentAnchor` switches, or whether v1.1 uses only one anchor.
- How `scrollVelocity` affects front/back text layers without breaking reduced-motion.
- Which assets load at each quality tier.

### Canvas Rule

Homepage mode must follow the shared fixed Canvas architecture:

- `CoScrollScene` / `CoScrollSceneContent` must not create a Canvas.
- CoScroll front/back occlusion must happen inside the same WebGL depth relationship as the anchor model.
- `CoScrollStandaloneDemo` may create its own Canvas for spike, review, and debugging only.
- DOM project copy, details links, and SEO content live in `apps/site/content`, not in `packages/coscroll-scene`.

### Readiness Gate

CoScroll implementation should not begin until these are complete:

- Phase 1 scaffolding exists for `apps/site`, `packages/visual-core`, and `packages/coscroll-scene`.
- `docs/coscroll-scene-interface.md` is written.
- A visual spike proves one jade anchor, front/back text layers, compressed GLB assets, and fallback can preserve the core feeling.
- Asset budget and fallback behavior are documented.

## 15. Versioning

Initial package version:

```json
{
  "name": "@miralith/lubirth-hero",
  "version": "0.1.0"
}
```

Breaking changes before first public release are allowed, but every API change must update this document.

## 16. Open Questions

- Should KTX2 be required in M1, or introduced after WebP/AVIF baseline works?
- Should exact moon phase beyond `1993-08-01T12:00:00Z` be supported in v1.0, or deferred until after launch?
- For CoScroll v1.1, should the first anchor be fixed to `心`, or should the scene switch between `心 / 空 / 道` after the visual spike?
