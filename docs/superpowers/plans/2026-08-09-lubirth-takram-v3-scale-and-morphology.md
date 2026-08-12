# LuBirth Takram V3 Scale and Morphology Implementation Plan

> **For agentic workers:** REQUIRED SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not start Task 0P or the original Task 0–8 unless this plan reaches its explicit unlock checkpoint.

**Goal:** 先让 V3 云场在 LuBirth 当前实际产品 opening 构图中读成有尺度、有厚度、有自阴影的 Takram 原生体积云，而不是贴地色块或颗粒噪点；近地/空中镜头保留为诊断，不参与当前 promotion/kill。

**Architecture:** 保留 V3 作为唯一宏观天气场，保留完整原生 `CloudsEffect → temporal resolve → AerialPerspectiveEffect` 渲染路径。正式 morphology contract 只覆盖 opening progress `0.00 / 0.06 / 0.12 / 0.18`；先验证轨道镜头中的米制波长、最终体积形态和 BSM 信号。当前产品没有低空镜头，因此禁止用近地 gate 阻断 opening，也不授权 near/orbital LOD 或 anisotropic ENU。禁止通过更换 renderer、降低分辨率、关闭 BSM/temporal/detail 或修改 V3 coverage footprint 来伪造通过。

**Tech Stack:** TypeScript、React Three Fiber、Three.js、`@takram/three-clouds@0.7.6`、Vitest、headed System Chrome E2E、现有 Takram parity query route。

> **2026-08-12 superseded status:** 本计划的独立 `220–300 km / 30–40 km` 候选和后续 sample-budget A/B 已由 `docs/superpowers/specs/2026-08-12-lubirth-takram-cloud-scale-similarity-design.md` 与 `docs/superpowers/plans/2026-08-12-lubirth-takram-cloud-scale-similarity.md` 取代。首个 stock matrix 已降级为 `UNSCALED_STOCK_WEATHER_CONTROL`；clean-HEAD Stage A1 已完成 `[100/S,100/S]` stock health control 与实际 shader/patch identity readback。三档均恢复 weather signal，但都未达到轨道视觉门，当前状态为 `SCALED_STOCK_WEATHER_CONTROL_FAIL_MIP_UNPROVEN`、`stockPassingScales=[]`。Stage B/C、V3 分类、本计划 Task 3–6、Task 0P 和原 Task 0–8 继续锁定；Conditional Task M 只有在用户另行授权时才可执行同帧 weather-hit / primary-hit / actual-mip / pre-temporal-opacity 只读诊断。权威证据：`docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-cloud-scale/stage-a1-scaled-weather/`。

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
4. opening 虽然画面上像“近景行星”，Takram 实际接收的 camera altitude 约为 `3,578 km`。Task 2O 已把主形体提升到 `220–300 km`；最新 mask-local 原生读回修正了旧 sample debug 的 `out` 参数缺陷后，primary sample 的均值为 `6.21–7.00`、中位数为 `2`、p95 为 `29–35`。采样没有归零，但分布明显不均，仍与碎点风险相符。
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
OPENING_MORPHOLOGY_VISUAL_FAIL
STAGE_ISOLATION_INCONCLUSIVE_WITH_ATTENUATION_OBSERVED
EXACT_FRAME_STAGE_POPULATIONS_PASS
NATIVE_HIT_SAMPLE_COUNT_LOW
NO_TEMPORAL_NEAR_ZERO_COLLAPSE
SAMPLING_CAUSALITY_UNVERIFIED
ROOT_CAUSE_NOT_YET_ISOLATED
SAMPLE_BUDGET_CAUSAL_AB_AUTHORIZED_DIAGNOSTIC_ONLY
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

Task 2O/2S 已在 commit `14a9d05` 上完成 `6 candidates × 4 opening progresses × 6 diagnostics = 144` 张源帧、24 张 cloud-only mask 与 24 份原生 sample-count 缓冲。没有出现可读体积 winner。随后在 commit `247bc9a` 上冻结中央候选，以 exact frame 32 重抓 native hit、pre-temporal、resolved-history/AerialPerspective-input、final output 和 repeat noise floor。直接 native-hit population 的 primary `p50=2 / p95=3`，确认低采样数是独立观察；resolved history 仍保留 pre-temporal signal-pixel luma 的 `65.78–69.29%`，排除 temporal near-zero collapse。final/raw `9.28–10.83%` 仍因没有同相机 healthy control 而只记 attenuation observation，sampling 也尚未完成因果 A/B。Task 3–6、Task 0P 与原 Task 0–8 继续锁定；只授权中央候选的 sample-budget diagnostic A/B，不授权生产预算变化或 density representation 重构。

### 0.4 历史诊断（2026-08-09，near view-space correction）

commit `f3ac113` 在 `1440×960 / DPR 1` headed System Chrome 上重建了四视角 baseline、尺度审计和 Task 2 preflight。固定 target UV、球面相机距离、目标高度与 on-screen audit origin 继续通过；新的审计同时保存局部 tangent-plane projection Jacobian 与 SVD。

这组数据证明上一版双轴判定本身无效，而不是证明 morphology 尺度失败。三个近景相机都明显沿 local east 方向观察，Jacobian condition number 分别为 `13.53 / 4.97 / 4.02`；east 屏幕投影因此天然远小于 north。要求物理各向同性形体在 raw east/north 两轴同时进入相同 pixel band，会把透视缩短误写成 renderer/morphology failure。

该轮历史诊断 checkpoint 为：

```text
VIEW_SPACE_ACCEPTANCE_CONTRACT_FAIL
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

Task 2 candidate replay 在 preflight 后停止，不再引用历史 10 组 replay 作为当前证据。候选生成器现在必须同时通过 screen 与 physical wavelength contract，并分别保存 rejected reason；当前 accepted `0` / rejected `36` 只是旧 view-space 规则下的诊断数，不能用来选择 LOD 或否决各向同性云体。最大连通区占比只做 dominance 诊断，最低连通质量仍作为 fragmentation gate。

Temporal history 已改为统一 epoch，覆盖 diagnostic、candidate、view、资源 generation、weather、coordinate mode 与完整 resolved renderer fingerprint；同页切换 candidate/view 的浏览器回归均重新捕获 exact `nativeFrameCount=1`。

这组数据仍有效，但它不再是产品 promotion/kill gate。三个近景视角没有对应当前 LuBirth opening 产品镜头；其 Jacobian/SVD、candidate rejection 与 exact-frame-1 history regression 只保留为未来低空镜头的诊断依据，不再要求先修 near view-space acceptance，也不授权 anisotropic ENU。

### 0.5 Task 2O 执行结果（2026-08-09，opening-only production gate）

正式 gate 固定为：

- opening progress `0.00 / 0.06 / 0.12 / 0.18`；
- shape wavelength `220 / 260 / 300 km`；
- detail wavelength `30 / 40 km`；
- `full / cloud-raw / cloud-raw-off / bsm-off / aerial-final / sample-count-debug`，另派生 cloud-only mask 与原生半浮点 sample-count 缓冲；
- native Takram renderer、V3 weather、`coverage=0.55`、`1440×960 / DPR 1`。

实测 shape 投影为 `20.814–29.182 px`；六组 shape 均达标。detail 投影为 `2.838–3.891 px`，其中只有三组 `40 km` detail 达到 `3–10 px` 目标，三组 `30 km` 仍为 `subpixel-risk`。六组 full output 都没有云地分离、柔和透明层次、受光/背光体积变化或稳定局部 BSM 响应，暗面盐粒仍存在；六组全部 `FAIL`，没有 winner。base/core/top 在轨道距离只保留为诊断，不再作为硬门。

正式 evidence：`docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-opening-morphology/`。后续不得继续水平 repeat 搜索，也不得执行本计划旧 Task 3–6；下一 amendment 必须先分离 native density/profile、pre-temporal radiance、temporal history 与 final composite，证明单一 stage 的因果后才能选择修复方向。

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

## 2. 诊断视角与 opening 产品指标

本节原有四视角数据仍用于解释投影、采样和表示问题；只有 Task 2O 的四个 opening progress 参与当前产品判定。任何包含 near views 的共同区间、形态或 LOD 结论都不具 promotion/kill 权限。

### 2.1 四个 diagnostic views

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
- local tangent-plane projection Jacobian、SVD major/minor scale 与 condition number
- per-layer base/top altitude、height、projected thickness
- shape/detail east/north projected pixels（保留为原始诊断，不得在高透视缩短视角直接套相同 band）
- native primary sample-count statistics

**Step 4: 生成 baseline scale audit**

`scale-audit.json` 必须先回答观测目标是否 on-screen、view-space mapping 是否良态。若 Jacobian condition number 超过 provisional preflight threshold `3`，raw ENU axis magnitude 只能做诊断，不能直接回答 morphology 哪一项越界。

**Step 5: 执行 checkpoint 1**

改变一个 query-only repeat 候选后，屏幕波长与 connected-component 中位尺寸必须同方向变化。若没有变化，结论为 `MORPHOLOGY_SCALE_PLUMBING_FAIL`，停止一切美术调参并修 uniform/fingerprint 应用链。

在 candidate 生成前增加 view-space preflight：任一近景 Jacobian condition number `>3` 时，结论为 `VIEW_SPACE_ACCEPTANCE_CONTRACT_FAIL`。该结论只否决当前“raw east/north 同 band”验收规则，不否决 renderer、isotropic morphology 或 V3；立即停止 Task 2 replay，等待独立 amendment 冻结 foreshortening-aware measure。

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

### Task 2N：近景水平 morphology 诊断（已降为 diagnostic-only）

> **Authority correction（2026-08-09）：** 当前 LuBirth 产品 opening 不包含这些近景镜头。以下 near-view 候选求解与 raw east/north 规则仅保留为未来低空镜头的诊断草案，不参与当前 winner、kill、LOD 或 promotion。正式产品 gate 由 Task 2O 独立定义。

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

旧规则“east 与 north 两轴都进入同一目标 band”只在 view-space preflight 已证明映射良态时适用。高透视缩短视角必须由后续 amendment 改用 Jacobian/SVD 导出的 view-plane 主尺度或其他明确允许 foreshortening 的合同；不得用 anisotropic ENU 拉伸抵消镜头透视。将四个 view 解出的有效数值合并、去重为一组世界尺度候选；**每个候选都必须原样运行全部四个 view**，不得为每张截图临时套用不同 repeat。历史 RMS-derived ID 可以作为 replay diagnostic 保留，但不得进入 winner 集合。候选矩阵先使用当前 layer tuple、shapeAmount、shapeDetailAmount、densityScale 和 `coverage=.55`。禁止同帧改变其他参数。

**Step 2: 先写 candidate-resolution tests**

测试必须证明候选可复现、按 view/candidate ID 稳定解析、不会流入 stock、不会覆盖 opening matrix 或 V3 weather transform；`axisRangePass=false` 或 `physicalRangePass=false` 的项只能进入 `rejectedCandidates`，并保留拒绝原因。

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
2. 最大 connected-area dominance 只做诊断，不得因其接近 `1.0` 自动判 flat；最低 connected mass 仍可作为 fragmentation gate。
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

### Task 2O：opening-only 轨道形态 gate（已执行，FAIL）

**Files:**

- Modify: `packages/lubirth-hero/src/planetaryCloud/parity/TakramV3MorphologyContract.ts`
- Modify: `tests/unit/lubirthTakramV3MorphologyScale.spec.ts`
- Modify: `tests/e2e/lubirth-takram-v3-morphology.spec.ts`
- Create: `docs/lubirth-planetary-cloud-evidence/2026-08-09/v3-opening-morphology/`

**Step 1: 冻结 opening-only 合同**

产品 gate 只使用 opening progress `0.00 / 0.06 / 0.12 / 0.18`。近景三个视角明确标为 `diagnostic-only`，不得改变 checkpoint。

**Step 2: 固定候选矩阵**

运行 shape `220 / 260 / 300 km` × detail `30 / 40 km` 六组候选。每组必须保持同一 V3 weather、coverage、layers、sun、renderer fingerprint 与 native pipeline。

**Step 3: 采集联合视觉证据**

每个 candidate × progress 保存：

- `full`
- `cloud-raw`
- `cloud-raw-off`
- `bsm-off`
- `aerial-final`
- `sample-count-debug`

另保存 `cloud-raw - cloud-raw-off` cloud-only mask 与原生 pre-temporal sample-count 缓冲。manifest 必须记录 commit、Chrome 版本和 executable、GPU vendor/renderer、viewport/DPR、复现命令、逐帧/派生 artifact hash、projection audit、完整 adapter/runtime contract 与 contact-sheet hash。

**Step 4: 选择唯一 opening winner**

候选只有在四个 progress 都满足轨道视角标准时才能 `PASS`：宏观云团轮廓、云地分离或 limb elevation、柔和透明度层次、受光/背光变化、局部 BSM 响应以及无明显盐粒。`base/core/top` 只做诊断，不参与硬门。尺度进入目标像素范围、raw signal 非零或测试通过均不能替代视觉 PASS。零个 winner 记录 `OPENING_MORPHOLOGY_VISUAL_FAIL`；多个 winner 必须继续人工选择唯一 winner，不能自动进入 Task 3。

**Step 5: 2026-08-09 实测 checkpoint**

```text
OPENING_MORPHOLOGY_VISUAL_FAIL
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

六组 shape 已达到 `20.814–29.182 px`；只有 `40 km` detail 三组达到 detail 目标，`30 km` 三组仍为 `subpixel-risk`。所有 final 画面仍缺少轨道体积层次且 BSM 差异弱，全部判 `FAIL`。停止 Task 2O；不得继续水平 repeat 调参。

### Task 2S：opening stage-isolation diagnosis（exact-frame revalidation 完成；根因仍未定位）

Task 2S 使用相同 candidate/progress/runtime contract，将 `cloud-raw/cloud-raw-off`、`full/aerial-final` 与 `full/bsm-off` 建成独立 matched populations，并只在 cloud-only mask 内计算信号、碎片、BSM 与原生 sample-count 分布。

历史计算得到 raw mask-local MAE `0.4452–0.4587`、single-pixel fragments `12.21–15.57%`、small fragments `21.76–27.36%`、edge density `81.70–83.43%`；旧 `25%` mask 映射下 primary p50 为 `2`、p95 为 `29–35`。独立 final 页面计算的 mask-local MAE 为 `0.0342–0.0470`，是 raw 页面 screen difference 的 `7.58–10.49%`；独立 BSM 页面差异为 `0–0.0172`。后两组尚不是 exact-frame matched population，旧 sample 分布也不是 native-hit population。

复核发现 `p50=2` 会随 mask-cell coverage threshold 从 `25%` 到 `100%` 变为 `25`；同时独立页面没有锁定相同 Takram frame/jitter，final/raw 也没有同相机 healthy control。因此 checkpoint 修正为：

```text
STAGE_ISOLATION_INCONCLUSIVE_WITH_ATTENUATION_OBSERVED
SAMPLING_CAUSALITY_UNVERIFIED
ROOT_CAUSE_NOT_YET_ISOLATED
```

commit `247bc9a` 已按上述合同完成中央候选重抓：24 张 exact-frame source、4 个 cloud mask、4 份 native sample buffer、12 份 native stage buffer、6 张 repeat 和 7 张 contact sheet，57 个 manifest 引用哈希全部匹配。所有 capture 锁定 native/cloud/resolve/shadow frame `32`、jitter `0`、STBN slice `32`，repeat MAE 为 `0`。

native hit population 的 primary mean 为 `2.050–2.487`、`p50=2`、`p95=3`，因此低 sample count 不再依赖 post-temporal mask threshold；但它仍只是观察，不是形态失败的因果。pre-temporal signal-pixel luma 经 resolve 保留 `65.78–69.29%`，没有 temporal near-zero collapse。exact-frame final/raw ratio 为 `9.28–10.83%`，由于缺少同相机 healthy control 仍只记 attenuation observation；full/BSM-off 8-bit MAE 为 `0`，只能证明当前输出没有可见 BSM 响应，不能定位责任 stage。

因此只授权冻结 `opening-shape-260-detail-40` 的 sample-budget causal A/B，且只能改变 primary sampling density；必须继续保存同一 exact-frame native/pre-temporal/resolved/final populations。A/B 只能决定 sampling 是否参与碎点和弱光学信号，不能直接推广高预算、进入 density redesign、Task 3–6 或 Task 0P。

### Task 3：校准垂直 profile、密度与原生自阴影（当前锁定）

> **Current authority:** Task 2O 没有 opening visual winner，因此本 Task 与后续 Task 4–6 均不得执行。以下内容是历史设计草案；新的 amendment 必须先重写为 opening-only 表示/光学合同，不能沿用近景 gate 直接开工。

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

### Task 4：只在证据需要时增加 near/orbital presentation LOD（当前锁定）

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

### Task 5：处理 salt-and-pepper 与 temporal 收敛，不改变形体（当前锁定）

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

### Task 6：正式视觉 gate、evidence 和 Task 0P 解锁判定（当前锁定）

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
           yes -> Task 2O opening-only matrix complete and hash-valid?
                    no  -> OPENING_MORPHOLOGY_EVIDENCE_INVALID -> stop
                    yes -> exactly one opening visual winner?
                             no winner -> OPENING_MORPHOLOGY_VISUAL_FAIL -> stop/amend
                             multiple  -> OPENING_MORPHOLOGY_VISUAL_REVIEW_REQUIRED -> stop/review
                             one       -> Task 3 becomes amendment-eligible
                                          -> opening-only Task 3–6 rewrite required
                                          -> final visual pass may unlock Task 0P only
```

## 5. 最终验收清单

- [x] opening-only 正式 gate 已覆盖 progress `0.00 / 0.06 / 0.12 / 0.18`，近景视角不再阻断产品镜头。
- [x] `220/260/300 km` shape × `30/40 km` detail 已按投影像素实测，不再凭截图猜 repeat。
- [x] 144 张 source frame、24 张 cloud-only mask 与 24 份原生 sample-count artifact 来自同一 commit，浏览器/GPU/viewport/哈希/复现命令完整。
- [x] opening shape 已进入 `20.814–29.182 px`，detail 已进入 `2.838–3.891 px`。
- [x] V3 宏观 footprint 在四个 progress 中可见且连续。
- [ ] opening 能满足轨道视觉门：宏观轮廓、云地分离/limb elevation、透明层次、受光/背光变化、局部 BSM 响应且无盐粒；base/core/top 仅诊断。
- [ ] 暗面 salt-and-pepper 已消除。
- [x] stock 路径、normalized renderer fingerprint、native Clouds/BSM/temporal/AerialPerspective 保持不变。
- [x] visual FAIL 后没有运行 Task 3–6 或 Task 0P，没有得出性能或 promotion 结论。
- [x] 原 Task 0–8 继续等待独立授权。

## 6. 预期产出与时间边界

Task 0–1 已完成尺度与信号诊断。Task 2O 已把轨道主形体放大到目标屏幕范围，但结果仍是有 footprint、无可读体积层次的平板，因此在 `OPENING_MORPHOLOGY_VISUAL_FAIL` 停止。Task 2S 的 exact-frame/native-hit 重抓确认 primary `p50=2 / p95=3` 且 temporal 没有 near-zero collapse；final attenuation 与 BSM 无可见响应仍没有 healthy control 或 stage-specific 因果。因此当前记录 `STAGE_ISOLATION_INCONCLUSIVE_WITH_ATTENUATION_OBSERVED / NATIVE_HIT_SAMPLE_COUNT_LOW / SAMPLING_CAUSALITY_UNVERIFIED / ROOT_CAUSE_NOT_YET_ISOLATED`。

当前计划不会进入 Task 3–6。下一步只运行中央候选的 sample-budget causal A/B，分别比较 native hit、pre-temporal radiance/fragmentation、resolved history 与 final composite；不得继续用 horizontal repeat、coverage、tone mapping、近景 LOD 或更多 temporal pass 延长试错，也不得在证据不足时直接授权生产 sample budget 或 density representation 重构。
