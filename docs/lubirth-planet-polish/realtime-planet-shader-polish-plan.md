# LuBirth Realtime Planet Shader Polish Borrowing Plan

状态：Spike review update v0.4
日期：2026-05-08
范围：只讨论 LuBirth 地球效果的细节打磨与 shader polish，不做渲染架构重写。

## 0. 2026-05-07 Spike 结论

LuBirth atmosphere spike 已经不是“待验证方案”，而是一个可以评估的实现切片：

- 独立评估路由已落地：[apps/site/app/lubirth-atmosphere-spike/page.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/app/lubirth-atmosphere-spike/page.tsx:1)
- 路由支持 `atmo=stack|volumetric|split`，可做旧 stack、新 volumetric 和左右 split A/B：[apps/site/components/LuBirthAtmosphereSpikeRoute.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/components/LuBirthAtmosphereSpikeRoute.tsx:1)
- Three / R3F 版 `LandingVolumetricAtmospherePass` 已落地，没有引入 Babylon runtime：[packages/lubirth-hero/src/LandingVolumetricAtmospherePass.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingVolumetricAtmospherePass.tsx:1)
- shader port 已落到独立文件，并标注 Apache-2.0 upstream 与 Three/R3F 差异：[packages/lubirth-hero/src/volumetricAtmosphericScatteringShader.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/volumetricAtmosphericScatteringShader.ts:1)
- 质量分级、低档回退、mobile landscape 显式 high 才启用 volumetric，以及截图矩阵已有 Playwright 覆盖：[tests/e2e/lubirth-atmosphere-spike.spec.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/tests/e2e/lubirth-atmosphere-spike.spec.ts:1)

本次 review 提到的两个 hooks lint finding 已按请求标记为忽略项：`LuBirthAtmosphereSpikeRoute` 的同步 config setState，以及 `LuBirthSceneSlot` 的 cached-location state sync 不进入这份视觉 / shader polish 计划，也不作为下一轮视觉决策 blocker。

因此，第 10 节的“下一步”已经从“先做 lookdev spike”改为“评估并收敛已落地 spike，然后决定是否进入正式 LuBirth 首屏路径”。

2026-05-08 复核结论：当前 spike 只能继续作为取证框架，不能直接作为默认方案 promotion 计划。进入 production 前，必须先补齐 policy owner / API、hybrid 语义、production route wiring、stack/split/fallback/production 截图矩阵、真实首屏 `copy=visible` 证据、spike / production look parity、mobile explicit medium 规则、性能预算，以及 evidence / visual scoring / hardening / performance acceptance gates。具体合同见同目录 implement plan。

## 1. 目标

在保留 LuBirth 现有 `R3F + sphere mesh + 多层 compositing` 架构的前提下，吸收 `jsulpis/realtime-planet-shader` 里对地球边缘、大气、云层阈值、地表起伏和整体调色有帮助的做法，把当前画面从“层很多但略分裂”推进到“层次统一、近景更稳、远景更克制”的状态。

这份计划的重点不是“把外部项目搬进来”，而是“提炼其中适合 LuBirth 的细节模型，然后用 LuBirth 自己的实现语言重写”。

## 2. 核心判断

### 2.1 可以借什么

- 外部项目的解析式 planet edge / atmosphere falloff 思路。
- 以隐式球半径扰动为基础的起伏法线思路。
- 云层 coverage threshold、云影过渡和暗面发光的统一处理思路。
- 在单个 shader 内部完成更多 tone / contrast discipline 的习惯。

### 2.2 不该借什么

- fullscreen quad + fragment raycast 整体架构。
- `Astro + four` 的 renderer、page、loader 组织方式。
- 直接复制 GPL-3.0 shader 源码。

### 2.3 对 LuBirth 的实际价值

- 主要价值：统一视觉逻辑。
- 次要价值：补足近地弧线、大气边缘、地表 relief 这些微妙但决定“高级感”的细节。
- 不适合作为整套替换方案。

## 3. 现有基线

当前 LuBirth 的地球相关实现已经是多层结构，不是单一 surface shader：

- 地球表面：[packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:58)
- 云层壳体：[packages/lubirth-hero/src/LandingCloudLayer.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingCloudLayer.tsx:490)
- 大气层栈：[packages/lubirth-hero/src/LandingAtmosphereStack.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingAtmosphereStack.tsx:100)
- 场景装配：[packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:571)
- lookdev 入口：[apps/site/visual/scenes/LuBirthLookdevSceneSlot.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/visual/scenes/LuBirthLookdevSceneSlot.tsx:318)

当前主要问题不是“没做”，而是以下几层的视觉模型还没有完全收拢：

- `LandingEarth` 自己已经有 rim / haze / glint / city glow。
- `LandingAtmosphereStack` 另外做了一套大气边缘。
- `LandingProjectedLimbScattering` / `LandingProjectedHorizonComposite` 又是一条屏幕空间方向，但正式路径未启用。
- 新增 `LandingVolumetricAtmospherePass` 现在提供了一条 post-process volumetric atmosphere 对照路径，可通过 spike 路由与 stack 做隔离比较。

这正是外部参考最值得帮助的地方。

## 4. 借鉴原则

### 4.1 保持架构

继续使用真实球体、真实相机、真实 moon placement，不切到 fullscreen fake planet。

### 4.2 只做 polish，不做大拆

优先改局部 shader 数学和参数组织，不重写整个 scene assembly。

### 4.3 高低档一致

`high` 档可以吃到最多细节，但 `medium` 也必须保留核心提升。`low` / `fallback` 只允许少细节，不允许风格断裂。

### 4.4 先视觉统一，再追求更“物理”

LuBirth 的目标不是纯物理正确，而是“NASA-photo but disciplined”的诗性现实感。所有借鉴都要服从这个目标。

### 4.5 许可证安全

外部仓库是 `GPL-3.0`。本计划只允许：

- 记录思路
- 重新推导
- 重新实现

不允许：

- 复制片段后小改
- 直接搬 uniform 命名和结构当作源码使用
- 把外部 shader 文本直接并入仓库

## 5. 优先级排序

### P0：建立 polish 基线

目的：先把当前 LuBirth 的可对比基线固定下来，否则后续所有“更好看了”都容易失真。

涉及文件：

- [apps/site/visual/scenes/LuBirthLookdevSceneSlot.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/visual/scenes/LuBirthLookdevSceneSlot.tsx:318)
- [packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:152)

要做的事：

- 固定 `clouds` / `atmosphere` / `projection` 这几个 pass 的对比截图矩阵。
- 固定至少三种观察点：近地、过渡、中远景。
- 把“clean”和“nasa”两条正式路径都纳入对比。

验收：

- 能稳定复现当前基线截图。
- 后续每次改动都能直接做前后对照。

### P1：大气边缘统一

目的：基于已落地的 atmosphere spike，判断 LuBirth 的正式大气路径应继续使用 stack、转向 volumetric，还是采用已定义的 hybrid policy；随后把 `LandingEarth`、`LandingAtmosphereStack` 与可选 `LandingVolumetricAtmospherePass` 的边缘语言收束成同一种视觉逻辑。

建议重点：

- 借鉴外部项目的解析式 edge distance / sun falloff 思路。
- 保留 LuBirth 现有的三层感受：
  - 内侧白线
  - 蓝色厚度层
  - 外侧极弱 halo
- 但把它们统一到一组共享判断，而不是各自长各自的。

涉及文件：

- [packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:336)
- [packages/lubirth-hero/src/LandingAtmosphereStack.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingAtmosphereStack.tsx:147)
- [packages/lubirth-hero/src/LandingVolumetricAtmospherePass.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingVolumetricAtmospherePass.tsx:1)
- [packages/lubirth-hero/src/volumetricAtmosphericScatteringShader.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/volumetricAtmosphericScatteringShader.ts:1)
- [packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:694)

要避免的事：

- 再加一层新的“大气蓝边”去掩盖问题。
- 让近景边缘变得更厚更脏。
- 让远景 halo 抢掉月球边缘。

验收：

- 近地帧边缘更薄、更亮、更连续。
- 中远景仍可见，但存在感收敛。
- `LandingEarth` 的 rim 与 `LandingAtmosphereStack` 的 surface glow 不再互相打架。
- spike screenshot matrix 明确记录 `stack`、`volumetric`、`split` 三条路径的结论，并给出“是否 promotion”的决定。

### P2：地表 relief 与海洋高光统一

目的：提升地表“是真的球体而不是贴图球”的可信度。

建议重点：

- 借鉴外部项目“由位移/亮度变化重新估计 normal”的思路，但只在 LuBirth 的 mesh shader 里重写。
- 继续保留你们已有 normal / displacement 贴图入口，不改资源契约。
- 强化海洋 glint 与 relief 的关系，让高光更像贴着曲面走，而不是简单加白。

涉及文件：

- [packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:314)
- [packages/lubirth-hero/src/assetManifest.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/assetManifest.ts:125)

具体方向：

- `high` 档优先尝试更统一的 normal mixing。
- `medium` 档可保留简化版，不强求完整位移细节。
- 只在 close stage 提升 relief 感，避免远景噪点化。

验收：

- 近景大陆和海洋的表面转折更清楚。
- 海洋高光更贴近太阳方向与曲率关系。
- 不新增明显闪烁、锯齿或 moire。

### P3：云层阈值、体积感和地表云影 polish

目的：让云层读感更稳，不只是“有云贴图”，而是“有层次、有厚度、有遮挡逻辑”。

建议重点：

- 借鉴外部 Earth shader 的 cloud threshold / smoothness 逻辑。
- 把当前 surface cloud、cloud shell、cloud shadow 三者的阈值关系理顺。
- 优先让日侧云顶和晨昏线附近的厚度成立，再修微小噪声细节。

涉及文件：

- [packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:298)
- [packages/lubirth-hero/src/LandingCloudLayer.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingCloudLayer.tsx:146)
- [packages/lubirth-hero/src/LandingCloudLayer.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingCloudLayer.tsx:537)

细节目标：

- 云层 core 更稳，边缘更软，不发灰。
- 云影更像贴在地表，不像脏色罩子。
- 近景与远景的云层对比不出现“近景太轻、远景反而太重”的倒挂。

验收：

- `debug-clouds` 下单看 cloud shell 也能成立。
- 正式画面中，云层有存在感但不抢地表轮廓。
- 云影不会把地表整体压脏。

### P4：暗面城市灯、晨昏线和整体色彩纪律

目的：让 LuBirth 的 day / twilight / night 过渡更像同一个世界，而不是三个效果叠在一起。

建议重点：

- 借鉴外部项目把 night lights、ambient、sun intensity 放在同一闭环里调的习惯。
- 保留 LuBirth 已有的 city core + halo，但把它和 twilight fill、night fill 的比例再统一一次。
- 继续使用 LuBirth 自己的 film discipline / highlight knee，不直接照搬外部 tone mapping。

涉及文件：

- [packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:367)
- [packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:412)

验收：

- 晨昏线不过分发橙，也不显得“脏蓝”。
- 夜灯亮但不飘，不形成廉价荧光感。
- 高光压制更稳，亮区不会一团发白。

### P5：可选的 projected horizon 收束

目的：如果近地 look 仍然不够“贴镜头”，再考虑把屏幕空间 limb 方向做成辅助层，而不是新主路径。

前提：

- 只有在 P1 到 P4 完成后仍觉得近地弧线不够稳，才进入这一阶段。

涉及文件：

- [packages/lubirth-hero/src/LandingProjectedLimbScattering.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingProjectedLimbScattering.tsx:48)
- [packages/lubirth-hero/src/LandingProjectedHorizonComposite.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingProjectedHorizonComposite.tsx:154)
- [packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:204)

原则：

- 不恢复整套投影合成作为正式默认路径。
- 只把它当作“近景加一口气”的可选增强层。

验收：

- close stage 的地弧更贴屏。
- 不引入额外的假边框感或 UI 投影感。

## 6. 推荐执行顺序

建议按以下顺序推进：

1. 先用已落地的 `/lubirth-atmosphere-spike` 固定 `stack`、`volumetric`、`split` 的 screenshot / pixel smoke evidence。
2. 完成 atmosphere decision gate：选择 stack 默认、volumetric 默认、hybrid policy，或继续 spike-only；hybrid 只能是有明确 owner / API 的 binary resolver，不能是未定义第三路径。
3. 按 decision gate 结果做大气边缘统一。
4. 地表 relief 与海洋高光。
5. 云层阈值与云影。
6. 暗面 / 晨昏线 / color discipline。
7. 只在必要时启用 projected horizon 辅助。

这样做的原因是：

- 大气边缘最影响第一眼“高级感”。
- 当前 atmosphere spike 已经存在，先决策可以避免继续同时打磨两套不确定的正式路径。
- relief 和 glint 会直接改变地球质感。
- 云层必须建立在边缘和地表关系比较稳定之后再收。
- projected pass 风险最大，应该放最后。

## 7. 具体文件地图

本轮 polish 的高概率落点：

- [packages/lubirth-hero/src/LandingEarth.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingEarth.tsx:58)
- [packages/lubirth-hero/src/LandingCloudLayer.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingCloudLayer.tsx:490)
- [packages/lubirth-hero/src/LandingAtmosphereStack.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/LandingAtmosphereStack.tsx:100)
- [packages/lubirth-hero/src/EarthMoonScene.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/EarthMoonScene.tsx:152)
- [apps/site/visual/scenes/LuBirthLookdevSceneSlot.tsx](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/visual/scenes/LuBirthLookdevSceneSlot.tsx:318)

可能需要小幅补充参数的地方：

- [packages/lubirth-hero/src/types.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/types.ts:70)
- [packages/lubirth-hero/src/presets.ts](/Users/aitoshuu/Documents/GitHub/MiraLith/packages/lubirth-hero/src/presets.ts:1)

## 8. 不在本计划中的内容

以下内容不属于这份 polish 借鉴计划：

- 把 LuBirth 改成 fullscreen quad raycast planet。
- 重写 Moon、Aurora 或整个背景系统。
- 新增重型体积云 raymarch。
- 引入 3D noise 资产和 `sampler3D` 管线。
- 为了“更像参考”而破坏现有首屏性能预算。
- 修复本次 review 中已按请求忽略的 hooks lint findings。

## 9. 完成标准

这份借鉴计划完成，不等于代码完成。真正算完成，要同时满足：

- `clean` 与 `nasa` 两条正式视图都能看出 polish 提升。
- 近地帧边缘语言更统一。
- 地表 relief、海洋 glint、云层阈值更稳。
- 暗面与晨昏线更自然。
- 不引入新的性能尖峰。
- 不直接复制 GPL 源码。
- atmosphere promotion / keep-spike-only 决策有截图、质量分级和 fallback 证据支撑。

## 10. 下一步建议

建议下一步不要再开新的大气 lookdev spike，而是先收敛已经落地的 `/lubirth-atmosphere-spike`：

1. 跑完并保存 `stack`、`volumetric`、`split` 的截图矩阵，覆盖 desktop high / medium、mobile landscape high、低档 fallback。
2. 按近地白线、蓝色 shelf、外侧 halo、地表可见度、云层遮挡、月球干扰、黑场干净度做视觉评分。
3. 做一次 promotion decision：`volumetric` 是否进入正式路径，还是继续只作为评估路由存在；decision 前必须通过 policy API、evidence、visual scoring、technical hardening、performance 五道 gate。
4. 如果 promotion 成立，先按 implement plan 选择 slot-owned resolver 或 route-owned resolver；不直接改 `LuBirthSceneSlot` 的全局默认。
5. 如果 promotion 不成立，把 spike 结论转回 `LandingAtmosphereStack` / `LandingEarth` 的局部 shader polish。

具体执行拆解见：[lubirth-atmosphere-spike-implementation-plan.md](/Users/aitoshuu/Documents/GitHub/MiraLith/docs/lubirth-planet-polish/lubirth-atmosphere-spike-implementation-plan.md:1)。
