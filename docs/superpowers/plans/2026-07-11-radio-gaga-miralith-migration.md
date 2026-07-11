# Radio Gaga MiraLith Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已经接近完成的 Radio Gaga 独立页收口为可维护的 MiraLith 叙事模块，并将它作为 LuBirth 之后的首页第二幕接入唯一的 production Canvas。

**Architecture:** 保留 `/radio-gaga` 作为独立验收页；把滚动驱动、DOM 叙事和 R3F 场景拆成可复用的 chapter runtime。Radio agent 同时负责搭建通用首页叙事骨架，LuBirth 仍保留现有开场行为，但通过 render-slot 把它当前拥有的唯一 Canvas 升级为 `HomeVisualSceneSlot`。Radio Gaga 只在章节接近视口时挂载场景和加载模型；原项目的业务运行时不迁入 MiraLith。

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, three, @react-three/fiber, @react-three/drei, GSAP ScrollTrigger, Playwright.

---

## 0. 两个 Agent 的协作契约

这份计划由 Radio agent 执行；CoScroll agent 使用配套的 CoScroll 计划并行工作。

### 分支与文件所有权

- Radio agent 分支建议：`codex/radio-gaga-home-migration`。
- CoScroll agent 分支建议：`codex/coscroll-home-migration`。
- Radio agent 是共享首页骨架的唯一 owner，负责：
  - `apps/site/app/page.tsx`
  - `apps/site/components/LuBirthRevisedRoute.tsx` 中仅与共享 Canvas/render-slot/章节导航有关的改动
  - `apps/site/components/home/**`
  - `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
  - `tests/e2e/miralith.spec.ts`
  - Radio Gaga 自身的 package、route、CSS 和测试
- CoScroll agent 在并行阶段不得修改以上共享文件。它先完成 package、资产、`/coscroll` 独立页和专属测试。
- 合流顺序固定为：Radio agent 先合并首页骨架；CoScroll agent 再 rebase，并通过既定 chapter contract 添加第三幕。
- 每次提交前先运行 `git diff --name-only`；只能 stage 当前 task 的明确路径，禁止用 `git add apps/site`、`git add tests/e2e` 或 `git add docs` 吞入同一工作树的无关改动。

### 启动前硬门禁

当前 MiraLith 工作区不是干净 HEAD：

- Radio Gaga 存在 tracked 修改；
- `RadioGagaParticleTransition.tsx`、`radioGagaFinalOutput.ts` 等仍是 untracked；
- CoScroll package、资产和测试也主要是 untracked；
- 同一工作区还混有 LuBirth 视觉实验。

因此两个 agent 必须基于同一个“候选迁移快照”启动。组织者需要先选择一种方式：

1. 建立只包含已确认 Radio/CoScroll 候选文件的 checkpoint commit；或
2. 为两个 worktree 提供同一个可读取的 patch bundle。

若 agent 的工作树里没有本计划“当前基线”列出的 Radio 文件，立即停止并请求 checkpoint；不要从旧 HEAD 猜测性重写，也不要把无关 LuBirth 实验一起提交。

---

## 1. 当前基线与事实

### 原仓库同步状态

- 原仓库：`/Users/aitoshuu/Documents/GitHub/radio-gaga`
- GitHub：`git@github.com:astroleno/radio-gaga.git`
- 本地 `main`：`b47453efa2d7f25c0a51468907e906d66fb18fba`
- `origin/main`：同一 SHA；规划审计时为 `0 ahead / 0 behind`。
- 原仓库只有一个未跟踪的恢复目录；业务源码与远端 main 同步。

### MiraLith 当前完成度

- `/radio-gaga` 已有可运行的独立叙事页。
- 已有单 Canvas、模型预检、SSR forced fallback、移动端布局与较完整 Playwright 覆盖。
- 当前候选视觉已经进入“radio 外壳 → 粒子/流程证据 → ESP32 → 家中一句话”的后半段重做。
- `pnpm verify` 在规划审计时通过，但当前候选 E2E 必须由执行 agent 重新跑，旧文档里的“30 passed”不能作为本次验收证据。
- `RadioGagaParticleTransition.tsx` 约 1000 行，且高/中/低粒子数当前分别为 9000 / 5600 / 2600；它是本次维护性与性能风险中心。
- 首页 `/` 仍只返回 `<LuBirthRevisedRoute variant="home" />`；Radio Gaga 尚未成为真实第二幕。

### 原项目可迁移的叙事事实

保留：

1. 附近发生的事被收集；
2. 人进行选择、排序与改写；
3. 内容被压缩成家里听得懂的一句话；
4. ESP32/收音机把这句话带回家；
5. 两张原项目截图作为“过程证据”，不是装饰背景。

不迁移：

- feed query、ListenHub 生成与轮询；
- preview/edit/publish 的真实业务调用；
- Jotai 内存状态、Cloudflare KV/D1、Worker/MCP；
- 硬件 bridge、真实音频播放、密钥、账号或环境变量；
- 原项目里尚未完成的搜索、设置、历史、反馈功能。

Radio Gaga 在 MiraLith 中是 case-study narrative，不是原产品的第二套运行时。

---

## 2. 目标文件结构

```text
apps/site/app/radio-gaga/page.tsx
apps/site/components/
  RadioGagaRoute.tsx
  RadioGagaExperience.tsx
  RadioGagaCopyLayer.tsx
  home/
    MiraLithHomeNarrative.tsx
    RadioGagaHomeChapter.tsx
    homeChapterRegistry.ts
    homeChapterTypes.ts
    useHomeChapterPresence.ts
apps/site/visual/scenes/
  RadioGagaSceneSlot.tsx
  HomeVisualSceneSlot.tsx
packages/radio-gaga-scene/src/
  RadioGagaSceneContent.tsx
  RadioGagaParticleTransition.tsx
  RadioGagaParticleField.tsx
  RadioGagaProofPlanes.tsx
  radioGagaParticleBudget.ts
  radioGagaParticleTargets.ts
  radioGagaParticleShader.ts
  radioGagaTimeline.ts
  radioGagaFinalOutput.ts
tests/e2e/
  radio-gaga.spec.ts
  radio-gaga-contract.spec.ts
  miralith.spec.ts
docs/migrations/
  radio-gaga-source-audit.md
  radio-gaga-acceptance.md
```

`RadioGagaParticleTransition.tsx` 最终只负责组合和帧驱动，目标不超过 350 行；纯数据生成、预算、shader 和 proof planes 必须拆开。

---

## 3. 完成定义

只有以下条件全部满足，才可声称“Radio Gaga 已迁移完成”：

- [ ] `/radio-gaga` 独立页保留完整叙事、单 Canvas、forced fallback 和模型失败 fallback。
- [ ] 首页顺序为 LuBirth → Radio Gaga；标题 rail/移动标题在第二幕显示 Radio Gaga active。
- [ ] 首页始终只有一个 `data-visual-canvas="production"`。
- [ ] 首页首屏没有请求 `radio_gaga.glb`、`xiaozhi_esp32.glb`、`website1.PNG` 或 `website2.png`。
- [ ] 接近第二幕才加载 Radio Gaga 场景；离开后 inactive scene 不改 camera/background/fog，也不继续昂贵的逐帧更新。
- [ ] reduced-motion、WebGL fallback、桌面、移动竖屏、移动横屏均可阅读。
- [ ] MiraLith 中没有原项目业务依赖、远端生成请求、音频运行时或凭据。
- [ ] 粒子性能达到本计划门槛，且 1000 行单文件被拆分。
- [ ] Radio 专属测试、首页测试、`pnpm verify`、`git diff --check` 全部通过。
- [ ] 结构性修改后 `/graphify --update` 成功；若命令在环境中不可用，明确记录而不是假装已更新。

---

## Task 1: 建立可重复的基线

**Files:**

- Inspect: `graphify-out/GRAPH_REPORT.md`
- Inspect: `apps/site/components/RadioGagaRoute.tsx`
- Inspect: `packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx`
- Inspect: `packages/radio-gaga-scene/src/RadioGagaParticleTransition.tsx`
- Inspect: `tests/e2e/radio-gaga.spec.ts`
- Create: `docs/migrations/radio-gaga-source-audit.md`

- [ ] **Step 1: 按项目协议查询知识图谱**

```bash
test -f graphify-out/graph.json || /graphify
/graphify query "Radio Gaga page scene homepage visual canvas"
/graphify path "RadioGagaRoute" "VisualCanvas"
/graphify explain "RadioGagaSceneContent"
```

Expected: 获得 community 35（Radio Gaga）到 community 27（Visual Canvas）的路径。若 `/graphify` 不存在，记录失败并先读 `graphify-out/GRAPH_REPORT.md`，再做定向 `rg`。

- [ ] **Step 2: 确认候选迁移文件确实存在**

```bash
git status --short
test -f packages/radio-gaga-scene/src/RadioGagaParticleTransition.tsx
test -f packages/radio-gaga-scene/src/radioGagaFinalOutput.ts
test -f apps/site/public/img/website1.PNG
test -f apps/site/public/img/website2.png
```

Expected: 四个 `test` 均退出 0。任一个失败就触发启动前硬门禁。

- [ ] **Step 3: 再确认原仓库与 GitHub 同步**

```bash
git -C /Users/aitoshuu/Documents/GitHub/radio-gaga fetch origin main
git -C /Users/aitoshuu/Documents/GitHub/radio-gaga rev-parse HEAD
git -C /Users/aitoshuu/Documents/GitHub/radio-gaga rev-parse origin/main
git -C /Users/aitoshuu/Documents/GitHub/radio-gaga status --short
```

Expected: 两个 SHA 都是 `b47453efa2d7f25c0a51468907e906d66fb18fba`。不要修改原仓库。

- [ ] **Step 4: 跑静态基线与专属 E2E**

```bash
pnpm verify
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts --workers=1
```

Expected: 两条命令退出 0。若 E2E 失败，先把失败截图/trace 记录为基线缺陷；不要带着不明失败开始重构。

- [ ] **Step 5: 写 source audit**

`docs/migrations/radio-gaga-source-audit.md` 至少写入：

```md
# Radio Gaga source audit

- Source repo: /Users/aitoshuu/Documents/GitHub/radio-gaga
- Source SHA: b47453efa2d7f25c0a51468907e906d66fb18fba
- Migration mode: static case-study narrative
- Runtime code allowed: none
- Evidence allowed: story facts, local screenshots, radio/ESP32 models
- Explicit exclusions: feed API, ListenHub, publish, KV/D1, MCP, hardware bridge, audio, credentials
```

- [ ] **Step 6: 提交审计**

```bash
git add docs/migrations/radio-gaga-source-audit.md
git commit -m "docs(radio-gaga): lock migration source boundary"
```

---

## Task 2: 用测试锁定“独立页已经差不多完成”的边界

**Files:**

- Modify: `tests/e2e/radio-gaga.spec.ts`
- Create: `tests/e2e/radio-gaga-contract.spec.ts`
- Modify: `apps/site/components/RadioGagaRoute.tsx`
- Modify: `apps/site/components/RadioGagaCopyLayer.tsx`

- [ ] **Step 1: 先添加 host 与业务隔离的失败测试**

在 `tests/e2e/radio-gaga-contract.spec.ts` 添加：

```ts
import { expect, test } from "@playwright/test";

test("standalone Radio Gaga is a local case study, not a live product runtime", async ({ page }) => {
  const remoteRuntimeRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== "http://127.0.0.1:3100" ||
      /api|listenhub|publish|mcp|worker|audio/i.test(url.pathname)
    ) {
      remoteRuntimeRequests.push(request.url());
    }
  });

  await page.goto("/radio-gaga");
  await expect(page.locator('[data-radio-gaga-host="standalone"]')).toBeVisible();
  await expect(page.getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true })).toBeVisible();
  expect(remoteRuntimeRequests).toEqual([]);
});
```

- [ ] **Step 2: 运行并确认它先失败**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga-contract.spec.ts --project=desktop --workers=1
```

Expected: 因 `data-radio-gaga-host` 尚不存在而失败；若它意外通过，检查测试是否真正命中当前 route。

- [ ] **Step 3: 只补语义标记，不改视觉**

在 `RadioGagaRoute` 的根节点增加：

```tsx
<main
  ref={routeRef}
  className="radio-gaga-route"
  data-radio-gaga-host="standalone"
  data-radio-gaga-runtime="case-study"
>
```

- [ ] **Step 4: 扩充现有 E2E 的五个稳定场景**

现有 `radio-gaga.spec.ts` 必须继续覆盖：

1. 顶部 radio 主角；
2. 人的筛选/改写过程；
3. 两张 proof frame；
4. ESP32 核心揭示；
5. 家中一句话结尾。

不要把测试绑死到粒子逐像素位置；测试 DOM copy、阶段 opacity、Canvas 非空、资产失败和 fallback。

- [ ] **Step 5: 跑专属测试**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts --workers=1
```

Expected: 全部通过。

- [ ] **Step 6: 提交契约**

```bash
git add apps/site/components/RadioGagaRoute.tsx tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts
git commit -m "test(radio-gaga): lock standalone migration contract"
```

---

## Task 3: 拆分粒子系统而不改变叙事

**Files:**

- Create: `packages/radio-gaga-scene/src/radioGagaParticleBudget.ts`
- Create: `packages/radio-gaga-scene/src/radioGagaParticleTargets.ts`
- Create: `packages/radio-gaga-scene/src/radioGagaParticleShader.ts`
- Create: `packages/radio-gaga-scene/src/RadioGagaProofPlanes.tsx`
- Create: `packages/radio-gaga-scene/src/RadioGagaParticleField.tsx`
- Modify: `packages/radio-gaga-scene/src/RadioGagaParticleTransition.tsx`
- Modify: `packages/radio-gaga-scene/src/index.ts`
- Modify: `tests/e2e/radio-gaga-contract.spec.ts`

- [ ] **Step 1: 先测试粒子预算**

在 contract test 中直接导入纯函数：

```ts
import { resolveRadioGagaParticleBudget } from "../../packages/radio-gaga-scene/src/radioGagaParticleBudget";

test("particle budget is bounded and reduced motion is static", () => {
  expect(resolveRadioGagaParticleBudget("high", false).count).toBeLessThanOrEqual(9000);
  expect(resolveRadioGagaParticleBudget("medium", false).count).toBeLessThanOrEqual(5600);
  expect(resolveRadioGagaParticleBudget("low", false).count).toBeLessThanOrEqual(2600);
  expect(resolveRadioGagaParticleBudget("fallback", false).count).toBe(0);
  expect(resolveRadioGagaParticleBudget("high", true).count).toBe(0);
});
```

- [ ] **Step 2: 运行并看到模块缺失失败**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga-contract.spec.ts --project=desktop --workers=1
```

Expected: import/module not found。

- [ ] **Step 3: 实现唯一预算入口**

`radioGagaParticleBudget.ts`：

```ts
import type { ResolvedQualityTier } from "@miralith/visual-core";

export interface RadioGagaParticleBudget {
  count: number;
  pointSize: number;
}

export function resolveRadioGagaParticleBudget(
  tier: ResolvedQualityTier,
  reducedMotion: boolean
): RadioGagaParticleBudget {
  if (reducedMotion || tier === "fallback") return { count: 0, pointSize: 0 };
  if (tier === "high") return { count: 9000, pointSize: 0.014 };
  if (tier === "medium") return { count: 5600, pointSize: 0.017 };
  return { count: 2600, pointSize: 0.023 };
}
```

后续性能测量如果不过门槛，只在这个文件下调，不允许在多个组件复制数字。

- [ ] **Step 4: 把纯目标生成移出 React 组件**

`radioGagaParticleTargets.ts` 对外只暴露：

```ts
export interface RadioGagaParticleTargets {
  radio: Float32Array;
  proofOne: Float32Array;
  proofTwo: Float32Array;
  esp32: Float32Array;
  home: Float32Array;
}

export interface CreateRadioGagaParticleTargetsInput {
  count: number;
  seed: number;
  radioSurface: Float32Array;
  esp32Surface: Float32Array;
  proofOnePixels: Uint8ClampedArray;
  proofTwoPixels: Uint8ClampedArray;
}

export function createRadioGagaParticleTargets(
  input: CreateRadioGagaParticleTargetsInput
): RadioGagaParticleTargets;
```

要求同一 `seed` 产生确定性结果；不要在 render/useFrame 中重建数组。

- [ ] **Step 5: 拆 shader、proof planes 与 particle field**

- `radioGagaParticleShader.ts`：vertex/fragment shader 字符串与 uniform 类型。
- `RadioGagaProofPlanes.tsx`：两张网站 proof texture 的几何与材质。
- `RadioGagaParticleField.tsx`：buffer attributes、material、`useFrame` 插值。
- `RadioGagaParticleTransition.tsx`：加载 radio/ESP32/proof 资源，构建 targets，组合两个子组件。

`RadioGagaParticleTransition.tsx` 不再包含大段 shader、像素读取器和目标采样实现。

- [ ] **Step 6: 删除每帧分配**

逐项确认 `useFrame` 内没有：

- `new Float32Array`；
- `Array.from`；
- `new Color` / `new Vector3`；
- texture canvas readback；
- 重复 traversal/sampler 建立。

- [ ] **Step 7: 检查行数和类型**

```bash
wc -l packages/radio-gaga-scene/src/RadioGagaParticleTransition.tsx
pnpm --filter @miralith/radio-gaga-scene typecheck
pnpm --filter @miralith/site typecheck
```

Expected: orchestration 文件不超过 350 行，两项 typecheck 退出 0。

- [ ] **Step 8: 回归视觉与测试**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts --workers=1
```

Expected: 所有既有故事阶段、fallback 和非空 Canvas 检查通过。

- [ ] **Step 9: 提交重构**

```bash
git add packages/radio-gaga-scene tests/e2e/radio-gaga-contract.spec.ts
git commit -m "refactor(radio-gaga): split particle transition pipeline"
```

---

## Task 4: 抽出独立页与首页共用的 chapter runtime

**Files:**

- Create: `apps/site/components/RadioGagaExperience.tsx`
- Create: `apps/site/components/useRadioGagaProgress.ts`
- Modify: `apps/site/components/RadioGagaRoute.tsx`
- Modify: `apps/site/components/RadioGagaCopyLayer.tsx`
- Modify: `tests/e2e/radio-gaga.spec.ts`

- [ ] **Step 1: 先给独立页添加复用边界测试**

```ts
test("standalone route exposes reusable chapter progress without nested canvases", async ({ page }) => {
  await page.goto("/radio-gaga");
  await expect(page.locator('[data-radio-gaga-experience="standalone"]')).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
});
```

- [ ] **Step 2: 运行并确认失败**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts --project=desktop --workers=1 -g "reusable chapter"
```

- [ ] **Step 3: 定义复用接口**

`RadioGagaExperience.tsx`：

```tsx
export interface RadioGagaChapterPresence {
  near: boolean;
  active: boolean;
}

export interface RadioGagaExperienceProps {
  host: "standalone" | "home";
  progressRef: React.MutableRefObject<number>;
  renderVisual?: (input: {
    progressRef: React.MutableRefObject<number>;
    active: boolean;
    near: boolean;
    assetState: "checking" | "ready" | "failed";
  }) => React.ReactNode;
  onPresenceChange?: (presence: RadioGagaChapterPresence) => void;
}
```

规则：

- `RadioGagaExperience` 拥有 DOM copy、章节 root、progress styles 和 asset preflight；
- `renderVisual` 传入时才允许由 host 决定 Canvas 放在哪里；
- `host="home"` 时组件本身绝不创建 Canvas；
- `host="home"` 的 asset preflight 必须等 `near=true` 才开始，避免 HEAD 请求偷跑到首页首屏；
- progress 每帧写入稳定 ref；React state 只保存 near/active/assetState 等离散状态。

- [ ] **Step 4: 把 GSAP 逻辑移到 hook**

`useRadioGagaProgress.ts` 输入 root ref、scroll distance、progress ref；输出 cleanup。必须：

- 使用唯一 ScrollTrigger id，包含 host；
- unmount 时 kill；
- 不在每次 progress 更新 setState；
- 仍调用当前 CSS variable mapper 与 finale output mapper。

- [ ] **Step 5: 用复用组件重写 standalone shell**

`RadioGagaRoute` 保持以下结构：

```tsx
export function RadioGagaRoute(props: RadioGagaRouteProps) {
  const progressRef = useRef(0);

  return (
    <RadioGagaExperience
      host="standalone"
      progressRef={progressRef}
      renderVisual={({ active, assetState }) => (
        <VisualCanvas decorative fallback={fallback}>
          <RadioGagaSceneSlot
            active={active && assetState === "ready"}
            progressRef={progressRef}
          />
        </VisualCanvas>
      )}
    />
  );
}
```

实际实现继续保留 forced fallback 的 SSR 一致性；不要用这段 skeleton 覆盖现有正确的 fallback 分支。

- [ ] **Step 6: 跑完整独立页测试**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts --workers=1
```

- [ ] **Step 7: 提交 chapter extraction**

```bash
git add apps/site/components/RadioGagaExperience.tsx apps/site/components/useRadioGagaProgress.ts apps/site/components/RadioGagaRoute.tsx apps/site/components/RadioGagaCopyLayer.tsx tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts
git commit -m "refactor(radio-gaga): extract reusable narrative chapter"
```

---

## Task 5: 由 Radio agent 建立共享首页骨架

**Files:**

- Create: `apps/site/components/home/homeChapterTypes.ts`
- Create: `apps/site/components/home/homeChapterRegistry.ts`
- Create: `apps/site/components/home/useHomeChapterPresence.ts`
- Create: `apps/site/components/home/MiraLithHomeNarrative.tsx`
- Create: `apps/site/components/home/RadioGagaHomeChapter.tsx`
- Modify: `apps/site/components/LuBirthRevisedRoute.tsx`
- Replace/Modify: `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- Modify: `apps/site/app/page.tsx`
- Modify: `apps/site/app/globals.css`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: 先写首页顺序与单 Canvas 的失败测试**

在 `tests/e2e/miralith.spec.ts` 增加：

```ts
test("homepage composes LuBirth then Radio Gaga in one production canvas", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('[data-home-chapter="lubirth"]')).toBeVisible();
  expect(await page.evaluate(() => {
    const lubirth = document.querySelector('[data-home-chapter="lubirth"]');
    const radio = document.querySelector('[data-home-chapter="radio-gaga"]');
    if (!(lubirth instanceof HTMLElement) || !(radio instanceof HTMLElement)) return false;
    return radio.offsetTop > lubirth.offsetTop;
  })).toBe(true);
  await expect(page.locator('[data-visual-canvas="production"]')).toHaveCount(1);
});
```

比较 DOM 顺序/offset，不硬编码整页像素距离。

- [ ] **Step 2: 运行并确认 Radio chapter 缺失**

```bash
CI=1 pnpm exec playwright test tests/e2e/miralith.spec.ts --project=desktop --workers=1 -g "LuBirth then Radio Gaga"
```

- [ ] **Step 3: 建立通用类型，预留 CoScroll 但不导入它**

`homeChapterTypes.ts`：

```ts
export type HomeSceneId = "lubirth" | "radio-gaga" | "coscroll";

export interface HomeChapterRuntime {
  id: HomeSceneId;
  near: boolean;
  active: boolean;
  progressRef: { current: number };
}

export interface HomeChapterDefinition {
  id: HomeSceneId;
  index: string;
  title: string;
  zh: string;
  en: string;
}
```

`homeChapterRegistry.ts` 初始只启用：

```ts
export const HOME_CHAPTERS: readonly HomeChapterDefinition[] = [
  { id: "lubirth", index: "01", title: "LuBirth", zh: "来处", en: "Arrival" },
  { id: "radio-gaga", index: "02", title: "Radio Gaga", zh: "照护", en: "Care" }
];
```

`"coscroll"` 只作为类型保留，不能在 Radio 分支加载 CoScroll package 或资产。

- [ ] **Step 4: 给 LuBirth 增加 render-slot，而不是复制 LuBirth**

在 `LuBirthRevisedRoute.tsx` 导出：

```tsx
export interface LuBirthVisualSlotProps {
  mode: "field";
  quality: "auto" | "medium" | "high";
  paused: boolean;
  cloudDeckEnabled: boolean;
  routeVariant: "home" | "study";
  homeIntroRendering: boolean;
  onProjectionFrame?: (frame: LuBirthProjectionFrame) => void;
  onVisualReadyEnough?: () => void;
  onMoonTextureReady?: () => void;
}

interface LuBirthRevisedRouteProps {
  variant?: "home" | "study";
  ariaLabel?: string;
  stageLabel?: string;
  activeChapterId?: HomeSceneId;
  renderVisualSlot?: (props: LuBirthVisualSlotProps) => React.ReactNode;
}
```

在现有唯一 `VisualCanvas` 内：

```tsx
{renderVisualSlot
  ? renderVisualSlot(lubirthVisualSlotProps)
  : <LuBirthSceneSlot {...lubirthVisualSlotProps} />}
```

约束：

- 不移动或重写 LuBirth loading/projection/readiness 状态机；
- `variant="study"` 行为完全不变；
- 不新增第二个 Canvas；
- active title rail 从 `activeChapterId` 派生，不再依赖模块级固定 `active: true`。

- [ ] **Step 5: 建立共享 scene slot**

`HomeVisualSceneSlot.tsx` 的 Radio 阶段契约：

```tsx
interface HomeVisualSceneSlotProps {
  activeScene: "lubirth" | "radio-gaga";
  lubirth: LuBirthVisualSlotProps;
  radio: HomeChapterRuntime;
  radioMounted: boolean;
}

export function HomeVisualSceneSlot(props: HomeVisualSceneSlotProps) {
  if (props.activeScene === "radio-gaga" && props.radioMounted) {
    return (
      <RadioGagaSceneSlot
        active={props.radio.active}
        progressRef={props.radio.progressRef}
      />
    );
  }

  return <LuBirthSceneSlot {...props.lubirth} />;
}
```

后续 CoScroll agent 会在 rebase 后扩展这里；Radio 分支不要提前导入 `@miralith/coscroll-scene`。

- [ ] **Step 6: 创建第二幕 DOM**

`RadioGagaHomeChapter.tsx`：

```tsx
export function RadioGagaHomeChapter({
  progressRef,
  onPresenceChange
}: {
  progressRef: React.MutableRefObject<number>;
  onPresenceChange: (presence: RadioGagaChapterPresence) => void;
}) {
  return (
    <section data-home-chapter="radio-gaga" id="radio-gaga">
      <RadioGagaExperience
        host="home"
        progressRef={progressRef}
        onPresenceChange={onPresenceChange}
      />
    </section>
  );
}
```

不要把 `RadioGagaRoute` 整页嵌进首页；home host 不得创建 Canvas。

- [ ] **Step 7: 组合首页**

`MiraLithHomeNarrative.tsx`：

```tsx
export function MiraLithHomeNarrative() {
  const radioProgressRef = useRef(0);
  const [radioPresence, setRadioPresence] = useState({ near: false, active: false });
  const activeScene = radioPresence.active ? "radio-gaga" : "lubirth";

  return (
    <>
      <LuBirthRevisedRoute
        variant="home"
        activeChapterId={activeScene}
        renderVisualSlot={(lubirth) => (
          <HomeVisualSceneSlot
            activeScene={activeScene}
            lubirth={lubirth}
            radio={{ id: "radio-gaga", ...radioPresence, progressRef: radioProgressRef }}
            radioMounted={radioPresence.near}
          />
        )}
      />
      <RadioGagaHomeChapter
        progressRef={radioProgressRef}
        onPresenceChange={setRadioPresence}
      />
    </>
  );
}
```

最终 `apps/site/app/page.tsx` 只返回 `<MiraLithHomeNarrative />`。

- [ ] **Step 8: 实现稳定的 near/active 规则**

`useHomeChapterPresence.ts` 使用 IntersectionObserver：

- near：`rootMargin: "150% 0px 150% 0px"`；
- active：章节中心进入视口中间 50%，或 intersection ratio 最大；
- 只在布尔值改变时 setState；
- 上下滚动都可回到 LuBirth；
- observer cleanup 完整。

- [ ] **Step 9: 跑 LuBirth 与首页回归**

```bash
CI=1 pnpm exec playwright test tests/e2e/miralith.spec.ts --project=desktop --workers=1
pnpm --filter @miralith/site typecheck
```

Expected: 现有 LuBirth 首屏、loading/readiness 测试不退化，新顺序与单 Canvas 测试通过。

- [ ] **Step 10: 提交首页骨架**

```bash
git add apps/site/app/page.tsx apps/site/components/home apps/site/components/LuBirthRevisedRoute.tsx apps/site/visual/scenes/HomeVisualSceneSlot.tsx apps/site/app/globals.css tests/e2e/miralith.spec.ts
git commit -m "feat(home): add shared narrative spine and Radio Gaga act"
```

---

## Task 6: 懒加载、场景仲裁与首屏预算

**Files:**

- Modify: `apps/site/components/home/MiraLithHomeNarrative.tsx`
- Modify: `apps/site/visual/scenes/HomeVisualSceneSlot.tsx`
- Modify: `apps/site/visual/scenes/RadioGagaSceneSlot.tsx`
- Modify: `packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: 先添加请求预算失败测试**

```ts
test("homepage defers Radio Gaga assets until the second act is near", async ({ page }) => {
  const radioAssets: string[] = [];
  page.on("request", (request) => {
    if (/radio_gaga|xiaozhi_esp32|website1|website2/i.test(request.url())) {
      radioAssets.push(request.url());
    }
  });

  await page.goto("/");
  await page.waitForTimeout(500);
  expect(radioAssets).toEqual([]);

  await page.locator('[data-home-chapter="radio-gaga"]').scrollIntoViewIfNeeded();
  await expect.poll(() => radioAssets.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: 运行并确认当前 eager import/load 会失败**

```bash
CI=1 pnpm exec playwright test tests/e2e/miralith.spec.ts --project=desktop --workers=1 -g "defers Radio Gaga"
```

- [ ] **Step 3: near 时才挂载 Radio scene**

可用 `React.lazy` + `Suspense` 或 Next dynamic；关键不是只拆 bundle，而是 near 之前 JSX 不得挂载 `RadioGagaSceneContent`。为 scene root 增加：

```tsx
<group
  visible={active}
  userData={{ sceneId: "radio-gaga", active }}
>
  {/* radio scene */}
</group>
```

在 `RadioGagaSceneSlot.tsx` 导出 `preloadRadioGagaSceneAssets()`，只预热 `radio_gaga.glb`、`xiaozhi_esp32.glb`、`website1.PNG`、`website2.png`。`radioPresence.near` 第一次变为 true 时调用一次；首屏不得调用。

- [ ] **Step 4: 修正 inactive 副作用**

`RadioGagaSceneContent` 必须满足：

- inactive 时不注册 pointer listener；
- inactive 时不改 `scene.background` / `scene.fog`；
- cleanup 恢复进入前的 background/fog；
- `useFrame` 第一行检查 active/paused；
- inactive 时 particle/proof children 不执行昂贵更新。

- [ ] **Step 5: 加 scene 诊断标记**

在共享 Canvas 外层或 scene arbiter 上暴露：

```tsx
data-home-scene={activeScene}
```

这是 E2E 和调试契约，不用于 CSS 选择视觉。

- [ ] **Step 6: 添加 scene switch 测试**

断言：

1. 首屏 `data-home-scene="lubirth"`；
2. 第二幕 `data-home-scene="radio-gaga"`；
3. 两处 Canvas count 都是 1；
4. 第二幕 Canvas 非空；
5. 返回顶部后重新是 LuBirth；
6. Radio scene inactive 后其 camera/background 不残留。

- [ ] **Step 7: 跑测试并提交**

```bash
CI=1 pnpm exec playwright test tests/e2e/miralith.spec.ts tests/e2e/radio-gaga.spec.ts --project=desktop --workers=1
git add apps/site/components/home/MiraLithHomeNarrative.tsx apps/site/visual/scenes/HomeVisualSceneSlot.tsx apps/site/visual/scenes/RadioGagaSceneSlot.tsx packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx tests/e2e/miralith.spec.ts
git commit -m "perf(home): lazy load and arbitrate Radio Gaga scene"
```

---

## Task 7: reduced motion、移动端和性能门槛

**Files:**

- Modify: `packages/radio-gaga-scene/src/radioGagaParticleBudget.ts`
- Modify: `packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx`
- Modify: `apps/site/components/RadioGagaExperience.tsx`
- Modify: `apps/site/app/globals.css`
- Modify: `tests/e2e/radio-gaga.spec.ts`
- Modify: `tests/e2e/miralith.spec.ts`

- [ ] **Step 1: 添加 reduced-motion 测试**

```ts
test("Radio Gaga reduced motion keeps the story readable without particles", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/radio-gaga");
  await expect(page.locator('[data-radio-gaga-motion="reduced"]')).toBeVisible();
  await expect(page.getByText("把附近发生的事，变成家里听得懂的一句提醒", { exact: true })).toBeVisible();
});
```

Reduced motion 可以保留静态 Canvas 或走 poster/DOM fallback，但 particle count 必须为 0，滚动不能触发剧烈模型变形。

- [ ] **Step 2: 添加桌面/移动关键阶段截图验收**

只为关键视觉验收使用 Playwright：

- 1440×960：radio、proof/process、ESP32、final；
- 412×915：opening、memory、final；
- 915×412：memory 与 step marker 不重叠；
- forced fallback。

截图放本地 review artifact，不默认提交二进制；最终接受结论写入 `docs/migrations/radio-gaga-acceptance.md`。

- [ ] **Step 3: 测量而不是猜粒子预算**

生产 build 后分别在 desktop 和 mobile-portrait 跑 10 秒中段动画，忽略前 2 秒 warm-up，采集 RAF delta。

门槛：

- desktop p95 frame delta ≤ 25ms；
- mobile p95 frame delta ≤ 33ms；
- warm-up 后不得有 >100ms 的连续长帧；
- 同一时刻只有一个 active R3F scene。

若失败，按 high → medium → low 顺序下调 `resolveRadioGagaParticleBudget`，不牺牲 proof 文本可读性来保粒子数量。

- [ ] **Step 4: 移动端布局验收**

确认：

- copy/step marker/proof strip 不相互遮挡；
- final sheet 保持在底部阅读区；
- 915×412 不把 ESP32 与 copy 同时挤出 viewport；
- touch scroll 不被 Canvas 捕获。

- [ ] **Step 5: 跑三项目专属 E2E**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts tests/e2e/miralith.spec.ts --workers=1
```

Expected: desktop、mobile-portrait、mobile-landscape 全部通过。

- [ ] **Step 6: 提交可访问性与性能**

```bash
git add packages/radio-gaga-scene/src/radioGagaParticleBudget.ts packages/radio-gaga-scene/src/RadioGagaSceneContent.tsx apps/site/components/RadioGagaExperience.tsx apps/site/app/globals.css tests/e2e/radio-gaga.spec.ts tests/e2e/miralith.spec.ts docs/migrations/radio-gaga-acceptance.md
git commit -m "perf(radio-gaga): meet motion and viewport budgets"
```

---

## Task 8: 最终验证与给 CoScroll agent 的合流交接

**Files:**

- Modify: `docs/radio-gaga/post-review-plan.md`
- Modify: `docs/migrations/radio-gaga-acceptance.md`
- Modify: `README.md` 或项目当前唯一的 roadmap 文档（若存在且已在本分支跟踪）

- [ ] **Step 1: 标记旧计划已被本计划取代**

不要删除历史；在旧 Radio 文档顶部加“Superseded by `docs/superpowers/plans/2026-07-11-radio-gaga-miralith-migration.md`”。

- [ ] **Step 2: 跑最终静态检查**

```bash
pnpm --filter @miralith/radio-gaga-scene typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site lint
pnpm build
git diff --check
```

Expected: 全部退出 0，build route 列表含 `/` 与 `/radio-gaga`。

- [ ] **Step 3: 跑最终专属测试**

```bash
CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts tests/e2e/radio-gaga-contract.spec.ts tests/e2e/miralith.spec.ts --workers=1
```

Expected: 三个 viewport project 全部通过，无 retry 后才通过的 flaky case。

- [ ] **Step 4: 跑全项目验证**

```bash
pnpm verify
```

- [ ] **Step 5: 更新知识图谱**

```bash
/graphify --update
/graphify path "RadioGagaSceneContent" "HomeVisualSceneSlot"
```

Expected: 新的 shared-home 路径可查询。若本机没有 `/graphify` 可执行文件，在 acceptance 文档写明“graph update blocked: executable unavailable”。

- [ ] **Step 6: 记录合流 SHA 和 CoScroll extension point**

在 acceptance 文档写：

```md
## CoScroll handoff

- Radio/home-spine merge commit: <SHA>
- Shared files now owned by merged home spine:
  - apps/site/components/home/homeChapterTypes.ts
  - apps/site/components/home/homeChapterRegistry.ts
  - apps/site/components/home/MiraLithHomeNarrative.tsx
  - apps/site/visual/scenes/HomeVisualSceneSlot.tsx
- CoScroll must rebase onto this SHA before editing shared files.
- Extension contract: add a HomeChapterRuntime, extend registry order, mount only when near, and preserve one Canvas.
```

- [ ] **Step 7: 最终提交**

```bash
git add docs/radio-gaga/post-review-plan.md docs/migrations/radio-gaga-acceptance.md README.md
git commit -m "docs(radio-gaga): record migration acceptance and CoScroll handoff"
```

---

## 停止条件

遇到以下任一情况，agent 应停在当前 task，报告证据，不扩大范围：

- 候选 Radio 文件没有进入 agent worktree；
- 为首页 render-slot 必须重写 LuBirth loading/projection 状态机；
- 独立页回归在重构前就失败且原因未知；
- 需要导入原 radio-gaga 的业务 runtime 或凭据才能继续；
- 首页出现第二个 Canvas；
- Radio 首屏资产无法通过 near-mount 延迟；
- shared home files 已被另一个 agent 并行修改但没有可 rebase 的 commit；
- 性能门槛失败且继续下调粒子后故事证据已不可读。

这些是需要协调的架构/产品阻塞，不允许用“最小化实现”跳过验收。
