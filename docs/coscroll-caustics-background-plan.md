# CoScroll Caustics Background Plan

状态：草案 v0.1  
日期：2026-05-12  
目的：评估并规划将 `reference/caustics` 的焦散光纹语言转译为 CoScroll 路由背景，让 CoScroll 从静态 silk field 变成更有呼吸感的数字仪式场。

## 1. 背景判断

`reference/caustics` 不是一张可直接替换的背景贴图，而是一套基于透明物体、法线渲染、折射计算和接收平面的实时 caustics 系统。它的视觉核心是：

- 透明/半透明主体折射光线。
- 光纹被投射到接收面上。
- 光纹带有细碎、液态、玻璃感的明暗变化。
- 轻微 chromatic aberration 让边缘产生彩色分离。

这与 CoScroll 的玉质锚字、深色仪式场、前后文字穿行非常匹配。它不适合直接替换全站背景，也不适合成为 LuBirth 或 Radio Gaga 的主视觉背景；最适合在 CoScroll 中作为玉字与背景之间的局部光场。

## 2. 当前 CoScroll 背景问题

当前 CoScroll 背景主要由 `CoScrollSilkBackground` 提供：

- 文件：`packages/coscroll-scene/src/CoScrollSilkBackground.tsx`
- 方式：单个 shader plane，使用正弦纹理和噪声生成 silk-like pattern。
- 挂载点：`packages/coscroll-scene/src/CoScrollSceneContent.tsx`

优点：

- 轻量。
- 已接入 `active`、`paused`、`reducedMotion` 和 opacity。
- 与现有 fixed canvas 架构兼容。

不足：

- 运动偏平面化，缺少与中心玉字的物理关系。
- 纹理像背景层，不像由锚字、光线、经文共同生成的场。
- source-match 模式下虽然颜色更接近参考，但仍偏“铺底”，缺少光从物体里透出来的感觉。

## 3. 设计目标

目标不是完整移植 `reference/caustics`，而是提炼其“透明主体产生活光”的语言。

CoScroll 的背景应达到：

- 让中央玉字像在暗场中折射出光纹。
- 背景运动比当前 silk 更自然，但不抢经文和锚字。
- 光纹只在中心周围、文字路径附近、或锚字下方出现，不全屏泛滥。
- 保留 CoScroll 的 black-blue / amber / jade 气质。
- 支持 reduced motion、低性能降级和 visual fallback。

非目标：

- 不引入完整 `MeshTransmissionMaterial`。
- 不使用 `leva`、远程 bunny 模型或 demo controls。
- 不把 `reference/caustics` 的 2000x2000 FBO 配置直接搬进生产。
- 不让 caustics 成为全站统一背景语言。

## 4. 推荐方案

新增一个 CoScroll 专用背景层：

```text
packages/coscroll-scene/src/CoScrollCausticLightField.tsx
```

它作为 `CoScrollSilkBackground` 的增强层，而不是替代所有背景。

推荐渲染顺序：

```text
scene background color
CoScrollSilkBackground
CoScrollCausticLightField
back lyric layer
CoScrollJadeAnchor
front lyric layer
```

`CoScrollCausticLightField` 第一版不需要真实投射锚字几何。先做轻量 shader plane，模拟 caustic light field：

- 使用 procedural caustic fragment shader。
- 输入 `uTime`、`uIntensity`、`uAnchorPresence`、`uScrollVelocity`、`uSourceMatch`。
- 使用 radial mask 把光纹限制在锚字附近。
- 使用 asymmetric drift 让光纹像被慢速滚动拉伸。
- 使用 additive 或 screen-like blending。

这比完整 FBO caustics 稳，成本更低，也更符合 CoScroll 首版背景需求。

## 5. 分阶段计划

### Phase 1: Lightweight Shader Spike

目标：用单 plane shader 替换“僵硬感”，不引入额外 render target。

变更范围：

- 新增 `CoScrollCausticLightField.tsx`。
- 在 `CoScrollSceneContent.tsx` 中挂到 `CoScrollSilkBackground` 后面。
- 为 `sourceMatchMode` 和非 source-match 配两套强度参数。

建议参数：

- `positionZ`: `-5.4` 到 `-4.9`，略靠近 silk 背景。
- `renderOrder`: `-80` 到 `-70`。
- `opacity`: `0.12` 到 `0.32`，source-match 更低。
- `colorA`: jade-cyan or warm amber。
- `colorB`: near-white highlight。
- `radialFalloff`: 中心 30%-55% 可见，边缘快速淡出。

验收：

- 背景不再像静止布纹。
- 锚字周围出现轻微“由玉折出的光”。
- 文字仍然是第一阅读对象。
- 移动端和 reduced motion 不出现明显闪烁。

### Phase 2: Anchor-Aware Light Field

目标：让光纹响应当前锚字和滚动状态。

输入：

- `state.currentAnchor`
- `state.backgroundIntensity`
- `state.scrollVelocity`
- `sourceMatchMode`
- `paused`
- `reducedMotion`

行为：

- `心 / 空 / 道` 可使用不同光纹尺度或方向。
- 滚动速度高时光纹略微拉伸，停止后缓慢回稳。
- source-match 模式更暖、更低饱和，避免破坏当前 black-amber 调性。
- 非 source-match 模式可保留少量冷青色高光。

验收：

- 锚字切换时背景有细微状态变化。
- 快速滚动时场域变活，但不会像粒子爆发。
- paused 状态可稳定复现，用于截图和 visual test。

### Phase 3: Optional Low-Resolution True Caustics

目标：如果 Phase 1/2 不够“物理”，再引入低分辨率真实 caustics pass。

候选做法：

- 参考 `reference/caustics/App.js` 的 normal render target + compute quad 流程。
- FBO 从 demo 的 `2000x2000` 降到 `512x512` 或 `768x768`。
- 只在 `quality.tier === "high"` 且非 reduced motion 时启用。
- 接收面仍然是局部 plane，不铺满整屏。
- 当前锚字 geometry 可作为 caster，但需要避免每帧昂贵 bounds 计算。

风险：

- 与现有 `MeshPhysicalMaterial` / transmission 渲染交互不一定稳定。
- 多一次 render target 会增加移动端成本。
- CoScroll 的文本层和锚字遮挡关系可能变复杂。

验收：

- 高端桌面有肉眼可见提升。
- medium/low 回退到 Phase 1 shader，视觉仍成立。
- 不影响 CoScroll route 的首屏可用性和 fallback。

## 6. 具体实现边界

### 文件边界

新增：

- `packages/coscroll-scene/src/CoScrollCausticLightField.tsx`

修改：

- `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- `packages/coscroll-scene/src/index.ts`，如需要导出给 spike route 使用。
- `tests/e2e/coscroll.spec.ts`，补充视觉存在和 fallback 检查。

不修改：

- `packages/radio-gaga-scene`
- `packages/lubirth-hero`
- 全局 `VisualCanvas`
- LuBirth home loading 逻辑

### 质量分层

- `high`: caustic shader full intensity，可考虑 Phase 3 true caustics。
- `medium`: shader light field，降低采样复杂度和 opacity。
- `low`: 只保留非常慢、低频的背景光纹。
- `fallback`: 不渲染 caustics，使用 poster / static fallback。
- `reducedMotion`: freeze time 或极慢 drift，不响应 scroll velocity。

## 7. Shader 方向

Phase 1 shader 不应追求真实物理，而应追求 CoScroll 的审美结果。

核心结构：

```glsl
vec2 uv = centeredUv;
uv = rotate(uv, uRotation);

float lineA = sin(uv.x * scaleA + fbm(uv + time));
float lineB = sin((uv.x + uv.y) * scaleB - time * 0.4);
float caustic = pow(max(0.0, lineA * lineB), sharpness);

float mask = smoothstep(outer, inner, length(centeredUv));
vec3 color = mix(uColorA, uColorB, caustic);
alpha = caustic * mask * uIntensity;
```

视觉约束：

- 不要做全屏高亮水波。
- 不要使用纯蓝/纯紫主调。
- 不要让光纹边缘太锐，避免廉价水池感。
- 中央可亮，四周必须暗。

## 8. 验收清单

- [ ] Desktop CoScroll route：中心锚字周围有轻微活光，背景不僵。
- [ ] Mobile CoScroll route：没有明显过曝、闪烁、文字遮挡。
- [ ] `sourceMatch=1`：仍保留当前 black-amber source-match 气质。
- [ ] `visualTest=pixels` 或 paused 截图：画面稳定，不因时间随机导致不可复现。
- [ ] `prefers-reduced-motion`：caustics 静止或极慢。
- [ ] fallback：WebGL 失败时不依赖 caustics 才能表达章节。
- [ ] 性能：medium/low 不引入额外 render target。

## 9. 推荐下一步

先做 Phase 1 的 shader spike，并在 `/coscroll-spike?sourceMatch=1` 和普通 CoScroll 场景中各截一组桌面/移动截图。

如果 Phase 1 已经解决“背景僵”的问题，就不要进入 Phase 3。真实 caustics 只有在轻量方案明显不够、且 CoScroll 需要更强玉质物理感时再做。
