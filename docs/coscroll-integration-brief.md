# CoScroll 接入准备简报

状态：草案 v0.1  
日期：2026-04-24  
目的：在正式迁移计划和接口文档之前，固定 CoScroll 接入 MiraLith 的边界、风险和下一步产物。

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

第一版组件形态：

```tsx
<CoScrollScene
  progress={sectionProgress}
  active={sectionActive}
  quality={qualityTier}
  reducedMotion={reducedMotion}
/>
```

## 3. 保留内容

从 CoScroll 保留这些精髓：

- 玉质锚字模型。
- 前后遮挡滚动：字句在模型前后穿行，后层被模型遮挡。
- 深蓝、暗金、矿物黑的背景氛围。
- 滚动时代的赛博转经筒概念。
- 简短项目文案和进入详情页的 DOM 内容。

## 4. 不迁入内容

第一版不迁入：

- 完整音频系统。
- 播放器、seek、loop 和可见性同步。
- 完整心经时间轴。
- 全量 26 个 OBJ 模型。
- 5MB+ 原字体文件。
- CoScroll 的项目配置 store。
- 调试页、测试页和旧实验分支。

这些内容在 CoScroll 原项目中成立，但进入 MiraLith 后会污染首屏预算和章节架构。

## 5. 技术边界

### 数据输入

CoScroll 章节只读 MiraLith 的编排状态：

- `progress`：当前章节内 `0..1` 进度。
- `active`：章节是否进入可见/预加载范围。
- `quality`：`high | medium | low | fallback`。
- `reducedMotion`：是否禁用强运动。

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

## 6. 资产原则

- OBJ 迁入前转换为 GLB。
- GLB 使用 `gltf-transform` 和 meshopt 压缩。
- 第一版只保留 1-3 个锚字模型，候选：`心`、`空`、`道`。
- HDR/环境贴图只保留一个轻量版本。
- 字体优先使用系统字体、SVG/纹理字、或极小 subset。
- CoScroll 资产只在接近章节时预加载，不进入 LuBirth 首屏关键路径。

## 7. 风险

- 视觉风险：轻量化后失去 CoScroll 原本的“玉质 + 遮挡”灵魂。
- 性能风险：模型、字体、HDR 和后处理合计超过章节预算。
- 架构风险：如果另起 Canvas 或全量迁入，会破坏 MiraLith 固定视觉层。
- 叙事风险：如果把 CoScroll 提前成站点第二屏，会削弱 LuBirth 的入口神话。
- 交互风险：滚轮驱动必须有 touch、keyboard 和 reduced-motion 替代。

## 8. 下一步产物

下一轮应产出两个文档：

1. `docs/coscroll-migration-plan.md`
   - 从 CoScroll 到 MiraLith 的文件级迁移计划。
   - 资产压缩和删减清单。
   - 分阶段验收标准。

2. `docs/coscroll-scene-interface.md`
   - `CoScrollScene` props contract。
   - quality tier 行为表。
   - fallback 行为表。
   - 与 `visual-core` 的 scroll/quality/theatre 接口。

## 9. 当前开放问题

- 第一版中心锚字固定用 `心`，还是在 `心 / 空 / 道` 中切换？
- CoScroll 章节背景使用轻量 shader，还是使用短循环视频 fallback 为主？
- 是否需要保留真实前后遮挡，还是移动端可降级为录屏/poster？
- CoScroll 项目详情页是否嵌入原体验链接，还是只展示 MiraLith 摘录？
