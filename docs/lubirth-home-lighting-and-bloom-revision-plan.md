# LuBirth 首页 Loading、Bloom 与地月光照一致性修改方案

> 日期：2026-07-12  
> 状态：已实施并通过目标回归  
> 本轮范围：首页渲染实现、自动化验收与固定视觉矩阵；full/study 高质量路径保持原行为。

## 1. 目标

修复首页 LuBirth 当前六类视觉问题，同时保持已经成立的轻量架构：

1. Loading SVG 圆最终必须完整闭环。
2. 保留贴地的内层蓝白弧光，收窄过宽的外层 Bloom，并消除矩形截断。
3. 让月球在产品语义正确的月相下清晰可读。
4. 日面不得显示城市灯光贴图。
5. 近景暗面要可读但不能被抬成日面，晨昏线必须清晰。
6. 缩远后仍保持与近景一致的太阳方向、明暗关系与晨昏线，只改变构图和细节等级。

继续保留：

- 单张 packed 云场与单层云壳。
- 首页 `DPR = 0.85`、MSAA 关闭。
- 首页不启用全屏 `UnrealBloomPass`。
- study/full 高质量路径不降级。
- 不把旧 LuBirth 的 DEM、POM、重采样夜光模糊整体移植到首页。

## 2. 诊断结论

这不是单纯再调一组亮度参数的问题，而是六个互相耦合的实现问题：

| 现象 | 直接原因 | 结论 |
| --- | --- | --- |
| Loading 圆始终像缺一段 | 单路径最终仍保留 `stroke-dasharray: 1`；`dashoffset=0` 不会得到稳定的完整圆 | 最终态必须切到 `1 0` 或 `none` |
| 外层 Bloom 太宽且有水平/矩形硬边 | analytic halo 的 Sprite 半径达到 `1.25R`，纹理边界 alpha 仍非零 | 保留 surface glow，重做窄 analytic halo |
| 月球太暗 | 首页默认 `nasa` profile，又把未指定月相解释为 `today`；2026-07-12 的照明比例约 6.4% | 首页默认应回到出生月相；今日月相只显式启用 |
| 日面能看到城市灯 | 城市灯只依赖宽 `dayWeight` 混合，并被 `closeStage * 2.1` 大幅增亮 | 城市灯需要独立、严格的夜侧 gate |
| 近景夜侧过亮、晨昏线不清 | 首页把 `nightSurfaceLift` 从基准 `0.1` 提到 `1.0`，又向整个夜侧叠加大量 day map | 回退整体抬亮，改为低强度夜侧反照率与局部城市灯 |
| 缩远后昼夜趋同 | 滚动时太阳方向从真实方向插值到近乎正对镜头的 `fieldSunDirection` | 太阳方向不得由滚动进度驱动 |

## 3. 证据与代码锚点

### 3.1 Loading 圆

当前结构只有一条圆路径：

- `apps/site/components/LuBirthRevisedRoute.tsx:301-316`
- `apps/site/app/globals.css:866-891`
- `apps/site/app/globals.css:1747-1772`

定时采样结果：

| `data-home-loading="active"` 后时间 | dash offset | opacity | 实际画面 |
| --- | ---: | ---: | --- |
| 350ms | 0.894 | 0.68 | 部分圆弧 |
| 750ms | 0.120 | 0.96 | 接近闭合但仍有明显缺口 |
| 1150ms | 0 | 1 | 仍然没有视觉闭环 |
| 1550ms | 0 | 1 | 仍然没有视觉闭环 |
| 2050ms | 0 | 0.05 | 开始消失 |

浏览器内只把同一条路径改成 `stroke-dasharray: 1 0`，圆立即完整闭合。因此问题不是 SVG 几何，而是最终 dash pattern。

本轮视觉证据：

- `output/playwright/lubirth-lighting-review/loading-1150ms.png`
- `output/playwright/lubirth-lighting-review/loading-forced-one-zero.png`

现有测试还存在互相矛盾的历史断言：

- `tests/e2e/miralith.spec.ts` 仍期待 draw path + complete path 两条圆。
- `tests/e2e/lubirth-revised.spec.ts` 已改为只期待一条路径。

本轮建议保留单路径，但必须验证其最终像素确实闭环，不能只断言 DOM 数量。

### 3.2 外层 Bloom

`packages/lubirth-hero/src/LandingPostEffect.tsx` 当前：

- 64×64 analytic halo 纹理。
- 外圈衰减到归一化半径 `1.08` 才归零，因此纹理方形边缘仍有非零 alpha。
- `diameterScale = 2.5`，即外圈可达到地球半径的 `1.25R`。
- opacity 为 `0.085-0.1`。

实拍 A/B 表明：

- `postEffect=off` 后，大范围蓝色场和水平硬边消失。
- `LandingAtmosphereStack` 的贴地内层蓝白弧仍然存在，而且正是应该保留的部分。

因此不应继续放大 analytic halo，也不应恢复首页全屏 Bloom。

本轮视觉证据：

- `output/playwright/lubirth-lighting-review/earth-close-today-halo.png`
- `output/playwright/lubirth-lighting-review/earth-close-today-nohalo.png`

### 3.3 月球

调用链：

- `apps/site/components/LuBirthRevisedRoute.tsx:63-70` 默认 render profile 为 `nasa`。
- `apps/site/visual/scenes/LuBirthSceneSlot.tsx:263-278` 在未指定时把 `nasa` 映射为 `moonPhase=today`。
- `packages/lubirth-hero/src/LandingMoon.tsx` 再按该月相计算受光与 earthshine。

受控截图结果：

- 2026-07-12 今日月相：照明约 `0.064`，月球几乎全暗。
- LuBirth 出生月相：照明 `0.984`，月面纹理和体积立即恢复。

旧 LuBirth 默认使用出生日期与接近满月的月相，这也与“出生时刻的地月合影”文案一致。月球问题首先是默认语义错误，不能只靠提高全局曝光掩盖。

本轮视觉证据：

- `output/playwright/lubirth-lighting-review/earth-close-today-halo.png`
- `output/playwright/lubirth-lighting-review/earth-close-birthmoon-halo.png`

### 3.4 地球昼夜与城市灯

首页轻量 shader 位于 `packages/lubirth-hero/src/LandingEarthLite.tsx`。

当前高风险组合：

```text
nightSurfaceLift = 1.0
readableNight += closeStage * 0.15
cityLight *= 0.58 + nightWeight * 1.62 + closeStage * 2.1
night day-map detail += closeStage * (0.22 ... 0.70)
```

其中 `nightSurfaceLift=1` 来自：

- `apps/site/visual/scenes/LuBirthSceneSlot.tsx:117-130`

基准 preset 只有 `0.1`：

- `packages/lubirth-hero/src/presets.ts:19-21`

Git 历史确认：

- 夜侧整体抬亮来自 `af8e95a`。
- 近景 `closeStage` 日图与城市灯增强来自 `34f3b14`。
- 最新 `75bc566` 没有重新调整这套昼夜关系。

所以“以前太暗”确实被调整过，但目前属于过度修正。

### 3.5 近远景太阳方向不一致

`packages/lubirth-hero/src/EarthMoonScene.tsx:444-454` 当前按滚动进度执行：

```text
真实/运行时太阳方向
  -> 随 progress 插值
  -> DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION (-0.03, 0.05, 0.998)
```

后者近似正对镜头，会让缩远后的可见圆盘趋向正面照明，削弱明暗半球和晨昏线。滚动不只是改变相机与地球构图，还实际改了太阳，因而无法保证同一颗地球近远一致。

旧 LuBirth 的可复用原则位于：

- `/Users/aitoshuu/Documents/GitHub/LuBirth/src/scenes/simple/api/components/Earth.tsx`
- `/Users/aitoshuu/Documents/GitHub/LuBirth/src/scenes/simple/utils/lightingUtils.ts`
- `/Users/aitoshuu/Documents/GitHub/LuBirth/docs/晨昏线问题修复总结.md`

应借鉴的不是旧 shader 的复杂度，而是三条原则：

1. 单一太阳方向，不由相机或滚动进度改变。
2. `dayW` 与 `nightW` 明确分层。
3. 夜景贴图严格乘夜侧权重；夜侧地表可读性由独立、低强度的反照率层提供。

## 4. 目标渲染架构

### 4.1 单一太阳状态

建立唯一的场景太阳方向：

```text
日期 + 地点
  -> solarDirection（地球/纹理约定坐标）
  -> 按展示用 Earth group 旋转变换一次
  -> sceneLightDirection
  -> Earth / clouds / atmosphere / Moon 共用
```

硬约束：

- `progress` 不参与太阳方向计算。
- 近、中、远三个镜位使用同一太阳向量。
- 相机移动不改变晨昏线在地球表面的地理位置。
- Earth group 的展示旋转只能对太阳向量做一次明确的坐标变换，不能重复补偿。

为便于回归，新增只读诊断值：

```ts
window.__MiraLithLuBirthSceneLightDirection
```

同一 `sunDate/location` 下，`progress=0/0.5/1` 的向量点积应大于 `0.999`。

### 4.2 轻量昼夜模型

建议把首页 shader 收敛为：

```glsl
float ndl = dot(normal, lightDir);
float dayW = smoothstep(-edge, edge, ndl);
float nightW = 1.0 - dayW;
float deepNightW = 1.0 - smoothstep(-edge * 2.2, -edge * 0.65, ndl);

day = dayMap * directAndAmbient * dayW;
nightAlbedo = dayMap * coolNightTint * nightAlbedoStrength * deepNightW;
city = nightMap * nightIntensity * cityGate;
terminator = warmTint * terminatorBand;
color = day + nightAlbedo + city + terminator + specular + cloudTerms;
```

城市灯 gate 必须独立于通用 `dayW` 混合：

```glsl
float cityGate = (1.0 - smoothstep(-0.18, 0.08, ndl)) * pow(nightW, 1.4);
```

这样：

- 日面内部城市灯严格趋近于零。
- 晨昏线附近灯光可以非常轻地提前出现。
- 深夜城市灯保留，但不会把整个夜半球照成日面。

### 4.3 近远景只允许小幅曝光补偿

`closeStage` 可以继续用于：

- 法线/云层细节权重。
- 近景抗压暗的小幅曝光补偿。
- 近景弧光和云影的局部参数。

`closeStage` 不得再用于：

- 改变太阳方向。
- 在整个夜半球叠加高强度 day map。
- 数倍增强城市灯。
- 改变昼夜分类。

建议将近远曝光差控制在约 ±10%，而不是改变材质语义。

## 5. 建议初始参数

以下是第一轮 lookdev 起点，不是无需复核的最终值：

| 参数 | 当前 | 建议起点 | 说明 |
| --- | ---: | ---: | --- |
| `nightSurfaceLift` | 1.0 | 0.16 | 可在 0.10-0.22 内调 |
| `nightIntensity` | 1.05 | 0.76 | 保留灯光但避免过曝 |
| 近景 city boost | `+2.1` | 取消 | 城市灯只由 city gate 控制 |
| 近景夜侧 day-map 追加 | 0.22-0.70 | 0.04-0.09 | 改为冷色夜侧反照率 |
| `terminatorSoftness` | 0.13 | 0.10-0.13 | 不要用超宽过渡掩盖方向错误 |
| terminator tint | 极弱 | 暖色 0.035-0.065 | 只作用在窄带 |
| halo `diameterScale` | 2.5 | 2.12-2.18 | 外扩约 6%-9% 地球半径 |
| halo opacity | 0.085-0.1 | 0.04-0.06 | 内层 surface glow 负责主体弧光 |
| halo 边缘 alpha | 非零 | 必须为 0 | 防止矩形/水平截断 |

## 6. 分阶段实施计划

### Phase A：Loading 与外层 Bloom

修改：

- `apps/site/app/globals.css`
- 必要时 `apps/site/components/LuBirthRevisedRoute.tsx`
- `packages/lubirth-hero/src/LandingPostEffect.tsx`

任务：

1. 保留单一 moon circle。
2. draw 阶段继续使用 dash offset 动画。
3. 约 52% 后把最终 pattern 切为 `stroke-dasharray: 1 0`，持续到淡出。
4. 完整圆至少稳定可见 600ms。
5. analytic halo 纹理增加透明 padding，最外一圈 alpha 强制为 0。
6. 将外扩宽度和 opacity 收到建议范围。
7. 保留 `surface-glow` 内层，不启用首页全屏 Bloom。

### Phase B：月球语义与可读性

修改：

- `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- 视需要微调 `packages/lubirth-hero/src/LandingMoon.tsx`

任务：

1. 首页未指定 `moonPhase` 时默认 `birth`。
2. `moonPhase=today` 继续作为显式调试/产品模式。
3. 出生月相保持当前接近满月的真实几何，不用全局提亮伪造相位。
4. 今日细月模式只增加轻微 earthshine/轮廓可读性，不扩大受光面积。
5. 在文档或 UI 中明确当前显示的是出生月相还是今日月相。

### Phase C：太阳方向统一

修改：

- `packages/lubirth-hero/src/EarthMoonScene.tsx`
- `apps/site/visual/scenes/LuBirthSceneSlot.tsx`

任务：

1. 移除 `sceneLightDirection -> fieldSunDirection` 的 progress 插值。
2. 明确太阳向量是 earth-local 还是 world-space，并在一个位置完成变换。
3. Earth、cloud shell、surface glow 和 Moon 接收同一个最终向量。
4. 保持现有相机、Earth scale、Earth position 和标题滚动编排不变。
5. 增加场景太阳向量诊断值和近远一致性断言。

### Phase D：EarthLite 昼夜重构

修改：

- `packages/lubirth-hero/src/LandingEarthLite.tsx`
- `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- `packages/lubirth-hero/src/presets.ts`（仅在公共默认值确实需要时）

任务：

1. 分离 `dayW`、`nightW`、`deepNightW` 和 `cityGate`。
2. 日面城市灯严格关闭。
3. 删除 `closeStage * 2.1` 城市灯增强。
4. 删除近景对整个夜半球的大幅 day-map 追加。
5. 使用低强度、冷色的 night albedo 保留地形轮廓。
6. 增强窄晨昏带的色温/亮度识别，但不扩大昼夜过渡。
7. 云层、云影、法线、海面高光继续遵守同一个 `dayW`。

### Phase E：回归测试与视觉验收

修改：

- `tests/e2e/miralith.spec.ts`
- `tests/e2e/lubirth-revised.spec.ts`
- `tests/e2e/lubirth-atmosphere-policy.spec.ts`
- 新增或扩展一份 lighting pixel matrix 测试

需要替换的旧断言：

- 删除“首页 `nightSurfaceLift >= 0.3`”这一方向错误的门槛。
- 统一 Loading 单路径测试，不再一处要求两条圆、另一处要求一条圆。
- 测试最终 computed `stroke-dasharray` 为 `1px, 0px` 或 `none`，并保存闭环截图。

新增断言：

1. 同一太阳输入下，progress 0/0.5/1 的场景太阳向量一致。
2. 日面内部 night-map 能量低于夜面内部的 5%。
3. 远景亮面与暗面中位亮度比至少约 2:1。
4. 暗面仍保留可辨地形，不出现全黑裁切。
5. 晨昏带在近、中、远景均可辨，方向不跳变。
6. analytic halo 外边界 alpha 为 0，黑场无矩形边。
7. 首页默认月相为 birth；显式 today 仍返回运行时月相。
8. 单云壳、共享纹理、同步 offset、DPR 0.85 与 MSAA off 回归继续通过。

## 7. 固定视觉矩阵

每次实现后都用同一地点和太阳时间截图，避免“日期不同导致看起来不同”的误判：

```text
viewport: 1440 × 960
location: Mianyang (31.467, 104.679)
timeZone: Asia/Shanghai
sunDate: 2026-07-12T09:00:00Z
progress: 0 / 0.5 / 1
postEffect: analytic-halo / off
moonPhase: birth / today
quality: medium
```

必须保存：

- Loading drawing frame。
- Loading 完整闭环 hold frame。
- 近景 halo on/off。
- 近、中、远同太阳方向地球。
- birth/today 月相 A/B。
- 844×390 横屏近景与最终列表态。

## 8. 验收标准

### Loading

- 肉眼能看到完整圆稳定停留，不是只在理论 dash offset 上归零。
- 圆和真实月球投影之间没有位置跳变。

### Bloom / 弧光

- 内层蓝白弧清晰保留。
- 外层扩散不超过约 6%-9% 地球半径。
- 黑场中没有水平线、方形边、64×64 色阶块。
- 月球和背景星点不被 halo 污染。

### 月球

- 首页默认出生月相，月面纹理可读。
- 今日细月仍保持正确相位，只靠轻微 earthshine 保留轮廓。

### 地球

- 日面无城市灯。
- 暗面能看到地理轮廓，但明显暗于日面。
- 晨昏线连续、方向明确、近远一致。
- 滚动只改变构图和 LOD，不改变太阳。

### 性能

- 不新增全屏 Bloom 或重型 raymarch。
- 桌面首页 p95 目标不高于 18ms。
- 844×390 横屏 p95 目标不高于 18.5ms。
- 相比当前基线，单项修复不应带来超过约 0.5ms 的稳定帧成本。

## 9. 非目标与已知旁路问题

本方案不处理：

- Radio Gaga、CoScroll 或其它首页章节。
- full/study 路径的高级体积大气重构。
- 相机和标题滚动编排重做。
- 844×390 章节栏与品牌文字重叠问题；该问题仍需单独修复，但不要和本轮球体 shader 调参混在同一个提交中。

## 10. 推荐提交拆分

1. `fix(lubirth): close loading moon ring and tighten lite halo`
2. `fix(lubirth): restore birth moon default on home`
3. `fix(lubirth): keep one solar direction across opening`
4. `fix(lubirth): restore day night separation in lite earth`
5. `test(lubirth): lock lighting and halo visual matrix`

每个提交独立视觉复核，避免 Bloom、太阳方向、夜侧曝光同时变化后无法判断是哪一项造成回归。

## 11. 实施结果

本方案已在 `codex/lubirth-home-lighting-bloom` 分支落地，实际实现如下：

### 11.1 Loading 与 analytic halo

- Loading 保留单条 SVG circle；动画进入 52% 后切换为 `stroke-dasharray: 1 0`，闭环保持至淡出。
- analytic halo 直径缩至 `2.16R`，opacity 收敛为 `0.045-0.055`。
- 64×64 halo 纹理的四条边界 alpha 强制为 0；实际外沿约为地球半径外 6.4%。
- surface glow 继续承担贴地蓝白弧光，首页仍不启用全屏 Bloom。

### 11.2 月相与太阳坐标契约

- 首页未指定 `moonPhase` 时固定解析为 `birth`；显式 `today` / `runtime` 继续使用运行时星历。
- `window.__MiraLithLuBirthMoonPhaseMode` 暴露当前产品语义，避免只凭亮度判断月相。
- `window.__MiraLithLuBirthSceneLightDirection` 明确为归一化的 `earth-local` 唯一太阳状态；坐标空间由 `window.__MiraLithLuBirthSceneLightDirectionSpace` 标记。
- 首页只在 `EarthMoonScene` 内使用 Earth group quaternion 做一次 earth-local → world 变换，Earth、cloud、atmosphere 与 Moon 共用该 world 向量。
- 删除首页向 `DEFAULT_LUBIRTH_FIELD_SUN_DIRECTION` 的 progress 插值；full/study 路径保留原高质量渲染行为，避免本轮首页修复改变既有 lookdev 结果。

### 11.3 EarthLite 昼夜模型

- 首页 surface profile 收敛为 `nightIntensity = 0.76`、`nightSurfaceLift = 0.16`。
- shader 明确分离 `dayWeight`、`nightWeight`、`deepNightWeight`、`cityGate` 与 `terminatorBand`。
- 城市灯使用独立夜侧 gate，删除 `closeStage * 2.1`；近景不再向整个夜半球追加高强度 day map。
- 暗面改为低强度冷色 night albedo；晨昏带使用窄暖色识别层；`closeStage` 只保留 `0.96-1.04` 的曝光补偿。
- 性能优化后不使用非整数 `pow` 城市 gate，保持 strict gate 的同时避免首页 fragment shader 跨过 60Hz 帧预算。

### 11.4 自动化与视觉证据

- 新增 halo 边界、月相解析、昼夜权重、近远太阳状态、Loading 闭环和像素亮度断言。
- 固定视觉矩阵保存在 `output/playwright/lubirth-lighting-revision/`，覆盖 Loading draw/hold、halo on/off、近中远、birth/today 与 844×390 横屏。
- 固定远景像素采样结果：日面中位亮度 `85.76`，暗面 `5.94`，背景 `0.86`，日暗比 `14.44:1`；暗面与背景的亮度差约 `5.08`，保留地形轮廓且未黑裁切。
- strict RAF 最终验收结果：桌面 analytic-halo p95 `17.10ms`，844×390 横屏 analytic-halo p95 `17.00ms`。本轮 no-halo 对照受到一次调度长帧干扰，因此不据此宣称 halo 的精确增量成本。
- 单云壳、packed 云纹理、DPR 0.85、MSAA off 与首页无全屏 Bloom 的既有回归继续保留。
- Playwright 支持 `MIRALITH_PLAYWRIGHT_PORT`，并固定从当前 worktree 启动服务，避免并行 worktree 误复用旧构建。

### 11.5 仓库级测试边界

桌面全套共 143 项，结果为 123 passed、3 skipped、17 failed。本轮目标测试没有出现在失败清单中；失败由以下既有或并行环境问题构成：

- 6 项 CoScroll 断言依赖当前基线不存在的迁移组件、anchor 资源或旧 source-match 数值。
- 2 项 full/spike RAF 用例在两 worker 并行跑重型 WebGL 时只得到 2 个样本，未达到其最少 30 样本门槛；相关首页 strict 性能用例已单 worker 独立通过。
- 9 项旧首页用例仍引用已移除的 helmet / `opening-title` 节点、旧滚动交接或易受并行负载影响的 loading 来源。

这些失败未通过放宽断言掩盖，也未在本轮跨范围修改 CoScroll 或标题编排；验收以本方案列出的目标回归、独立 strict 性能测试、lint、typecheck 与 production build 为准。

### 11.6 星空、云体积、暗面与 fallback 闭环

- 首页 medium/high 改为直接采样 `2048×1024` 的 equirect 星空 WebP；文件约 `40KB`，RGBA8 + mipmap 的估算 GPU 占用约 `10.7MiB`。原 8K 星空只保留给 full/study 与 lookdev，首页不再承担约 `170.7MiB` 的解码后纹理占用。
- 固定天空区域采样结果为平均亮度 `0.825/255`、p95 `0.860/255`、亮度至少 `3/255` 的像素占比 `0.00334`；既能读到真实星场，也不抬高黑场底色。
- 云层继续保持“一张 packed 纹理 + 一层云壳”：R 为覆盖度、GB 为切线法线、A 为厚度；A 参与最高 `0.0045R` 的径向顶点置换，fragment 只增加一次视向 relief sample，并继续复用现有太阳偏移自遮蔽和地表云影。
- EarthLite 为未受直射光的表面增加低强度冷色地形环境光，城市灯仍使用独立 strict night gate；近景与暗面可读性因此不再依赖抬高城市灯或全局曝光。
- `visual=fallback` 改为由服务端 search params 决定初始渲染，首帧不再先挂载 Canvas；新增约 `18KB` 的真实 WebP poster，消除了 hydration mismatch 与 poster 404。
- 本轮目标回归 `5/5` 通过，独立首页性能用例 `1/1` 通过；LuBirth/site TypeScript、site ESLint 与 production build 均通过。全套 Playwright 未在本轮重复执行，性能数据仍是桌面浏览器与移动横屏 viewport 仿真，不代表真实移动 GPU。
