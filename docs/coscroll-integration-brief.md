# CoScroll 接入准备简报

状态：草案 v0.1  
日期：2026-04-24  
目的：在正式迁移计划和接口文档之前，固定 CoScroll 接入 MiraLith 的边界、风险和下一步产物。

> 2026-04-24 对齐说明：CoScroll 不进入 v1.0 发布范围。v1.0 专注 LuBirth 前两屏；CoScroll 作为 v1.1 主线章节准备，仍然遵守轻量 scene package、不全量迁移、不抢第二屏的原则。

## 1. 当前判断

CoScroll 适合作为 MiraLith 主线叙事中的 **数字仪式章节**，不适合作为站点第二屏，也不适合全量应用迁移。

MiraLith 的站点第二屏仍然保留给 `LuBirth Zoomable Project Window`。CoScroll 放在 Radio Gaga 之后，用来完成：

```text
声音的流动 -> 经文的滚动 -> 数字仪式
```

## 2. 接入策略

采用 **轻量 scene package**：

```text
packages/coscroll-scene
```

它只输出一个可被 MiraLith scroll timeline 驱动的视觉章节组件，而不是完整 CoScroll app。

外部壳层形态（不是最终实现接口）：

```tsx
<CoScrollScene
  progress={sectionProgress}
  active={sectionActive}
  quality={qualityTier}
  reducedMotion={reducedMotion}
/>
```

这四个 props 只描述 MiraLith 给章节的入口信号，不能直接覆盖 CoScroll 现有视觉所需的全部状态。`docs/coscroll-scene-interface.md` 已建立 v0.1 草案，正式实现前还需要用 visual spike 回填如何把章节 `progress` 映射成视觉时间、锚字状态、文字层状态和 fallback 行为。

## 3. Readiness Gate：为什么不能直接开工

当前方向已经对齐，但 CoScroll 集成还没有到 implementation-ready。直接迁代码会过早锁死错误边界，尤其是 Canvas 所有权、音频时间轴和资产预算。

开工前必须满足：

- MiraLith Phase 1 scaffolding 已存在：`apps/site`、`packages/visual-core`、`packages/coscroll-scene` 可以作为真实 workspace 互相引用。
- `docs/coscroll-scene-interface.md` 已补齐并经过 visual spike 回填，不只写 `progress/active/quality/reducedMotion`，还要定义视觉适配状态。
- 视觉 spike 已证明“一个玉质锚字 + 前后文字层 + 压缩资产”仍然保留 CoScroll 的灵魂。
- GLB/meshopt 转换结果、poster/video fallback、quality tier 行为表和章节预算表已确认。
- CoScroll scene 在 MiraLith 首页模式下不创建自己的 Canvas，只挂入共享 fixed Canvas；独立 Canvas 只能用于 standalone demo 或 spike。

CoScroll 原项目中已经存在并被验证的能力包括：玉质锚字、前后遮挡、深色/暗金视觉、音频系统、完整心经时间轴、26 个 OBJ、5.8MB 字体和配置 store。这些事实支持“保留精髓、不要全量迁入”的方向，但也说明实现接口必须比当前壳层 props 更细。

## 4. 保留内容

从 CoScroll 保留这些精髓：

- 玉质锚字模型。
- 前后遮挡滚动：字句在模型前后穿行，后层被模型遮挡。
- 深蓝、暗金、矿物黑的背景氛围。
- 滚动时代的赛博转经筒概念。
- 为 MiraLith DOM 内容提供视觉锚点；项目文案、详情页链接和 SEO 由 `apps/site/content` 管理，不进入 `packages/coscroll-scene`。

## 5. 不迁入内容

第一版不迁入：

- 完整音频系统。
- 播放器、seek、loop 和可见性同步。
- 完整心经时间轴。
- 全量 26 个 OBJ 模型。
- 5MB+ 原字体文件。
- CoScroll 的项目配置 store。
- 调试页、测试页和旧实验分支。

这些内容在 CoScroll 原项目中成立，但进入 MiraLith 后会污染首屏预算和章节架构。

## 6. 技术边界

### 数据输入

CoScroll 章节只读 MiraLith 的编排状态：

- `progress`：当前章节内 `0..1` 进度。
- `active`：章节是否进入可见/预加载范围。
- `quality`：`high | medium | low | fallback`。
- `reducedMotion`：是否禁用强运动。

下一版接口文档必须补齐这些视觉适配状态，作为 props、adapter 输出或 scene 内部派生状态均可，但不能遗漏：

- `visualTime`：由 `progress`、章节长度和缓动曲线派生，不直接复用音频播放时间。
- `duration`：章节视觉时长，用于把 CoScroll 的时间轴压缩成 MiraLith 段落长度。
- `lyrics`：轻量经文/短句清单，不迁入完整心经时间轴作为首版依赖。
- `currentAnchor`：当前玉质锚字，如 `心`、`空`、`道`。
- `scrollVelocity`：滚动速度或惯性指标，用于控制文字层强弱，但必须有 reduced-motion 降级。
- `assetManifest`：当前 quality tier 下可加载的 GLB、纹理、poster/video fallback。

### 视觉输出

CoScroll 章节负责：

- 渲染玉质锚字。
- 渲染前后层字句。
- 渲染或接受背景氛围。
- 暴露 fallback poster/video。

CoScroll 章节不负责：

- 页面路由。
- 项目详情页内容。
- 全局 scroll store。
- SEO metadata。
- 站点级音频。
- 创建 homepage 主 Canvas。

## 7. 资产原则

- OBJ 迁入前转换为 GLB。
- GLB 使用 `gltf-transform` 和 meshopt 压缩。
- 第一版只保留 1-3 个锚字模型，候选：`心`、`空`、`道`。
- HDR/环境贴图只保留一个轻量版本。
- 字体优先使用系统字体、SVG/纹理字、或极小 subset。
- CoScroll 资产只在接近章节时预加载，不进入 LuBirth 首屏关键路径。

## 8. 风险

- 视觉风险：轻量化后失去 CoScroll 原本的“玉质 + 遮挡”灵魂。
- 性能风险：模型、字体、HDR 和后处理合计超过章节预算。
- 架构风险：如果另起 Canvas 或全量迁入，会破坏 MiraLith 固定视觉层。
- 叙事风险：如果把 CoScroll 提前成站点第二屏，会削弱 LuBirth 的入口神话。
- 交互风险：滚轮驱动必须有 touch、keyboard 和 reduced-motion 替代。
- 接口风险：只用 `progress/active/quality/reducedMotion` 会低估 CoScroll 的真实状态需求。

## 9. 下一步产物

下一轮不直接迁代码，先补齐前置 gate，再进入迁移计划：

1. MiraLith Phase 1 scaffolding
   - 初始化 `apps/site`、`packages/visual-core`、`packages/coscroll-scene`。
   - 让文档中的 workspace 边界变成可运行代码边界。

2. `docs/coscroll-scene-interface.md`
   - v0.1 草案已建立。
   - visual spike 后回填 `progress -> visualTime` 的最终映射。
   - visual spike 后确认 `lyrics/currentAnchor/scrollVelocity/assetManifest` 的状态归属。
   - 收敛 quality tier 行为表和 fallback 行为表。
   - 明确与 `visual-core` 的 scroll/quality/theatre 接口。

3. CoScroll visual spike
   - 只做一个锚字模型。
   - 验证前后文字层遮挡。
   - 验证压缩 GLB、轻量字体/纹理字、poster/video fallback。

4. `docs/coscroll-migration-plan.md`
   - 从 CoScroll 到 MiraLith 的文件级迁移计划。
   - 资产压缩和删减清单。
   - 分阶段验收标准。

## 10. 当前开放问题

- 第一版中心锚字固定用 `心`，还是在 `心 / 空 / 道` 中切换？
- CoScroll 章节背景使用轻量 shader，还是使用短循环视频 fallback 为主？
- 是否需要保留真实前后遮挡，还是移动端可降级为录屏/poster？
- CoScroll 项目详情页是否嵌入原体验链接，还是只展示 MiraLith 摘录？
