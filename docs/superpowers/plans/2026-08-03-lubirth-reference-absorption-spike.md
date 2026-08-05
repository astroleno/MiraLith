# LuBirth Reference Absorption Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用两个互不污染、可独立否决的 query-only spike，验证“离线打包地表材质”和“Relief-lite 云光照配方”是否能以低成本增强 LuBirth 的地表与云体积感；不迁移 WebGPU、不重启 Hybrid/deep-impostor，也不改默认首页。

**Architecture:** 新建 `/lubirth-reference-absorption-spike`，复用真实 LuBirth IP 定位、Earth-local 旋转、缩放与 opening progress。变体通过显式 props 从路由传到 `EarthMoonScene`，禁止核心 shader 自行读取 URL。A 轨只增加一张按 tier 选择的 Earth material packed texture；B 轨只替换 Relief-lite 的散射函数，保持现有 V3 云场、薄壳积分、透明度和 `3/4` 次纹理读取不变。只有 A、B 各自通过后才测试 combined；任一轨失败就封存证据，不继续参数漂移。

**Tech Stack:** Next.js 16 App Router、React 19、Three.js 0.184、React Three Fiber 9、WebGL2 GLSL、现有 KTX2/UASTC 工具链、Playwright + System Chrome GPU timer、TypeScript 6。

---

## 1. 参考吸纳边界

### 可以吸纳

| 来源 | 吸纳内容 | 在 LuBirth 中的形式 |
| --- | --- | --- |
| [Three.js WebGPU Volume Fire](https://threejs.org/examples/#webgpu_volume_fire) | Henyey-Greenstein 相函数、Beer 衰减、低成本多重散射近似 | 仅替换 Relief-lite 的光照函数；不新增体素、不新增纹理读取 |
| [EarthThreeJS](https://github.com/achrefelouafi/EarthThreeJS) | 地表 normal/specular 分工与昼夜材质组织 | 离线合并为一张线性 packed map；运行时使用现有 Earth tangent frame |
| [SnowSystemThreeJS](https://github.com/achrefelouafi/SnowSystemThreeJS) | 明确的更新/材质/telemetry 分层思路 | 只吸收模块边界，不吸收 camera-follow billboard 渲染 |

### 明确不吸纳

- 不迁移到 WebGPU/TSL，不引入 3D fluid simulation、3D storage texture 或半分辨率 blur pass。
- 不使用 fire 示例的 additive compositing；水云继续使用现有 front-to-back premultiplied alpha。
- 不使用 EarthThreeJS 的 2D cloud sphere、简单 Fresnel atmosphere、wall-clock camera tween 或其资产。
- 不使用 SnowSystem 的 camera-follow、modulo wrap、billboard 粒子；它会破坏 IP 地理定位和 Earth-local 稳定性。
- 不纳入 [WebGPU custom fog scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) 的屏幕空间 blur。当前边缘融入已经够好，本 spike 只解决材质和体积光照线索。
- 不重新打开 Hybrid、2-bin、deep impostor 或离线云模型路线。

### 为什么这两个 spike 与现有运镜兼容

- packed Earth material 与 Relief 云都挂在现有 `earthGroup` 内，IP yaw/pitch、地球自转、缩放、退镜天然一致。
- 不增加 screen-space 锚点、camera-follow volume 或固定城市贴片。
- 验收覆盖 `progress=0 / 0.22 / 0.55`，并覆盖 near → oblique → reverse sweep；不能只看静态近景。

---

## 2. 决策合同与时间盒

### 变体

```ts
export type LandingReferenceAbsorptionVariant =
  | "baseline"
  | "earth-material-v1"
  | "cloud-scattering-v1"
  | "combined-v1";
```

URL 合同：

```text
/lubirth-reference-absorption-spike?variant=baseline&progress=0.22
/lubirth-reference-absorption-spike?variant=earth-material-v1&progress=0.22
/lubirth-reference-absorption-spike?variant=cloud-scattering-v1&progress=0.22
/lubirth-reference-absorption-spike?variant=combined-v1&progress=0.22
```

非法或缺失 `variant` 必须解析为 `baseline`。默认 `/` 与 `/lubirth-revised` 不得加载新增资产，也不得改变 shader define、telemetry 或截图。

### 时间盒

- A 轨只允许一个 packed layout：`RG=切线空间法线 XY，B=specular/ocean，A=roughness`。
- B 轨只允许六组固定候选：`g ∈ {0.65, 0.72, 0.78}` × `multiScatter ∈ {0.18, 0.28}`。
- 候选由固定评分规则选出；不能在截图后继续手调常量。
- 每轨最多一次 correctness 修正和一次性能修正。仍未过门槛即 `REJECT`。
- `combined-v1` 只有 A、B 都 `PASS` 后才能进入正式证据矩阵。

### 最终状态

- `PASS`：视觉、性能、资产、运动与 fallback 全部通过。
- `REJECT`：机制或视觉门槛失败，封存证据，不推广。
- `BLOCKED_BY_BASELINE`：新实现增量合格，但同机同轮 baseline 仍超过绝对性能门槛；不得写成 PASS。

---

## Task 0: 建立干净执行基线与证据骨架

**Files:**
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/README.md`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/manifest.json`

- [ ] **Step 1: 在当前脏工作树之外执行**

当前工作树有 LuBirth、CoScroll、Radio Gaga 和历史 spike 的未提交改动。实现前先从包含当前 Relief-lite V3 路径的已确认提交创建：

```bash
git worktree add ../MiraLith-lubirth-reference-absorption-spike -b codex/lubirth-reference-absorption-spike <confirmed-relief-lite-baseline>
```

若 `<confirmed-relief-lite-baseline>` 不包含 `LandingReliefCloud.tsx`、`LandingEarthSurfaceLiteV2.tsx`、KTX2 V3 云场和现有 GPU timer，停止执行并请求新的 baseline commit；禁止从当前脏工作树手工猜测复制范围。

- [ ] **Step 2: 记录起点**

`manifest.json` 至少记录：

```json
{
  "baselineCommit": "<sha>",
  "branch": "codex/lubirth-reference-absorption-spike",
  "references": [
    "https://threejs.org/examples/#webgpu_volume_fire",
    "https://github.com/achrefelouafi/EarthThreeJS",
    "https://github.com/achrefelouafi/SnowSystemThreeJS",
    "https://threejs.org/examples/#webgpu_custom_fog_scattering"
  ],
  "defaultHomepageTouched": false,
  "tracks": {
    "earthMaterial": "pending",
    "cloudScattering": "pending",
    "combined": "not-eligible"
  }
}
```

- [ ] **Step 3: 验证基线**

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
git status --short
```

Expected: typecheck PASS；新 worktree clean。

- [ ] **Step 4: 提交证据骨架**

```bash
git add docs/lubirth-reference-absorption-evidence/2026-08-03
git commit -m "docs(lubirth): start reference absorption spike evidence"
```

---

## Task 1: 先锁定 query-only 变体合同

**Files:**
- Create: `packages/lubirth-hero/src/landingReferenceAbsorptionPolicy.ts`
- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/index.ts`
- Modify: `packages/lubirth-hero/src/EarthMoonScene.tsx`
- Modify: `packages/lubirth-hero/src/LandingEarth.tsx`
- Modify: `packages/lubirth-hero/src/LandingEarthSurfaceLiteV2.tsx`
- Modify: `packages/lubirth-hero/src/LandingReliefCloud.tsx`
- Modify: `apps/site/visual/scenes/LuBirthSceneSlot.tsx`
- Modify: `apps/site/components/LuBirthRevisedRoute.tsx`
- Create: `apps/site/components/LuBirthReferenceAbsorptionSpikeRoute.tsx`
- Create: `apps/site/app/lubirth-reference-absorption-spike/page.tsx`
- Create: `tests/e2e/lubirth-reference-absorption-contract.spec.ts`

- [ ] **Step 1: 写失败的纯合同测试**

合同测试必须覆盖：

```ts
expect(resolveLandingReferenceAbsorptionVariant("earth-material-v1"))
  .toBe("earth-material-v1");
expect(resolveLandingReferenceAbsorptionVariant("cloud-scattering-v1"))
  .toBe("cloud-scattering-v1");
expect(resolveLandingReferenceAbsorptionVariant("combined-v1"))
  .toBe("combined-v1");
expect(resolveLandingReferenceAbsorptionVariant("anything-else"))
  .toBe("baseline");
expect(referenceVariantUsesEarthMaterial("combined-v1")).toBe(true);
expect(referenceVariantUsesCloudScattering("combined-v1")).toBe(true);
```

运行：

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
```

Expected: FAIL，因为 policy 尚不存在。

- [ ] **Step 2: 实现纯 policy**

`landingReferenceAbsorptionPolicy.ts` 只包含 union、解析器和两个 feature predicate；不得读取 `window`：

```ts
export const LANDING_REFERENCE_ABSORPTION_VARIANTS = [
  "baseline",
  "earth-material-v1",
  "cloud-scattering-v1",
  "combined-v1"
] as const;

export function resolveLandingReferenceAbsorptionVariant(
  value: string | null | undefined
): LandingReferenceAbsorptionVariant {
  return LANDING_REFERENCE_ABSORPTION_VARIANTS.includes(
    value as LandingReferenceAbsorptionVariant
  )
    ? (value as LandingReferenceAbsorptionVariant)
    : "baseline";
}
```

- [ ] **Step 3: 通过显式 props 贯通场景**

给 `LuBirthRevisedRoute`、`LuBirthSceneSlot`、`EarthMoonScene`、`LandingEarth`、`LandingEarthSurfaceLiteV2` 和 `LandingReliefCloud` 增加可选 `referenceAbsorptionVariant`，默认值一律为 `baseline`。禁止在 package shader 组件里读取 pathname/search params。

- [ ] **Step 4: 新建专用路由**

`LuBirthReferenceAbsorptionSpikeRoute` 只负责解析 query、把变体显式传入 `LuBirthRevisedRoute` 并输出：

```html
data-reference-absorption-variant="baseline|earth-material-v1|cloud-scattering-v1|combined-v1"
```

它必须继续复用 `LuBirthRevisedRoute` 的实际 opening progress、IP 定位和 `earthGroup`，不能搭建静态替身场景。

- [ ] **Step 5: 加默认首页隔离断言**

合同测试读取源码/运行时并断言：

- `/` 的 variant 恒为 `baseline`。
- `/lubirth-revised` 的 variant 恒为 `baseline`。
- 新路由 baseline 的 Earth/cloud telemetry 与现有 Relief-lite 基线一致。
- 新路由非法 query 不激活任何实验路径。

- [ ] **Step 6: 验证并提交**

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
git diff --check
git add packages/lubirth-hero/src apps/site/app/lubirth-reference-absorption-spike apps/site/components/LuBirthReferenceAbsorptionSpikeRoute.tsx apps/site/components/LuBirthRevisedRoute.tsx apps/site/visual/scenes/LuBirthSceneSlot.tsx tests/e2e/lubirth-reference-absorption-contract.spec.ts
git commit -m "feat(lubirth): add isolated reference absorption route"
```

---

## Task 2: A 轨生成 Earth material packed assets

**Files:**
- Create: `packages/lubirth-hero/scripts/generate-earth-material-lite.mjs`
- Modify: `packages/lubirth-hero/package.json`
- Modify: `packages/lubirth-hero/src/types.ts`
- Modify: `packages/lubirth-hero/src/assetManifest.ts`
- Create: `apps/site/public/assets/lubirth/textures/earth-material-lite-v1-2k.png`
- Create: `apps/site/public/assets/lubirth/textures/earth-material-lite-v1-2k.ktx2`
- Create: `apps/site/public/assets/lubirth/textures/earth-material-lite-v1-1k.png`
- Create: `apps/site/public/assets/lubirth/textures/earth-material-lite-v1-1k.ktx2`
- Create: `apps/site/public/assets/lubirth/textures/earth-material-lite-v1.manifest.json`
- Modify: `tests/e2e/lubirth-reference-absorption-contract.spec.ts`

- [ ] **Step 1: 先写资产合同失败测试**

断言：

- desktop 为 `2048×1024`，mobile 为 `1024×512`。
- color space 为 `linear`。
- channel layout 为 `rg-normalxy-b-specular-a-roughness`。
- 每个输出都有 SHA-256，且 manifest 绑定生成脚本与两个输入文件。
- desktop KTX2 `≤2.8 MiB`，mobile KTX2 `≤0.8 MiB`。
- 新资产只存在于 reference-spike asset override，不进入 `DEFAULT_LUBIRTH_ASSETS`。

- [ ] **Step 2: 实现确定性生成器**

仅使用仓库内已有、来源已被项目接受的：

```text
earth-displacement-8k.jpg
earth-specular-4k.png
```

规则固定为：

```text
R = tangent normal X * 0.5 + 0.5
G = tangent normal Y * 0.5 + 0.5
B = normalized specular/ocean mask
A = clamp(1 - 0.72 * B, 0.18, 0.96)
```

法线从 displacement 的 wrap-S / clamp-T 中心差分生成，先在高分辨率计算再降采样；禁止从 day color 猜法线。生成器必须固定参数、输出 manifest、失败时非零退出。

- [ ] **Step 3: 增加脚本命令**

```json
"generate:earth-material-lite": "node scripts/generate-earth-material-lite.mjs"
```

运行两次并核对哈希稳定：

```bash
pnpm --filter @miralith/lubirth-hero generate:earth-material-lite
shasum -a 256 apps/site/public/assets/lubirth/textures/earth-material-lite-v1-* > /tmp/earth-material-first.sha256
pnpm --filter @miralith/lubirth-hero generate:earth-material-lite
shasum -a 256 -c /tmp/earth-material-first.sha256
```

Expected: 全部 OK。

- [ ] **Step 4: 只给 spike 定义 asset overrides**

在 `LandingAssetManifest` 增加可选 `earthMaterialLite?: TextureRef`；新增 desktop/mobile reference constants。`DEFAULT_LUBIRTH_ASSETS` 不设置该字段，普通 Relief-lite constants 也不设置。

- [ ] **Step 5: 验证并提交**

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm --filter @miralith/lubirth-hero typecheck
git diff --check
git add packages/lubirth-hero apps/site/public/assets/lubirth/textures/earth-material-lite-v1-* tests/e2e/lubirth-reference-absorption-contract.spec.ts
git commit -m "feat(lubirth): generate packed Earth material assets"
```

---

## Task 3: A 轨接入 Earth surface shader

**Files:**
- Modify: `packages/lubirth-hero/src/LandingEarthSurfaceLiteV2.tsx`
- Modify: `packages/lubirth-hero/src/landingGpuTimer.ts`
- Modify: `tests/e2e/lubirth-reference-absorption-contract.spec.ts`
- Create: `tests/e2e/lubirth-reference-absorption-spike.spec.ts`

- [ ] **Step 1: 写失败的 telemetry 与 fallback 测试**

`earth-material-v1` 必须报告：

```ts
{
  materialModel: "packed-v1",
  materialMapActive: true,
  materialMapSource: expect.stringContaining("earth-material-lite-v1"),
  materialFragmentTextureReads: 1,
  gpuTimer: { supported: expect.any(Boolean), sampleCount: expect.any(Number) }
}
```

baseline 必须报告 `materialModel: "baseline"`、`materialMapActive: false`、`materialFragmentTextureReads: 0`。请求强制失败时必须恢复 baseline shader 结果且页面不黑屏。

- [ ] **Step 2: 接入一张线性材质图**

使用现有 `vWorldEast / vWorldNorth / vWorldNormal` 重建 world normal，避免额外 derivative TBN：

```glsl
vec4 packedMaterial = texture2D(earthMaterialMap, vUv);
vec2 tangentXY = packedMaterial.rg * 2.0 - 1.0;
float tangentZ = sqrt(max(1.0 - dot(tangentXY, tangentXY), 0.02));
vec3 materialNormal = normalize(
  vWorldEast * tangentXY.x +
  vWorldNorth * tangentXY.y +
  vWorldNormal * tangentZ
);
float materialSpecular = packedMaterial.b;
float materialRoughness = packedMaterial.a;
```

`materialNormal` 只替换地表 direct/specular normal；城市灯、cloud shadow、limb 和几何 silhouette 保持原路径。map 未就绪或失败时 `hasEarthMaterialMap=0`，不得采信 packed 通道。

- [ ] **Step 3: 增加受控 GPU timing**

复用现有 `createLandingGpuTimer`，仅当专用路由带 `referenceAbsorptionGpuTimer=on` 时收集 `LandingEarthSurfaceLiteV2` draw timing；disjoint 时清窗并计数。不得拿 rAF 当 GPU time。

- [ ] **Step 4: 验证地理与运镜稳定性**

动态测试在至少三组位置运行：

```text
Mianyang: 31.47, 104.68
Equator: 0, 0
Dateline north: 45, 179
```

对 `progress=0 / 0.22 / 0.55` 前进、反向各截图一次；断言地图特征随同一 Earth rotation 移动、无 seam 闪烁、无 screen-space 滑动。

- [ ] **Step 5: 运行 A 轨测试**

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop --grep "earth material"
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=mobile-landscape --grep "earth material"
```

- [ ] **Step 6: 提交**

```bash
git add packages/lubirth-hero/src/LandingEarthSurfaceLiteV2.tsx packages/lubirth-hero/src/landingGpuTimer.ts tests/e2e/lubirth-reference-absorption-*.spec.ts
git commit -m "feat(lubirth): spike packed Earth surface material"
```

---

## Task 4: A 轨独立验收或否决

**Files:**
- Modify: `docs/lubirth-reference-absorption-evidence/2026-08-03/README.md`
- Modify: `docs/lubirth-reference-absorption-evidence/2026-08-03/manifest.json`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/earth-material-*.png`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/earth-material-telemetry.json`

- [ ] **Step 1: 固定 A/B 帧，不临场选图**

桌面和 mobile-landscape 各采：

- `progress=0.00`：初始 IP 聚焦近景。
- `progress=0.22`：主要退镜前边界。
- `progress=0.55`：地球明显缩小/旋转后的中景。
- 每个 progress 同时保存 baseline 和 `earth-material-v1`。

- [ ] **Step 2: 执行 A 轨硬门槛**

全部满足才 PASS：

- daylight land ROI 的中频对比度相对 baseline 增加 `≥10%`，但 P99 高光不得超过 `250/255`。
- ocean highlight ROI 相对邻近 land 的分离度增加 `≥12%`。
- deep-night 城市灯均值变化 `≤3%`。
- Earth silhouette mask 边缘漂移 `≤1 px`。
- desktop Earth surface GPU p95 `≤1.5ms` 且相对同轮 baseline 增量 `≤0.35ms`。
- mobile-landscape p95 `≤1.0ms` 且增量 `≤0.25ms`。
- 每个性能结论 `≥60` 个有效 GPU samples、`0` 次 disjoint reset。
- asset 大小、fallback、IP 和 reverse sweep 合同全部通过。

- [ ] **Step 3: 写结论**

`README.md` 记录 `PASS / REJECT / BLOCKED_BY_BASELINE`、机器/GPU/浏览器、完整命令和未通过项。A 轨 REJECT 不阻止 B 轨运行，但 combined 立即保持 `not-eligible`。

- [ ] **Step 4: 提交 A 轨证据**

```bash
git add docs/lubirth-reference-absorption-evidence/2026-08-03
git commit -m "docs(lubirth): record packed Earth material verdict"
```

---

## Task 5: B 轨先用纯函数锁定散射数学

**Files:**
- Create: `packages/lubirth-hero/src/landingReliefCloudScattering.ts`
- Modify: `packages/lubirth-hero/src/index.ts`
- Modify: `tests/e2e/lubirth-reference-absorption-contract.spec.ts`

- [ ] **Step 1: 写失败的数值合同**

测试至少覆盖：

```ts
expect(resolveHenyeyGreenstein(1, 0.72))
  .toBeGreaterThan(resolveHenyeyGreenstein(0, 0.72));
expect(resolveHenyeyGreenstein(0, 0.72))
  .toBeGreaterThan(resolveHenyeyGreenstein(-1, 0.72));
expect(resolveBeerTransmittance(0)).toBe(1);
expect(resolveBeerTransmittance(8)).toBeLessThan(0.001);
expect(resolveCheapMultiScatter(0, 0.72, 0.28)).toBeGreaterThan(0);
expect(resolveCheapMultiScatter(8, 0.72, 0.28)).toBeLessThan(
  resolveCheapMultiScatter(1, 0.72, 0.28)
);
```

还必须对 `tau ∈ [0, 12]`、`cosTheta ∈ [-1, 1]` 做网格测试，断言所有返回值 finite、non-negative、无 NaN。

- [ ] **Step 2: 实现 TS reference 与 GLSL chunk**

GLSL 只用固定三项解析 octave，不读取纹理：

```glsl
float hgPhase(float cosTheta, float g) {
  float gg = g * g;
  float denominator = pow(max(1.0 + gg - 2.0 * g * cosTheta, 0.001), 1.5);
  return (1.0 - gg) / denominator;
}

float cheapMultiScatter(float tau, float cosTheta, float g, float strength) {
  float single = exp(-tau) * hgPhase(cosTheta, g);
  float octave1 = exp(-tau * 0.25) * hgPhase(cosTheta, g * 0.5) * strength;
  float octave2 = exp(-tau * 0.0625) * hgPhase(cosTheta, g * 0.25) * strength * strength;
  return single + octave1 + octave2;
}
```

TS reference 和 GLSL 常量必须来自同一导出配置，避免测试与 shader 两套参数。

- [ ] **Step 3: 锁死六组候选**

```ts
export const RELIEF_SCATTERING_CANDIDATES = [
  { id: "g065-ms018", g: 0.65, multiScatter: 0.18 },
  { id: "g065-ms028", g: 0.65, multiScatter: 0.28 },
  { id: "g072-ms018", g: 0.72, multiScatter: 0.18 },
  { id: "g072-ms028", g: 0.72, multiScatter: 0.28 },
  { id: "g078-ms018", g: 0.78, multiScatter: 0.18 },
  { id: "g078-ms028", g: 0.78, multiScatter: 0.28 }
] as const;
```

- [ ] **Step 4: 验证并提交**

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm --filter @miralith/lubirth-hero typecheck
git add packages/lubirth-hero/src/landingReliefCloudScattering.ts packages/lubirth-hero/src/index.ts tests/e2e/lubirth-reference-absorption-contract.spec.ts
git commit -m "test(lubirth): lock Relief cloud scattering math"
```

---

## Task 6: B 轨接入 Relief-lite，保持采样预算不变

**Files:**
- Modify: `packages/lubirth-hero/src/LandingReliefCloud.tsx`
- Modify: `packages/lubirth-hero/src/landingEarthLiteV2Policy.ts`
- Modify: `tests/e2e/lubirth-reference-absorption-contract.spec.ts`
- Modify: `tests/e2e/lubirth-reference-absorption-spike.spec.ts`

- [ ] **Step 1: 写失败的运行时合同**

`cloud-scattering-v1` 必须报告：

```ts
{
  scatteringModel: "hg-ms-v1",
  phaseG: expect.any(Number),
  multiScatterStrength: expect.any(Number),
  fragmentTextureReads: mobile ? 3 : 4,
  viewSteps: mobile ? 2 : 3,
  sunSteps: 1,
  densityIntegration: "front-to-back",
  premultipliedAlpha: true,
  temporalJitter: false
}
```

baseline 必须保持 `scatteringModel: "relief-baseline"`。

- [ ] **Step 2: 只替换散射项**

替换当前 `pow(dot, 7.0)` 的 forward scatter 和直接 Beer 亮度组合；以下内容不能变化：

- ray-sphere thin-shell intersection。
- V3 RGBA channel interpretation。
- 2/3 个 view steps + 1 个 sun sample。
- density/tau 与 alpha accumulation。
- premultiplied alpha、geometry、cloud bottom/top scale。
- cloud offset 与 Earth-local transform。

禁止新增 noise texture、history buffer、blur FBO、frame counter 或时间 jitter。

- [ ] **Step 3: 增加诊断视图**

专用路由支持：

```text
?debug=cloud-alpha
?debug=cloud-lighting
```

`cloud-alpha` 黑底只输出 alpha/tau，用于证明 B 轨没有改轮廓；`cloud-lighting` 黑底输出 RGB 光照，供 top/side/underside ROI 统计。普通路由忽略这两个 query。

- [ ] **Step 4: 固定选择算法**

对六个候选在同一台机器、相同进程、固定三帧上采样，评分：

```text
score = 0.45 * normalizedTopSideSeparation
      + 0.30 * normalizedSideBottomSeparation
      + 0.25 * normalizedInternalContrastGain
```

先淘汰任何违反 alpha、clipping、GPU 或 motion 门槛的候选，再从余下者取最高分。若无候选通过，B 轨直接 REJECT，不创建第七组参数。

- [ ] **Step 5: 验证基础合同并提交**

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop --grep "cloud scattering contract"
pnpm --filter @miralith/lubirth-hero typecheck
git diff --check
git add packages/lubirth-hero/src tests/e2e/lubirth-reference-absorption-*.spec.ts
git commit -m "feat(lubirth): spike bounded Relief cloud scattering"
```

---

## Task 7: B 轨 motion + visual + GPU 严格验收

**Files:**
- Create: `playwright.reference-absorption-system-chrome.config.ts`
- Modify: `tests/e2e/lubirth-reference-absorption-spike.spec.ts`
- Modify: `docs/lubirth-reference-absorption-evidence/2026-08-03/README.md`
- Modify: `docs/lubirth-reference-absorption-evidence/2026-08-03/manifest.json`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/cloud-scattering-*.png`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/cloud-scattering-candidates.json`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/cloud-scattering-telemetry.json`

- [ ] **Step 1: 只在最终门禁使用 System Chrome**

配置 desktop `1440×960` 与 mobile-landscape `844×390`，worker 固定为 `1`，避免并行 GPU 结果互相污染。证据环境变量：

```bash
export MIRALITH_REFERENCE_ABSORPTION_EVIDENCE_DIR="$PWD/docs/lubirth-reference-absorption-evidence/2026-08-03"
```

- [ ] **Step 2: 运行固定 motion 矩阵**

每个候选覆盖：

```text
progress: 0.00 → 0.22 → 0.55 → 0.22 → 0.00
location: Mianyang / Equator / Dateline north
tier: desktop / mobile-landscape
```

同一 `progress + location` 的正向/反向 `cloud-alpha` 图必须一致：mean absolute pixel delta `≤0.5/255`，边缘漂移 `≤1 px`。

- [ ] **Step 3: 执行 B 轨硬门槛**

全部满足才 PASS：

- oblique `cloud-lighting` top/side mean ratio `≥1.25`。
- side/underside mean ratio `≥1.12`。
- cloud body P90-P10 对比跨度相对 baseline 增加 `≥12%`。
- RGB P99 `≤250/255`；不可通过过曝制造体积感。
- `cloud-alpha` 相对 baseline mean delta `≤0.5/255`、边缘漂移 `≤1 px`。
- desktop 与 mobile 的 fragment reads 仍为 `4 / 3`。
- desktop near、oblique 与完整 sweep：cloud GPU p95 均 `≤3.0ms`。
- variant 相对同轮 baseline GPU p95 增量 `≤0.20ms`。
- 每项 `≥120` 个有效 GPU samples，`gpuDisjointResetCount=0`。
- 无时间 jitter、无滚动闪烁、无 IP 位置漂移、无反向状态迟滞。

如果增量 `≤0.20ms` 但 baseline 与 variant 均超过 `3ms`，结论是 `BLOCKED_BY_BASELINE`，不能把公式写成 PASS。

- [ ] **Step 4: 加主观 kill 条款**

数值通过后再看 near、oblique、0.55 中景三帧。只要仍明显是“柔白贴片/浮雕层”，或光照只改变颜色而没有稳定的 top/side/underside 关系，B 轨仍记为 `REJECT`。不得因为边缘已经柔和就降低体积门槛。

- [ ] **Step 5: 运行最终 B 轨命令**

```bash
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop --grep "cloud scattering"
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=mobile-landscape --grep "cloud scattering"
```

- [ ] **Step 6: 写结论并提交**

```bash
git add playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts docs/lubirth-reference-absorption-evidence/2026-08-03
git commit -m "docs(lubirth): record Relief scattering spike verdict"
```

---

## Task 8: 条件式 combined 验证与最终封存

**Files:**
- Modify: `tests/e2e/lubirth-reference-absorption-spike.spec.ts`
- Modify: `docs/lubirth-reference-absorption-evidence/2026-08-03/README.md`
- Modify: `docs/lubirth-reference-absorption-evidence/2026-08-03/manifest.json`
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/combined-*.png`（仅当 A/B 均 PASS）
- Create: `docs/lubirth-reference-absorption-evidence/2026-08-03/checksums.sha256`

- [ ] **Step 1: 检查 eligibility**

```ts
const combinedEligible =
  manifest.tracks.earthMaterial === "pass" &&
  manifest.tracks.cloudScattering === "pass";
```

不满足时跳过 combined 动态测试，manifest 写 `not-eligible`；不能用 combined 截图掩盖单轨失败。

- [ ] **Step 2: 若 eligible，运行组合矩阵**

组合路径重复 desktop/mobile 的 `0 / 0.22 / 0.55` 与 reverse sweep，要求同时保留 A、B 的全部合同。Earth surface 与 cloud GPU timer 分开报告，禁止相加不同 frame id 的查询结果伪装 total。

- [ ] **Step 3: 全量回归**

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=mobile-landscape
pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm --filter @miralith/site build
git diff --check
```

- [ ] **Step 4: 证明默认首页未变**

保存 `/` 的 network log 与 telemetry，断言：

- 没有请求 `earth-material-lite-v1-*`。
- `referenceAbsorptionVariant === "baseline"`。
- Relief cloud fragment reads、visual policy、IP focus 和 opening progress 合同与 baseline 相同。

- [ ] **Step 5: 固化来源与校验和**

```bash
cd docs/lubirth-reference-absorption-evidence/2026-08-03
find . -type f ! -name checksums.sha256 -print0 | sort -z | xargs -0 shasum -a 256 > checksums.sha256
shasum -a 256 -c checksums.sha256
```

manifest 同时记录所有实现源码、生成脚本、packed assets、测试报告和截图的 SHA-256。

- [ ] **Step 6: 更新知识图并最终提交**

```bash
/graphify --update
git diff --check
git add apps/site packages/lubirth-hero tests/e2e playwright.reference-absorption-system-chrome.config.ts docs/lubirth-reference-absorption-evidence/2026-08-03 graphify-out
git commit -m "feat(lubirth): conclude reference absorption spikes"
```

---

## 3. 最终决策表

| A 轨 | B 轨 | Combined | 后续动作 |
| --- | --- | --- | --- |
| PASS | PASS | PASS | 另开 production integration 计划；本 spike 仍不直接改首页 |
| PASS | REJECT/BLOCKED | not-eligible | 仅考虑 packed Earth material，云保持 Relief-lite baseline |
| REJECT/BLOCKED | PASS | not-eligible | 仅考虑散射配方，拒绝新增 Earth asset |
| REJECT/BLOCKED | REJECT/BLOCKED | not-eligible | 整体封存；不再围绕四个参考继续调参 |

## 4. 本计划不解决的事情

- 不承诺摄影级真实体云；B 轨只是验证现有 Relief-lite 数据能否通过更可信光照获得足够体积线索。
- 不解决 `0–0.22` 电影序章 master sequence；该路线继续受独立资产先验收门禁约束。
- 不做真实 iPhone/Pixel 门禁；System Chrome mobile-tier 只作为 spike 证据，真机仍属于后续 production gate。
- 不改变默认首页、首页 asset preload、现有 IP 定位、opening timeline 或 Relief-lite 采样预算。
