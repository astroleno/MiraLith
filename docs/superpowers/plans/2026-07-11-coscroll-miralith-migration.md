# CoScroll MiraLith Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 CoScroll 原型中真正成立的“黑蓝丝绸场、冷玉锚字、前后层经文横移”迁移成 MiraLith 可维护的独立章节，并在 Radio Gaga 之后作为首页第三幕接入唯一的 production Canvas。

**Architecture:** 原 CoScroll 仓库只作为视觉与内容来源，不迁移音频播放器和应用壳。`packages/coscroll-scene` 保持 canvas-less，使用 24 秒 scroll-derived timeline、3 个压缩 GLB 锚字（心/空/道）、小型字体子集和 site-owned DOM/fallback。CoScroll agent 先在独立分支完成资产、场景、`/coscroll` 路由和测试；待 Radio agent 的共享首页骨架合并后再 rebase，通过统一 chapter contract 添加第三幕。

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, three, @react-three/fiber, @react-three/drei, GSAP/IntersectionObserver, Playwright, obj2gltf 3.2.0, glTF Transform CLI 4.4.1, fonttools/pyftsubset.

---

## 0. 两个 Agent 的协作契约

这份计划由 CoScroll agent 执行；Radio agent 使用配套的 Radio Gaga 计划。

### 分支与并行边界

- CoScroll agent 分支建议：`codex/coscroll-home-migration`。
- Radio agent 分支建议：`codex/radio-gaga-home-migration`。
- CoScroll 可立即并行完成 Task 1–7。
- 在 Task 8 的 wait gate 之前，CoScroll agent 不得修改：
  - `apps/site/app/page.tsx`
  - `apps/site/components/LuBirthRevisedRoute.tsx`
  - `apps/site/components/home/**`
  - `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
  - `tests/e2e/miralith.spec.ts`
- Radio agent 是这些共享文件的首任 owner；它先建立 LuBirth → Radio Gaga 的共享单 Canvas 骨架。
- Radio merge SHA 产生后，CoScroll agent 必须 rebase，再执行 Task 9–10，把 CoScroll 作为扩展而不是另起一套首页。
- 每次提交前先运行 `git diff --name-only`；只能 stage 当前 task 的明确路径，禁止用 `git add apps/site`、`git add tests/e2e` 或 `git add docs` 吞入同一工作树的无关改动。

### 启动前硬门禁

规划时的 MiraLith 工作区很脏，且当前 CoScroll 候选几乎全是 untracked：

- `packages/coscroll-scene/**`
- `apps/site/app/coscroll-spike/**`
- `apps/site/public/assets/coscroll/**`
- `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- `tests/e2e/coscroll.spec.ts`

两个 agent 必须基于同一候选迁移 checkpoint 或同一 patch bundle。若 CoScroll agent 的 worktree 中没有这些候选文件，停止并请求 checkpoint；不要从旧 HEAD 或旧文档重建一个缩水版本，也不要把无关 LuBirth 实验混进分支。

---

## 1. 当前基线与事实

### 原仓库同步状态

- 原仓库：`/Users/aitoshuu/Documents/GitHub/CoScroll`
- GitHub：`git@github.com:astroleno/CoScroll.git`
- 当前本地分支：`decoupled`
- 本地/远端 `decoupled`：`3b24cd6ec66db770fc14ee579b43443adcbf5ec7`
- 远端 `main`：`927a086ffd79bb97ec86b410e5b0499675be624f`
- `decoupled` 比 `main` 多 2 个 commit；规划审计的 tree diff 只新增 `public/lyrics/heart_sutra.srt`。
- 原仓库工作树还有未提交的 config refactor；执行 agent 不得修改它，并需把 dirty file list 写入参考截图 provenance。

结论：GitHub 同名仓库已经在本地；`decoupled` 与其远端同名分支同步，但不是 origin 默认 main。迁移视觉以 `decoupled@3b24cd6` 与实际 live render 为准，不能只看 main。

### 原项目真实完成度

可作为迁移来源：

- `src/app/page.tsx`：完整可演示入口；
- `src/components/backgrounds/SilkR3F.tsx`；
- `src/components/layouts/useLayeredLyrics.ts`；
- `src/components/layouts/LyricBillboard.tsx`；
- `src/components/layouts/UnifiedLyricsAndModel.tsx`；
- `src/components/jade/JadeModelLoader.tsx`；
- `public/lyrics/心经.lrc`；
- 26 个 OBJ 字库、字体、HDR/normal、完整音频。

它仍是 prototype：

- 核心入口约 990 行；
- 多个实验 route 与重复实现；
- 无可靠自动化测试；
- 音频、全量字体和 OBJ 资产不适合首页；
- 当前 config refactor 尚未提交。

### MiraLith 当前候选的关键问题

- `packages/coscroll-scene` 已有 canvas-less 基础、layered lyric 算法和 scene slot，但均未进入当前 HEAD。
- manifest 声称存在以下生产资产，实际缺失：
  - `/assets/coscroll/anchors/xin.glb`
  - `/assets/coscroll/anchors/kong.glb`
  - `/assets/coscroll/anchors/dao.glb`
  - `/assets/coscroll/posters/coscroll-poster.webp`
- public 中反而存在：
  - 13 个 1.0–1.5MB OBJ；
  - 6,048,788 byte 的完整康熙字体；
  - 1.26MB normal JPG；
  - 1.22MB HDR。
- 当前 `sourceMatchMode` 是暖棕/金色，且明确跳过 `CoScrollSilkBackground`，与 source gate 要求的黑蓝/冷白/冰玉方向相反。
- 当前 source comparison test 引用的 reference JPG 并不存在。
- 当前首页没有真实 CoScroll chapter。

因此本计划先修“资产真相与 source match”，再做首页；不得把当前 spike 当成已完成迁移。

---

## 2. 迁移范围

### 必须迁移

- 原 SilkR3F 的黑蓝丝绸感；
- 冷 cyan-white / ice-jade 材料；
- 竖排经文列；
- 经文在前后深度层中横向穿行；
- 心 / 空 / 道三个锚字；
- 一个 24 秒、由章节滚动进度驱动的摘要时间轴；
- `/coscroll` 独立验收页；
- 首页第三幕、单 Canvas、near-load、fallback、reduced motion。

### 明确不迁移

- 原音频、Tone/audio engine、autoplay guard；
- seek bar、播放控制、蓝色 progress UI；
- 364 秒完整播放运行时；
- 运行时 OBJ loader；
- 14/26 锚字全量首页资产；
- 6MB 全量字体；
- 原项目 app shell、config store、实验 routes；
- 第二个 homepage Canvas。

---

## 3. 目标文件结构

```text
apps/site/app/coscroll/page.tsx
apps/site/components/
  CoScrollRoute.tsx
  CoScrollExperience.tsx
  home/
    CoScrollHomeChapter.tsx              # Task 9 后创建
apps/site/public/assets/coscroll/
  anchors/xin.glb
  anchors/kong.glb
  anchors/dao.glb
  fonts/runzhi-heart-sutra-subset.woff2
  posters/coscroll-poster.webp
apps/site/visual/scenes/
  CoScrollSceneSlot.tsx
packages/coscroll-scene/src/
  CoScrollSceneContent.tsx
  CoScrollSilkBackground.tsx
  CoScrollJadeAnchor.tsx
  CoScrollTextBillboard.tsx
  createCoScrollLayeredLyrics.ts
  createCoScrollVisualState.ts
  miralithTimeline.ts
  assetManifest.ts
tests/e2e/
  coscroll.spec.ts
  coscroll-contract.spec.ts
  miralith.spec.ts                        # Task 9 后修改
docs/migrations/
  coscroll-source-audit.md
  coscroll-asset-report.md
  coscroll-acceptance.md
docs/coscroll-source-match/reference/
  source-coscroll-live-active-desktop.jpg
```

最终 public production path 不保留 `source-models/*.obj`、完整 TTF、source HDR/normal。原始资产继续留在原 CoScroll 仓库；MiraLith 只提交可交付产物与来源/哈希报告。

---

## 4. 完成定义

- [ ] 原 `decoupled` live render 有一张带 provenance 的参考截图。
- [ ] `/coscroll` 恢复黑蓝 Silk、冷玉、冷白经文与真实前后层深度。
- [ ] 生产 manifest 引用的所有文件真实存在。
- [ ] 心/空/道 GLB 各 ≤350KB；poster ≤180KB；字体子集 ≤120KB。
- [ ] production runtime 不请求 OBJ、完整 TTF、HDR、normal、audio。
- [ ] `packages/coscroll-scene` 不创建 Canvas，不读取原仓库，不拥有业务 shell。
- [ ] `/coscroll` 有单 Canvas、forced fallback、asset failure fallback、desktop/mobile/reduced-motion 测试。
- [ ] 首页顺序为 LuBirth → Radio Gaga → CoScroll。
- [ ] 首页首屏没有任何 `/assets/coscroll/` 请求。
- [ ] near 第三幕才加载 3 个 GLB/字体/poster；同一时刻只有一个 active scene。
- [ ] Radio → CoScroll → Radio 的来回滚动不残留 camera/background/fog。
- [ ] `pnpm verify`、专属 E2E、`git diff --check` 通过，知识图谱已更新或记录阻塞。

---

## Task 1: 建立可重复的 source truth

**Files:**

- Inspect: `graphify-out/GRAPH_REPORT.md`
- Inspect: `docs/coscroll-source-match/SOURCE_MATCH_GATE.md`
- Create: `docs/migrations/coscroll-source-audit.md`
- Create: `docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg`

- [ ] **Step 1: 按项目协议查询图谱**

```bash
test -f graphify-out/graph.json || /graphify
/graphify query "CoScroll scene assets homepage visual canvas"
/graphify path "CoScrollSceneContent" "VisualCanvas"
/graphify explain "CoScrollSceneSlot"
```

Expected: 定位 community 28（CoScroll assets）、21（scene slots）、27（Visual Canvas）。若 `/graphify` 不存在，记录错误，先读 `GRAPH_REPORT.md`，再定向搜索。

- [ ] **Step 2: 确认候选文件进入 worktree**

```bash
test -f packages/coscroll-scene/src/CoScrollSceneContent.tsx
test -f packages/coscroll-scene/src/createCoScrollLayeredLyrics.ts
test -f apps/site/visual/scenes/CoScrollSceneSlot.tsx
test -f tests/e2e/coscroll.spec.ts
```

Expected: 全部退出 0，否则触发 checkpoint 门禁。

- [ ] **Step 3: 再确认源分支同步**

```bash
git -C /Users/aitoshuu/Documents/GitHub/CoScroll fetch origin main decoupled
git -C /Users/aitoshuu/Documents/GitHub/CoScroll rev-parse decoupled
git -C /Users/aitoshuu/Documents/GitHub/CoScroll rev-parse origin/decoupled
git -C /Users/aitoshuu/Documents/GitHub/CoScroll rev-list --left-right --count origin/main...origin/decoupled
git -C /Users/aitoshuu/Documents/GitHub/CoScroll status --short
```

Expected:

- 两个 decoupled SHA 相同，均为 `3b24cd6ec66db770fc14ee579b43443adcbf5ec7`；
- ahead/behind 为 `0 2`；
- dirty list 被记录，但原仓库不被修改。

- [ ] **Step 4: 启动原项目并捕获参考**

终端 A：

```bash
cd /Users/aitoshuu/Documents/GitHub/CoScroll
npm run dev -- -H 127.0.0.1 -p 3125
```

终端 B（在 MiraLith 根目录）：

```bash
mkdir -p docs/coscroll-source-match/reference
node --input-type=module <<'EOF'
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
await page.goto("http://127.0.0.1:3125", { waitUntil: "networkidle" });
const guard = page.getByText("点击开始", { exact: true });
if (await guard.isVisible()) await guard.click();
await page.waitForTimeout(10_200);
await page.screenshot({
  path: "docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg",
  type: "jpeg",
  quality: 90
});
await browser.close();
EOF
```

Expected: 1440×960 reference 存在，画面包含黑蓝 Silk、冷玉锚字和前后经文。停止源项目服务器，并确认 3125 无 listener。

- [ ] **Step 5: 写 provenance**

`coscroll-source-audit.md` 必须包含：

```md
# CoScroll source audit

- Source repo: /Users/aitoshuu/Documents/GitHub/CoScroll
- Source branch/SHA: decoupled / 3b24cd6ec66db770fc14ee579b43443adcbf5ec7
- Remote state: origin/decoupled matched; origin/main was 2 commits behind decoupled
- Working-tree delta at capture: append the exact `git status --short` output below this line
- Capture: 1440x960, 10.2s after autoplay guard
- Visual authority:
  1. live capture
  2. SilkR3F.tsx
  3. useLayeredLyrics.ts
  4. LyricBillboard.tsx
  5. UnifiedLyricsAndModel.tsx
  6. JadeModelLoader.tsx
- Runtime exclusions: audio, player UI, OBJ, full font, source app shell
```

- [ ] **Step 6: 提交 source truth**

```bash
git add docs/migrations/coscroll-source-audit.md docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg
git commit -m "docs(coscroll): capture authoritative source reference"
```

---

## Task 2: 先用测试暴露资产清单说谎

**Files:**

- Create: `tests/e2e/coscroll-contract.spec.ts`
- Modify: `packages/coscroll-scene/src/assetManifest.ts`
- Create: `docs/migrations/coscroll-asset-report.md`

- [ ] **Step 1: 添加 production asset contract**

`tests/e2e/coscroll-contract.spec.ts`：

```ts
import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const productionAssets = [
  ["apps/site/public/assets/coscroll/anchors/xin.glb", 350_000],
  ["apps/site/public/assets/coscroll/anchors/kong.glb", 350_000],
  ["apps/site/public/assets/coscroll/anchors/dao.glb", 350_000],
  ["apps/site/public/assets/coscroll/fonts/runzhi-heart-sutra-subset.woff2", 120_000],
  ["apps/site/public/assets/coscroll/posters/coscroll-poster.webp", 180_000]
] as const;

test("CoScroll production assets exist inside their byte budgets", () => {
  for (const [relativePath, maxBytes] of productionAssets) {
    const bytes = statSync(path.join(root, relativePath)).size;
    expect(bytes, relativePath).toBeGreaterThan(0);
    expect(bytes, relativePath).toBeLessThanOrEqual(maxBytes);
  }
});
```

- [ ] **Step 2: 运行并确认缺失失败**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll-contract.spec.ts --project=desktop --workers=1
```

Expected: 至少因第一个缺失 GLB 失败。若通过，重新核对当前 worktree，不要继续使用旧审计结论。

- [ ] **Step 3: 将 manifest 收缩到唯一 production contract**

`assetManifest.ts` 最终只保留：

```ts
export const DEFAULT_COSCROLL_ASSETS: CoScrollAssetManifest = {
  anchors: [
    { id: "心", label: "心", modelSrc: "/assets/coscroll/anchors/xin.glb", materialPreset: "jade-blue", bytesBudget: 350_000 },
    { id: "空", label: "空", modelSrc: "/assets/coscroll/anchors/kong.glb", materialPreset: "jade-blue", bytesBudget: 350_000 },
    { id: "道", label: "道", modelSrc: "/assets/coscroll/anchors/dao.glb", materialPreset: "jade-blue", bytesBudget: 350_000 }
  ],
  fallback: {
    posterSrc: "/assets/coscroll/posters/coscroll-poster.webp",
    posterBytesBudget: 180_000
  }
};
```

从 production exports 删除 `SOURCE_COSCROLL_ASSETS`、OBJ paths 与 source excerpt manifest。参考源码不等于生产 runtime manifest。

- [ ] **Step 4: 建立 asset report 模板**

```md
# CoScroll production asset report

| Asset | Source | Toolchain | Bytes | SHA-256 | Runtime role |
|---|---|---|---:|---|---|
| xin.glb | 002_心.obj | obj2gltf 3.2.0 + glTF Transform 4.4.1 | pending | pending | anchor |
| kong.glb | 001_空.obj | same | pending | pending | anchor |
| dao.glb | 003_道.obj | same | pending | pending | anchor |
| font subset | 润植家康熙字典美化体.ttf | pyftsubset | pending | pending | scripture |
| poster | approved source-match capture | Pillow WebP | pending | pending | fallback |
```

- [ ] **Step 5: 暂不提交红测试以外的假资产**

提交 failing test 与报告模板可以单独成 commit：

```bash
git add tests/e2e/coscroll-contract.spec.ts docs/migrations/coscroll-asset-report.md packages/coscroll-scene/src/assetManifest.ts
git commit -m "test(coscroll): define production asset contract"
```

---

## Task 3: 生成真实的 3 个 GLB、字体子集与 poster

**Files:**

- Create: `apps/site/public/assets/coscroll/anchors/xin.glb`
- Create: `apps/site/public/assets/coscroll/anchors/kong.glb`
- Create: `apps/site/public/assets/coscroll/anchors/dao.glb`
- Create: `apps/site/public/assets/coscroll/fonts/runzhi-heart-sutra-subset.woff2`
- Create: `apps/site/public/assets/coscroll/posters/coscroll-poster.webp`
- Modify: `docs/migrations/coscroll-asset-report.md`

- [ ] **Step 1: 建输出目录**

```bash
mkdir -p apps/site/public/assets/coscroll/anchors
mkdir -p apps/site/public/assets/coscroll/fonts
mkdir -p apps/site/public/assets/coscroll/posters
mkdir -p /tmp/miralith-coscroll-assets
```

- [ ] **Step 2: 用固定版本转换三个锚字**

```bash
pnpm dlx obj2gltf@3.2.0 -i /Users/aitoshuu/Documents/GitHub/CoScroll/public/models/10k_obj/002_心.obj -o /tmp/miralith-coscroll-assets/xin.raw.glb
pnpm dlx obj2gltf@3.2.0 -i /Users/aitoshuu/Documents/GitHub/CoScroll/public/models/10k_obj/001_空.obj -o /tmp/miralith-coscroll-assets/kong.raw.glb
pnpm dlx obj2gltf@3.2.0 -i /Users/aitoshuu/Documents/GitHub/CoScroll/public/models/10k_obj/003_道.obj -o /tmp/miralith-coscroll-assets/dao.raw.glb

pnpm dlx @gltf-transform/cli@4.4.1 optimize /tmp/miralith-coscroll-assets/xin.raw.glb apps/site/public/assets/coscroll/anchors/xin.glb --compress meshopt
pnpm dlx @gltf-transform/cli@4.4.1 optimize /tmp/miralith-coscroll-assets/kong.raw.glb apps/site/public/assets/coscroll/anchors/kong.glb --compress meshopt
pnpm dlx @gltf-transform/cli@4.4.1 optimize /tmp/miralith-coscroll-assets/dao.raw.glb apps/site/public/assets/coscroll/anchors/dao.glb --compress meshopt
```

如果 CLI 参数与固定版本不一致，先运行对应 `--help` 并把实际命令记录到 asset report；不要改成未固定的 latest。

- [ ] **Step 3: 生成只含生产经文字符的 WOFF2**

```bash
pyftsubset /Users/aitoshuu/Documents/GitHub/CoScroll/public/fonts/润植家康熙字典美化体.ttf \
  --text="照见五蕴皆空度一切苦厄色不异空空不异色无苦集灭道以无所得故心" \
  --flavor=woff2 \
  --layout-features='*' \
  --no-hinting \
  --output-file=apps/site/public/assets/coscroll/fonts/runzhi-heart-sutra-subset.woff2
```

- [ ] **Step 4: 从批准的 source reference 生成 fallback poster**

```bash
python3 - <<'PY'
from pathlib import Path
from PIL import Image, ImageOps

source = Path("docs/coscroll-source-match/reference/source-coscroll-live-active-desktop.jpg")
target = Path("apps/site/public/assets/coscroll/posters/coscroll-poster.webp")
image = Image.open(source).convert("RGB")
poster = ImageOps.fit(image, (1200, 675), method=Image.Resampling.LANCZOS)
poster.save(target, "WEBP", quality=82, method=6)
PY
```

- [ ] **Step 5: 验证格式与预算**

```bash
file apps/site/public/assets/coscroll/anchors/*.glb
file apps/site/public/assets/coscroll/fonts/*.woff2
file apps/site/public/assets/coscroll/posters/*.webp
find apps/site/public/assets/coscroll/anchors apps/site/public/assets/coscroll/fonts apps/site/public/assets/coscroll/posters -type f -exec stat -f '%z %N' {} \;
CI=1 pnpm exec playwright test tests/e2e/coscroll-contract.spec.ts --project=desktop --workers=1
```

Expected: 五项都在预算内，contract test 通过。

- [ ] **Step 6: 视觉检查 GLB 轴向与法线**

用 `/coscroll` 或临时现有 spike 逐一显示心/空/道：

- 字形正面朝向 camera；
- 没有镜像；
- bounding box 居中；
- 法线可产生连续冷玉高光；
- 三个模型切换时视觉尺度一致。

如果需要旋转/居中，优先在一次性 asset transform 中修正；不要给每个模型散落不同 magic rotation。

- [ ] **Step 7: 写入 byte size 与 SHA-256**

```bash
shasum -a 256 apps/site/public/assets/coscroll/anchors/*.glb apps/site/public/assets/coscroll/fonts/*.woff2 apps/site/public/assets/coscroll/posters/*.webp
```

把输出填入 `coscroll-asset-report.md`。

- [ ] **Step 8: 提交生产资产**

```bash
git add apps/site/public/assets/coscroll/anchors apps/site/public/assets/coscroll/fonts apps/site/public/assets/coscroll/posters docs/migrations/coscroll-asset-report.md
git commit -m "feat(coscroll): add bounded production assets"
```

---

## Task 4: 用 24 秒摘要替代音频时间轴

**Files:**

- Create: `packages/coscroll-scene/src/miralithTimeline.ts`
- Modify: `packages/coscroll-scene/src/createCoScrollVisualState.ts`
- Modify: `packages/coscroll-scene/src/index.ts`
- Modify: `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- Modify: `tests/e2e/coscroll-contract.spec.ts`

- [ ] **Step 1: 先写 timeline contract**

```ts
import { MIRALITH_COSCROLL_TIMELINE } from "../../packages/coscroll-scene/src/miralithTimeline";

test("MiraLith CoScroll uses a concise scroll timeline", () => {
  expect(MIRALITH_COSCROLL_TIMELINE.duration).toBe(24);
  expect(MIRALITH_COSCROLL_TIMELINE.anchorCues.map((cue) => cue.anchor)).toEqual(["心", "空", "道"]);
  expect(MIRALITH_COSCROLL_TIMELINE.lyricSegments.map((line) => line.text)).toEqual([
    "照见五蕴皆空",
    "度一切苦厄",
    "色不异空",
    "空不异色",
    "无苦集灭道",
    "以无所得故"
  ]);
});
```

- [ ] **Step 2: 运行并确认模块缺失**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll-contract.spec.ts --project=desktop --workers=1
```

- [ ] **Step 3: 实现唯一 production timeline**

`miralithTimeline.ts`：

```ts
import type { CoScrollTimelineConfig } from "./types";

export const MIRALITH_COSCROLL_TIMELINE: CoScrollTimelineConfig = {
  duration: 24,
  easing: "breath",
  anchorCues: [
    { anchor: "心", start: 0, end: 8 },
    { anchor: "空", start: 8, end: 16 },
    { anchor: "道", start: 16, end: 24 }
  ],
  lyricSegments: [
    { id: "heart-01", text: "照见五蕴皆空", start: 0, end: 5, layer: "back", emphasis: "normal" },
    { id: "heart-02", text: "度一切苦厄", start: 3, end: 8, layer: "front", emphasis: "bright" },
    { id: "empty-01", text: "色不异空", start: 8, end: 12, layer: "back", emphasis: "normal" },
    { id: "empty-02", text: "空不异色", start: 11, end: 16, layer: "front", emphasis: "bright" },
    { id: "way-01", text: "无苦集灭道", start: 16, end: 21, layer: "back", emphasis: "normal" },
    { id: "way-02", text: "以无所得故", start: 19, end: 24, layer: "front", emphasis: "bright" }
  ]
};
```

- [ ] **Step 4: progress 映射必须纯粹**

`createCoScrollVisualState`：

- clamp progress 到 0–1；
- `visualTime = easedProgress * 24`；
- 核心可读性只由 progress 决定；
- scrollVelocity 只能影响 atmosphere/微扰；
- reduced motion 固定到一个可读 pose，不播放 24 秒动画；
- 不读取 audio time、Date.now 或全局 store。

- [ ] **Step 5: production slot 使用新 timeline**

`CoScrollSceneSlot.tsx` 从 `MIRALITH_COSCROLL_TIMELINE` 导入；`DEFAULT_COSCROLL_TIMELINE` 与 364 秒 source timeline 不再进入生产 path。

- [ ] **Step 6: 跑 typecheck 与 contract**

```bash
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
CI=1 pnpm exec playwright test tests/e2e/coscroll-contract.spec.ts --project=desktop --workers=1
```

- [ ] **Step 7: 提交 timeline**

```bash
git add packages/coscroll-scene/src/miralithTimeline.ts packages/coscroll-scene/src/createCoScrollVisualState.ts packages/coscroll-scene/src/index.ts apps/site/visual/scenes/CoScrollSceneSlot.tsx tests/e2e/coscroll-contract.spec.ts
git commit -m "feat(coscroll): map chapter scroll to concise ritual timeline"
```

---

## Task 5: 通过 source-match gate，纠正暖金色漂移

**Files:**

- Modify: `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollSilkBackground.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollTextBillboard.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollCausticLightField.tsx`
- Modify: `tests/e2e/coscroll.spec.ts`
- Modify: `docs/coscroll-source-match/SOURCE_MATCH_GATE.md`

- [ ] **Step 1: 先写颜色与 Silk 存在的失败测试**

在 `coscroll.spec.ts` 的 source-match case 里检查：

- Canvas 非空；
- 上方 background band 为低亮黑蓝；
- lit pixel 中 cyan/white 占比高于 amber/red；
- anchor window 有可见体积；
- 左右经文区均有 lit pixels；
- 页面只有一个 Canvas。

不要要求跨 GPU 的逐像素完全相同；使用 region metrics + reference screenshot + 人工 gate。

- [ ] **Step 2: 运行当前候选并记录预期失败**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --workers=1
```

Expected: 当前暖棕 sourceMatch、缺 reference 或缺资产导致失败。

- [ ] **Step 3: 恢复 SilkR3F 的视觉参数**

`CoScrollSilkBackground` 的 source-match/production 起点：

```ts
export const COSCROLL_SILK_PRESET = {
  color: "#1f2e38",
  speed: 4.9,
  noiseIntensity: 1.3,
  rotation: 2.42
} as const;
```

`CoScrollSceneContent` 在 source-match 不能再写：

```tsx
{sourceMatchMode ? null : <CoScrollSilkBackground ... />}
```

必须让 Silk 在 source-match 与 production 都存在；reduced motion 只冻结/减速，不删除背景层。

- [ ] **Step 4: 把 scene 灯光改回冷色**

起始值：

```tsx
<color attach="background" args={["#02070b"]} />
<ambientLight intensity={0.42} color="#d9fbff" />
<directionalLight position={[3.2, 3.8, 5.2]} intensity={1.08} color="#effcff" />
<pointLight position={[-2.8, -1.6, 2.8]} intensity={0.5} color="#7ed6e8" />
```

删除 source-match 的 `#100705`、`#ffd8aa`、`#f4a35f`、`#ffd69b` 暖金组合。

- [ ] **Step 5: 恢复冷玉材料**

`CoScrollJadeAnchor` 的 `jade-blue` 起点：

- base color：`#b9eceb`；
- roughness：0.24–0.34；
- metalness：0；
- transmission：0.12–0.28；
- thickness：0.6–1.2；
- ior：约 1.45；
- emissive 只能是极弱 cyan，不可变成自发光塑料；
- 不依赖 production HDR/normal 请求。

根据 reference 调整，但每次只改一个参数组并记录截图，不接受回到金色矿物。

- [ ] **Step 6: 恢复冷白经文**

`CoScrollTextBillboard.tsx`：

```ts
const emphasisStyles = {
  quiet: {
    fill: "rgba(190, 220, 228, 0.42)",
    stroke: "rgba(1, 8, 12, 0.76)",
    shadow: "rgba(126, 214, 232, 0.12)"
  },
  normal: {
    fill: "rgba(222, 244, 247, 0.7)",
    stroke: "rgba(1, 8, 12, 0.8)",
    shadow: "rgba(126, 214, 232, 0.18)"
  },
  bright: {
    fill: "rgba(244, 253, 255, 0.9)",
    stroke: "rgba(1, 8, 12, 0.84)",
    shadow: "rgba(185, 241, 247, 0.26)"
  }
} as const;
```

字体 URL 改为 `runzhi-heart-sutra-subset.woff2`。外层列低 opacity，中间当前列更亮；保留真实 front/back depthTest/depthWrite。

- [ ] **Step 7: 修正 active 副作用**

当前 tone mapping effect 只看 `sourceMatchMode`。改为：

```ts
useEffect(() => {
  if (!sourceMatchMode || !active) return;
  // save renderer state, apply source-match state, restore on cleanup
}, [active, gl, sourceMatchMode]);
```

相同规则适用于 camera、background、fog、preload 和 pointer/scroll listeners。inactive scene 不得拥有全局 renderer state。

- [ ] **Step 8: 保持 layered lyric 算法的来源**

对照原 `useLayeredLyrics.ts`，确认：

- 经文从水平方向穿行；
- front layer 位于锚字前；
- back-near/back-far 在锚字后；
- 两侧 edge feather；
- 移动竖屏不把所有列压成一列；
- 当前行更亮，但不通过 DOM z-index 假装 3D。

- [ ] **Step 9: 捕获 candidate 与 reference 并人工 gate**

相同 1440×960、相同视觉时间捕获：

- reference；
- candidate；
- side-by-side 或 overlay。

通过标准：

1. 第一眼是黑蓝而非红棕；
2. 锚字是冰玉而非金矿；
3. 经文是冷白/cyan；
4. 左右有横向流动线索；
5. 经文确实穿过锚字前后；
6. 中心 anchor 尺度与 reference 同一量级。

未通过就停在本 task，不能进入 homepage integration。

- [ ] **Step 10: 用批准的 candidate Canvas 替换临时 poster**

只截取 `/coscroll` 的 Canvas，不包含独立页 UI；转为 1200×675 WebP 后覆盖 `coscroll-poster.webp`。重新跑 byte budget、`shasum -a 256`，更新 `coscroll-asset-report.md`。最终 poster 的来源必须是通过 gate 的 MiraLith candidate，不是带原 app 控件的 source screenshot。

- [ ] **Step 11: 更新 gate 并跑测试**

在 `SOURCE_MATCH_GATE.md` 记录：

- pass 日期；
- candidate screenshot path；
- 有意偏差（24 秒、3 锚字、无音频、GLB、字体子集）；
- region metric 结果；
- 审批人/agent 结论。

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --workers=1
pnpm --filter @miralith/coscroll-scene typecheck
```

- [ ] **Step 12: 提交 source match**

```bash
git add packages/coscroll-scene tests/e2e/coscroll.spec.ts docs/coscroll-source-match apps/site/public/assets/coscroll/posters/coscroll-poster.webp docs/migrations/coscroll-asset-report.md
git commit -m "feat(coscroll): restore source visual language"
```

---

## Task 6: 把 spike 收口为正式 `/coscroll` 独立页

**Files:**

- Create: `apps/site/app/coscroll/page.tsx`
- Create: `apps/site/components/CoScrollRoute.tsx`
- Create: `apps/site/components/CoScrollExperience.tsx`
- Modify: `apps/site/app/globals.css`
- Modify: `apps/site/visual/scenes/CoScrollSceneSlot.tsx`
- Modify: `tests/e2e/coscroll.spec.ts`
- Remove after parity: `apps/site/app/coscroll-spike/page.tsx`
- Remove after parity: `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx`

- [ ] **Step 1: 先写正式路由失败测试**

```ts
test("formal CoScroll route is a one-canvas scroll chapter", async ({ page }) => {
  await page.goto("/coscroll");
  await expect(page.locator('[data-coscroll-host="standalone"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "CoScroll" })).toBeVisible();
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] **Step 2: 运行并确认 404**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --workers=1 -g "formal CoScroll"
```

- [ ] **Step 3: 定义可复用 experience contract**

`CoScrollExperience.tsx`：

```tsx
export interface CoScrollPresence {
  near: boolean;
  active: boolean;
}

export interface CoScrollExperienceProps {
  host: "standalone" | "home";
  progressRef: React.MutableRefObject<number>;
  renderVisual?: (input: {
    progressRef: React.MutableRefObject<number>;
    near: boolean;
    active: boolean;
  }) => React.ReactNode;
  onPresenceChange?: (presence: CoScrollPresence) => void;
}
```

`host="home"` 永远不创建 Canvas；standalone route 可以通过 `renderVisual` 创建一个。

- [ ] **Step 4: 实现 scroll progress**

章节 progress：

```ts
const raw = (viewportHeight - rect.top) / (rect.height + viewportHeight);
progressRef.current = Math.min(1, Math.max(0, raw));
```

通过 RAF 合并 scroll/resize 更新；核心 timeline 只读 progress ref。不要引入 audio clock。

- [ ] **Step 5: 实现 forced fallback 与 asset failure**

`/coscroll?visual=fallback` 的初始 server HTML 必须：

- 不含 production Canvas；
- 含 `data-visual-fallback="coscroll"`；
- 含真实 poster、标题和摘要；
- JS hydration 后 DOM 不翻转。

GLB GET 被 abort 时也切到同一可读 fallback。

- [ ] **Step 6: 保留 site-owned DOM**

DOM 至少包含：

- heading：CoScroll；
- 章节定位：`03 / Devotion`；
- 简短中文说明；
- 六句 production excerpt 的可访问文本；
- fallback 中不依赖 Canvas 才能理解的摘要。

经文 3D billboard 是视觉层，不替代可访问 DOM。

- [ ] **Step 7: 移动端与 reduced-motion**

- desktop：完整 Silk + depth；
- mobile portrait：减少列数/粒子或 caustic，但保留心/空/道与前后关系；
- mobile landscape：标题不遮 anchor；
- reduced motion：静态冷玉/经文或 poster，scroll 可读，不连续旋转。

- [ ] **Step 8: 正式路由通过后移除 spike**

只有 `/coscroll` 覆盖 source match、fallback、移动端并通过测试后，才删除 `/coscroll-spike`。若暂时保留，必须明确 `noindex` 并在文档写“review-only”，不能让两个实现继续分叉。

- [ ] **Step 9: 跑正式路由测试**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts --workers=1
pnpm --filter @miralith/site typecheck
```

- [ ] **Step 10: 提交独立页**

```bash
git add apps/site/app/coscroll apps/site/components/CoScrollRoute.tsx apps/site/components/CoScrollExperience.tsx apps/site/visual/scenes/CoScrollSceneSlot.tsx apps/site/app/globals.css tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts
git add -u apps/site/app/coscroll-spike
git commit -m "feat(coscroll): ship formal standalone chapter"
```

---

## Task 7: 清除 production 重资产与请求漂移

**Files:**

- Remove: `apps/site/public/assets/coscroll/source-models/*.obj`
- Remove: `apps/site/public/assets/coscroll/fonts/runzhi-kangxi.ttf`
- Remove: `apps/site/public/assets/coscroll/textures/normal.jpg`
- Remove: `apps/site/public/assets/coscroll/textures/qwantani_moon_noon_puresky_1k.hdr`
- Modify: `packages/coscroll-scene/src/index.ts`
- Modify: `packages/coscroll-scene/src/assetManifest.ts`
- Modify: `tests/e2e/coscroll-contract.spec.ts`
- Modify: `docs/migrations/coscroll-asset-report.md`

- [ ] **Step 1: 先写 runtime allowlist 测试**

```ts
test("CoScroll production route requests only approved runtime assets", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith("/assets/coscroll/")) requested.push(pathname);
  });

  await page.goto("/coscroll");
  await page.evaluate(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight * 0.5, behavior: "instant" });
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  await expect.poll(() => requested.some((path) => path.endsWith(".glb"))).toBe(true);
  expect(requested.some((path) => path.endsWith(".obj"))).toBe(false);
  expect(requested.some((path) => path.endsWith(".ttf"))).toBe(false);
  expect(requested.some((path) => path.endsWith(".hdr"))).toBe(false);
  expect(requested.some((path) => path.endsWith("normal.jpg"))).toBe(false);
  expect(requested.some((path) => /audio|mp3|lrc/i.test(path))).toBe(false);
});
```

滚动后应等待两个 RAF，不使用固定 viewport 像素。

- [ ] **Step 2: 删除 production public 中的 source assets**

这些原始文件仍在 `/Users/aitoshuu/Documents/GitHub/CoScroll`，MiraLith 不需要重复部署。

```bash
git rm -r apps/site/public/assets/coscroll/source-models
git rm apps/site/public/assets/coscroll/fonts/runzhi-kangxi.ttf
git rm apps/site/public/assets/coscroll/textures/normal.jpg
git rm apps/site/public/assets/coscroll/textures/qwantani_moon_noon_puresky_1k.hdr
```

如果候选文件尚未 tracked，直接删除并确认 `git status` 中不再出现；不要用 `git rm` 报错掩盖状态。

- [ ] **Step 3: 清理 exports 与 loader**

- production index 不导出 OBJ/source manifests；
- `CoScrollJadeAnchor` production path 只用 GLTFLoader/useGLTF；
- 不保留运行时根据扩展名切换 OBJ 的分支；
- full source timeline 可以留作纯文档/测试参考，但不能由 production slot 导入。

- [ ] **Step 4: 运行 allowlist 与 bundle 检查**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts --workers=1
pnpm build
rg -n "source-models|runzhi-kangxi|\\.obj|\\.hdr|normal\\.jpg|心经_2\\.mp3" apps/site packages/coscroll-scene
```

Expected: 测试通过；`rg` 在 production code 中无命中（历史 docs 可有来源说明）。

- [ ] **Step 5: 提交清理**

```bash
git add -A apps/site/public/assets/coscroll packages/coscroll-scene tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts docs/migrations/coscroll-asset-report.md
git commit -m "perf(coscroll): remove source-only runtime payload"
```

Task 1–7 至此构成 parallel-safe CoScroll PR：正式独立页已完成，但还未触碰共享首页。

---

## Task 8: 等待 Radio 首页骨架并 rebase

**Files:**

- Read: `docs/migrations/radio-gaga-acceptance.md`
- Read: `apps/site/components/home/homeChapterTypes.ts`
- Read: `apps/site/components/home/homeChapterRegistry.ts`
- Read: `apps/site/components/home/MiraLithHomeNarrative.tsx`
- Read: `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`

- [ ] **Step 1: 获取 Radio handoff SHA**

`radio-gaga-acceptance.md` 必须给出已通过测试的 shared-home merge SHA。没有 SHA 就等待，不要在旧 untracked `HomeVisualSceneSlot.tsx` 上继续。

- [ ] **Step 2: 确认 parallel-safe 阶段干净**

```bash
git status --short
pnpm verify
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts --workers=1
```

Expected: 工作树干净、验证通过。

- [ ] **Step 3: rebase 到 Radio/home-spine**

使用组织者提供的本地分支或 commit：

```bash
git rebase <radio-home-spine-sha>
```

不要用冲突解决覆盖 Radio agent 的 shared file。CoScroll 专属文件应无冲突；共享文件只在 rebase 完成后按 Task 9 增量修改。

- [ ] **Step 4: 重新查询图谱路径**

```bash
/graphify query "HomeVisualSceneSlot Radio Gaga CoScroll extension"
/graphify path "MiraLithHomeNarrative" "HomeVisualSceneSlot"
```

- [ ] **Step 5: 重跑独立页**

```bash
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts --project=desktop --workers=1
```

若 rebase 后独立页退化，先修复再进入首页。

---

## Task 9: 通过共享 contract 添加首页第三幕

**Files:**

- Create: `apps/site/components/home/CoScrollHomeChapter.tsx`
- Modify: `apps/site/components/home/homeChapterRegistry.ts`
- Modify: `apps/site/components/home/MiraLithHomeNarrative.tsx`
- Modify: `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- Modify: `apps/site/components/LuBirthRevisedRoute.tsx` 仅章节导航数据（如 registry 尚未自动驱动）
- Modify: `apps/site/app/globals.css`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: 先添加三幕顺序失败测试**

```ts
test("homepage orders LuBirth, Radio Gaga, then CoScroll", async ({ page }) => {
  await page.goto("/");
  const order = await page.locator("[data-home-chapter]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-home-chapter"))
  );
  expect(order.slice(0, 3)).toEqual(["lubirth", "radio-gaga", "coscroll"]);
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
});
```

- [ ] **Step 2: 先添加 CoScroll 首屏零请求测试**

```ts
test("homepage first screen makes zero CoScroll requests", async ({ page }) => {
  const coscrollRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/assets/coscroll/")) {
      coscrollRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.waitForTimeout(700);
  expect(coscrollRequests).toEqual([]);
});
```

- [ ] **Step 3: 运行并确认第三幕缺失**

```bash
CI=1 pnpm exec playwright test tests/e2e/miralith.spec.ts --project=desktop --workers=1 -g "CoScroll|three acts"
```

- [ ] **Step 4: 扩展 registry**

```ts
export const HOME_CHAPTERS: readonly HomeChapterDefinition[] = [
  { id: "lubirth", index: "01", title: "LuBirth", zh: "来处", en: "Arrival" },
  { id: "radio-gaga", index: "02", title: "Radio Gaga", zh: "照护", en: "Care" },
  { id: "coscroll", index: "03", title: "CoScroll", zh: "念持", en: "Devotion" }
];
```

章节 rail/移动标题必须从 registry 派生，避免在 `LuBirthRevisedRoute` 保留另一份手写 active 列表。

- [ ] **Step 5: 创建无 Canvas 的 home chapter**

`CoScrollHomeChapter.tsx`：

```tsx
export function CoScrollHomeChapter({
  progressRef,
  onPresenceChange
}: {
  progressRef: React.MutableRefObject<number>;
  onPresenceChange: (presence: CoScrollPresence) => void;
}) {
  return (
    <section data-home-chapter="coscroll" id="coscroll">
      <CoScrollExperience
        host="home"
        progressRef={progressRef}
        onPresenceChange={onPresenceChange}
      />
    </section>
  );
}
```

- [ ] **Step 6: 扩展 scene arbiter**

`HomeVisualSceneSlot`：

```tsx
interface CoScrollHomeRuntime extends HomeChapterRuntime {
  id: "coscroll";
}

// Only render this branch when near; active controls frame work.
if (activeScene === "coscroll" && coscroll.near) {
  return (
    <CoScrollSceneSlot
      active={coscroll.active}
      progressRef={coscroll.progressRef}
    />
  );
}
```

如果现有 `CoScrollSceneSlot` 只接受 number progress，改为同时接受稳定 `progressRef`；R3F `useFrame` 读取 ref，不能让整棵 React tree 随滚动每帧 rerender。

在 `CoScrollSceneSlot.tsx` 导出 `preloadCoScrollProductionAssets()`，只预热 manifest 中的 3 个 GLB 和字体子集。`coscrollPresence.near` 第一次变为 true 时调用一次；首屏不得调用。

- [ ] **Step 7: 实现确定性场景选择**

当 Radio 与 CoScroll 的 near 区域重叠：

- active 由视口中心命中的 chapter 决定；
- 若两个都命中，以 intersection ratio 最大者为准；
- 完全相等时用滚动方向选择将进入的章节；
- 任一时刻只允许一个 `active=true`；
- near 可以同时为 true，以便预热下一个 scene module，但模型请求不得提前超过 150% rootMargin。

- [ ] **Step 8: 请求阶段断言**

测试分三段：

1. 首屏：0 CoScroll requests；
2. 接近第三幕：只出现 subset font、poster（若 fallback 需要）与心/空/道 GLB；
3. 第三幕 active：仍无 OBJ/HDR/normal/audio。

允许的 pathname 必须显式列出，不使用“只要数量不多”。

- [ ] **Step 9: 场景来回切换**

Playwright 验证：

- 首屏 `lubirth`；
- 第二幕 `radio-gaga`；
- 第三幕 `coscroll`；
- 回到第二幕 `radio-gaga`；
- 回到首屏 `lubirth`；
- 每一步 production Canvas count = 1；
- 每一步 Canvas nonblank；
- CoScroll 离开后黑蓝背景不污染 Radio/LuBirth；
- Radio 离开后暖色/fog 不污染 CoScroll。

- [ ] **Step 10: fallback 与 reduced motion**

- `/?visual=fallback` 或项目统一 fallback 开关能让第三幕用 poster/DOM；
- reduced motion 第三幕不连续旋转；
- fallback 页面不请求 GLB；
- DOM 经文和标题保持可阅读。

- [ ] **Step 11: 跑首页与专属测试**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts tests/e2e/miralith.spec.ts --workers=1
```

Expected: desktop、mobile-portrait、mobile-landscape 全部通过。

- [ ] **Step 12: 提交首页第三幕**

```bash
git add apps/site/components/home/CoScrollHomeChapter.tsx apps/site/components/home/homeChapterRegistry.ts apps/site/components/home/MiraLithHomeNarrative.tsx apps/site/visual/scenes/HomeVisualSceneSlot.tsx apps/site/components/LuBirthRevisedRoute.tsx apps/site/app/globals.css tests/e2e/miralith.spec.ts
git commit -m "feat(home): add CoScroll as the third shared-canvas act"
```

---

## Task 10: 性能、文档与最终验收

**Files:**

- Modify: `docs/coscroll-source-match/SOURCE_MATCH_GATE.md`
- Modify: `docs/coscroll-implementation-plan/NEXT_STEPS_PLAN.md`
- Modify: `docs/migrations/coscroll-acceptance.md`
- Modify: `README.md` 或当前唯一 roadmap（若适用）

- [ ] **Step 1: 测量首页性能**

生产 build 下测：

- 首屏不因 CoScroll 增加请求；
- Radio → CoScroll 切换无重复 Canvas/context；
- desktop CoScroll active p95 RAF ≤25ms；
- mobile portrait p95 RAF ≤33ms；
- 无持续 >100ms long frame；
- 离开第三幕后 CoScroll 的 active frame work 停止。

性能不足时按顺序降级：

1. caustic sample/opacity；
2. billboard texture resolution；
3. 可见经文列数；
4. DPR/quality tier；

不得先删除 Silk、前后深度或冷玉核心特征。

- [ ] **Step 2: 视觉验收三 viewport**

关键截图：

- desktop 1440×960：心、空、道各一张；
- mobile portrait 412×915：中心锚字与两层经文；
- mobile landscape 915×412：标题与锚字不重叠；
- forced fallback；
- 首页 Radio → CoScroll 过渡前后。

`coscroll-acceptance.md` 记录截图位置、结论和有意偏差。

- [ ] **Step 3: 标记旧计划已被取代**

在以下旧文档顶部增加 superseded note，不删除历史：

- `docs/coscroll-migration-plan.md`
- `docs/coscroll-implementation-plan/NEXT_STEPS_PLAN.md`
- 其他声称“spike 已等同首页迁移”的文档。

权威执行计划指向本文件。

- [ ] **Step 4: 跑静态检查**

```bash
pnpm --filter @miralith/coscroll-scene typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm build
git diff --check
```

Expected: 全部退出 0；build route 列表含 `/`、`/radio-gaga`、`/coscroll`。

- [ ] **Step 5: 跑专属 E2E**

```bash
CI=1 pnpm exec playwright test tests/e2e/coscroll.spec.ts tests/e2e/coscroll-contract.spec.ts tests/e2e/miralith.spec.ts --workers=1
```

Expected: 三 viewport projects 全部通过，无 flaky retry。

- [ ] **Step 6: 跑全项目验证**

```bash
pnpm verify
```

- [ ] **Step 7: 更新知识图谱**

```bash
/graphify --update
/graphify path "CoScrollSceneContent" "HomeVisualSceneSlot"
```

Expected: community 28 → 21 → 27 路径可查询。若 `/graphify` 不可用，在 acceptance 明确记录阻塞。

- [ ] **Step 8: 最终提交**

```bash
git add docs/coscroll-source-match/SOURCE_MATCH_GATE.md docs/coscroll-implementation-plan/NEXT_STEPS_PLAN.md docs/coscroll-migration-plan.md docs/migrations/coscroll-acceptance.md README.md
git commit -m "docs(coscroll): record migration acceptance"
```

---

## 停止条件

遇到以下任一情况，停止当前 task 并报告证据：

- 候选 package/route/test 没有进入 worktree；
- 原仓库 `decoupled` 与 `origin/decoupled` 不再相同；
- 无法得到原 live render 参考；
- GLB 经固定工具链优化后仍超过 350KB，且继续简化会破坏字形；
- source match 仍是暖金/棕色或没有 Silk；
- 为完成视觉必须重新引入 OBJ、完整字体、HDR/normal 或音频；
- `/coscroll` 还没通过独立验收就要求接首页；
- Radio shared-home SHA 尚未提供；
- rebase 需要覆盖 Radio agent 的共享实现；
- 首页出现第二个 Canvas；
- first-screen 出现任何 `/assets/coscroll/` 请求；
- 性能只能通过删除 Silk/深度/冷玉核心来达标。

这些问题需要资产、架构或产品决策，不允许通过缩水实现绕过。
