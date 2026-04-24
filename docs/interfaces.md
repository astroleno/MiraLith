# MiraLith 接口文档

状态：草案 v0.1  
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
export { LUBIRTH_PRESETS, resolveLandingPreset } from './presets';
export type {
  EarthMoonHeroProps,
  EarthMoonHeroMode,
  EarthMoonHeroInteraction,
  LandingComposition,
  LandingPresetName,
  LandingQuality,
  LandingAssetManifest,
  EarthMoonHeroEvent,
} from './types';
```

### `EarthMoonHero`

Primary public component.

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
  reducedMotion?: boolean;
  paused?: boolean;
  posterSrc?: string;
  assets?: Partial<LandingAssetManifest>;
  composition?: Partial<LandingComposition>;
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

Lower-level scene component used inside an existing Canvas. Use this when the page owns a shared fixed WebGL canvas.

```ts
interface EarthMoonSceneProps {
  mode: EarthMoonHeroMode;
  composition: LandingComposition;
  assets: LandingResolvedAssets;
  quality: ResolvedQualityTier;
  scrollProgress?: number;
  sectionProgress?: number;
  reducedMotion?: boolean;
  paused?: boolean;
  onSceneReady?: () => void;
}
```

Rule:

- `EarthMoonHero` may create its own Canvas.
- `EarthMoonScene` must not create a Canvas.
- MiraLith homepage long-term should prefer one shared fixed Canvas and mount `EarthMoonScene` inside it.

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

```ts
interface LandingPreset {
  name: LandingPresetName;
  composition: LandingComposition;
  qualityOverrides?: Partial<Record<ResolvedQualityTierName, Partial<LandingComposition>>>;
}
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
function resolveLandingPreset(input: {
  mode: EarthMoonHeroMode;
  viewport: ViewportInfo;
  quality: ResolvedQualityTier;
  overrides?: Partial<LandingComposition>;
}): LandingComposition;
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
type EarthMoonHeroEventType =
  | 'init'
  | 'assets-ready'
  | 'scene-ready'
  | 'quality-selected'
  | 'expanded'
  | 'collapsed'
  | 'fallback'
  | 'error';

interface EarthMoonHeroEvent {
  type: EarthMoonHeroEventType;
  mode: EarthMoonHeroMode;
  quality: ResolvedQualityTierName;
  timestamp: number;
}

interface EarthMoonHeroError {
  code:
    | 'webgl-unavailable'
    | 'asset-load-failed'
    | 'shader-compile-failed'
    | 'context-lost'
    | 'unknown';
  message: string;
  cause?: unknown;
}
```

Events are callbacks only. Do not dispatch global `window` events from the package.

## 8. `@miralith/visual-core` Public API

### Quality

```ts
type ResolvedQualityTierName = 'high' | 'medium' | 'low' | 'fallback';

interface ResolvedQualityTier {
  name: ResolvedQualityTierName;
  dpr: number;
  enablePost: boolean;
  enableAurora: boolean;
  enableClouds: boolean;
  maxTextureSize: number;
  reason: 'user' | 'device' | 'fps' | 'webgl' | 'reduced-motion';
}

function detectInitialQuality(options?: {
  preferred?: LandingQuality;
  viewport?: ViewportInfo;
  reducedMotion?: boolean;
}): ResolvedQualityTier;
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

`EarthMoonHero` must accept:

```ts
interface AccessibilityProps {
  ariaLabel?: string;
  describedById?: string;
  decorative?: boolean;
}
```

Rules:

- If decorative is true, Canvas uses `aria-hidden`.
- If decorative is false, Canvas gets a concise `aria-label`.
- DOM content must contain all meaningful copy.
- Expanded modal traps focus and supports Esc.
- reduced-motion disables scroll-driven camera flights.

## 12. Error and Fallback Contract

Fallback must activate when:

- WebGL is unavailable.
- WebGL context is lost and cannot restore quickly.
- Critical texture fails.
- User is in reduced-motion and quality resolves to fallback.
- Device quality detection returns fallback.

Fallback rendering:

```tsx
<EarthMoonHero
  quality="fallback"
  posterSrc="/assets/lubirth/poster-field.webp"
/>
```

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

## 14. Versioning

Initial package version:

```json
{
  "name": "@miralith/lubirth-hero",
  "version": "0.1.0"
}
```

Breaking changes before first public release are allowed, but every API change must update this document.

## 15. Open Questions

- Should `EarthMoonHero` create Canvas in production, or should homepage always own one shared Canvas?
- Should exact moon phase use runtime astronomy or precomputed constants for `1993-08-01`?
- Should KTX2 be required in M1, or introduced after WebP/AVIF baseline works?
- Should Theatre.js be mandatory in `lubirth-hero`, or only used by `apps/site` orchestration?
