# LuBirth Takram V3 Scale and Morphology Implementation Plan

> **For agentic workers:** REQUIRED SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not start Task 0P or the original Task 0–8 unless this plan reaches its explicit unlock checkpoint.

**Goal:** 让 V3 云场在 LuBirth 的近地、空中和 opening 构图中都读成有尺度、有厚度、有自阴影的 Takram 原生体积云，而不是贴地色块或颗粒噪点；先取得视觉正确性，再授权成本测试。

**Architecture:** 保留 V3 作为唯一宏观天气场，保留完整原生 `CloudsEffect → temporal resolve → AerialPerspectiveEffect` 渲染路径。新增一个以米和投影像素为单位的 morphology scale contract，先验证单一世界尺度能否跨视角成立；只有证据证明单一尺度无法同时服务近景与 opening 时，才引入带迟滞的两档 presentation LOD。禁止通过更换 renderer、降低分辨率、关闭 BSM/temporal/detail 或修改 V3 coverage footprint 来伪造通过。

**Tech Stack:** TypeScript、React Three Fiber、Three.js、`@takram/three-clouds@0.7.6`、Vitest、headed System Chrome E2E、现有 Takram parity query route。

---

## 0. 当前判断与执行边界

### 0.1 结论：尺度合同确实没有做完整，但不是 ECEF 世界尺度再次出错

现有证据已经证明：

- `world-depth-to-ecef-v1`、非 1:1 scene-depth scale、V3 spherical mapping、HDR/gamma 与原生 pipeline 均通过。
- 固定地理列在 `2.5 km / 50 km / 200 km / 3,578.429 km` 都有非零 density、optical depth、pre/post-temporal radiance 和最终 cloud-on/off 差分。
- 因此当前失败不是“云根本没进入 raymarch”，也不是 Earth inverse scale 或某个 shader stage 归零。

真正缺失的是**相对尺度合同**：

1. 当前 `shapeRepeat=0.000025`，主形体波长为 `40 km`；官方默认 `0.0003` 对应约 `3.33 km`。当前主形体被放大约 12 倍。
2. 当前 `shapeDetailRepeat=0.0006`，细节波长约 `1.67 km`；官方默认 `0.006` 对应约 `167 m`。当前细节被放大约 10 倍。
3. 当前四层 base altitude 为 `8–18 km`，厚度为 `20–50 km`；官方示例主要是 `0.75–7.5 km` base、`0.5–1.2 km` 厚度。当前垂直尺度和水平尺度没有共同的形态比例约束。
4. opening 虽然画面上像“近景行星”，Takram 实际接收的 camera altitude 约为 `3,578 km`。在这个投影下，`40 km` 主形体仍可能只覆盖少量像素，`1.67 km` detail 会落入亚像素；最新 opening ladder 的有效 primary sample 平均值又只有约 `1.73`，所以最终表现为碎点和表面色斑。
5. 现有 altitude ladder 是 optical-signal 诊断，不是近景 morphology 视觉测试；它没有以斜视角展示 base/core/top，也没有证明近景尺度成立。

所以本计划不再继续盲调一个共享 `coverage/shapeRepeat`。先建立“世界米制尺度 → 当前相机投影像素 → 原生采样密度”的可测合同，再做受控候选矩阵。

### 0.2 不允许改变的合同

- V3 weather 仍是唯一宏观覆盖来源；保留 source hash、equirectangular spherical mapping、S Repeat / T Clamp、clear-air 语义和现有四通道含义。
- stock 与 V3 继续共用同一 normalized native renderer fingerprint。
- 保留 BSM、shape detail、turbulence、temporal upscale、AerialPerspective、`qualityPreset=high`、`resolutionScale=1`。
- morphology 阶段固定 `coverage=0.55`；在至少一个候选已经读成体积云以前，不得以 coverage 调节形态。
- 不修改首页、`EarthMoonScene`、production composer、fallback policy 或原 Task 0–8。
- Task 0P 继续锁定；本计划中的 GPU 数据只能用于采样诊断，不能得出成本或 promotion 结论。

### 0.3 当前 checkpoint

```text
V3_INPUT_CONTRACT_PASS
DISPOSABLE_RENDERER_REJECTED
TAKRAM_NATIVE_PATH_PASS
V3_ADAPTER_SIGNAL_VISIBLE_MORPHOLOGY_FAIL
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

只有完成 Task 6 的正式视觉 gate 后，才允许把 `V3_ADAPTER_SIGNAL_VISIBLE_MORPHOLOGY_FAIL` 改为 `V3_ADAPTER_VISUAL_PASS` 并解锁 Task 0P。

### 0.4 执行结果（2026-08-09）

Task 0–2 已在 commit `1063909`、headed System Chrome、production build、`1440×960 / DPR 1` 下重新执行。四个视角的 review target 都锁定在同一个 V3 spherical UV；三个近景相机从该目标反向沿球面 arc 求解，审计点均位于画面中心，目标 ECEF altitude 与沿地表距离也由单测锁定。尺度审计保留 east/north 两轴，不再使用 RMS 代替二维投影。

纠正后的 baseline east/north 投影为：near shape `42.67 / 577.58 px`、detail `1.78 / 24.07 px`；aerial shape `50.32 / 250.27 px`、detail `2.10 / 10.43 px`；near-orbit shape `18.06 / 72.65 px`、detail `0.75 / 3.03 px`；opening shape `2.85 / 4.67 px`、detail `0.12 / 0.19 px`。三个近景的 shape repeat 交集为 `[0.0003008209, 0.0000282150]`，detail 为 `[0.0014439402, 0.0001504800]`，均为空。

Task 2 为可追溯性重放原 10 个 RMS-derived candidate ID，但 `axisEligibleCandidates=[]`，没有候选在三个近景的 east/north 两轴同时进入目标区间。`largestConnectedAreaFraction` 已降为诊断项：单一大连通区不能证明没有内部 billow。新增 internal luma stddev、multi-scale variation、gradient energy 与 local-peak density；这些指标不得替代人工体积视觉门。所有 raw-off、cloud-off 与 exact history-reset frame 都已持久化，首帧由 `nativeFrameCount=1` 的 immutable capture 绑定。因此当前 checkpoint 只由双轴尺度证据计算为：

```text
HORIZONTAL_MORPHOLOGY_SCALE_FAIL
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

Task 3–6 与 Task 0P 继续锁定。单纯 near/aerial scalar LOD 无法修复单一视角内部的 east/north 投影跨度。下一步若要继续，必须先 amendment 明确修改 view-space acceptance contract，或授权 anisotropic ENU morphology representation；不得继续共享 scalar repeat 调参，也不得进入 vertical profile、temporal、lighting 或 GPU cost。

## 1. 目标文件结构

### 新建

- `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract.ts`
  - 固定 review views、地理列、投影像素目标、候选 profile、checkpoint 类型。
- `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyScaleAudit.ts`
  - 纯函数：repeat/波长换算、投影 pixels-per-meter、屏幕波长、层厚屏幕尺寸、候选求解与判定。
- `tests/unit/lubirthTakramV3MorphologyScale.spec.ts`
  - 锁定尺度数学和禁止项。
- `tests/e2e/lubirth-takram-v3-morphology.spec.ts`
  - 固定视角、诊断截图、telemetry 和视觉证据采集。
- `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/README.md`
- `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/scale-audit.json`
- `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/candidate-matrix.json`
- `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/visual-review.json`
- `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/checkpoint.json`
- `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/captures/`

### 修改

- `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
  - 增加 query-only morphology view/candidate 参数；不改变 stock contract。
- `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityV3Layers.ts`
  - 将当前匿名数值提升为命名 baseline，并接收已冻结的候选 profile。
- `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
  - 在 V3/query-only 路径应用 morphology candidate，暴露 resolved scale telemetry。
- `packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx`
  - 只挂载 query-only review camera，不改变 opening mirror。
- `tests/unit/lubirthTakramParityContract.spec.ts`
- `tests/unit/lubirthTakramParityV3Adapter.spec.ts`
- `tests/e2e/lubirth-takram-parity.spec.ts`
- `tests/e2e/lubirth-takram-parity-visual.spec.ts`
- `docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/checkpoint.json`
- `docs/superpowers/plans/2026-08-05-lubirth-planetary-volumetric-cloud-spike.md`
  - 只在 Task 0V/0P checkpoint 增加本计划链接与最终结论，不把本计划重新复制进去。

## 2. 固定验收视角与尺度指标

### 2.1 四个 review views

所有视角使用同一 V3 高覆盖地理列、同一 sun、同一 viewport `1440×960 / DPR 1`。近地三个视角使用局部 ENU 相机，opening 保留现有 Task -1R matrix mirror。

| ID | Camera altitude | Framing | 目的 |
|---|---:|---|---|
| `near-oblique` | `2.5 km` | 朝沿地表东向约 `80 km`、地表上空 `8 km` 的云层目标点斜视 | 检查云底、近景 billow、视差和贴地感 |
| `aerial-oblique` | `50 km` | 朝沿地表东向约 `180 km`、地表上空 `10 km` 的云层目标点斜视 | 检查整层厚度、tower 和自阴影 |
| `near-orbit` | `200 km` | 朝沿地表东向约 `600 km`、地表上空 `12 km` 的云层目标点斜视 | 检查中尺度轮廓与时间稳定性 |
| `opening-orbit` | `3,578.429 km` | 现有 opening progress `0.06`，不得重构相机 | 检查现有页面构图的最终可读性 |

每个视角同时采集：

- `full-converged`
- `cloud-raw-converged`
- `history-reset-first`
- `bsm-off`
- `cloud-off-final`
- `sample-count-debug`

### 2.2 屏幕尺度目标

尺度审计必须对每个 view 从相机矩阵和固定地理点实际投影 `1 km` 局部切线段，不能用行星在截图中的目测宽度反推。

- 主形体波长：目标 `16–48 px`，低于 `8 px` 记为碎裂风险，高于 `96 px` 记为单块贴图风险。
- detail 波长：目标 `3–10 px`，低于 `2 px` 记为亚像素噪声风险。
- 可读垂直厚度：在 `near-oblique` 和 `aerial-oblique` 至少 `12 px`；在 `near-orbit` 至少 `4 px`；opening limb 至少 `2 px`。
- projected shape/detail ratio 保持在 `4:1–12:1`；禁止主形体清楚但 detail 亚像素。
- cloud raw 中 `1–3 px` 孤立碎片占 cloud pixels 的比例必须 `<8%`；单像素碎片 `<2%`。
- clear-air 区域的 cloud-on/off 差分像素泄漏 `<1%`。

这些数值是自动门槛，不替代人工视觉判断。

### 2.3 体积视觉目标

人工 review 必须同时确认：

- 至少能读出 lit top、dense core、shadowed base 中的两级，且不能只是颜色渐变贴图。
- 轻微相机基线变化时云与地表产生不同视差；不得锁在 Earth albedo 上。
- BSM on/off 对内部遮蔽有局部、可解释的差异，不能只改变整块亮度。
- temporal converged 比 first-frame 更稳定，但不能把轮廓抹成平板。
- 无连续白壳、无 needle/salt-and-pepper、无明显 cube/equirect seam、无二次 gamma。
- V3 大尺度 footprint 与 clear-air identity 保持不变。

## 3. 实施任务

### Task 0：冻结 baseline、review camera 与失败复现

**Files:**

- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/LuBirthTakramParityScene.tsx`
- Test: `tests/unit/lubirthTakramV3MorphologyScale.spec.ts`
- Test: `tests/e2e/lubirth-takram-v3-morphology.spec.ts`

**Step 1: 先写失败的 contract tests**

断言：

- 四个 view ID、camera altitude、沿地表 target distance 和固定 spherical UV 完全锁定。
- `opening-orbit` 继续使用现有 opening matrices，不允许 morphology route 重算或近似。
- morphology query 只接受白名单 candidate ID；stock input 拒绝 candidate 参数。
- baseline 精确锁定为 `coverage=.55 / shapeRepeat=.000025 / shapeDetailRepeat=.0006` 和当前四层。

运行：

```bash
pnpm exec vitest run tests/unit/lubirthTakramV3MorphologyScale.spec.ts
```

预期：因 contract 尚未存在而失败。

**Step 2: 实现最小 contract 与相机枚举**

这里只新增 query-only 数据结构和相机选择，不改变云参数。

**Step 3: 采集当前 baseline 的四视角证据**

先在 production build + headed System Chrome 重现当前结果，并保存所有六类诊断。证据 manifest 必须记录 commit、browser executable、GPU renderer/vendor、viewport、DPR、camera matrices、ECEF camera altitude、sun、asset hashes、renderer fingerprint 与 resolved cloud props。

**Step 4: 执行 checkpoint 0**

通过条件：四个 view 都能复现，opening 与现有 evidence 像素/telemetry 合同一致，所有截图来自同一 commit。

失败结论：`MORPHOLOGY_BASELINE_NOT_REPRODUCIBLE`。命中即停止，先修证据/相机 plumbing，不进入调参。

**Step 5: 验证并提交**

```bash
pnpm exec vitest run tests/unit/lubirthTakramV3MorphologyScale.spec.ts
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site build
```

建议提交：

```text
test(lubirth): freeze V3 morphology review views
```

### Task 1：建立米制尺度到投影像素的审计

**Files:**

- Create: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyScaleAudit.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Test: `tests/unit/lubirthTakramV3MorphologyScale.spec.ts`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/scale-audit.json`

**Step 1: 先写尺度数学测试**

必须覆盖：

- `wavelengthMeters = 1 / repeatPerMeter`。
- `.000025 → 40,000 m`、`.0006 → 1,666.666… m`、官方 `.0003 → 3,333.333… m`、`.006 → 166.666… m`。
- 通过 view-projection 实投影局部 `1 km` east/north/up 线段，得到各轴 pixels-per-meter。
- 对非 1 缩放、旋转、位移 Earth matrix，投影结果仍使用 ECEF 米制距离。
- shape/detail/layer thickness 的 projected pixels 和状态分类准确。

**Step 2: 实现纯函数审计器**

审计器只读 matrices、repeat 与 layer tuple，返回 JSON-safe 结果；不得读取 React state、WebGL texture 或全局单例。

**Step 3: route telemetry 暴露 resolved audit inputs**

增加：

- resolved shape/detail wavelength meters
- per-view east/north/up pixels-per-meter
- per-layer base/top altitude、height、projected thickness
- shape/detail east/north projected pixels（两轴分别保留并分别判定）
- native primary sample-count statistics

**Step 4: 生成 baseline scale audit**

`scale-audit.json` 必须明确回答：当前 failure 是哪一项越界，不能只输出原始矩阵。

**Step 5: 执行 checkpoint 1**

改变一个 query-only repeat 候选后，屏幕波长与 connected-component 中位尺寸必须同方向变化。若没有变化，结论为 `MORPHOLOGY_SCALE_PLUMBING_FAIL`，停止一切美术调参并修 uniform/fingerprint 应用链。

**Step 6: 验证并提交**

```bash
pnpm exec vitest run tests/unit/lubirthTakramV3MorphologyScale.spec.ts
pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --grep "scale audit"
pnpm --filter @miralith/lubirth-hero typecheck
```

建议提交：

```text
feat(lubirth): audit V3 cloud scale in projected pixels
```

### Task 2：只解水平 morphology，禁止同时改垂直层和 coverage

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `tests/e2e/lubirth-takram-v3-morphology.spec.ts`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/candidate-matrix.json`

**Step 1: 冻结候选生成规则**

不要再手写一组“看起来更大”的 repeat。每个 view 根据 Task 1 的实际 pixels-per-meter 生成以下候选：

```text
shape target pixels  = 16, 32, 48
detail target pixels = 4, 6, 8
repeat interval      = intersect(eastPixelsPerMeter / targetBand,
                                 northPixelsPerMeter / targetBand)
```

物理波长只允许落在：

- `near-oblique`: shape `2–20 km`，detail `0.25–2 km`
- `aerial-oblique`: shape `10–80 km`，detail `1–8 km`
- `near-orbit`: shape `30–160 km`，detail `4–20 km`
- `opening-orbit`: shape `80–320 km`，detail `8–40 km`

只有 east 与 north 两轴都进入目标 band 的组合才是 axis-eligible candidate。将四个 view 解出的有效数值合并、去重为一组世界尺度候选；**每个候选都必须原样运行全部四个 view**，不得为每张截图临时套用不同 repeat。历史 RMS-derived ID 可以作为 replay diagnostic 保留，但不得进入 winner 集合。候选矩阵先使用当前 layer tuple、shapeAmount、shapeDetailAmount、densityScale 和 `coverage=.55`。禁止同帧改变其他参数。

**Step 2: 先写 candidate-resolution tests**

测试必须证明候选可复现、按 view/candidate ID 稳定解析、不会流入 stock、不会覆盖 opening matrix 或 V3 weather transform。

**Step 3: 采集水平尺度 atlas**

每个候选至少保存 `cloud-raw-converged`、`sample-count-debug` 和 `full-converged`。自动统计：

- largest connected area fraction
- `1 px` 与 `1–3 px` fragments
- edge density
- clear-air leakage
- first-frame/converged luma delta

**Step 4: 选择唯一 horizontal winner**

选择顺序：

1. 先淘汰亚像素 detail 和大量碎片。
2. connected area 只用于检测碎裂/缺失，不得因最大连通区接近 `1.0` 自动判 flat。
3. 使用 internal luma variation、gradient/curvature 与 local peaks 辅助诊断，最后仍由人工视觉门选择 billow 层级最清楚的一组。

不得按“最亮”或“覆盖最多”选择。

**Step 5: 决定单尺度还是两档 LOD**

- 如果一个世界尺度候选能让 `near-oblique`、`aerial-oblique`、`near-orbit` 同时进入目标区间，先冻结为 `single-scale-candidate`。
- opening 允许此时仍未通过；Task 4 再判断是否需要 orbital LOD。
- 如果近地三个 view 都找不到共同候选，结论为 `HORIZONTAL_MORPHOLOGY_SCALE_FAIL`，停止，不进入 vertical/profile、temporal 或 performance。

**Step 6: 验证并提交**

```bash
pnpm exec vitest run \
  tests/unit/lubirthTakramV3MorphologyScale.spec.ts \
  tests/unit/lubirthTakramParityContract.spec.ts
pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --grep "horizontal morphology atlas"
```

建议提交：

```text
feat(lubirth): calibrate native cloud morphology scale
```

### Task 3：校准垂直 profile、密度与原生自阴影

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramParityV3Layers.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract.ts`
- Modify: `tests/unit/lubirthTakramParityV3Adapter.spec.ts`
- Modify: `tests/e2e/lubirth-takram-v3-morphology.spec.ts`

**Step 1: 冻结两个显式 vertical candidates**

保留 current baseline 供比较，只新增两组候选：

| Profile | R base/height | G base/height | B base/height | A base/height | 用途 |
|---|---:|---:|---:|---:|---|
| `balanced` | `3/9 km` | `5/18 km` | `4/12 km` | `14/6 km` | 近景层次和云底可读性 |
| `heroic` | `4/14 km` | `7/28 km` | `5/18 km` | `20/8 km` | 保留 LuBirth 放大感 |

约束：

- 每层 height 不得超过 horizontal winner 主波长的 `1.25×`。
- base/top 必须留在 Takram shell interval 内。
- 四层不得拥有相同 base，避免官方 README 指出的人工齐平问题。
- coverage、weather exponent、shape repeat/detail repeat 此步冻结。

**Step 2: 先写 layer tuple tests**

断言两个候选的米制数值、layer order、shadow channels、V3 channel identity 和 fingerprint 字段。

**Step 3: 分三轮单变量审查**

1. `vertical profile`：只比较 baseline / balanced / heroic。
2. `erosion`：在 vertical winner 上，只比较 shapeAmount/shapeDetailAmount；每个 channel 最多三个固定值。
3. `density and BSM`：只在前两轮 winner 上调整 densityScale，并捕获 BSM on/off。

禁止把三轮合成随机网格搜索。每一轮都必须保存 rejection reason。

**Step 4: morphology kill checkpoint**

至少一个候选必须同时满足：

- `near-oblique` 和 `aerial-oblique` 人工体积 gate 通过。
- cloud-ground parallax 通过。
- base/core/top 至少两级可读。
- `1–3 px` fragment `<8%`，single-pixel `<2%`。
- BSM on/off 显示局部内部遮蔽差异。
- V3 macro identity 与 clear-air footprint 继续通过。

否则结论为 `V3_DENSITY_REPRESENTATION_FAIL`。命中后停止 Task 4–6；下一份计划必须重新设计 V3 RGBA → Takram density/profile adapter，不能继续调 lighting、temporal 或 coverage。

**Step 5: 验证并提交**

```bash
pnpm exec vitest run \
  tests/unit/lubirthTakramParityV3Adapter.spec.ts \
  tests/unit/lubirthTakramV3MorphologyScale.spec.ts
pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --grep "vertical morphology gate"
pnpm --filter @miralith/lubirth-hero typecheck
```

建议提交：

```text
feat(lubirth): restore V3 cloud volume profiles
```

### Task 4：只在证据需要时增加 near/orbital presentation LOD

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract.ts`
- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `tests/unit/lubirthTakramV3MorphologyScale.spec.ts`
- Modify: `tests/e2e/lubirth-takram-v3-morphology.spec.ts`

**Precondition:** Task 3 已有 near visual-pass candidate，但同一 physical repeat 在 `opening-orbit` 因 projected wavelength `<8 px` 或 detail `<2 px` 明确失败。

如果没有这个证据，本 Task 必须记录 `NOT_NEEDED`，继续 Task 5；禁止为了“以后可能需要”预先引入 LOD。

**Step 1: 先写 LOD 状态测试**

只允许两档：

- `near`: camera altitude `<=200 km`
- `orbital`: camera altitude `>=300 km`
- `200–300 km` 为迟滞区，保持上一档；首次进入按 `250 km` 分界。

LOD 只允许改变 `shapeRepeat`、`shapeDetailRepeat` 和必要的 temporal history reset。不得改变 coverage、V3 texture、localWeather transform、layer altitude/height、density 或 renderer quality。

**Step 2: 从投影目标解 orbital repeats**

使用 Task 2 同一公式，使 opening 的 shape/detail 分别落入 `16–48 px` / `3–10 px`。不得独立手调到“看起来对”。

**Step 3: 实现迟滞与 history reset**

只有实际切档时 reset temporal history；resize、context restore 和现有 readiness gate 语义保持不变。

**Step 4: 采集连续 transition 证据**

相机跨越 `180 → 320 → 180 km`，记录：

- resolved LOD 与切换次数
- temporal reset 次数
- cloud footprint centroid/area
- 相邻帧 luma delta

不允许反复抖动、coverage 跳变或地理位置漂移。

**Step 5: 验证并提交**

```bash
pnpm exec vitest run tests/unit/lubirthTakramV3MorphologyScale.spec.ts
pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --grep "morphology LOD transition"
```

建议提交：

```text
feat(lubirth): add evidence-gated orbital cloud morphology LOD
```

### Task 5：处理 salt-and-pepper 与 temporal 收敛，不改变形体

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramStockParityPipeline.tsx`
- Modify: `tests/e2e/lubirth-takram-v3-morphology.spec.ts`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/candidate-matrix.json`

**Step 1: 冻结 Task 3/4 winner**

锁定 weather、coverage、layers、repeat、detail repeat、density 和 BSM。此后任何 morphology 参数变化都使 Task 3/4 evidence 失效。

**Step 2: 建立 first/converged 与 sample-count 关联**

对四个 view 记录：

- first-frame 和 8/16/32-frame converged captures
- primary/detail sample-count 分布
- temporal luma variance
- history rejection/reset telemetry

**Step 3: 只处理被证据证明的采样问题**

- 如果 raw first-frame 已是平板或碎片，回到 Task 3；禁止靠 temporal 隐藏 representation fail。
- 如果 raw first-frame 形体正确但 sample count 导致噪点，只允许调整 Takram 原生 visual quality/sample budget，并保留 `qualityPreset=high`、`resolutionScale=1`、temporal/detail/BSM 开启。
- 不得以 adaptive、0.35/0.5 resolutionScale 或强模糊通过。

**Step 4: temporal gate**

- converged 轮廓与 first-frame 轮廓的 IoU `>=0.9`。
- converged 后背景 clear-air leakage `<1%`。
- `1–3 px` fragments `<8%`，single-pixel `<2%`。
- morphology 不能因收敛丢失 base/core/top。

**Step 5: 验证并提交**

```bash
pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --grep "temporal morphology convergence"
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site build
```

建议提交：

```text
fix(lubirth): stabilize native V3 cloud morphology
```

### Task 6：正式视觉 gate、evidence 和 Task 0P 解锁判定

**Files:**

- Modify: `tests/e2e/lubirth-takram-parity-visual.spec.ts`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/README.md`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/visual-review.json`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-morphology/checkpoint.json`
- Modify: `docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/checkpoint.json`

**Step 1: 重抓完整 evidence**

- 四个 morphology review views × 六种诊断。
- 原 opening progress `0.00 / 0.06 / 0.12 / 0.18` 的 full/raw 两列。
- upstream control、stock opening 和 V3 winner 同版 contact sheet。
- 所有 evidence 必须来自同一 clean commit；manifest 保存 sha256。

**Step 2: 人工视觉 review**

逐项给出 `PASS/FAIL` 和证据路径：

- macro identity
- clear-air footprint
- cloud-ground attachment/parallax
- base/core/top readability
- volumetric morphology
- BSM self-shadow
- temporal convergence
- continuous-shell absence
- opening four-frame readability

不得用 unit/E2E 通过代替视觉 PASS。

**Step 3: 写 checkpoint**

只有全部视觉项通过，记录：

```text
V3_INPUT_CONTRACT_PASS
DISPOSABLE_RENDERER_REJECTED
TAKRAM_NATIVE_PATH_PASS
V3_ADAPTER_VISUAL_PASS
TASK_0P_UNLOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

任一视觉项失败则记录：

```text
V3_ADAPTER_SIGNAL_VISIBLE_MORPHOLOGY_FAIL
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

**Step 4: 全量验证**

```bash
pnpm exec vitest run \
  tests/unit/lubirthTakramParityContract.spec.ts \
  tests/unit/lubirthTakramParityV3Adapter.spec.ts \
  tests/unit/lubirthTakramAltitudeLadder.spec.ts \
  tests/unit/lubirthTakramV3MorphologyScale.spec.ts
pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-parity.spec.ts \
  tests/e2e/lubirth-takram-altitude-ladder.spec.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  tests/e2e/lubirth-takram-parity-visual.spec.ts \
  --project=desktop-system-chrome
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site build
git diff --check
```

**Step 5: 提交 evidence**

建议提交：

```text
docs(lubirth): record V3 scale and morphology verdict
```

### Task 7：同步主计划，保持性能与生产任务锁定关系清晰

**Files:**

- Modify: `docs/superpowers/plans/2026-08-05-lubirth-planetary-volumetric-cloud-spike.md`

**Step 1: 只增加链接和状态**

在原 Task 0V/0P checkpoint 引用本计划与 evidence，不复制候选矩阵。

**Step 2: 按 Task 6 结论更新授权**

- `V3_ADAPTER_VISUAL_PASS`：仅解锁原计划 Task 0P。
- visual fail：0P 和原 Task 0–8 继续锁定，并写明命中的 kill classification。
- 无论视觉是否通过，都不得直接解锁原 Task 0–8 或 production promotion。

**Step 3: 更新知识图谱**

```bash
command -v graphify
graphify --update
graphify query "Takram V3 morphology scale contract"
git diff --check
```

建议提交：

```text
docs(lubirth): link V3 morphology checkpoint
```

## 4. 执行顺序与停止条件

```text
Task 0 baseline reproducible?
  no  -> MORPHOLOGY_BASELINE_NOT_REPRODUCIBLE -> stop
  yes -> Task 1 scale plumbing responds?
           no  -> MORPHOLOGY_SCALE_PLUMBING_FAIL -> stop
           yes -> Task 2 near horizontal winner exists?
                    no  -> HORIZONTAL_MORPHOLOGY_SCALE_FAIL -> stop
                    yes -> Task 3 volumetric candidate passes near gate?
                             no  -> V3_DENSITY_REPRESENTATION_FAIL -> stop
                             yes -> Task 4 LOD only if opening projection proves necessary
                                      -> Task 5 temporal cleanup
                                      -> Task 6 formal visual gate
                                           pass -> unlock Task 0P only
                                           fail -> keep Task 0P locked
```

## 5. 最终验收清单

- [ ] 当前 40 km / 1.67 km 与 20–50 km layer 组合已被投影像素审计，而不是继续凭截图猜尺度。
- [ ] 四个固定视角都保存 full/raw/first/BSM-off/cloud-off/sample-count evidence。
- [ ] 近景能读出体积、厚度、视差和局部自阴影，不再像 Earth albedo 上的 weather mask。
- [ ] opening 的主形体和 detail 不再落入碎点/亚像素区间。
- [ ] V3 宏观 coverage identity 与 clear-air footprint 没有因 morphology 调整而改变。
- [ ] 若引入 LOD，只有两档、具有迟滞、切档 reset history，并通过往返 transition gate。
- [ ] temporal 只稳定已有正确形体，不承担掩盖 raw representation fail 的职责。
- [ ] stock 路径、normalized renderer fingerprint、native Clouds/BSM/temporal/AerialPerspective 均保持不变。
- [ ] visual PASS 前没有运行 Task 0P，没有得出性能或 promotion 结论。
- [ ] visual PASS 后也只解锁 Task 0P，原 Task 0–8 继续等待独立授权。

## 6. 预期产出与时间边界

按现有 parity harness 已可用的前提，本计划应在以下节点首次出现“真正像云”的结果：

- Task 0–1：只完成诊断，不承诺视觉改善。
- Task 2：应首次消除主要的尺度碎裂，但还可能是有轮廓的平板。
- **Task 3：必须出现首个近景体积云候选；若仍看不到 base/core/top，立即以 `V3_DENSITY_REPRESENTATION_FAIL` 停止。**
- Task 4–5：把通过的近景形体延伸到 opening，并处理 LOD/temporal 稳定性。
- Task 6：才是正式可验收结果。

执行方不应在 Task 3 失败后继续用 coverage、tone mapping 或更多 temporal pass 延长试错。
