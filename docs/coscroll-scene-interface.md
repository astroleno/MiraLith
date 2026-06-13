# CoScroll Scene Interface

状态：草案 v0.1
日期：2026-04-24
范围：MiraLith v1.1 主线章节，不进入 v1.0 LuBirth 前两屏发布范围。

## 1. 目的

本文定义 CoScroll 以轻量 scene package 接入 MiraLith 时需要满足的接口边界。

目标不是把 CoScroll app 全量搬进来，而是保留它的核心体验：

```text
玉质锚字 + 前后遮挡滚动 + 暗金/深蓝/矿物黑背景 + 数字仪式感
```

当前文档仍是 implementation gate，不是最终代码合约。正式实现前必须通过 visual spike 验证。

## 2. 章节定位

CoScroll 在 MiraLith 中属于 v1.1 主线章节，位置在 Radio Gaga 之后：

```text
声音的流动 -> 经文的滚动 -> 数字仪式
```

它不是：

- v1.0 发布范围。
- 首页第二屏。
- iframe 嵌入。
- CoScroll 原应用的全量迁移。
- 站点级音频系统。
- 项目详情页或 SEO 内容来源。

项目标题、说明、详情链接和 SEO metadata 由 `apps/site/content` 管理。`packages/coscroll-scene` 只负责视觉 scene。

## 3. 包边界

```text
apps/site
  owns DOM content, section layout, routing, SEO, scroll section registration

packages/visual-core
  owns shared fixed Canvas, scene registry, quality detection, scroll state, reduced-motion

packages/coscroll-scene
  owns jade anchor model, front/back text layers, background atmosphere, fallback assets
```

`packages/coscroll-scene` 可以提供 standalone demo 方便 spike 和 review，但 homepage 正式路径必须挂入 shared fixed Canvas。

## 4. 推荐导出

```ts
export type {
  CoScrollSceneShellProps,
  CoScrollVisualState,
  CoScrollTimelineConfig,
  CoScrollLyricSegment,
  CoScrollAnchorId,
  CoScrollAssetManifest,
  CoScrollFallbackMode,
};

export { CoScrollSceneContent } from './CoScrollSceneContent';
export { CoScrollStandaloneDemo } from './CoScrollStandaloneDemo';
export { createCoScrollVisualState } from './createCoScrollVisualState';
```

### `CoScrollSceneContent`

用于 MiraLith homepage 的真实 scene content。它运行在已有 Canvas 内，不创建 Canvas。

```ts
interface CoScrollSceneShellProps {
  progress: number;
  active: boolean;
  quality: ResolvedQualityTier;
  reducedMotion?: boolean;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  scrollVelocity?: number;
  onReady?: () => void;
  onFallback?: (reason: CoScrollFallbackReason) => void;
}
```

### `CoScrollStandaloneDemo`

仅用于 visual spike、review 和调试。它可以创建自己的 Canvas，但不能成为 homepage 集成方式。

```ts
interface CoScrollStandaloneDemoProps extends CoScrollSceneShellProps {
  showDebugControls?: boolean;
}
```

## 5. Visual State

`progress/active/quality/reducedMotion` 只是入口信号。CoScroll 真实视觉至少需要派生出以下状态：

```ts
interface CoScrollVisualState {
  visualTime: number;
  duration: number;
  lyrics: CoScrollLyricSegment[];
  currentAnchor: CoScrollAnchorId;
  scrollVelocity: number;
  frontLayerOpacity: number;
  backLayerOpacity: number;
  backgroundIntensity: number;
  fallbackMode: CoScrollFallbackMode;
}
```

推荐把映射逻辑收敛到纯函数，方便测试和 spike：

```ts
function createCoScrollVisualState(input: {
  progress: number;
  active: boolean;
  quality: ResolvedQualityTier;
  reducedMotion: boolean;
  timeline: CoScrollTimelineConfig;
  assets: CoScrollAssetManifest;
  scrollVelocity: number;
}): CoScrollVisualState;
```

## 6. Timeline

MiraLith 版不复用 CoScroll 原音频时间轴作为主驱动。`visualTime` 由 section progress 派生：

```ts
interface CoScrollTimelineConfig {
  duration: number;
  easing?: 'linear' | 'ritual-slow-in' | 'breath';
  anchorCues: CoScrollAnchorCue[];
  lyricSegments: CoScrollLyricSegment[];
}

interface CoScrollAnchorCue {
  anchor: CoScrollAnchorId;
  start: number;
  end: number;
}
```

首版建议：

- `duration` 使用 18-30 秒的视觉时长映射，不等同于真实音频长度。
- `progress = 0..1` 映射到 `visualTime = 0..duration`。
- `scrollVelocity` 只影响文字层强度、拖尾或背景呼吸，不能决定核心可读性。
- reduced-motion 下 `visualTime` 可以跟随 progress，但禁用快速穿梭和强视差。

## 7. Text Layers

```ts
interface CoScrollLyricSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  layer: 'front' | 'back';
  emphasis?: 'quiet' | 'normal' | 'bright';
}
```

首版文本策略：

- 不迁入完整心经时间轴作为必需依赖。
- 从 CoScroll 的经文/短句中抽取少量代表段落。
- 前层文字负责清晰阅读和仪式节奏。
- 后层文字负责被玉字遮挡、吞入暗场和形成深度。
- DOM 内容仍由 `apps/site/content` 提供，Canvas 字句不承担 SEO。

## 8. Anchor Models

```ts
type CoScrollAnchorId = 'heart' | 'emptiness' | 'dao' | string;

interface CoScrollAnchorAsset {
  id: CoScrollAnchorId;
  label: string;
  modelSrc: string;
  posterSrc?: string;
  materialPreset: 'jade-dark' | 'jade-gold' | 'jade-blue';
}
```

首版建议：

- visual spike 只验证一个锚字，优先 `心`。
- v1.1 正式版最多 1-3 个锚字，候选 `心 / 空 / 道`。
- OBJ 必须先转 GLB，并用 `gltf-transform` 和 meshopt 压缩。
- 原 26 个 OBJ 不进入首版 package。

## 9. Asset Manifest

```ts
interface CoScrollAssetManifest {
  anchors: CoScrollAnchorAsset[];
  background?: {
    shaderPreset?: 'mineral-silk' | 'dark-gold-field';
    textureSrc?: string;
    videoFallbackSrc?: string;
  };
  text?: {
    fontFamily?: string;
    textureAtlasSrc?: string;
  };
  fallback: {
    posterSrc: string;
    videoSrc?: string;
  };
}
```

资产原则：

- 不直接迁入 5MB+ 字体。
- 字体优先使用系统字体、极小 subset、SVG 字形或纹理字。
- CoScroll 资产只在接近章节时预加载。
- fallback poster/video 必须先于 heavy WebGL asset 可用。

## 10. Quality Tier

| Tier | Model | Text | Background | Post FX | Fallback |
| --- | --- | --- | --- | --- | --- |
| high | 1-3 GLB anchors | front/back text mesh | shader + light texture | light bloom allowed | poster ready |
| medium | 1 GLB anchor | front/back text mesh | lightweight shader | no heavy bloom | poster ready |
| low | 1 simplified GLB or baked mesh | reduced text count | CSS/video background | none | poster ready |
| fallback | none | DOM/SVG/static text | poster/video | none | primary path |

## 11. Canvas Contract

Homepage 正式路径：

- `apps/site` 或 `visual-core` 创建 shared fixed Canvas。
- `CoScrollSceneContent` 只挂入现有 Canvas。
- 前后遮挡必须在同一个 WebGL depth relationship 内完成。
- 不能用两个独立 Canvas 分别画前景/背景来冒充主路径遮挡。

允许例外：

- `CoScrollStandaloneDemo`。
- visual spike。
- isolated regression test。

## 12. Fallback Contract

```ts
type CoScrollFallbackMode =
  | 'none'
  | 'poster'
  | 'video-loop'
  | 'dom-static';

type CoScrollFallbackReason =
  | 'webgl-unavailable'
  | 'context-lost'
  | 'asset-failed'
  | 'quality-tier'
  | 'reduced-motion';
```

Fallback 行为：

- WebGL 不可用：显示 poster + DOM 项目内容。
- 模型加载失败：显示 poster 或 video loop，不阻塞页面。
- low tier：可以使用简化 GLB 或 video fallback。
- reduced-motion：保留静态玉字/经文构图，禁用强滚动穿梭。
- fallback 不能影响 LuBirth 首屏和第二屏预算。

## 13. Readiness Gate

CoScroll implementation 不应早于以下条件：

1. `apps/site`、`packages/visual-core`、`packages/coscroll-scene` scaffold 已可运行。
2. 本接口文档经过 visual spike 回填。
3. 一个锚字 + 前后文字层 + 压缩 GLB 的 spike 通过桌面和移动降级检查。
4. asset budget 表明确每个 tier 的模型、字体/文字、背景和 fallback 体积。
5. shared Canvas 挂载路径被验证。

## 14. Open Questions

- 首版锚字固定 `心`，还是在 `心 / 空 / 道` 中切换？
- 背景首版应以 shader 为主，还是以短循环 video fallback 为主？
- 移动端 low tier 是否保留真实前后遮挡，还是直接进入 video/poster fallback？
- `scrollVelocity` 是否由 `visual-core` 统一提供，还是由 `apps/site` section adapter 提供？
