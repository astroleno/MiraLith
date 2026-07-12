# LuBirth Atmosphere Spike Implementation Plan

状态：取证与决策合同 v0.3
日期：2026-05-08
范围：继续使用 `/lubirth-atmosphere-spike` 做取证；在 policy API、证据、视觉评分、技术 hardening、性能 gate 都通过之前，不进入 production promotion。

## 1. 结论

当前计划仍不能直接指导 `volumetric default` 或 `hybrid policy` 的 production promotion。它现在的定位是：

- 先把 stack、volumetric、split、fallback、production route、真实首屏 copy choreography 的证据矩阵补齐。
- 先定义 atmosphere policy owner / API，再决定 policy 是否能进入 production。
- 再用可复现评分规则决定 `stack default`、`volumetric default`、`hybrid policy` 或 `spike-only`。
- 最后只有在所有 acceptance gates 通过时，才进入 production wiring。

`hybrid policy` 不是第三种 renderer，也不是同时叠加 stack 和 volumetric。现有实现面仍然是二选一：`stack | volumetric`。Hybrid 只能表示“由一个明确 owner 根据明确输入选择其中一个 variant”。

## 2. 当前实现面

- Spike route：[apps/site/app/lubirth-atmosphere-spike/page.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/app/lubirth-atmosphere-spike/page.tsx:1)
- Spike controller：[apps/site/components/LuBirthAtmosphereSpikeRoute.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/components/LuBirthAtmosphereSpikeRoute.tsx:1)
- Production home route：[apps/site/app/page.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/app/page.tsx:1)
- Production study route：[apps/site/app/lubirth-revised/page.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/app/lubirth-revised/page.tsx:1)
- Production route component：[apps/site/components/LuBirthRevisedRoute.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/components/LuBirthRevisedRoute.tsx:1426)
- Production scene slot：[apps/site/visual/scenes/LuBirthSceneSlot.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/visual/scenes/LuBirthSceneSlot.tsx:394)
- Quality resolver：[packages/visual-core/src/quality/quality.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/visual-core/src/quality/quality.ts:62)
- Scene assembly：[packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:178)
- Existing stack：[packages/lubirth-hero/src/LandingAtmosphereStack.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingAtmosphereStack.tsx:1)
- Volumetric pass：[packages/lubirth-hero/src/LandingVolumetricAtmospherePass.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingVolumetricAtmospherePass.tsx:1)
- Shader port：[packages/lubirth-hero/src/volumetricAtmosphericScatteringShader.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/volumetricAtmosphericScatteringShader.ts:1)
- Spike E2E：[tests/e2e/lubirth-atmosphere-spike.spec.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/tests/e2e/lubirth-atmosphere-spike.spec.ts:1)
- Production E2E：[tests/e2e/lubirth-revised.spec.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/tests/e2e/lubirth-revised.spec.ts:1)

## 3. 非目标

- 不修复本次 review 中用户明确要求忽略的 two hooks lint findings。
- 不引入 Babylon，不把 LuBirth 切成 Babylon post-process 架构。
- 不复制 GPL-3.0 shader 代码；当前 volumetric source 只能来自已标注的 Apache-2.0 upstream port 或重新推导。
- 不在没有 policy API、截图、fallback、hardening、性能、production route 证据的情况下把 `volumetric` 设为正式默认。
- 不把 `split` 带入 production；`split` 只用于 spike A/B。
- 不顺手改 RadioGaga、CoScroll 或其他首屏以外的未完成工作。

## 4. Policy API Gate

进入任何 production promotion 前，必须先完成一个小的 policy API spike。原因：`hybrid policy` 依赖 resolved quality tier、reduced-motion、mobile-landscape、home-intro medium state、render profile、requested quality，但这些输入今天分散在 route 和 `LuBirthSceneSlot` 里。

Allowed owner options：

### Option A：Slot-owned resolver

`LuBirthRevisedRoute` 只声明 production 意图，例如 `atmospherePolicy="stack" | "volumetric" | "hybrid"`，并把 route-only context 传给 `LuBirthSceneSlot`，例如：

```ts
interface LuBirthAtmospherePolicyContext {
  routeVariant: "home" | "study";
  homeIntroRendering: boolean;
  productionSurface: boolean;
}
```

`LuBirthSceneSlot` 在拿到 `qualityProfile`、`reducedMotion`、`activeRenderProfile` 后调用纯函数 resolver，并把 resolved `atmosphereVariant` / `atmosphereLook` 传给 `EarthMoonScene`。

### Option B：Route-owned resolver with lifted runtime inputs

把 `useReducedMotionPreference`、`useQualityTier` 或等价 runtime input 提升到 `LuBirthRevisedRoute`，route 调用同一个纯函数 resolver，再把 resolved `atmosphereVariant` / `atmosphereLook` 传给 `LuBirthSceneSlot`。

### Required resolver contract

无论选 A 还是 B，都必须先落一个纯函数并单测：

```ts
interface LuBirthAtmospherePolicyInput {
  policy: "stack" | "volumetric" | "hybrid";
  routeVariant: "home" | "study" | "spike";
  renderProfile: LandingRenderProfile;
  requestedQuality: LandingQuality;
  resolvedQualityTier: "high" | "medium" | "low" | "fallback";
  reducedMotion: boolean;
  mobileLandscape: boolean;
  homeIntroRendering: boolean;
  productionSurface: boolean;
  productionLook: LandingAtmosphereLook;
}

interface LuBirthAtmospherePolicyResult {
  atmosphereLook: LandingAtmosphereLook;
  atmosphereVariant: LandingAtmosphereVariant;
  reason: string;
}
```

Policy rules：

- Explicit `quality=medium/high` does not bypass mobile or reduced-motion safety on production surfaces.
- `homeIntroRendering` always resolves to `stack` until a separate home-intro performance and readability gate passes.
- `debug-*` render profiles resolve to `stack` unless the evidence matrix explicitly covers that debug mode.
- `productionLook` must be declared before scoring. Promotion evidence must use the same look in spike and production.
- The resolver must expose `reason` to tests or debug globals so production assertions can verify policy branches.

## 5. Decision Outcomes

### Stack Default

语义：production 继续走 `stack`。Volumetric 只保留在 spike route，视觉结论回填到 `LandingAtmosphereStack` / `LandingEarth` 的 shader polish backlog。

生产要求：

- `LuBirthSceneSlot` 默认继续是 `stack`。
- `/` 和 `/lubirth-revised` 不新增 volumetric production wiring。
- 保留 spike route 作为后续比较工具。

### Volumetric Default

语义：production 的 LuBirth first-screen 默认使用 `volumetric`，但低档和受限设备必须回退 `stack`。

最低 production contract：

- `quality=high` desktop / laptop：`volumetric`。
- `quality=medium`：必须有截图、pixel smoke 和 performance 证据后才能允许；否则回退 `stack`。
- `quality=low` / `fallback`：`stack`。
- mobile landscape：默认 `stack`。只有单独批准后，才允许 production mobile 使用 `volumetric`。
- production look 必须显式选择 `lubirth` 或 `reference`，并且 spike scoring 与 production screenshots 使用同一个 look。

### Hybrid Policy

语义：policy owner 根据明确条件选择 `stack | volumetric`，没有第三个 renderer。

v0.3 允许的唯一 hybrid contract：

- `/` 和 `/lubirth-revised` 在 `renderProfile=nasa`、resolved quality tier 为 `high`、非 reduced-motion、非 home intro rendering、非 mobile landscape、production look 已声明且已取证时选择 `volumetric`。
- 其他所有情况选择 `stack`，包括 `medium`、`low`、`fallback`、mobile landscape、debug route、home intro rendering，以及 look 未匹配的证据。
- `atmo=split` 仍然只属于 `/lubirth-atmosphere-spike`。

如果实现者想采用其他 hybrid 语义，必须先更新本合同和对应测试，不允许在代码里临场发明。

### Spike Only

语义：不 promotion。保留 route、测试和截图矩阵，继续把 volumetric 当作取证工具。

适用条件：

- Policy API 未定义或 resolver 测试不足。
- 视觉评分不明显优于 stack。
- hardening、performance 或 fallback gate 未通过。
- production route wiring 会扩大风险但没有足够收益。

## 6. Acceptance Gate 总览

进入 production wiring 前，必须全部满足：

- Policy API gate 完成，resolver owner、input、output、reason 和测试都明确。
- Phase 1 evidence matrix 完整，包含 stack / volumetric / split / fallback / production route / visible copy choreography。
- Phase 2 visual scorecard 有明确 owner、分数、结论和 tie-breaker。
- Phase 3 hardening checklist 全部通过。
- Phase 4 performance gate 全部通过。
- mobile landscape explicit `medium` 行为已经定义并测试。
- `/` 和 `/lubirth-revised` 的 production caller 都纳入验证目标。

任一 gate 未满足时，允许继续取证，但不允许 promotion。

## 7. Phase 1：证据冻结

目的：补齐当前 volumetric-heavy evidence，让最终 decision 不是只看一条路径。

Look rule：

- Promotion candidate 必须先声明 `productionLook = "lubirth" | "reference"`。
- Spike promotion URLs 必须显式带 `look=<productionLook>`。
- `look=reference` 可以继续作为探索证据，但不能给 `look=lubirth` 的 production promotion 背书，反之亦然。

必须新增或确认的截图 / assertion matrix：

| Surface | Params | Expected variant | Evidence |
| --- | --- | --- | --- |
| Spike desktop stack close | `/lubirth-atmosphere-spike?atmo=stack&look=<productionLook>&quality=high&progress=0&copy=hidden&visualTest=pixels` | `stack` | screenshot + `stack active=true` + `volumetric active=false` |
| Spike desktop stack transition | `atmo=stack&look=<productionLook>&quality=high&progress=0.5` | `stack` | screenshot |
| Spike desktop stack far | `atmo=stack&look=<productionLook>&quality=high&progress=1` | `stack` | screenshot |
| Spike desktop volumetric close | `atmo=volumetric&look=<productionLook>&quality=high&progress=0` | `volumetric` | screenshot + pixel smoke |
| Spike desktop volumetric transition | `atmo=volumetric&look=<productionLook>&quality=high&progress=0.5` | `volumetric` | screenshot |
| Spike desktop volumetric far | `atmo=volumetric&look=<productionLook>&quality=high&progress=1` | `volumetric` | screenshot |
| Spike split A/B | `atmo=split&look=<productionLook>&quality=high&progress=0` | two canvases | screenshot with both panes visible; no single global variant assertion |
| Spike medium desktop | `atmo=volumetric&look=<productionLook>&quality=medium&progress=0` | `volumetric` on desktop review surface | screenshot + resolved variant |
| Spike low fallback | `atmo=volumetric&look=<productionLook>&quality=low&progress=0` | `stack` | screenshot + fallback assertion |
| Spike mobile auto | mobile-landscape, `atmo=volumetric&look=<productionLook>` | `stack` | assertion |
| Spike mobile medium | mobile-landscape, `atmo=volumetric&look=<productionLook>&quality=medium` | `stack` for safe policy | new assertion; current behavior must be fixed or explicitly rejected |
| Spike mobile high | mobile-landscape, `atmo=volumetric&look=<productionLook>&quality=high` | `volumetric` for spike-only review | screenshot + assertion |
| Production canvas baseline | `/lubirth-revised?progress=0&copy=hidden&profile=nasa&visualTest=pixels` | current `stack` | screenshot + production flags |
| Production canvas candidate | same route after candidate wiring | contract-dependent | screenshot + production flags |
| Study visible baseline | `/lubirth-revised?copy=visible&profile=nasa` | current `stack` | before screenshot + title/copy readability |
| Study visible candidate | same route after candidate wiring | contract-dependent | after screenshot + title/copy readability + policy reason |
| Home visible baseline | `/?copy=visible` | current `stack` during home intro | before screenshot + loading/title/copy choreography |
| Home visible candidate | same route after candidate wiring | `stack` during home intro unless separately approved | after screenshot + policy reason + no occlusion |
| Home hidden canvas candidate | `/?progress=0&copy=hidden&profile=nasa&visualTest=pixels` if supported by route params | contract-dependent | screenshot or explicit reason route cannot be used |

Exit criteria:

- Every required row has a screenshot path or an explicit blocker note.
- Non-split expected variants are asserted through `window.__MiraLithLuBirthAtmosphereVariant`, `__MiraLithLuBirthAtmosphereStackActive`, and `__MiraLithLuBirthVolumetricAtmosphereActive`.
- Split evidence is exempt from single global variant assertions because both panes write the same global flags. It must use DOM pane assertions (`[data-atmo-pane="stack"]`, `[data-atmo-pane="volumetric"]`) and screenshot evidence, or first add pane-scoped instrumentation.
- Existing Playwright screenshot coverage must be expanded beyond the current volumetric-heavy set before any default decision.
- Known gap: current code may allow explicit `quality=medium` on mobile landscape to reach `volumetric`; under v0.3 safe policy this is a failing gate until fixed or the contract is intentionally changed with tests.

## 8. Phase 2：视觉判分

目的：让视觉判断可复查，而不是“看起来更好”。

Owner：

- Implementer captures screenshots and fills the scorecard.
- Reviewer or design owner scores independently. If the same person does both roles, scoring must happen after evidence capture and cite screenshot names.

Crop regions:

- `close-limb`: progress `0`, bottom half of frame where Earth limb enters.
- `transition-limb`: progress `0.5`, full frame plus Earth limb crop.
- `far-frame`: progress `1`, full frame.
- `moon-field`: upper/right moon area when moon is visible.
- `black-field`: darkest empty sky quadrant.
- `copy-visible-home`: first viewport with loading/title/copy visible.
- `copy-visible-study`: study route first viewport with title/copy visible.

Score each candidate against stack baseline using `0 = worse`, `1 = equivalent`, `2 = better`:

- Inner white line thinness and continuity.
- Blue shelf thickness without dirty wash.
- Outer halo readability without black-field contamination.
- Earth surface and cloud readability.
- Moon non-interference.
- Transition and far-frame decay.
- Mobile landscape stability.
- Visible copy readability and non-occlusion.

Fail-fast conditions:

- Canvas blank, wrong canvas count, or wrong resolved variant.
- `quality=low` resolves to `volumetric`.
- mobile landscape explicit `medium` resolves to `volumetric` while safe policy is in force.
- Moon edge gets visible atmospheric contamination.
- Black field becomes visibly blue or milky in the screenshot crop.
- Home intro title/copy/loading choreography becomes unreadable, occluded, or policy-wrong.
- Spike `look` and production `atmosphereLook` differ for promotion evidence.
- Reviewer cannot map the score to screenshot evidence.

Decision thresholds:

- `volumetric default`: no fail-fast, all Phase 1 rows complete, Phase 3 and Phase 4 pass, score is at least `13/16`, and total is at least `+2` over stack baseline.
- `hybrid policy`: same visual superiority threshold as `volumetric default` for the subset where hybrid chooses volumetric, no fail-fast in that subset, all non-volumetric subsets explicitly choose stack, and production route tests cover both sides of the policy.
- `stack default`: volumetric is equivalent, worse, or lacks evidence.
- `spike-only`: evidence incomplete, policy API incomplete, hardening incomplete, performance incomplete, or visual score is disputed.

Tie-breaker:

- If the score is within `1` point of stack baseline, choose `stack default` or `spike-only`.
- If mobile, production, visible-copy, or look-matched evidence is missing, choose `spike-only`.

## 9. Phase 3：Technical Hardening

目的：只处理会影响 promotion 的稳定性问题，不碰已忽略 lint finding。

Checklist：

- `WebGLRenderTarget` 和 `DepthTexture` resize / dispose 在 repeated navigation 或 viewport resize 后稳定。
- `toneMapped=false` 与 shader 内 ACES 没有 double tone mapping 迹象。
- depth unprojection 在 desktop、laptop、mobile landscape 视口下保持近地 frame 可见。
- `quality=low` 固定回退 `stack`。
- mobile landscape `quality=medium` 行为按本合同测试；v0.3 safe policy 要求回退 `stack`。
- split mode 双 canvas 只用于评估，不进入 production。
- Browser console 没有新增 WebGL resource、shader compile、React runtime error。
- Pixel smoke 至少覆盖 volumetric desktop high / medium 和 low fallback。
- Policy resolver exposes the selected variant and reason for production tests.

Exit criteria：

- Checklist 全部通过，或明确选择 `stack default` / `spike-only`。
- 任何 hardening failure 都不能被 Phase 2 视觉评分覆盖。

## 10. Phase 4：Performance Gate

目的：防止 visually correct 但 first-screen 太贵的方案进入 production。Volumetric 是 render-target + fullscreen pass，production DPR 可到 `[1.5, 2.1]`，必须有量化预算。

Measurement surfaces：

- Spike desktop stack high and volumetric high, same viewport, same `productionLook`。
- Production study visible candidate。
- Production home visible candidate during home intro and after intro.
- Mobile landscape high only作为 spike review；production mobile 默认 stack。

Budgets：

- Desktop high volumetric median RAF delta must be `<= 24ms` and p95 `<= 40ms` after warm-up.
- Volumetric must not be more than `25%` worse than stack baseline on the same machine / viewport.
- Home intro visible candidate must not introduce long visible stalls; no RAF delta over `100ms` after the first warm-up second.
- If medium production ever allows volumetric, it needs its own budget: median `<= 28ms`, p95 `<= 50ms`, and no more than `25%` worse than stack.
- Any measurement affected by wrong server, wrong branch, or hidden tab is invalid.

Exit criteria：

- Performance numbers are recorded in the decision record.
- Failure chooses `stack default` or `spike-only`; visual score cannot override performance failure.

## 11. Phase 5：Production Wiring

只有 Policy API gate、Phase 1、Phase 2、Phase 3、Phase 4 全部通过，且 decision 是 `volumetric default` 或 `hybrid policy` 时，才能进入本阶段。

最小改动：

- Do not put unresolved policy logic directly in [apps/site/components/LuBirthRevisedRoute.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/components/LuBirthRevisedRoute.tsx:1476). First choose Option A or Option B from Policy API Gate.
- If Option A is chosen, `LuBirthRevisedRoute` passes policy intent and route context; `LuBirthSceneSlot` resolves using actual runtime inputs.
- If Option B is chosen, `LuBirthRevisedRoute` owns the runtime hooks and passes resolved `atmosphereVariant` / `atmosphereLook`.
- 不把 [apps/site/visual/scenes/LuBirthSceneSlot.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/visual/scenes/LuBirthSceneSlot.tsx:394) 的默认值从 `stack` 改成 `volumetric`。
- [packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:213) 已有 `low` / `fallback` 回退逻辑；只有证据要求时才改这里。
- `/` 通过 [apps/site/app/page.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/app/page.tsx:1) 使用 `LuBirthRevisedRoute variant="home"`，必须作为 production verification target。
- `/lubirth-revised` 通过 [apps/site/app/lubirth-revised/page.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/app/lubirth-revised/page.tsx:1) 使用 `LuBirthRevisedRoute variant="study"`，必须作为 study verification target。
- 保留 `/lubirth-atmosphere-spike` 作为回归评估路由，不把它当成用户主入口。

验收：

- Production route 变更有 before / after screenshots for `copy=hidden` canvas and `copy=visible` first screen。
- `tests/e2e/lubirth-revised.spec.ts` 覆盖 production resolved variant and policy reason。
- Spike tests 继续覆盖 `stack` 回退和 `volumetric` pass。
- 旧 stack 路径仍可通过明确 policy 或参数回退。

## 12. Phase 6：验证命令

Clean-tree reproducible order：

```bash
pnpm --filter @miralith/site build
pnpm --filter @miralith/site typecheck
pnpm exec playwright test tests/e2e/lubirth-atmosphere-spike.spec.ts --project=desktop
pnpm exec playwright test tests/e2e/lubirth-atmosphere-spike.spec.ts --project=mobile-landscape
pnpm exec playwright test tests/e2e/lubirth-revised.spec.ts --project=desktop
```

`apps/site/tsconfig.json` includes `.next/types/**/*.ts`, so `pnpm --filter @miralith/site typecheck` is not clean-tree reproducible until Next has generated `.next/types`. Run `pnpm --filter @miralith/site build` first, or run a Playwright webServer build that is known to be on the current branch before typecheck.

如 `127.0.0.1:3100` 被占用，先释放端口或确认已有服务就是当前分支，再设置 `PLAYWRIGHT_REUSE_SERVER=1`。不能在错误服务上接受截图证据。

`pnpm --filter @miralith/site lint` 当前可能会被本次 review 中已忽略的 hooks lint findings 阻塞；本计划不把 lint 当作 atmosphere decision gate，除非后续决定单独处理 lint cleanup。

## 13. 风险与应对

| 风险 | 应对 |
| --- | --- |
| Hybrid 被理解成第三种 renderer | 明确 hybrid 只是 binary resolver，并先做 Policy API gate |
| Route 想用它拿不到的 runtime inputs | 选择 Slot-owned resolver 或把 runtime hooks lift 到 route |
| 只看 volumetric-heavy screenshots 就 promotion | Phase 1 要求 stack / split / fallback / production / visible-copy matrix |
| `copy=hidden` 掩盖真实首屏问题 | 必须补 `/` 和 `/lubirth-revised` 的 `copy=visible` before / after |
| Spike look 和 production look 不一致 | Promotion scoring 必须显式 `look=<productionLook>` |
| Split globals last-writer-wins | Split 只用 pane DOM assertions 或 pane-scoped instrumentation |
| Hybrid 在视觉无优势时仍 promotion | Hybrid volumetric subset 必须满足同等 visual superiority threshold |
| Volumetric 太贵 | Phase 4 performance budget 独立 gate |
| Typecheck 在 clean tree 失败 | build / `.next/types` generation before typecheck |
| Mobile explicit medium 误进 volumetric | v0.3 safe policy 要求 mobile medium 回退 stack，并新增测试 |
| 已忽略 lint finding 继续挡 merge | 本计划记录为 out-of-scope，后续如要合并再单独开 lint cleanup |

## 14. 决策记录模板

实施者完成 Policy API gate 和 Phase 1 到 Phase 4 后，把结论补回本文件或同目录新建 review note：

```text
Decision: stack default | volumetric default | hybrid policy | spike-only
Date:
Implementer:
Visual reviewer:
Policy API:
- Owner: slot-owned | route-owned
- Resolver tests:
- Production look:
Evidence:
- Stack desktop high:
- Volumetric desktop high:
- Split desktop high:
- Desktop medium:
- Low fallback:
- Mobile auto:
- Mobile medium:
- Mobile high:
- Production canvas baseline:
- Production canvas candidate:
- Home visible baseline:
- Home visible candidate:
- Study visible baseline:
- Study visible candidate:
Score:
- Inner white line:
- Blue shelf:
- Outer halo:
- Earth/cloud readability:
- Moon non-interference:
- Transition/far decay:
- Mobile stability:
- Visible copy readability:
Hardening:
- Resize/dispose:
- Tone mapping:
- Depth unprojection:
- Console/WebGL:
- Policy reason:
Performance:
- Stack median/p95:
- Volumetric median/p95:
- Regression %:
- Home intro max delta:
Reason:
Follow-up:
```
