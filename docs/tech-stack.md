# MiraLith 技术栈决策

状态：草案 v0.1  
日期：2026-04-24  
目标：搭建一个对标 Shopify Editions 级别体验的个人场域站，同时保持首屏轻、移动端可用、后续组件可持续扩展。

## 1. 技术判断

MiraLith 不是普通作品集，也不是单个 WebGL demo。它需要同时承载：

- 首页长滚动叙事与固定 WebGL 主视觉。
- LuBirth、Radio Gaga、CoScroll、ArtBreeze 等多个章节场景。
- 项目详情页、实验星群、About、Now Building、Contact。
- SEO、可访问性、移动端 fallback、性能分级。
- 后续持续加入组件和项目，而不是一次性活动页。

因此主站采用 **Next.js App Router**，不是纯 Vite 单页站。Vite 后续可以用于独立包、视觉组件 demo 或 library build，但 MiraLith 主站需要 Next 的路由、静态生成、元数据、图片/内容组织和部署生态。

## 2. 核心栈

| 层级 | 决策 | 用途 |
| --- | --- | --- |
| Framework | Next.js App Router | 站点路由、静态生成、SEO、项目页、内容组织 |
| Language | TypeScript strict | 控制复杂交互和视觉配置的长期可维护性 |
| Package | pnpm workspace | 主站与视觉包拆分，便于复用 LuBirth hero |
| Styling | Tailwind CSS + CSS custom properties + CSS Modules | Tailwind 做布局/响应式，CSS 变量做设计令牌，复杂视觉组件用 CSS Modules |
| 3D | three + @react-three/fiber + @react-three/drei | 固定 WebGL canvas、地月场景、后续 3D 章节 |
| 3D Timeline | @theatre/core + @theatre/r3f | Shopify 式 scroll timeline、camera、shader、scene 参数编排 |
| State | zustand | section index、scroll progress、quality tier、modal/expanded 状态 |
| DOM Motion | motion + CSS transitions | 仅用于文字、卡片、导航等轻量 DOM 动效 |
| Vector Motion | Rive, lazy loaded | 小型 hover/icon/装置动画，不进首屏关键路径 |
| Content | 本地 typed data + MDX | 先不上 CMS，保证开发速度和内容可控 |
| Asset Pipeline | gltf-transform + meshopt + KTX2/Basis + WebP/AVIF | 3D/纹理压缩，降低传输体积和 GPU 内存 |
| Testing | Playwright + Lighthouse CI + bundle analyzer | 首屏、移动横屏、WebGL 非空、性能预算 |
| Deploy | Vercel | 保留 Next 标准能力，页面尽量静态生成 |

## 3. 仓库结构建议

```text
MiraLith/
  apps/
    site/
      app/
      components/
      content/
      styles/
      visual/
  packages/
    lubirth-hero/
      src/
      assets/
      shaders/
    coscroll-scene/
      src/
      assets/
      shaders/
    visual-core/
      src/
        quality/
        scroll/
        theatre/
        shaders/
  docs/
```

### apps/site

主站应用。负责页面路由、DOM 内容、项目数据、SEO、整体布局、滚动结构。

### packages/lubirth-hero

MiraLith 首页专用的 LuBirth 视觉摘录，不直接嵌入 LuBirth 全量应用。它只保留：

- 自转地球。
- 固定日期月球，默认 `1993-08-01`。
- 固定太阳方向。
- 部分大气、地弧辉光、aurora。
- 小图、zoom-in、expanded 大图三种 preset。
- 低资源纹理和 shader procedural 效果。

### packages/coscroll-scene

MiraLith 首页 CoScroll 章节专用的轻量视觉摘录，不直接嵌入 CoScroll 全量应用。它只保留：

- 玉质锚字模型。
- 前后遮挡的经文/字句层。
- 暗金、深蓝、矿物黑背景氛围。
- 由 section progress 驱动的旋转、位移、显隐和转场。
- 移动端 poster/video fallback。

不迁入：

- CoScroll 的完整音频系统。
- 完整心经时间轴和播放器。
- 全量 26 个 OBJ 模型。
- 项目配置 store、调试页、测试页和旧实验路线。

第一版目标是一个可被主站 scroll timeline 驱动的 `CoScrollScene`，不是一个独立小应用。

### packages/visual-core

跨章节复用的视觉工具：

- quality tier 检测。
- scroll progress store。
- Theatre.js timeline binding。
- shader utilities。
- WebGL fallback helpers。
- section scene interface types。
- asset budget registry。

## 4. 首页视觉架构

MiraLith 首页采用三层架构：

```text
DOM Content Layer
  标题、文案、项目说明、链接、可访问性内容

Fixed WebGL Canvas
  LuBirth / Radio Gaga / CoScroll / ArtBreeze / Constellation scenes

Orchestration Layer
  scroll progress、section index、quality tier、timeline position
```

原则：

- DOM 不被 WebGL 吞掉，文字和链接必须可选中、可读、可索引。
- WebGL canvas 固定在背景/中景，负责高成本视觉。
- Theatre.js 只管理需要精确时间轴的 3D/visual 参数。
- React 状态不承载每帧动画；高频动画在 R3F `useFrame`、shader uniforms 或 Theatre sequence 内完成。
- 章节视觉默认接入同一个固定 WebGL 架构；只有 demo、调试或 fallback 才允许另起 Canvas。
- 站点第二屏保留给 LuBirth project window；CoScroll 是主线章节中的数字仪式段，不抢 LuBirth 的第二屏叙事位置。

## 5. LuBirth Hero 技术方案

### 两屏都要

LuBirth 在 MiraLith 首页承担两个状态：

1. **Opening / Ritual Field**  
   全屏地月仪式场，是 MiraLith 的第一视觉入口。

2. **LuBirth / Zoomable Project Window**  
   第二屏项目窗口，保留小图、hover/scroll zoom-in、expanded 大图。

两屏使用同一个 `EarthMoonHero` 内核，不复制两套 Canvas。

```tsx
<EarthMoonHero
  mode="field"
  date="1993-08-01T12:00:00Z"
  quality="auto"
/>

<EarthMoonHero
  mode="window"
  interaction="hover-and-click-expand"
  date="1993-08-01T12:00:00Z"
  quality="auto"
/>
```

### 不做的事

- 不 iframe 嵌 LuBirth 全量应用。
- 不加载 LuBirth 的调试面板、LocationSelector、音频、自动测试入口。
- 不在首页首屏加载 8K 纹理、BGM、displacement、moon normal。
- 不把真正 FBO PIP 作为第一版目标；首页版使用同 Canvas 屏幕锚定直渲染，更轻。

### 必须保留的观感

- 自转地球。
- 近满月月球，固定日期默认 `1993-08-01`。
- 固定太阳方向，画面稳定。
- 地弧辉光与卡门线感。
- 少量 aurora，使用 procedural noise/FBM，不加载 aurora 贴图。
- 手机横屏可看，不遮挡主要文字。

## 6. 性能策略

### 初始预算

| 项 | 目标 |
| --- | --- |
| 首屏传输 | mobile 目标 2.4MB，硬上限 3MB |
| 首次可见 | 3s 内显示可接受画面 |
| JS gzip | 首页首屏尽量 350-500KB |
| 首屏纹理 | 1K 或 512 WebP/AVIF/KTX2 |
| WebGL 内存 | 移动端默认低 tier，禁用高细分和重贴图 |
| DPR | mobile 默认 clamp 到 1 或 1.25 |

### Quality tiers

```text
high
  完整地月 hero、aurora、轻 clouds、较高 dpr、更多 post effect

medium
  地月 hero、aurora、无 clouds、低 post effect

low
  地球 + 月球 + 大气辉光，禁用 aurora 或降低采样

fallback
  静态 poster + CSS/SVG 光效，无 WebGL
```

### 加载顺序

1. CSS/SVG intro 和 DOM 文案先出现。
2. WebGL canvas 初始化，用 placeholder material 或极低清纹理。
3. 地球和月球低清纹理就绪后进入运动。
4. 空闲时根据 quality tier 加载 aurora/post effect/更高质量资源。
5. 用户进入 expanded 大图时再提升画质。

## 7. CoScroll 接入策略

CoScroll 在 MiraLith 中作为 **M3 主线章节** 接入，而不是首页第二屏，也不是 iframe/全量应用迁移。

### 保留精髓

- 玉质锚字：来自 CoScroll 的双层材质思路，即内层深青自发光、外层高透射玉质。
- 前后遮挡：保留单 Canvas 深度关系，让前层字句在模型前、后层字句被模型遮挡。
- 背景氛围：保留丝绸/矿物暗场，但优先使用轻量 shader、CSS 或视频 fallback。
- 滚动仪式：用 MiraLith 的 section progress 驱动，而不是复用 CoScroll 的音频时间轴。

### 第一版接口草案

```tsx
<CoScrollScene
  progress={sectionProgress}
  active={sectionActive}
  quality={qualityTier}
  reducedMotion={reducedMotion}
/>
```

其中：

- `progress` 是当前 CoScroll 章节内的 `0..1` 滚动进度。
- `active` 控制资源加载、动画恢复和事件启用。
- `quality` 控制模型数量、DPR、后处理和粒子强度。
- `reducedMotion` 下必须退化为慢速/静态或 poster。

### 资产约束

- OBJ 迁入前必须转 GLB，并经过 meshopt/gltf-transform 压缩。
- 第一版只允许 1-3 个锚字模型，不迁入全量模型库。
- 字体使用系统字体、图片化字贴图或极小 subset，不直接迁入 5MB+ 字体。
- CoScroll 章节资产不进入首屏关键路径，只在接近章节时预加载。

## 8. 动画与滚动

默认使用原生滚动。后续如需丝滑惯性，可只在 desktop high tier 启用 Lenis，不作为基础依赖。

Theatre.js 用于：

- 第一屏到第二屏的 camera transition。
- LuBirth field 到 project window 的形态转换。
- Radio Gaga、CoScroll、ArtBreeze 等章节切换。
- shader uniform、light intensity、mesh transform 的可调时间轴。

不用 Theatre.js 管：

- 每帧地球自转。
- 简单 hover。
- 普通文字 fade/slide。

## 9. 组件策略

后续引入大量组件时遵守：

- 组件默认 server-friendly，只有必要时使用 `use client`。
- WebGL 组件独立包管理，不污染 DOM 内容层。
- 每个重组件必须有 fallback。
- 动画组件必须声明是否进入首屏关键路径。
- 每个项目章节都要能单独禁用视觉层，只保留 DOM 内容。
- 每个章节 scene 必须声明 props contract、资源清单、fallback 和质量分级。

## 10. 关键工程规则

- 首页不允许无预算引入新大依赖。
- 新增资源必须记录大小、用途、首屏是否加载。
- 3D 模型必须经过 mesh/texture 压缩。
- WebGL 动画不得通过 React setState 每帧驱动。
- 移动端默认不加载重后处理。
- 所有视觉章节必须有 reduced-motion 体验。
- 任何页面都不能依赖 WebGL 才能读懂内容。
- CoScroll、Radio Gaga、ArtBreeze 等章节不得迁入原项目全量应用，只迁入可控 scene package。

## 11. 待确认

- 是否使用 Vercel Analytics 还是更隐私友好的 Plausible/Umami。
- 项目详情页是否需要中英文双语。
- Rive 是否第一阶段引入，还是等 Radio Gaga/ArtBreeze 再引入。
- 是否把 LuBirth hero 包独立发布成 npm package，还是仅 monorepo 内部使用。
- CoScroll 第一版保留哪个锚字模型：`心`、`空`、`道`，或三者切换。
