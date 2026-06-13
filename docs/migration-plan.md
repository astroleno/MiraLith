# LuBirth 到 MiraLith 迁移计划

状态：MiraLith v1.0 LuBirth 前两屏已实现  
日期：2026-04-24  
来源项目：`/Users/aitoshuu/Documents/GitHub/LuBirth`  
目标项目：`/Users/aitoshuu/Documents/GitHub/MiraLith`

## 1. 项目目标

把 LuBirth 的地月视觉能力迁移为 MiraLith 首页专用的轻量视觉包 `@miralith/lubirth-hero`，用于首页前两屏：

1. **Opening / LuBirth Ritual Field**：全屏地月仪式场。
2. **LuBirth Zoomable Project Window**：可 zoom 的项目窗口，支持小图、zoom-in、expanded 大图。

迁移不是把 LuBirth 全量应用搬进 MiraLith。迁移目标是抽出视觉内核、重写轻量入口、重做资产预算，并建立可在 MiraLith 长滚动体验中复用的接口。

生产首页的 WebGL ownership 由 `apps/site` / `packages/visual-core` 负责：MiraLith v1.0 使用一个 fixed Canvas 承载 Opening、LuBirth Window 和后续章节 scene。`@miralith/lubirth-hero` 在生产首页主要导出 `EarthMoonScene`；`EarthMoonHero` 只作为 demo/dev standalone wrapper、独立预览页或 fallback wrapper 使用。

## 2. 迁移原则

- 不 iframe 嵌入 LuBirth。
- 不复制 LuBirth 的 `SimpleTest` 作为首页组件。
- 不引入调试面板、LocationSelector、音频播放器、自动测试入口。
- 不把 LuBirth 的 8K 纹理和 BGM 带入 MiraLith 首屏。
- 不实现、不复用 FBO PIP。LuBirth 当前可用形态是 same-canvas screen-anchored moon，MiraLith v1.0 明确采用同 Canvas 屏幕锚定月球。
- 生产首页不允许多个 WebGL Canvas 竞争 GPU；所有章节 scene 默认挂入同一个 fixed Canvas。
- Theatre.js binding 属于 `apps/site` / `visual-core` 编排层；`@miralith/lubirth-hero` 只暴露 animatable props，不直接依赖 Theatre。
- 复用经过验证的数学、shader 思路和地月视觉经验。
- 在 MiraLith 中建立新的轻量类型、preset、asset manifest 和 quality tier。
- 所有迁移代码必须有 mobile landscape 验证路径。

## 3. 可迁移资产与代码锚点

| LuBirth 模块 | 迁移方式 | 用途 | 注意事项 |
| --- | --- | --- | --- |
| `src/scenes/simple/api/components/Earth.tsx` | 参考/部分抽取 | 地球昼夜、海面高光、大气 rim 思路 | 当前 props 和 shader 太重，首页版应新建 `LandingEarth` |
| `src/scenes/simple/api/components/Moon.tsx` | 参考/部分抽取 | 固定屏幕月球、潮汐锁定、月相 shader | 去掉 `window.__LuBirthMoonScreenSize`，改显式 prop |
| `src/scenes/simple/api/components/AtmosphereEffects.tsx` | 参考/改写 | 大气辉光、近地薄壳 | 首页版保留简化 shader |
| `src/scenes/simple/utils/positionUtils.ts` | 复用算法 | 屏幕锚定位置、相机设置思路 | 首页版避免直接写全局 camera 状态 |
| `src/scenes/simple/api/moonPhase.ts` | 可选复用 | 精确月相 | 若只固定 `1993-08-01T12:00:00Z`，可先离线/轻量常量化 |
| `src/scenes/simple/utils/moonPhaseCalculator.ts` | 可选复用 | 简化月相兜底 | 首页版不需要完整 astronomy-engine 首屏依赖 |
| `src/scenes/simple/utils/lightingUtils.ts` | 复用思路 | 固定太阳方向 | 首页默认固定太阳，不做季节变化 |
| `public/textures/*` | 不直接迁移 | 原始参考资源 | 重新生成 512/1024 WebP/AVIF/KTX2 |
| `src/SimpleTest.tsx` | 不迁移 | 调试宿主 | 只作为行为参考 |

## 4. 目标仓库结构

```text
MiraLith/
  apps/
    site/
      app/
      components/
      content/
      styles/
      visual/
        VisualCanvas.tsx
        scenes/
  packages/
    lubirth-hero/
      src/
        EarthMoonHero.tsx
        EarthMoonScene.tsx
        LandingEarth.tsx
        LandingMoon.tsx
        LandingAtmosphere.tsx
        LandingAurora.tsx
        presets.ts
        types.ts
        useLandingMotion.ts
        useLandingTextures.ts
        index.ts
      assets/
        earth/
        moon/
        posters/
      shaders/
    visual-core/
      src/
        quality/
        scroll/
        theatre/
        shaders/
```

## 5. Milestones

Target 按单人实现工作日估算，已包含基础集成、调试和验证缓冲；多人并行时可以压缩日历时间，但不能把这些数值直接当作总人天削减。

| # | Milestone | Target | Success Criteria |
| --- | --- | --- | --- |
| M0 | 项目骨架 | 2-3 days | Next + pnpm workspace 跑通，包结构就位 |
| M1 | LuBirth hero 静态场景 | 6-8 days | `EarthMoonScene` 能在站点 owned Canvas 内渲染地球、月球、固定光照、大气，且 mobile landscape smoke 通过 |
| M2 | 两屏交互 | 5-7 days | field → window → zoomed → expanded 状态可达，滚动/hover/tap 生效 |
| M3 | 资源与性能预算 | 4-5 days | mobile 首屏传输 <= 3MB，3s 内可见 |
| M4 | 首页前两屏集成 | 4-6 days | Intro + Opening + LuBirth Window 与 DOM 内容合成 |
| M5 | 验证与文档冻结 | 3-4 days | Playwright 截图、first-visible/LCP、bundle report、接口文档同步 |

## 6. Phase 0: 项目骨架

### Current Implementation Snapshot

截至 2026-04-24，LuBirth 前两屏生产路径已落地。

已完成：

- pnpm workspace、`apps/site`、`packages/lubirth-hero`、`packages/visual-core` 已存在。
- Next App Router 首页渲染 Opening 与 LuBirth Project Window 两屏。
- 生产首页已有 site-owned `VisualCanvas` / fixed Canvas layer。
- `EarthMoonScene` 已通过 `LuBirthSceneSlot` 挂入生产 site-owned Canvas。
- site-owned fallback、Canvas a11y、context-lost routing 已接入生产首页。
- `@miralith/lubirth-hero` 已有 `EarthMoonScene`、`EarthMoonHero` demo wrapper、`LandingEarth`、`LandingMoon`、`LandingAtmosphere`、`LandingAurora`。
- `@miralith/visual-core` 已有 quality、scroll、opening timeline 基础模块。
- `pnpm typecheck`、`pnpm build`、`pnpm test:e2e` 已通过当前实现。

未完成：

- 真实 WebP/AVIF/KTX2 贴图仍待替换当前 procedural texture refs。
- 后续 Radio Gaga、CoScroll、ArtBreeze、constellation 章节尚未接入共享 Canvas。

结论：Phase 0 的 `VisualCanvas ownership 边界` 已完成；生产首页路径是 `apps/site` owned `VisualCanvas` + `LuBirthSceneSlot` + `EarthMoonScene`，不是 `EarthMoonHero`。

| Task | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- |
| 初始化 pnpm workspace | 2h | 技术栈决策 | `apps/site` 和 `packages/*` 可安装依赖 |
| 创建 Next App Router 应用 | 2h | workspace | 首页 route 可运行 |
| 创建 `packages/lubirth-hero` | 2h | workspace | 可从 `apps/site` import |
| 创建 `packages/visual-core` | 2h | workspace | quality/scroll 基础导出 |
| 创建 `VisualCanvas` ownership 边界 | 3h | site + visual-core | 生产首页只有一个 fixed Canvas，scene 通过注册/props 挂入 |
| 配置 TypeScript strict | 2h | workspace | `pnpm typecheck` 可执行 |
| 配置 lint/format | 2h | workspace | 基础 lint 命令可执行 |
| 建立 docs 链接 | 1h | docs | README 或 docs index 指向 PRD/tech/migration/interfaces |

## 7. Phase 1: LuBirth Hero 静态视觉内核

Implementation note: `packages/lubirth-hero` 已拆成 `EarthMoonScene`、`LandingEarth`、`LandingMoon`、`LandingAtmosphere`、`LandingAurora`，并接入 Phase 0 的 site-owned `VisualCanvas`。当前 e2e 已覆盖 mobile landscape smoke、非空 Canvas、fallback、first usable marker 与 3MB budget gate。

| Task | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- |
| 定义 `LandingComposition` 类型 | 3h | Phase 0 | 只包含首页必要字段 |
| 编写 `presets.ts` | 4h | 类型 | `field/window/zoomed/expanded` preset 完整 |
| 完善并接入 `EarthMoonScene` 初版 | 6h | preset + VisualCanvas | 在站点 owned Canvas 内光照、相机、地月对象可渲染 |
| 完善 `EarthMoonHero` demo wrapper 初版 | 4h | EarthMoonScene | 可接受 mode/quality/date props，但不作为生产首页默认路径 |
| 实现 `LandingEarth` | 8h | Scene | 地球自转、昼夜、简化 rim 可见 |
| 实现 `LandingMoon` | 8h | Scene | 同 Canvas 屏幕锚定月球、固定日期 `1993-08-01T12:00:00Z` 月相可见；不使用 FBO PIP |
| 实现 `LandingAtmosphere` | 6h | Earth | 地弧辉光和近地薄壳可见 |
| 实现 `LandingAurora` alpha | 6h | Earth/Atmosphere | procedural aurora 可开关 |
| 生成临时低清资产 | 4h | assets | 512/1024 地球/月球首屏资源就位 |
| M1 mobile landscape smoke screenshot | 2h | EarthMoonScene + low assets | 手机横屏下 field 构图不遮挡核心地月视觉 |

## 8. Phase 2: 两屏交互与滚动

| Task | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- |
| 实现 `useLandingMotion` | 6h | Phase 1 | 地球自转、hover slowdown、motion pause 可控 |
| 实现 field → window preset interpolation | 8h | useLandingMotion | 滚动推进时构图平滑收束 |
| 实现 window hover zoom-in | 4h | interpolation | desktop hover 进入 zoom 状态 |
| 实现 touch/tap zoom | 4h | hover zoom | 移动端可进入 zoom |
| 实现 expanded modal/state | 6h | zoom | 点击打开大图，Esc/close 返回，focus trap 和返回焦点可用 |
| 接入 reduced-motion | 4h | motion | 系统偏好减少动画时仍可读可用 |
| 接入 Theatre.js opening timeline | 8h | interpolation | 第一屏到第二屏的 camera、light、shader、mesh 关键参数可 timeline 调整 |

## 9. Phase 3: 资源与性能预算

| Task | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- |
| 建立 asset manifest | 3h | Phase 1 | 每个资源有 size、tier、preload 标记 |
| 压缩地球/月球贴图 | 6h | manifest | 首屏纹理满足预算 |
| 添加 `QualityTier` 检测 | 6h | visual-core | high/medium/low/fallback 可切换 |
| DPR clamp | 3h | quality | mobile 默认 1 或 1.25 |
| 懒加载 expanded 资源 | 4h | manifest | 大图资源不进首屏 |
| Bundle analyzer | 3h | site | 可输出 JS/CSS 体积 |
| Lighthouse CI 基线 | 4h | site | 有首屏性能报告 |

## 10. Phase 4: 首页前两屏集成

| Task | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- |
| 实现 Intro / Loading Mark | 4h | site | CSS/SVG intro 不依赖 WebGL |
| 实现 Opening DOM copy | 4h | Hero field | 文案叠加在全屏地月场上 |
| 实现 LuBirth Window DOM | 4h | Hero window | 项目标题、说明、CTA 可读 |
| 接入 scroll sections | 6h | DOM + Hero | 第一屏到第二屏滚动可用 |
| 移动横屏布局 | 6h | sections | 文字不遮挡地月核心 |
| fallback poster | 4h | assets | WebGL 不可用、context lost、critical texture failed、reduced-motion fallback 时仍显示静态图和完整 DOM |
| a11y/fallback contract 接入 | 4h | sections + fallback | Canvas `aria-hidden` / `aria-label`、keyboard flow、expanded focus trap、Esc 返回全部明确 |

## 11. Phase 5: 验证与冻结

| Task | Effort | Depends On | Done Criteria |
| --- | --- | --- | --- |
| Playwright 桌面截图 | 3h | Phase 4 | Opening/window/zoomed/expanded 四态截图 |
| Playwright 手机竖屏截图 | 3h | Phase 4 | 内容可读，构图不坏 |
| Playwright 手机横屏截图 | 3h | Phase 4 | 满足硬性横屏要求 |
| WebGL 非空像素检查 | 4h | screenshots | Canvas 非空且地月可见 |
| 3s first usable viewport / LCP 检查 | 3h | site + analyzer | 首屏 3s 内出现可接受 DOM + fallback/WebGL 画面；LCP 或自定义 marker 通过 |
| a11y keyboard flow 检查 | 3h | Phase 4 | Tab 顺序、expanded focus trap、Esc、返回焦点通过 |
| fallback trigger 检查 | 3h | Phase 4 | WebGL unavailable/context lost/critical texture failed/reduced-motion 进入 fallback |
| Bundle budget 检查 | 3h | analyzer | 首屏 <= 3MB |
| 文档同步 | 2h | all | interfaces 和 migration-plan 与实现一致 |

## 12. Dependencies Map

```text
tech-stack/prd
  -> workspace setup
    -> VisualCanvas ownership
    -> lubirth-hero package
      -> LandingComposition + presets
        -> EarthMoonScene
          -> LandingEarth
          -> LandingMoon
          -> LandingAtmosphere
          -> LandingAurora
            -> field/window/zoomed/expanded interaction
              -> asset manifest + quality tiers
                -> homepage first two sections
                  -> Playwright + budget verification
```

## 13. Critical Path

1. Workspace, package boundaries, and production single-Canvas ownership.
2. `LandingComposition` and preset API.
3. `EarthMoonScene` static render inside the site-owned Canvas.
4. Asset budget and texture compression.
5. Field-to-window transition.
6. Mobile landscape verification.

不要在 M1 前处理 Radio Gaga、CoScroll、ArtBreeze 的复杂 3D。它们依赖同一套 visual-core，但不应阻塞 LuBirth 前两屏。

## 14. 风险与缓解

| Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- |
| 直接复用 LuBirth 组件导致包体过重 | High | High | 首页版新建 `LandingEarth/LandingMoon`，只借鉴实现 |
| Canvas ownership 漂移导致重复 Canvas | High | Medium | 生产首页只允许 `apps/site` / `visual-core` 创建 fixed Canvas，`EarthMoonHero` 限定为 demo/dev wrapper |
| 误把 PIP/FBO 当作 LuBirth 现成能力 | Medium | Medium | 文档和接口明确 v1.0 使用 same-canvas screen-anchored moon，不实现 FBO PIP |
| 纹理超过 3MB 首屏预算 | High | High | asset manifest + 512/1024 低清 + expanded 懒加载 |
| astronomy-engine 进入首屏 bundle | Medium | Medium | 固定日期月相先常量化，精确计算后置 |
| Theatre.js 管理范围过大 | Medium | Medium | 从第一阶段接入，但只管 Opening -> Window 主转场；地球自转、hover、普通 DOM 动效不进 Theatre |
| 手机横屏文字遮挡画面 | High | Medium | 从 M1 开始固定横屏 smoke 截图验收，M2 后覆盖 zoomed/expanded |
| Aurora shader 过重 | Medium | Medium | low tier 禁用或降低采样 |
| 多 Canvas 导致 GPU/内存上升 | High | Medium | 首页固定单 Canvas，状态切换不重建场景 |
| 迁移时破坏 LuBirth 原项目 | High | Low | 只读参考 LuBirth，不在 LuBirth 内改动 |

## 15. 验收标准

### M1

- `EarthMoonScene mode="field"` 能在站点 owned Canvas 内渲染地球、月球、大气。
- 地球自转可见。
- 月球固定为 `1993-08-01T12:00:00Z` 近满月视觉。
- mobile landscape smoke screenshot 通过，基础 field 构图不遮挡地月核心。
- 没有引入 LuBirth 全量 `SimpleTest`。

### M2

- 第一屏 field 可滚动收束到第二屏 window。
- 第二屏支持 zoomed 和 expanded。
- desktop hover、mobile tap 都可用。
- expanded 的 focus trap、Esc、关闭后返回焦点可用。

### M3

- 首屏资源传输不超过 3MB。
- mobile low tier 禁用重效果。
- expanded 资源不进首屏。

### M4

- Intro、Opening、LuBirth Window 串联完成。
- DOM 文案完整可读。
- WebGL unavailable、context lost、critical texture failed、reduced-motion fallback 可用。

### M5

- Playwright 覆盖桌面、手机竖屏、手机横屏。
- WebGL 非空像素检查通过。
- 3s first usable viewport / LCP 或自定义首屏 marker 检查通过。
- Keyboard/a11y/fallback trigger 检查通过。
- 文档、接口、实现一致。

## 16. 后续扩展

LuBirth 前两屏稳定后，再扩展：

- Radio Gaga scene。
- CoScroll scene。
- ArtBreeze scene。
- Constellation 3D 星群。
- 项目详情页模板。
- 资产管理脚本和视觉回归基线。
