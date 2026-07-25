---
title: "feat: Build the post-CoScroll cinematic narrative"
type: feat
status: active
date: 2026-07-19
deepened: 2026-07-19
---

# feat: Build the post-CoScroll cinematic narrative

## Overview

在现有 `01 LuBirth → 02 Radio Gaga → 03 CoScroll` 之后，继续完成 MiraLith 的后半段主线：

1. CoScroll 终幕的玉字随滚动加速旋转，产生冰蓝色视觉残留；
2. 残留逐渐闭合为 ArtBreeze 影片开头的 loading 圆环；
3. ArtBreeze 以西西弗斯式滚动困境为情绪入口，滚动推进至用户输入问题，点击发送后自动播放“伪共时性”回答；
4. ArtBreeze 的画框连续变成 AeScape 的窗框，窗景由 scrub 推开，随后自动播放产品展示；
5. Focuence 完整自动播放，片尾的离散信息收束为“星 + 卡”的项目场；
6. 星群中的 SonoScope、Sadine 与宇宙混剪使用可位移、缩放、越界的播片容器；
7. 宇宙混剪停在进入泳池之前，以水面门槛转入 Dulwich、Li 与 UGCFlow 的真实落地录屏；
8. 产品名称、角色、链接和交付信息在体验之后出现，作为片尾档案，而不是产品发布会开场。

本计划保留“一章一条正式路由、任一时刻只运行一个重 Canvas”的现有架构。章节内部由单一 `NarrativeController` 协调原生滚动、语义 stop 和媒体 gate；章节之间由持久 DOM 转场协调器完成画面接力。CoScroll → ArtBreeze 是一个明确的例外型视觉边：它增加有限 terminal、来源场景尾段和残影圆环，但不做 GLB 顶点拓扑 morph，也不引入全屏 FBO afterimage。

**实施就绪度：** Stage 0 可以立即开始，但此时只拆片、做接力样片并判断素材是否契合，不进入正式动画或路由实现。只有作者通过 `CP0.3 Editorial GO` 并在 `CP0.4 Editorial Freeze` 锁定首段剪辑后，Stage 1 才能启动架构实现。之后每个 Stage 都由明确 checkpoint 阻断下一阶段；Production promotion 另以真实素材、CDN verified base URL、性能和可访问性全部通过为最终 gate。

## Problem Frame

MiraLith 前三章已经建立了天体、声音与经文的高强度世界观。后半段如果直接从产品名称、功能点和录屏开始，会从互动叙事突然变成作品发布会，破坏前面建立的情绪。

后半段需要沿用一条可感知的精神主线：

> 滚动最初是一种徒劳，后来成为打开、选择、聆听、影响和创造的动作。

为此，媒介必须服务叙事：

- scrub 只用于滚动本身有意义的段落，例如推石头、打开窗和容器空间变换；
- 自动播放用于需要完整节奏的短片，例如回答、Focuence、SonoScope 与交付录屏；
- 指针交互用于内容越过屏幕边界的段落，例如弹幕与鱼；
- 项目信息在情绪体验之后出现，不打断影片。

当前正式章节只发布到 `/coscroll`，后半段也没有媒体调度、视频 ready/fallback、自动播放门控和项目容器的公共实现。本计划需要在不破坏现有前三章的前提下补齐这些能力。

## Requirements Trace

### Transition and emotional sequence

- **R1 — CoScroll 残影圆环：** 正常渲染路径下，CoScroll 终幕必须由当前玉字真实旋转状态出发，随着终点后的继续滚动加速并形成视觉残留；残留再闭合成 ArtBreeze loading 圆环，不能直接黑场切换。只有 Canvas/model/signal 明确失败时才允许走静态缺口 ring fallback。
- **R2 — 不污染 CoScroll 正片：** 已验收的 Silk、冷玉材质、歌词排布和常规旋转在终点前保持不变；残影只存在于 terminal exit window。
- **R3 — ArtBreeze 叙事顺序：** 使用影片中的 loading、西西弗斯句子、循环圆意象、“应当想象西西弗斯是幸福的”、平台/博物馆快切、问题输入和伪共时性回答，按已确认时间码组织。
- **R4 — 滚动即推石头：** ArtBreeze 前段由 scrub 控制，但不能制造无出口的假滚动；每一轮必须留下可见积累并保持整体进度单调前进。

### Playback and frame continuity

- **R5 — 主动发送：** scrub 到输入完成后停止。用户点击发送或按 Enter 才开始回答自动播放，并为当次回答提供声音触发；不得仅凭滚轮强制有声播放。
- **R6 — AB → AS 同框接力：** ArtBreeze 末尾停在《星月夜》画面并收成画框；AeScape 的云海进入同一框，随后在 `05.60s` 显影为真实窗框。
- **R7 — AeScape 双播放模式：** `00:00.00–00:16.47` 为窗景 scrub，`00:16.47–00:24.82` 为自动播放的产品和品牌展示。
- **R8 — Focuence 片尾成星：** Focuence `00:00.00–00:17.20` 完整自动播放一次；片尾收束成有关系的星点与项目卡，而不是普通作品网格。

### Constellation and delivered work

- **R9 — 容器越界语言：** SonoScope 弹幕与 Sadine 前景鱼必须能够越过视频容器；容器本身由 scroll 驱动位移和缩放，但内部影片保持自己的播放节奏。
- **R10 — Sadine 保持交互身份：** Sadine 不能只作为水下影像；至少有一层受指针光场影响的实时鱼群前景。
- **R11 — 宇宙门槛：** 宇宙混剪使用 `01:07.30–01:14.20`，停在泳池切入前的眼睛画面；`01:14.30` 开始的入水镜头不进入默认剪辑。
- **R12 — 真实交付：** Dulwich、Li 与 UGCFlow 只使用真实成片或录屏。三者虽共用播片容器，但必须分别表现为动态成片、身份网站和多维裂变系统。

### System quality

- **R13 — 精确媒体清单：** 时间码、播放模式、海报、尺寸、编码和 fallback 必须进入数据清单，不能散落在多个组件中。
- **R14 — 单一输入所有权：** 任一时刻只有当前场景拥有滚轮、触摸、键盘或自动播放控制；路由转场、影片自动播放和 scrub 不能同时争抢输入。
- **R15 — 可恢复与可跳过：** 自动播放段提供暂停、重播和跳过；键盘与 reduced-motion 用户能到达同一语义内容，不被 pinned 段落困住。
- **R16 — 性能边界：** 不把 HEVC 母版直接作为网页资源，不并行加载所有影片，不同时运行两个重 Canvas，不为残影分配全屏反馈 FBO。
- **R17 — 可达的 CoScroll terminal：** 当下一章处于当前访问层级时，CoScroll 必须使用独立、非循环的 `narrativeProgress`；第一次正向到达正式时间线末端后进入可逆 exit window。没有可访问下一章时，现有循环行为保持不变。
- **R18 — 三层章节访问：** 章节 registry 必须区分 `known`、`preview`、`published`。只有有效 preview session 或 published 状态允许 coordinator、terminal-next 和预加载跨入对应章节。
- **R19 — 类型化接力与恢复：** ring、star 和 water 接力使用版本化、可序列化的 handoff payload；返回快照使用版本化 `semanticStop + completedMediaIds + skippedMediaIds + playbackState`，`scrollY` 只能作为辅助信息。
- **R20 — 有界滚动门控：** scrub 才能消费 ScrollTrigger progress。`await-send` 与 autoplay 使用有限 sticky shelf、显式 skip 和下游折叠；不得用无限 pin 或持续 `preventDefault()` 把用户困住。未完成 autoplay 反向越过 shelf 入口时必须失去 segment ownership、立即暂停并恢复为显式 Resume，不能继续离屏发声。
- **R21 — 媒体交付契约：** 本地派生前必须显式具备 FFmpeg/FFprobe、源素材和字节预算；进入 Unit 9 publication 前再显式具备 CDN/provider base URL、上传凭据边界、缓存与 Range contract，因此 CDN 不阻塞本地 Stage 2 review。播放层必须处理 startup、`waiting/stalled` 和 `ended-too-early`。
- **R22 — 单次有声激活链路：** answer `<video>` 必须在 `await-send` 前挂载、设定 source 并预热；发送 click/keydown handler 必须在同一 user activation task 内直接调用该实例的 `play()`，再推进 React 状态。若实例或资源尚不可用，不能在 effect、`canplay` 或 Promise 之外排队自动有声播放，只能显示新的“播放回答”控制等待第二次主动操作。每次 play/resume/replay 都必须获得新的 playback attempt generation；skip、cancel、反向离场、新 attempt 和 unmount 会使旧 Promise/event 失效并暂停实例。
- **R23 — 可复现媒体发布：** committed source spec 与 generated deploy manifest 必须分层；所有剪辑使用 source time base 上的半开 PTS 区间。本地 Stage 2 必须通过显式、仅开发环境可用的 server resolver 消费并校验 preview manifest，production 禁止进入该分支。发布顺序固定为 immutable 上传、Range/cache/hash 验证、Next build 引用已验证 manifest、最后提升 published；deploy receipt 必须绑定实际 verified base URL，旧 hash 资源必须覆盖回滚窗口，不能随新版本发布立即清理。
- **R24 — 先拆片、后实现：** 在任何 CoScroll → ArtBreeze 正式动画、路由转场或 production media contract 实现之前，必须先用当前真实 CoScroll source end state（`sceneProgress=1`、锚字“空”；不是尚不存在的 terminal 实现）与 ArtBreeze `00:00–00:18.53` 拆出逐镜 shot map、至少三种接力样片和一份作者 GO/NO-GO 结论。只有选定方案的镜头顺序、入点/出点、声音、补充素材需求和连续性参数被冻结后，后续 stage 才能据此实现。

## Scope Boundaries

- 不做 CoScroll GLB 与圆环之间的真实几何顶点 morph；采用“真实旋转 → 过渡残影 → 持久 DOM/SVG 圆环”的视觉连续性。
- 不改变 CoScroll 终点前的 source-match 画面、材质、歌词和输入节奏。
- CoScroll terminal 使用正式 48 秒 source excerpt 的真实末字“空”；不额外加载或切换“道”。
- 不把 04–07 合并为一个超长 mega-route；保留路由级资源隔离和现有 transition coordinator。
- 不把所有影片都做成 scrub。Focuence、SonoScope、回答段和交付段默认自动播放。
- TaBient 不进入 v1 默认主线；可以在以后作为星群的声音交互或独立节点加入。
- 《赞美诗》不进入本轮默认主线；保留为后续星点或预告片入口。
- 不用生成式 UI 替代 ArtBreeze、AeScape、Focuence、Li 或 UGCFlow 的真实界面。
- 本计划不实施代码、不运行构建或视觉测试。

## Confirmed Source Film Map

以下时间码来自已提供影片的实际画面检查。时间码是剪辑基准，实施时生成独立网页版本，不直接在浏览器中远距离 seek 原始母版。

本节的十进制时间码只作为人类可读的剪辑定位。真正的 committed source spec 必须记录每个母版的 `sourceTimeBase`、`startPTS`、`endPTSExclusive`、首帧 hash 与最后包含帧 hash，并以 `[startPTS, endPTSExclusive)` 生成片段。相邻片段共享同一个边界 PTS 而不共享同一帧；宇宙片段以眼睛的最后包含帧 hash 为准，首个泳池帧必须位于半开区间之外。

ArtBreeze 首段当前时间码只是 Stage 0 的候选范围，不是已经冻结的网页顺序。Stage 0 必须实际比较“从 `00:00` 顺序进入”“从 `00:08.77` 圆环优先进入”和“DOM ring + 等待镜头混合接入”三种方案；`CP0.4` 之后，选中的顺序和 PTS 才成为 Unit 1 source spec 的唯一输入。

### ArtBreeze — `artbreeze-full.MP4` / 109.923s

| Source time | Confirmed frame content | Web behavior |
|---|---|---|
| `00:00.00–00:08.76` | LOADING、夜间等待者、白场 | 与 CoScroll 残影圆环接力；scrub |
| `00:08.77–00:18.52` | loading 圆环与“我们每天都在推着一块看不见的石头” | scrub；滚轮驱动圆环 |
| `00:18.53–00:28.36` | 风机、磁带盘、轮轴、洗衣机、齿轮等周而复始的圆 | scrub；允许两至三次节奏循环但页面进度持续前进 |
| `00:28.37–00:30.66` | “应当想象西西弗斯是幸福的” | 短暂停顿；仍由 scrub 到达 |
| `00:30.67–00:43.72` | 人、创作、平台、代码与博物馆快速切换 | scrub 加速 |
| `00:43.73–00:50.29` | “你的问题正在唤出另一个世界的回应”与问题输入 | scrub 至输入完成 |
| `00:50.30–00:51.76` | Enter 键与发送动作 | 等待真实 click / Enter 激活 |
| `00:51.77–00:58.52` | “有些等待，比回答更动人” | 自动播放 |
| `00:58.53–01:30.29` | 跨平台、博物馆、绘画和回答联动 | 自动播放；作为伪共时性回答主体 |
| `01:30.30–01:35.35` | 《星月夜》与观看者 | 自动播放后停帧，并形成 AB 画框 |
| `01:35.40–01:49.92` | 人物品牌结尾、ArtBreeze 标题和二维码 | 默认主线排除；完整版入口保留 |

移动和 reduced-motion 可使用 `artbreeze-short.MP4` 的无二维码前段作为备用预览，但不能代替桌面主叙事。

### AeScape — `aescape-short.MP4` / 24.822s

| Source time | Confirmed frame content | Web behavior |
|---|---|---|
| `00:00.00–00:05.59` | 云海与远山 | 进入 AB 画框；scrub |
| `00:05.60–00:08.29` | 暖色室内窗与推窗 | 画框显影为窗框；scrub |
| `00:08.30–00:10.52` | 城市、天气球与降雪 | scrub |
| `00:10.53–00:12.52` | 海边推窗 | scrub |
| `00:12.53–00:14.29` | 中式窗景与自然细节 | scrub |
| `00:14.30–00:16.46` | 蓝色、云和快速景象过渡 | scrub 收束 |
| `00:16.47–00:19.82` | 实际新标签页天气界面 | 自动播放 |
| `00:19.83–00:24.82` | AeScape 天景品牌与“在窗口与景色对话” | 自动播放并停帧 |

### Focuence — `focuence-short.MP4` / 17.206s

| Source time | Confirmed frame content | Web behavior |
|---|---|---|
| `00:00.00–00:06.26` | 单匹马穿过夜间城市 | 自动播放 |
| `00:06.27–00:09.89` | 马群穿过沙尘 | 自动播放 |
| `00:09.90–00:12.76` | 实际标签管理界面 | 自动播放 |
| `00:12.77–00:17.20` | Focuence / 知序标题 | 自动播放；文字与余光收束成星点 |

### SonoScope — `SonoScope-short.mp4` / 11.500s

- 使用 `00:00.00–00:11.50` 完整连续片段。
- 影片保持在容器中，德彪西《月光》相关弹幕从容器内部越界到页面。
- 弹幕时间轴独立于视频文件，以可编辑数据维护，不烧进影片。

### Sadine — `sadine-full.mov` / 45.567s

- 母版是围绕中央光源运动的连续鱼群，没有硬切。
- v1 推荐取 `00:24.00–00:36.00`，该段中央光源稳定、环形鱼群密度较高，适合与少量实时前景鱼叠加。
- 完整母版仍可作为二级入口；主线不连续播放 45.567 秒。

### 宇宙混剪 — `混剪-我们是宇宙感受自身的方式.MP4` / 89.301s

- 使用 `01:07.30–01:14.20`：雪夜人物、破裂面孔与眼睛逐渐逼近。
- `01:14.20` 停在蓝色眼睛特写。
- `01:14.30` 才切入泳池俯视镜头；默认主线不播放该帧之后的内容。
- 眼睛中的蓝色高光在网页中扩展为水面/屏幕门槛，进入真实交付章节。

### Dulwich

- `3月4日(1)-1.mp4` 至 `3月4日(1)-12.mp4` 是 12 段已存在的 1080p H.264 真实校园素材，总时长约 25.1 秒。
- 已确认内容覆盖人物、教师、舞蹈、实验室、协作、运动、校园和科学活动。
- `reference1.mp4`、`reference2.mp4`、`reference3.mp4` 只作为参考，不进入默认交付剪辑。
- 实施时优先使用已经完成的 Dulwich 总成片；若总成片尚未进入 MiraLith 资产目录，再以 12 段素材和现有浏览器动画导出生成网页剪辑。

### Li / UGCFlow

- 两者的最终录屏当前不在 MiraLith 媒体目录中。
- 本计划确认展示方式与容器行为，但精确入点、出点必须在最终录屏进入资产目录后补入媒体清单，不能由实施者猜测。

## Experience Structure

| Route | Internal act | Primary gesture | Media mode |
|---|---|---|---|
| `/coscroll` | 经文终幕 → 残影圆环 | 推 / 旋转 | WebGL 来源尾段 + 持久 DOM ring |
| `/artbreeze` | ArtBreeze → AeScape → Focuence | 推 → 打开 → 收束 | scrub → autoplay → autoplay |
| `/constellation` | 星群 → SonoScope → Sadine → 宇宙门槛 | 选择 → 聆听 → 吸引 → 穿越 | 星卡 + 播片容器 + 轻交互 |
| `/client-works` | Dulwich → Li | 观看 / 检验 | 真实成片与网站录屏 |
| `/now-building` | UGCFlow → About / Contact | 裂变 → 收拢 | 多容器录屏 + DOM |

route snapshot 使用以下稳定 semantic stop id；视觉实现可以增加内部 phase，但不能更名这些恢复边界：

| Route | Stable semantic stops |
|---|---|
| `/coscroll` | `timeline`, `terminal-hold` |
| `/artbreeze` | `loading-loop`, `artbreeze-scrub`, `await-send`, `answer-autoplay`, `ab-frame-hold`, `aescape-scrub`, `aescape-autoplay`, `focuence-autoplay`, `constellation-hold` |
| `/constellation` | `field-entry`, `sonoscope`, `sadine`, `cosmic-eye`, `client-handoff` |
| `/client-works` | `dulwich`, `li`, `now-building-handoff` |
| `/now-building` | `ugc-single`, `ugc-matrix`, `about-contact` |

`/artbreeze` 内部采用明确的播放状态：

| State | Input owner | Exit condition |
|---|---|---|
| `loading-loop` | scroll | 到达西西弗斯句子并完成残影积累 |
| `artbreeze-scrub` | scroll | 影片到 `00:51.76` |
| `await-send` | sticky shelf + button / Enter / Skip | 用户主动发送或明确跳过 |
| `answer-autoplay` | sticky shelf + video controls | 到达 `01:35.35`，或用户主动跳过 |
| `ab-frame-hold` | scroll | 《星月夜》收成画框 |
| `aescape-scrub` | scroll | 到达 `00:16.46` |
| `aescape-autoplay` | video controls | 到达 `00:24.82`，或用户跳过 |
| `focuence-autoplay` | video controls | 到达 `00:17.20` |
| `constellation-hold` | scroll / pointer / links | 用户进入 `/constellation` |

## Context & Research

### Technology & Architecture

- 根仓库是 pnpm monorepo，正式站点位于 `apps/site`。
- 站点使用 Next.js 16、React 19、GSAP 3.15、R3F 9.6、Three.js 0.184、Motion 12 和 Zustand 5。
- 当前正式章节采用独立路由和独立 Canvas；`ChapterTransitionProvider` 与 DOM veil 持久挂在根布局下。
- `CoScrollSpikeExperience` 已拥有虚拟 scroll input 和 destination ready/fallback，但当前通过 `wrapTime()` 无限循环，没有非循环 narrative progress，也没有调用 `useChapterTerminalGate`。
- `CoScrollJadeAnchor` 已内部维护真实旋转角度与速度，并具有尚未向场景外部接线的 `CoScrollRotationSignalRef`。
- 当前 `useChapterTerminalGate` 只解析 next published chapter；`ChapterTransitionProvider` 也只接受 published source/target，尚不支持 preview transition。
- 当前 `ChapterReturnSnapshot` 只有 `routeProgress`、`scrollY` 和 terminal boolean，无法表达回答/Focuence 已完成或当前语义 stop。
- 当前媒体工具链没有声明 FFmpeg/FFprobe，也没有 CDN、Git LFS 或大视频缓存策略。
- 项目只有 Playwright e2e 测试体系；视觉、输入和路由行为应继续在 `tests/e2e` 中验证。

### Relevant Code and Patterns

- `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`：真实旋转速度、角度和滚轮速度映射。
- `packages/coscroll-scene/src/CoScrollSceneContent.tsx`：CoScroll source-match 画面、readiness 组合和 scene 边界。
- `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx`：现有虚拟 scroll、循环时间和 route destination；需要新增有限 narrative terminal。
- `packages/coscroll-scene/src/sourceTimeline.ts`：正式 excerpt 仅含“观 → 空”，末端真实锚字是“空”。
- `packages/coscroll-scene/src/assetManifest.ts`：正式 excerpt 资产只包含“观”和“空”。
- `apps/site/components/chapter-transition/useChapterTerminalGate.ts`：现有 published-only terminal resolver 和正向输入阈值。
- `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`：跨路由状态机、输入锁、ready/fallback 与恢复。
- `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx`：持久 DOM 转场视觉。
- `apps/site/content/miraLithChapters.ts`：章节顺序和已发布 href 的唯一来源。
- `tests/e2e/coscroll.spec.ts`：当前明确断言 source-match 不接入 rotation-signal caustic 路径；新实现必须修改测试意图为“常规章节不显示残影，只有 terminal exit 显示”。
- `docs/plans/2026-07-14-001-feat-scroll-chapter-transition-plan.md`：已落地的 route-per-chapter、单 active Canvas 和 readiness-gated reveal 契约。
- `docs/miralith-transition-system/TRANSITION_PLAN.md`：路径带粒子、pause-frame、timeline coordinate 和 reduced-motion 约束。

### Institutional Learnings

- 仓库没有 `docs/solutions/`，没有可复用的历史解决方案条目。
- 现有实现反复证明：React mount 不能等同于视觉 ready；视频章节也必须以 poster/metadata/可解码首帧或明确 fallback 作为 reveal 条件。
- 首页首屏与重场景对资源数量敏感。后半段不得在进入 04 前预加载全部影片。

### External Research

- 当前不需要视觉案例或框架研究：Next、GSAP、R3F、路由转场和 fallback 都沿用仓库模式，叙事与素材也已确认。
- WebKit 明确要求有声 `video.play()` 直接由 `click`、`keydown` 等手势 handler 导致；在之后的 `canplaythrough` handler 调用不满足同一手势链路。Chrome 同样要求检查 `play()` 返回的 Promise，并在拒绝时提供显式播放控制。因此 answer 不能依赖“点击 → setState → effect/canplay → play”的异步链。
- CDN provider 被明确推迟到 Stage 6；选型时只针对候选 provider 的 Range/CORS/cache/credential 官方文档做一次约束核验，不改变本计划已经固定的生成、验证、构建与回滚 contract。

## Key Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 开工顺序 | 先做真实素材拆片与接力样片，通过作者 Editorial GO 后再冻结工程 contract | 首段网页顺序并不等于母版顺序；先验证“残影圆环 → 等待困境”是否成立，避免技术实现把尚未成立的剪辑假设固化 |
| CoScroll → AB 的连续方式 | 来源 Canvas 尾段 + 持久 DOM/SVG ring | 保留真实旋转感，同时遮住跨路由 Canvas 交接 |
| CoScroll terminal | 有可访问下一章时启用单次、非循环 narrative pass；否则保持现有无限循环 | preview 未激活和 04 未发布期间不改变线上 CoScroll |
| terminal 锚字 | 使用当前 source excerpt 的真实末字“空” | 同时满足“从当前真实状态出发”和“不修改正片” |
| 残影技术 | 少量 transition-only ghost/arcs + screen-space ring，不使用全屏 feedback FBO | 可控、轻量，不污染 CoScroll source-match |
| 后半段路由 | 04–07 继续独立路由 | 复用现有协调器，隔离视频和 WebGL 资源 |
| 章节可见性 | `known / preview / published` 三层 registry + tab-scoped preview session | 未发布章节可完整联调，但不会进入生产 rail |
| 跨路由视觉状态 | `beginTransition` 携带版本化 discriminated handoff payload | ring/star/water 的相位与几何不再靠组件间猜测 |
| 返回恢复 | route state adapter 生成版本化语义快照 | 已完成影片保持尾帧，返回不自动重播或发声 |
| 时间轴所有者 | 每条 route 只有一个主 timeline source | 防止多个 ScrollTrigger 各自解释同一滚动 |
| autoplay gate | 有限 sticky shelf + 下游折叠 + 显式 skip | 原生滚动不被无限拦截，gate 仍保持叙事顺序 |
| autoplay 反向离场 | 越过 shelf 入口即失去 ownership、pause、写 `paused/ready` | 用户可回看上文，但影片不会在屏外继续发声；返回后必须显式 Resume |
| 媒体文件 | scrub 与 autoplay 分离为网页剪辑 | 减少远距离 seek、简化关键帧和加载控制 |
| 媒体清单分层 | committed source spec + committed generated deploy manifest；本地 preview manifest gitignored | 人工剪辑决策与远端发布事实分离，同时让每次 Next build 可复现 |
| 本地媒体消费 | server-only resolver + 显式 `local-preview` mode；client 只接收已校验结果 | 无 CDN 也能真实播放本地派生文件，同时 production 无法误走 preview 分支 |
| 媒体交付 | CDN immutable assets；大媒体和本地生成目录不进入 Git，已验证 deploy manifest 进入 Git | 避免将约 193 秒多版本视频塞进仓库，同时把站点 build 与确切 hash 资产绑定 |
| CDN 验证绑定 | receipt 记录 canonical verified origin、base path 和 base URL hash | build 环境不能把已验证 asset key 指向另一主机或未验证路径 |
| 剪辑边界 | source time base 上的 `[startPTS, endPTSExclusive)` + 最后包含帧 hash | 消除相邻片段重复帧与浮点秒边界歧义 |
| ArtBreeze 声音入口 | 预挂载 answer video；点击发送 / Enter 的同一 handler 直接 `play()` | 同时满足叙事主动性和浏览器有声播放要求 |
| 异步播放并发 | 单调 `playbackAttemptId` + segment/element ownership 校验 | 迟到的 fulfilled/rejected/playing event 不能复活旧影片、覆盖新状态或离场发声 |
| Snapshot 写入 | 语义结果立即写、播放时间节流写、`pagehide` 与离场前最终写 | 刷新、返回和转场不会恢复到旧 stop 或重播已完成媒体 |
| CoScroll signal 缺失 | DOM fallback → 静态缺口 ring → 正常导航 | context lost、模型失败或锚字未 ready 时不等待不存在的旋转信号 |
| 自动播放可逆性 | scrub 可逆；autoplay 完成后保持尾帧，只有 Replay 才重播 | 避免用户反向滚动时影片反复启动 |
| 星群导航 | 半自由：滚动有默认路线，星卡可直接进入 | 保留编辑性，同时允许探索 |
| SonoScope / Sadine 越界 | DOM/2D overlay 层越过视频容器 | 不增加第二个 WebGL context |
| TaBient | v1 不设独立章节 | 当前没有足够强的主线素材，不为完整清单牺牲节奏 |
| 项目信息 | 片尾 dossier / 可展开档案 | 保持“先感受，再理解，最后相信” |

## Open Questions

### Resolved During Planning

- **为什么第一步不是先搭后半段架构？** 因为 ArtBreeze 的真实圆环在约 `00:08.77` 才出现，母版开头还包含 LOADING、夜间等待者和白场。CoScroll 残影究竟接母版顺序、直接接圆环，还是通过 DOM ring 混合等待镜头，会直接改变 source spec、声音入点、scrub 节奏和 transition payload；必须先用真实素材样片选择，再把结论交给架构。
- **CoScroll 是否能直接留下视觉残留？** 可以。使用 `CoScrollJadeAnchor` 的真实角速度作为来源，在 terminal exit window 生成有限残影，再交给持久 ring；不需要真实 mesh morph。
- **CoScroll 何时进入 terminal？** 只有当 registry 能解析到 accessible next chapter 时才启用 narrative mode；从初始 `10.2 / 48` 开始，第一次正向到达 `1.0` 即 armed，不要求重复绕行。
- **CoScroll terminal 使用哪个字？** 使用正式 excerpt 的真实末字“空”。scene progress 在 `1.0` 保持“空”，不加载“道”。
- **返回 CoScroll 恢复哪里？** 从 ArtBreeze 返回时恢复 `coscroll-terminal-hold`：`narrativeProgress=1`、`exitProgress=0`、锚字“空”，需要一笔新的正向输入才重放残影；直接访问或刷新仍从正式初始进度开始。
- **preview 如何跨路由？** 由显式 `post-coscroll-v1` preview bootstrap 激活当前 tab/build 的 session；session scope 同时写入 sessionStorage 和 history state，coordinator 只在该 scope 有效时允许 preview transitions。
- **autoplay 期间滚动怎么办？** route track 在 gate 后暂不展开下游段；用户仍使用原生滚动进入有限 sticky shelf，影片不受 scroll seek。结束或 skip 后才展开下一段、刷新布局并等待新输入。
- **ArtBreeze 从哪里切到自动播放？** scrub 到 `00:51.76`，用户发送后自动播放 `00:51.77–01:35.35`。
- **一次发送如何可靠启动有声回答？** answer video 在到达 `await-send` 前已挂载并预热；发送 click/Enter handler 对稳定实例先解除静音并直接调用 `play()`，随后才切换 UI 状态。若实例/source/metadata 不可用或 Promise 被拒绝，停在同一语义 stop，显示需要第二次激活的“播放回答”，绝不由后续 ready event 自动补播。
- **旧 `play()` Promise 迟到怎么办？** 每次 play/resume/replay 捕获新的 `playbackAttemptId`、当前 segment、route transition id 与 video element identity。skip、cancel、反向离开 shelf、新 replay、route transition 和 unmount 都先递增 generation 并 `pause()`；旧 continuation 只能被忽略，若迟到 fulfilled 已让元素开始播放，还要立即再次 pause，不能写状态或快照。
- **autoplay 未完成时能否反向离开？** 可以。反向越过 shelf 入口 sentinel 后 controller 释放该 segment ownership、暂停并保存 `paused/ready + mediaTime`，不写 completed/skipped。再次进入只显示 Resume/Skip/Replay，不能自动继续有声播放。
- **本地 preview media 如何进入页面？** 只有 `NODE_ENV` 非 production 且 server-only `MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview` 显式开启时，route server resolver 才读取、校验 `manifest.preview.json`，并把 normalized manifest 作为序列化 props 交给 route shell；client 不直接读取文件或选择环境分支。production build 设置该 mode 或发现本地 preview 资产都会 fail closed。
- **deploy manifest 如何进入 Next build？** 人工维护的 source spec 与已验证的 deploy manifest 都进入 Git；production runtime facade 静态导入 deploy manifest。publication scripts 只在 immutable 上传和远端验证成功后生成最终 manifest，Next build 对缺失、过期或 source-spec hash 不一致直接失败。
- **如何保证 verify 与 production 使用同一 CDN？** verify/finalize 使用唯一 canonicalizer 记录 `verifiedOrigin`、`verifiedBasePath` 与 `verifiedBaseUrlSha256`；Next build 和 promotion gate 对 `NEXT_PUBLIC_MIRALITH_MEDIA_BASE_URL` 做同样规范化并要求完全一致。host、scheme、port 或 path prefix 任一变化都必须重新 verify/finalize。
- **相邻剪辑如何避免重复边界帧？** source spec 使用 `[startPTS, endPTSExclusive)`；例如 AeScape 的 showcase 从 scrub 的 `endPTSExclusive` 开始，边界帧只属于 showcase。人类可读的 `16.47s` 不作为最终帧选择算法。
- **CoScroll 没有 angle/speed 怎么办？** context lost 或显式 scene/model fallback 立即采用 DOM fallback；terminal 到达后在有限 readiness deadline 内仍无有效 sample 也单向降级为静态缺口 ring，然后照常导航，迟到 signal 不再替换本次 fallback。
- **ArtBreeze 从哪里接 AeScape？** 在 `01:30.30–01:35.35` 的《星月夜》段收成画框；AeScape `00:00–00:05.59` 的云海进入同框，`00:05.60` 显影为窗。
- **宇宙混剪在哪里结束？** `01:14.20` 眼睛特写；不进入 `01:14.30` 的泳池镜头。
- **所有影片是否都 scrub？** 否。只有 ArtBreeze、AeScape 和容器空间变换 scrub；Focuence、SonoScope、回答和交付片自动播放。

### Deferred to Implementation

- **Li 与 UGCFlow 的精确时间码：** 等最终录屏进入资产目录后，由同一媒体清单补齐。
- **SonoScope 弹幕最终文本与节拍：** 先按《月光》的音乐结构建立可编辑 cue 表，最终文案在视觉 review 中确认。
- **Sadine 前景鱼数量和运动参数：** 根据桌面与移动端性能检查确定，但不能退化为纯视频。
- **Dulwich 使用总成片还是 12 段重剪：** 资产接入时优先采用现成总成片；不存在时才重剪。
- **各语义段的 scroll distance：** 先按影片时间码建立单调映射，再在 Stage 2/3 的叙事 review 中校准；计划不提前用任意像素长度锁死情绪节奏。
- **CDN/provider 选择：** Stage 2 本地视觉 review 只依赖 gitignored preview bundle/manifest；具体 object-storage/CDN 与上传 adapter 可在 Stage 6 production gate 前选择，但必须满足本计划固定的 Range、CORS、immutable cache、hash URL 和总预算 contract。上传凭据只进入部署环境 secret，不进入 `NEXT_PUBLIC_*`、manifest、客户端日志或 Git。

## High-Level Technical Design

> 以下内容用于确定实现边界和状态契约，是供评审的方向性设计，不是要求实现者照抄的代码。

### CoScroll terminal contract

`CoScrollSpikeExperience` 保留现有 `ritualTime`，但只有在 registry 能解析到 accessible next chapter 时才启用独立的非循环 `narrativeProgress`。因此 04 未发布且 preview 未激活时，线上 `/coscroll` 继续按当前 `wrapTime()` 循环；preview 或正式发布后才出现 terminal。

| State | Visual time / anchor | Physical input | Transition rule |
|---|---|---|---|
| `looping-unavailable` | 继续使用当前 wrapped progress | 当前 wheel/touch/key 行为 | 没有 accessible next，不出现 terminal |
| `timeline` | `narrativeProgress` 在 `0–1` 内可正反移动；末端为真实“空” | CoScroll 继续独占虚拟输入 | 从初始 `10.2 / 48` 出发，第一次正向到达 `1.0` 后进入 `terminal-hold` |
| `terminal-hold` | scene progress 固定 `1.0`，保留“空”；`exitProgress=0` | 反向输入回到 `timeline`；正向输入进入 exit | 不导航，不自动开始残影 |
| `terminal-exit` | scene 仍为“空”；真实 angle/speed 驱动 ghost arcs，`exitProgress` 为 `0–1` | 正向累积、反向等量撤销 | `exitProgress<=0` 回 hold；`exitProgress=1` 才 commit |
| `committing` | DOM ring 已接管并锁定 handoff payload | 本地输入关闭 | coordinator 开始 `/artbreeze` transition |
| `history-return` | 恢复“空”与 `terminal-hold`，不恢复半截残影 | 等待新的输入 | 不因旧 wheel inertia 自动再次跳转 |

- exit window 的初始输入距离采用 `0.75 × viewport height`，限制在 `480–900 CSS px`；wheel、touch 和键盘都换算到同一 normalized `exitProgress`，Stage 2 只允许在该范围内调节。
- CoScroll 已经主动接管 wheel/touch，因此 terminal 不再额外挂载现有 `useChapterTerminalGate` 的全局 listener；两者只共享 accessibility、阈值和 commit policy，避免双输入所有者。
- 到达 `1.0` 时 `createCoScrollVisualState` 仍解析 excerpt 的最后 cue“空”；不增加“道”的资产预载、锚字切换或额外 source timeline。

### Known / preview / published registry contract

| Layer | Direct URL / browser history | Coordinator transition | Rail / terminal-next / preload | Public discovery |
|---|---|---|---|---|
| `known` | 可以独立 mount 和 fallback | 无有效 access context 时不允许 programmatic transition | 不参与 | 不参与 |
| `preview` | 可以 | 仅在有效 `post-coscroll-v1` preview session 内允许 | 只进入 preview rail 和 preview terminal graph | 不进入正式导航、metadata 索引或 sitemap |
| `published` | 可以 | 正常允许 | 进入正式 rail、terminal-next 和下一章预热 | 正常公开 |

- 单一 registry 记录所有章节的 href、index、availability 和 transition edge；`publishedMiraLithChapters` 变成过滤视图，不再是 coordinator 认识章节的唯一来源。
- Stage 1 初始状态固定为 01–03 `published`、04–07 `preview`；所有七章都属于 known registry。提升到 published 只改变 availability，不改 href 或 index。
- 显式入口使用 `?preview=post-coscroll-v1` 激活 preview。Provider 校验 scope 与当前 build revision 后，将 versioned preview context 写入当前 tab 的 sessionStorage 和当前 history entry，再清理 URL 参数。
- preview metadata 使用 namespaced field 合并到现有 `history.state`，不能覆盖 Next.js 自己的 navigation state。后续 `pushState`/router navigation 复制 preview scope；`popstate`/Navigation API history traversal 从 entry state 恢复并再次校验。scope 缺失、版本不符或 build revision 变化时立即退回 published graph。
- preview session 只在当前 tab、当前 build 有效，不跨 tab、不开启任何鉴权含义；已知 route 仍可直接访问或由浏览器 history 恢复，但没有有效 session 时不能沿 preview terminal graph 继续跳转或显示 preview veil。
- sessionStorage、history state 和 handoff 都按不可信客户端输入校验；resolver 只能返回 registry 中的已知 href，payload 不能注入任意 URL、asset key 或 transition kind。
- preview route 在提升为 published 前使用 `robots: noindex`，不进入 sitemap 或正式 metadata 链接。
- `useChapterTerminalGate` 改为解析 `getNextAccessibleChapter(currentHref, accessContext)`；`ChapterTransitionProvider` 使用同一 resolver 验证 source/target，避免 gate 与 coordinator 认知不一致。
- browser history 涉及 inaccessible known route 时，Provider 不创建 active transition、不显示 veil，也不把它提升为 preview；让 Next/browser 完成普通导航，目标 route 走 deterministic direct-entry reset。

### Typed handoff and semantic recovery contract

`beginTransition` 除 target 和 initiator 外接收可选的 versioned handoff。payload 必须是可序列化、viewport-normalized 的 discriminated union，不携带 DOM、Three.js object 或视频实例。

| Handoff kind | Required visual state | Fallback when invalid/missing |
|---|---|---|
| `coscroll-ring` | `signalSource=live` 时携带 angle/angular velocity；`signalSource=fallback` 时携带静态 gap phase；两者都携带 normalized center、diameter 和 exit progress | 使用目标 route 的静态 loading ring |
| `focuence-stars` | normalized collapse origin、seed、collapse phase | 使用 constellation 默认星群入口 |
| `cosmic-water` | normalized eye/highlight origin、radius、ripple phase | 使用 client works 静态水面 poster |

- active transition runtime、public snapshot、`ChapterTransitionVisual` 和 destination reset context 都读取同一 handoff；kind 与 edge 不匹配时降级为 `direct` visual，不中断导航。
- handoff 只负责一次跨路由画面接力，不作为历史恢复数据；刷新或普通 history return 使用目标 route 的语义快照和稳定 poster。
- `ChapterReturnSnapshot` 升级为 build-bound、schema-versioned route state，至少记录 `pathname`、`semanticStop`、`narrativeProgress`、`completedMediaIds`、`skippedMediaIds`、`activeMediaId`、`playbackState`、`mediaTime`、mute preference、route-specific state 和 timestamp；读取时验证长度、枚举和 media id 是否属于当前 route manifest。
- route shell 注册 typed capture/restore adapter；Provider 不再只从通用 DOM dataset 猜测后半段状态。01–03 可继续由 legacy adapter 产生兼容快照。
- 恢复规则固定为：`completed/skipped` 保持尾帧，其中 skipped 同时显示简短文字摘要；`playing` 归一为 paused/ready，不自动有声续播；`await-send` 回到发送 stop；未知 schema/build 回到本章确定性入口。`scrollY` 只在语义 DOM 恢复并 ready 后用于对齐。
- 写入时机固定为：`semanticStop`、completed/skipped outcome、mute、solo/matrix 或 replay generation 变化时立即同步写；expected-playing 状态的 `mediaTime` 每 2 秒至多节流写一次，并在 pause、seeked、ended、skip 时立即补写；`pagehide` 使用同步 sessionStorage 做 best-effort 最终写；coordinator 离场前在遮罩和 pathname 变化之前再次 capture。
- 每份 snapshot 带单调 revision。立即语义写会取消或淘汰更早的播放时间节流任务，避免旧 `mediaTime` 回调覆盖新的 completed/skipped outcome；storage 不可用时继续走确定性入口，不阻塞导航。

### NarrativeController and physical scroll contract

每条后半段 route 只有一个 `NarrativeController` 和一个 route-level ScrollTrigger。ScrollTrigger 只观测已展开的原生 scroll track；controller 根据 segment offsets 计算 scene-local progress，只有 controller 可以写视频时间、容器 transform 或 gate state。

| Segment mode | Scroll behavior | Media behavior | Release behavior |
|---|---|---|---|
| `scrub` | 原生滚动映射本段 local progress | controller 写当前 scrub clip time | 到 segment end 进入下一 stop |
| `await-send` | 一个 viewport 左右的有限 sticky shelf；下游 DOM 暂不展开，不调用持续 `preventDefault()` | 固定发送帧；始终显示“发送”和“跳过回答并继续” | send 进入 answer；skip 记录 skipped、显示回答摘要与尾帧后释放 |
| `autoplay` | 保持同一有限 shelf；用户可以在 shelf 内正反滚动，但不能 seek 影片 | pause/replay/skip 拥有控制权；scroll 不写 `currentTime` | `ended` 或 skip 后记录完成并展开下一段 |
| `released-hold` | 下一段插入文档流；视觉仍保持上一尾帧 | 不自动重播 | input inertia settle 后 refresh；下一笔新输入才推进 |
| `reverse-before-complete` | 反向越过当前 shelf 的入口 sentinel，允许继续回到上游内容 | 立即失效当前 playback attempt、pause 并写 `paused/ready + mediaTime`；不写 completed/skipped | 再次进入 shelf 只显示 Resume/Skip/Replay，不自动恢复或离屏发声 |
| `reverse-after-complete` | 可以返回上一语义 stop | 显示尾帧/poster，不撤销 completed/skipped outcome | 只有显式 Replay 才重新播放 |

- gate 未释放时页面的可滚动内容自然结束在当前 shelf；浏览器到达边界后不再前进，但页面不拦截 wheel/touch，且始终有可聚焦 skip，所以不存在无限 pin 或无出口滚动劫持。
- autoplay segment ownership 由 route controller 的 shelf 入口 sentinel 和当前 semantic stop 决定，不由不稳定的瞬时 IntersectionObserver 比例猜测。反向跨过入口、route transition、页面隐藏或 unmount 都先释放 ownership、失效 attempt 并 pause；向前仍因下游折叠而不能越过未完成 gate。
- 释放 gate 时先捕获 sticky visual anchor 的 viewport 位置，展开下一 segment 后 refresh，并用 layout delta 保持该 anchor 不跳位；沿用 coordinator 的 `160ms` inertia settle，再重新允许 narrative input。
- gate state、completed/skipped media 和 active segment 先写入 route snapshot，再展开下游。刷新/返回时先恢复语义状态和 DOM 高度，再执行 scroll 对齐。

### Audible answer activation contract

- answer `<video playsinline>` 在进入 `await-send` 前已经常驻于同一 `ArtBreezeSequence`，source 已绑定并至少完成 metadata/首个 Range 预热；状态变化不能换掉这一个 DOM 实例。
- 发送按钮和 Enter 共用同一个直接事件入口。handler 先取得稳定 video ref、在用户明确选择有声的前提下解除静音，并在任何异步等待或会导致卸载的 state transition 前直接调用 `play()`；返回 Promise 必须被保存和检查。
- `play()` pending 时 UI 使用 `answer-starting`，保留 skip/cancel，不提前显示“正在播放”或 pause 状态；只有 Promise fulfilled/`playing` 后才进入 `answer-autoplay`。
- video 未挂载、source 缺失、仍为 `HAVE_NOTHING`、同步调用抛错或 Promise rejected 时，保持 `await-send` 的发送后语义结果并进入 `answer-manual-ready`。此状态提供明确“播放回答”按钮，第二次 click 再直接调用 `play()`。
- 不允许在 React effect、`loadedmetadata`、`canplay`、`canplaythrough`、timeout 或 Promise continuation 中自动补发第一次有声 `play()`；这些事件只能更新 ready UI。字幕、摘要和 skip 始终可用。
- 每次发送、播放回答、Resume 或 Replay 创建单调 `playbackAttemptId`，并捕获当前 route transition id、segment id 与 video element identity。Promise continuation、`playing`、`pause` 和 `ended` handler 在写 UI、snapshot 或 outcome 前都必须验证这四项仍属于 active attempt。
- skip、cancel、reverse-before-complete、新 attempt、route transition 和 unmount 会同步递增 generation 并调用 `pause()`。旧 Promise 迟到 reject 不覆盖新 UI；迟到 fulfill 或 `playing` 即使已启动底层媒体，也必须再次 pause，且不能恢复声音、进入 autoplay 或写 completed。attempt id 只存在于当前运行期，不进入 return snapshot。

### Media toolchain, delivery, and playback watchdog

已知采用片段约 `192.87s`。媒体派生是显式的离线制作步骤，不属于 Next build：本地必须提供 FFmpeg/FFprobe 与源素材目录，脚本记录二进制版本、源 hash、source time base、半开 PTS 边界和输出 hash；CI 验证 committed deploy manifest、poster 与远端资源 contract。

媒体清单固定为两层，并由一个 runtime facade 连接 Next：

| Layer | Canonical file | Git / owner | Purpose |
|---|---|---|---|
| Source spec | `apps/site/content/postCoScrollMediaSource.ts` | committed；人工评审 | editorial-freeze hash、稳定 id、源文件标签/source hash、`sourceTimeBase`、`[startPTS,endPTSExclusive)`、mode、预算和 fallback 意图 |
| Local preview manifest | `apps/site/public/media/post-coscroll/manifest.preview.json` | gitignored；prepare script 生成 | 本机输出路径、探测 metadata 和 hash；只允许 server-only local-preview resolver 消费 |
| Publication candidate | `apps/site/.generated/post-coscroll-release/candidate-manifest.json` | gitignored；prepare/upload scripts 共享 | 待上传 bundle inventory 与预期 hash，只是临时发布输入，不能被 Next runtime 消费 |
| Deploy manifest | `apps/site/generated/post-coscroll-media-manifest.json` | generated but committed；remote verify script 唯一写入 | release id、source-spec hash、相对 content-hash key、bytes、codec、duration、frame rate、source/output hash、首尾帧 hash、`verifiedOrigin`、`verifiedBasePath`、`verifiedBaseUrlSha256` 与验证结果 |
| Shared schema/facade | `apps/site/content/postCoScrollMedia.ts` | committed；不读取 filesystem 或浏览器环境 | 校验 source spec 与 normalized manifest，并向 route shell 提供同一序列化形状 |
| Server source selector | `apps/site/lib/media/resolvePostCoScrollMediaManifest.server.ts` | committed；server-only | local dev 显式读取 preview manifest；其他模式静态读取 deploy manifest，client 无权选择 |

- local preview 分支只有在 `NODE_ENV !== production` 且非公开的 server env `MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview` 同时成立时可用。server resolver 读取 preview manifest，校验 schema/source-spec hash、media ids、相对同源 key、bytes/output hash、duration/frame rate 与实际本地文件，再由 route Server Component 把 normalized manifest 作为 props 传给 `PostCoScrollRouteShell`；client 不 fetch 原始 manifest、不读取 filesystem，也不根据 `NEXT_PUBLIC_*` 选择分支。
- local-preview mode 校验失败时显示带具体 media id 的 diagnostic fallback，并将本次 Stage 2 visual review 标记为不可通过，不能静默退回 committed deploy manifest。production build guard 在 `NODE_ENV=production` 下发现 `MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview`、preview manifest 或本地派生目录即失败，避免 `public/` 内容被误复制进产物。
- production build 不选择“最新”远端对象，也不在运行时抓取 manifest；它静态绑定仓库中的 deploy manifest。04–07 仍全部为 preview 时，manifest 可以是 schema-valid 的 `unpublished` 记录，pending media 没有 runtime URL、只走明确 fallback；一旦任一章节被标为 `published`，该章全部 required media 必须来自 finalized/verified release，否则 build 失败。manifest 缺失、仍为 candidate、source-spec hash 过期、id 不一致或验证 receipt 无效时也不能完成对应 published build。
- publication 脚本职责分为 prepare、upload、remote verify/finalize 和 promotion gate；provider adapter 只负责凭据化上传和远端 header/read-back，不改 source spec。凭据不进入 manifest、客户端 bundle、日志或 `NEXT_PUBLIC_*`。
- `promote-post-coscroll-release.mjs` 只验证 committed deploy manifest、远端 receipt、站点 build revision、章节 required media 与预算，并输出/校验待评审的 registry availability diff；它不重新上传媒体，也不在未评审时静默公开 route。
- verify/finalize 与 build/promotion 共用一个 base URL canonicalizer：只接受 HTTPS、无 credentials/query/hash 的 URL，规范化 scheme、host、default port、path prefix 和尾斜杠。receipt/deploy manifest 记录 canonical `verifiedOrigin`、`verifiedBasePath` 与完整 base URL SHA-256；build/promotion 对 `NEXT_PUBLIC_MIRALITH_MEDIA_BASE_URL` 做同样处理并逐项匹配，任何 origin 或 path 差异都 fail closed。
- 发布顺序固定为：生成 candidate derivatives/manifest → 上传 content-hash immutable assets → 验证 HTTPS、Range、CORS、MIME、cache、bytes 与 output hash → 生成并提交 finalized deploy manifest → promotion script 产出唯一 registry availability diff → 在隔离 release candidate 中只应用该 diff并构建 exact staging artifact → 完成叙事、fallback 与 release 验收 → 作者批准 → 将同一已验证 artifact 提升到 production；批准后不得再改代码或重建。
- 回滚部署使用上一站点 build 与其 Git 历史中的 deploy manifest；CDN 至少保留当前及前两个可回滚 release，并设不少于 30 天的 GC 宽限期。GC 只对所有受保留 release manifest 做 mark-and-sweep 后删除无引用 hash，不能在新 manifest 发布时立即清旧对象。
- 每个 clip 的 `endPTSExclusive` 是首个排除 source frame 的 PTS；`frame-hold` 使用最后包含帧 hash。AeScape scrub/showcase 不重复边界帧；宇宙片段的最后包含帧必须匹配眼睛 hash，首个泳池帧 PTS 不得落入派生文件。

| Budget surface | Desktop target | Mobile target | Enforcement |
|---|---:|---:|---|
| Route reveal critical transfer | `<=5 MB` | `<=3 MB` | poster + 第一段可播放 Range；超过则不通过 reveal budget |
| Current playable derivative + next prefetch window | `<=24 MB` | `<=13 MB` | 当前文件 + 下一段 metadata/initial Range；离场 abort/preload cleanup |
| Longest single derivative | `<=20 MB` | `<=10 MB` | ArtBreeze 继续按语义段拆片，不生成 51 秒单一 scrub 文件 |
| `/artbreeze` 完整默认路径 | `<=52 MB` | `<=28 MB` | loading/loop/prompt/answer、AeScape、Focuence 合计 |
| `/constellation` 完整默认路径 | `<=15 MB` | `<=9 MB` | SonoScope、Sadine、宇宙门槛合计 |
| Each remaining route | `<=20 MB` | `<=12 MB` | Li/UGCFlow 接入后在此 route cap 内剪辑和重平衡 |
| Production v1 catalog | `—` | `—` | `<=160 MB`，覆盖全部 desktop/mobile derivatives 与 posters，包含 Li/UGCFlow 预留，不包含母版 |

- desktop H.264 初始平均目标约 `2.8 Mb/s`，mobile 720p 约 `1.4 Mb/s`；具体 clip 可上下浮动，但以上 transfer/catalog cap 是最终约束。WebM 只有在同等视觉质量下至少节省约 20% 且仍处于总预算内时才生成。
- ArtBreeze 按 `CP0.4` 拆出 `first-bridge`，再拆为 `cycle`、`prompt`、`answer` 和静态 `frame-hold`，避免首屏为 51 秒 scrub 文件买单。
- production 视频使用 fast-start progressive MP4、内容 hash 文件名与 CDN/object storage，要求 HTTPS、CORS、byte-range、`Cache-Control: public, max-age=31536000, immutable`；manifest 只保存相对 asset key，并由与 receipt 完全匹配的 `NEXT_PUBLIC_MIRALITH_MEDIA_BASE_URL` 解析。切换 host、port 或 base path 必须产生新的 verify/finalize receipt，不能复用旧 release 的通过状态。
- `apps/site/public/media/post-coscroll/` 只作为 gitignored 的本地 preview 输出；母版和大视频派生不进入 Git 历史，也不把 Git LFS 作为站点运行依赖。CDN 未配置时可以完成本地 Stage 2 review，但不能发布 04–07。
- playback session 仅在状态为 expected-playing/seeking 时监视首帧、时间推进和预期结束：3 秒无首帧沿用 destination fallback；`waiting/stalled` 且 `currentTime` 2.5 秒无推进时显示 buffering，连续 8 秒后给出 retry/skip；早于 manifest 预期结束时间超过 `max(0.35s, 2 frames)` 的 `ended` 不得标记完成；移动 scrub seek 超过 1.5 秒时降级到最近 poster/keyframe stop。

## Implementation Units

- [ ] **Unit 0: Decompose and approve the first cinematic bridge**

**Goal:** 在写正式转场和 route 代码前，先用真实 CoScroll 终幕与 ArtBreeze 首段证明“旋转残影 → loading 圆环 → 等待困境”在剪辑、声音和滚动节奏上成立，并冻结唯一可实施方案。

**Requirements:** R1, R2, R3, R4, R13, R24

**Dependencies:** 当前 CoScroll 可运行画面或确定性末帧 capture；ArtBreeze 母版；本地 FFmpeg 与 FFprobe。不依赖 CDN，也不改 production route。

**Files:**
- Create: `docs/post-coscroll/CHECKPOINTS.md`
- Create: `docs/post-coscroll/first-sequence-shot-map.md`
- Create: `docs/post-coscroll/first-sequence-editorial-decision.md`
- Local generated output: `apps/site/.generated/post-coscroll-editorial/`
- Modify: `.gitignore`

**Approach:**
- 从现有 CoScroll 真实 `sceneProgress=1` 画面提取“空”的中心、外接尺寸、旋转方向、角速度范围、亮度与冰蓝残影基准；另保留 Canvas/model/signal 不可用时的静态缺口 ring 参考，不把 fallback 当成主方案。
- 对 ArtBreeze `00:00.00–00:18.53` 做逐镜 shot map：记录 source time base、PTS、首尾 frame hash、构图主体、圆环中心/直径/缺口角、明暗与色温、画面运动、字幕、对白/音乐/音效和可否重排。
- 明确比较三种接力样片，不先假设母版顺序就是网页顺序：
  1. `A — source-order`：CoScroll 残影接 `00:00` LOADING、夜间等待者与白场，再进入 `00:08.77` 真实圆环；
  2. `B — ring-first`：残影直接接 `00:08.77` 真实圆环和“我们每天都在推着……”；等待镜头后置、缩短或移出首段；
  3. `C — hybrid`：持久 DOM ring 先接管，再把选中的等待镜头嵌入或闪回，最后无缝落到影片真实圆环。
- 每种样片都至少提供一次线性播放和一次低保真 scroll-scrub capture，覆盖 CoScroll 最后 `2–3s` 与 ArtBreeze 前 `18.53s`；此处只做离线 proxy/animatic，不接正式 coordinator、不做 final Canvas 残影。
- 同时比较声音入点：A/B/C 各先绑定一套最合理声音，不做无意义的 3×3 全排列；视觉候选收敛后，再在领先版本上比较保留 ArtBreeze 原声、先静默后入声、以及用 CoScroll 残响跨过圆环三种处理，记录哪种最能把“滚动”读成徒劳与等待，而不是普通 loading。
- `CP0.3` 由作者选择 A/B/C、要求混合或判定 NO-GO；NO-GO 时只回到拆片、补镜头和样片，不得以“技术上能做”越过。
- `CP0.4` 冻结选定镜头顺序、`[startPTS,endPTSExclusive)`、声音、文字出现时机、补充素材、DOM/视频职责和连续性参数。Unit 1 只能消费这份 freeze，不得自行恢复到母版默认顺序。
- `CHECKPOINTS.md` 作为唯一 gate ledger，记录 checkpoint 状态、日期、证据链接、作者决策和 reopened 原因；作者 checkpoint 不能由实施者自行标为通过。

**Review scenarios:**
- **Frame truth:** shot map 能从 PTS 和 frame hash 回到母版，圆环首次实际出现位置与字幕入点没有凭记忆填写。
- **Continuity:** 三种样片都从同一 CoScroll 末态开始，能明确比较中心跳位、尺寸跳变、旋转方向、缺口相位、亮度和声音。
- **Meaning:** 不看产品名时，首次观看者仍能读到“重复、等待、推不完的石头”，而不是品牌 loading 或炫技转场。
- **Scrub fit:** 滚动前进时循环会留下积累，反向可理解地撤回；没有为了追视频时间而制造机械逐帧拖动。
- **Fallback truth:** 静态 ring 可以完成导航，但不会在评审材料中冒充真实角速度驱动的主路径。
- **Scope:** 样片不改 01–03 正式实现，不新增 production media contract，不提前搭完整 `/artbreeze`。

**Verification:**
- `CP0.1 Asset Truth`、`CP0.2 Bridge Variants`、`CP0.3 Editorial GO` 与 `CP0.4 Editorial Freeze` 全部在 ledger 中有证据。
- 作者能明确指出选定方案为何比另两种更能完成“徒劳 → 意义”的情绪接力。
- 冻结文档足以让另一个实现者在不重新猜剪辑意图的情况下填写 source spec 和实现 Stage 2。

- [ ] **Unit 1: Build the local media source spec and web derivatives**

**Goal:** 把 `CP0.4` 冻结的首段方案和其余已确认时间码变成唯一 source spec，并生成可供本地 Stage 2–5 review 的 scrub / autoplay 网页派生文件。

**Requirements:** R3, R6, R7, R8, R11, R12, R13, R16, R21, R23, R24

**Dependencies:** Unit 0 / `CP0.4 Editorial Freeze`；用户提供的源素材目录；本地 FFmpeg 与 FFprobe。Unit 2 可在 `CP0.4` 后与本单元并行；本单元不依赖 CDN。

**Files:**
- Create: `apps/site/content/postCoScrollMediaSource.ts`
- Create: `apps/site/content/postCoScrollMedia.ts`
- Create: `apps/site/lib/media/resolvePostCoScrollMediaManifest.server.ts`
- Create: `apps/site/lib/media/resolvePostCoScrollMediaUrl.ts`
- Create: `apps/site/scripts/check-post-coscroll-media-toolchain.mjs`
- Create: `apps/site/scripts/prepare-post-coscroll-media.mjs`
- Modify: `apps/site/package.json`
- Modify: `.gitignore`
- Create: `apps/site/.env.example`
- Local generated output: `apps/site/public/media/post-coscroll/`
- Create/Test: `tests/e2e/post-coscroll-media.spec.ts`

**Approach:**
- committed source spec 记录稳定 id、作品、来源标签/hash、source time base、`startPTS`、`endPTSExclusive`、模式（scrub / autoplay / loop）、poster 意图、桌面/移动版本、音频、fallback 和字节预算；ArtBreeze 首段必须逐项引用 `CP0.4` freeze，不能只抄 Confirmed Source Film Map 的候选范围。人类可读时间码只作 review label。
- toolchain check 验证 FFmpeg/FFprobe 可执行并记录版本；Next build 不执行转码。
- server-only manifest resolver 在显式 local-preview mode 下读取并验证本地 preview manifest；route Server Component 将 normalized serializable manifest 传给 client route shell。production build 明确拒绝 local-preview flag 和残留于 `public/` 的 preview manifest/派生目录。committed deploy manifest 的 production 分支由 Unit 9 接入。
- 转码脚本通过显式 `--source-root` 和 `--output-root` 读取用户提供的母版目录；清单只保存来源标签、source hash 和相对 asset key，不写入某台机器的绝对路径。缺少源目录、二进制或源文件时脚本立即失败，并列出缺失 id。
- ArtBreeze 按 freeze 拆出首段，再拆为 `cycle`、`prompt`、`answer` 与静态 `frame-hold`；AeScape 拆成 `scrub` 与 `showcase`。不让首个 scrub 文件覆盖 `00:00–00:51.76` 全段。
- 所有裁切使用 source time base 上的半开 PTS 区间；相邻 clip 不得复用边界 frame，最终派生清单记录首帧与最后包含帧 hash。
- 所有 HEVC 母版转为浏览器可用的 H.264 MP4，并按需要增加 WebM；scrub 版本使用短关键帧间隔，autoplay 版本优先压缩效率。
- 本地 public 输出与 `manifest.preview.json` 被 gitignore；manifest 记录相对 key、bytes、duration、frame rate、codec、source/output hash、frame hash 与 source-spec hash。
- source spec 中尚未到位的 Li/UGCFlow 保留为 `pending`，normalized manifest 不返回伪造可播放 URL，只指向明确 dossier/poster fallback。
- `postCoScrollMedia.ts` 提供统一 runtime facade；Stage 2–5 只通过 resolver 取得媒体，不直接拼本地路径，也不读取远端 `latest`。
- 每段提供 poster；`frame-hold` 使用实际尾帧，不依赖视频恰好停在浮点时间。
- Li / UGCFlow 先以 `pending asset` 状态存在，页面使用明确档案占位而不是伪造录屏。

**Patterns to follow:**
- `packages/coscroll-scene/src/assetManifest.ts` 的集中资产边界。
- `apps/site/components/chapter-transition/preloadChapterTarget.ts` 的目标特定、幂等预热方式。

**Test scenarios:**
- **Happy path:** 每个已接入媒体 id 都能返回可访问的 MP4、poster、精确 mode 和预期时长。
- **Integrity:** ArtBreeze scrub 不包含 `00:51.77` 之后的回答；answer 不包含 `01:35.40` 之后的品牌/二维码。
- **PTS integrity:** AeScape scrub 的 `endPTSExclusive` 等于 showcase 的 `startPTS`，边界 source frame 只出现在 showcase，两个派生文件没有重复 frame hash。
- **PTS integrity:** 宇宙剪辑最后包含帧 hash 对应 `01:14.20` 的眼睛；首个泳池 frame PTS 与 hash 均不出现在派生文件。
- **Error path:** 媒体缺失或 metadata 与清单不一致时，route 使用 poster fallback 并报告可诊断状态。
- **Toolchain:** 缺少 FFmpeg/FFprobe、版本信息或 source root 时生成步骤失败；普通 Next build 不受本地转码工具缺失影响。
- **Progressive media:** MP4 的 metadata 位于文件前部，首个 Range 可以解码 poster/首帧；manifest expected duration 与 frame rate 等于 FFprobe 结果的允许容差。
- **Editorial binding:** ArtBreeze 首段的镜头顺序、声音和 PTS 与 `CP0.4` 一致；freeze hash 不匹配时 prepare/review 失败，不静默回到母版顺序。
- **Local output:** 每个输出使用稳定相对 key，本地 generated directory 不进入 Git status。
- **Local preview consumption:** 无 CDN、显式 local-preview mode 下，server resolver 从 `manifest.preview.json` 返回真实本地 MP4/poster，页面可以完成 Stage 2 播放；source-spec hash、editorial-freeze hash、media id、相对路径、bytes/hash 或 metadata 任一不符时显示可诊断失败且 review 不通过。
- **Production isolation:** production mode 设置 local-preview flag，或构建输入中残留 preview manifest/本地派生目录时 build 失败；client bundle 没有 filesystem loader 或可切换到 preview source 的公开 flag。
- **Path safety:** manifest asset key 必须是无 `..` 的相对 key，不能通过媒体清单构造任意协议、任意主机或工作区外文件。
- **Budget:** entry/current-next/route/catalog 任一预算超限时 local manifest validation 失败，并打印超限媒体 id 与字节差额。
- **Performance:** 初次进入 `/artbreeze` 不请求 Focuence 之后的 constellation/client 媒体。

**Verification:**
- 本地 Stage 2 route 在没有 CDN 时实际播放经过 manifest 校验的本地派生文件；同一分支不可能进入 production build。
- editorial freeze、reader-facing 时间码、committed source spec、派生文件和页面 runtime facade 可追溯到同一稳定 media id。
- 本地网页派生不包含原始 HEVC 母版，已知约 192.87 秒片段与后续 Li/UGCFlow 预留共同保持在 production `160 MB` catalog cap 内。

- [ ] **Unit 2: Establish known, preview, and published chapter access**

**Goal:** 把现有 published-only coordinator 扩展为一致的 known/preview/published access graph，使 04–07 可以完整联调，但不会提前进入生产 rail 或 terminal-next。

**Requirements:** R14, R15, R18

**Dependencies:** Unit 0 / `CP0.4 Editorial Freeze`。本单元可与 Unit 1 并行，是 Units 3–9 的访问前置。

**Files:**
- Modify: `apps/site/content/miraLithChapters.ts`
- Create: `apps/site/components/chapter-transition/chapterPreviewSession.ts`
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify: `apps/site/components/chapter-transition/useChapterTerminalGate.ts`
- Modify: `apps/site/components/chapter-transition/preloadChapterTarget.ts`
- Modify: `apps/site/components/MiraLithChapterNavigation.tsx`
- Create: `apps/site/app/artbreeze/page.tsx`
- Create: `apps/site/app/constellation/page.tsx`
- Create: `apps/site/app/client-works/page.tsx`
- Create: `apps/site/app/now-building/page.tsx`
- Create: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Modify/Test: `tests/e2e/chapter-navigation.spec.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`

**Approach:**
- 单一 registry 为 01–07 提供 href 和 `known/preview/published` availability；production rail 仍只消费 published filter。
- `post-coscroll-v1` query bootstrap 激活当前 tab/build 的 preview session，scope 传播到 sessionStorage 和 history entry；Provider、preloader 和 preview rail 全部通过同一 access resolver 工作。Unit 2 只让 resolver 产出 03→04 的 next candidate，不启用真实 CoScroll terminal；现有 01/02 terminal gate 仅改为使用同一 resolver。
- known route 可直接访问和注册 destination controls；只有 preview session 或 published 状态允许 coordinator transition。scope 失效时不会把 preview route 自动当成 published。
- transition snapshot 的 source/target chapter type 从 published-only 改为 registry chapter + resolved access level；Unit 3 再在同一类型文件上增加 handoff/recovery union。
- 增加有限 edge kinds：`sutra-to-loop`、`focus-to-field`、`field-to-proof`、`proof-to-building`；不建立任意动画 DSL。
- 视频 destination ready 至少要求 poster 可见、metadata 已知且第一目标帧可以提交；失败时必须在 3 秒预算内切 poster/DOM fallback。
- route preloader 只预热当前 accessible edge 的下一章入口媒体，不批量预载后半段。
- 直接访问 `/artbreeze` 时从本章静态 loading ring 开始；其余 known route 从第一语义 stop 和 poster-ready 状态开始，且不自动有声播放。

**Patterns to follow:**
- `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx` 的 id/pathname stale-signal 防护。
- `apps/site/components/chapter-transition/useChapterTerminalGate.ts` 的正向输入门槛，但 next resolver 改为 access-aware。

**Test scenarios:**
- **Access:** known route 无 session 时可直接访问但不能被 terminal/coordinator 选为 next；有效 preview session 时 coordinator/review rail 顺序严格是 03 → 04 → 05 → 06 → 07，03 的 resolver 可报告 04 为 next candidate 但 Unit 2 不渲染真实 CoScroll terminal；published graph 保持现状。
- **Session/history:** 激活 preview 后跨 push、back、forward 保持 scope；build revision 改变、entry scope 缺失或 session 清除后退回 published graph。
- **Known direct history:** 从无 session 的 known route back/forward 时不出现永久 veil 或 rejected-runtime 死锁，目标页面按 direct-entry fallback 正常 mount。
- **Untrusted state:** 伪造/损坏的 sessionStorage 或 history state 不能选择 registry 外 href/edge，只能失效并走 published/direct fallback。
- **Readiness:** 目标视频未 ready 时 veil 不揭开；poster fallback ready 后可以正常揭幕。
- **Direct entry:** 每个后半段 URL 都能从本章语义入口独立启动，不依赖上一章视觉 handoff。

**Verification:**
- preview rail、review links、现有 01/02 terminal gate、preloader 和 coordinator 使用同一 access graph；正式 rail 仍过滤未发布章节。CoScroll terminal 及其视觉交棒留到 Stage 2。
- direct known navigation 与 preview transition 两条路径都没有永久 veil 或错误公开。

- [ ] **Unit 3: Add typed visual handoff, semantic recovery, and controller contracts**

**Goal:** 为 ring、star、water 接力、后半段返回恢复以及单一输入/播放状态机建立版本化契约，不再依赖单一 routeProgress、组件间隐式状态或到 Unit 5 才临时发明 gate 行为。

**Requirements:** R14, R15, R19, R20, R22

**Dependencies:** Unit 2

**Files:**
- Modify: `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx`
- Create: `apps/site/components/chapter-transition/chapterRouteState.ts`
- Modify: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Create: `apps/site/components/post-coscroll/narrativeControllerState.ts`
- Create: `apps/site/components/post-coscroll/mediaPlaybackAttempt.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`
- Create/Test: `tests/e2e/chapter-route-state.spec.ts`
- Create/Test: `tests/e2e/post-coscroll-controller-contract.spec.ts`

**Approach:**
- `beginTransition` 接收与 edge 匹配的 typed handoff union；runtime snapshot、visual layer 和 destination reset 共享同一 payload，错误 version/kind 降级 direct visual。
- 本单元只建立 payload validation、normalized geometry/CSS-variable bridge 和 deterministic fallback；ring/star/water 的最终视觉编排分别留在 Units 4、6、7，不在 foundation 中提前制作三套动画。
- `ChapterReturnSnapshot` 升级为 schema/build-versioned semantic state；route shell 通过 capture/restore adapter 提供 stable stop、completed/skipped media、playback state 和 route-specific state。
- 01–03 由 legacy adapter 继续读取/生成当前 routeProgress snapshot；后半段 restore 先恢复 semantic DOM 和 media tail frame，再对齐 scrollY。
- handoff 只活在 active transition，return snapshot 只负责历史恢复；两者使用独立 schema 和失效规则。
- malformed state 只能引用 registry/route manifest 中已知的 edge、stop 和 media id，校验失败时走 direct/default fallback。
- route adapter 在 semantic stop、媒体 outcome、mute 和 route-specific state 变化时立即写；播放时间最多每 2 秒节流写一次，并在 pause/seeked/ended/skip 补写。`pagehide` 同步 best-effort 写，coordinator 离场前再 capture。
- snapshot revision 阻止旧节流任务覆盖较新的 completed/skipped outcome；刷新恢复不依赖只有转场开始时才触发的 capture。
- `narrativeControllerState.ts` 只定义 route-agnostic 的 segment ownership、scrub/shelf/release、`answer-starting/manual-ready/autoplay/reverse-before-complete` 状态和合法 transition；不在本单元编排 ArtBreeze 镜头。
- `mediaPlaybackAttempt.ts` 定义单调 generation、segment/element/transition ownership 与 stale continuation 判定。fixture 使用真实 `<video>` ref 验证直接手势调用、二次播放 fallback、skip/reverse/new attempt/unmount invalidation；Unit 5 再把该 contract 接入完整播放组件。

**Patterns to follow:**
- `ChapterTransitionProvider` 现有 transition id、destination attempt 和 pathname stale-signal 过滤。
- `writeReturnSnapshot` / `readReturnSnapshot` 的 sessionStorage failure containment，但升级为 route adapter 而不是扩大 DOM guessing。

**Test scenarios:**
- **Handoff:** ring/star/water payload 在 source snapshot、persistent visual 和 destination reset 中字段一致；错误 version/kind 使用 direct fallback，不暴露空层。
- **Recovery contract:** fixture route 的 `await-send`、completed 和 playing snapshot 分别恢复为等待、尾帧和 paused/ready；实际 ArtBreeze/Focuence 行为在 Unit 5 接入后验证。
- **Legacy recovery:** 01–03 的现有 routeProgress snapshot 继续可读；未知 snapshot schema/build 使用确定性默认入口。
- **Untrusted state:** 伪造 snapshot/handoff 不能选择 route manifest 外 media id、任意 URL 或 transition kind。
- **Storage unavailable:** sessionStorage 读写失败时 route 使用确定性入口，transition 不死锁。
- **Write timing:** 播放中直接刷新最多回退 2 秒；刚发生的 send/skip/ended/semantic stop 在刷新后立即恢复；`pagehide` 与 coordinator 离场 capture 均不会被旧 throttle 覆盖。
- **Controller state:** scrub、await、starting、manual-ready、autoplay、reverse-before-complete、release 的合法/非法 transition 与唯一 input owner 都被 fixture 覆盖。
- **Attempt races:** delayed fulfill/reject/playing/ended 在 skip、reverse、new attempt、navigation 和 unmount 后不能写状态或 outcome；迟到 fulfill 导致底层播放时会再次 pause。

**Verification:**
- 每个跨路由视觉边都有明确 payload 或明确 direct fallback。
- 返回、刷新和 history traversal 不会重播已完成影片或恢复有声 playing。

- [ ] **Unit 4: Implement CoScroll rotation residue into the ArtBreeze loading ring**

**Goal:** 完成用户指定的 CoScroll 玉字旋转残留 → loading 圆环 → `/artbreeze` 首帧接力。

**Requirements:** R1, R2, R4, R14, R15, R16, R17, R18, R19, R24

**Dependencies:** Units 1–3

**Files:**
- Modify: `packages/coscroll-scene/src/types.ts`
- Modify: `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- Modify: `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- Modify: `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx`
- Create: `apps/site/app/coscroll-spike/useCoScrollNarrativeTerminal.ts`
- Create: `apps/site/components/chapter-transition/chapterTerminalPolicy.ts`
- Create: `apps/site/components/post-coscroll/CoScrollArtBreezeBridge.tsx`
- Modify: `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx`
- Modify: `apps/site/app/globals.css`
- Modify/Test: `tests/e2e/coscroll.spec.ts`
- Create/Test: `tests/e2e/coscroll-artbreeze-transition.spec.ts`

**Approach:**
- 没有 accessible next chapter 时继续使用当前 wrapped ritual time；preview/published target 可达时启用 clamped `narrativeProgress`，从正式初始进度开始，第一次正向到达 `1.0` 即 armed。
- `timeline → terminal-hold → terminal-exit → committing` 由 CoScroll 自己的虚拟 input owner 驱动，不再叠加 `useChapterTerminalGate` 的全局 wheel/touch listeners。
- terminal 前保持现有 scene 完全不变；`terminal-hold` 固定 source excerpt 末帧“空”，只有之后的额外滚动进入 exit window。
- 将 `CoScrollJadeAnchor` 已有的 angle/speed signal 以 transition-only contract 向 bridge 暴露，不让普通 source-match caustic 或背景消费它。
- rotation signal 同时暴露显式 readiness/fallback status。context lost、模型加载失败或 Canvas fallback 立即锁定本次 transition 为 fallback；进入 terminal 后 `500ms` 内没有首个有限 angle/speed sample，也单向降级，不能无限等待或被迟到 sample 再切回 live。
- exit window 中提高末字“空”的角速度，逐渐淡出歌词和实体玉字；少量 ghost arcs / screen-space path 根据真实角速度增加密度。
- exit progress 按共享 terminal policy 将正向/反向 delta 映射到 `0–1`；反向回到 0 取消残影，达到 1 才冻结 typed `coscroll-ring` payload 并 commit。
- 残影从不完整弧线收敛成一条细、缺口明确的 loading ring。ring 的中心、直径、颜色和角速度在来源 Canvas 与持久 DOM 层之间共享视觉参数。
- 当 DOM ring 已完全覆盖来源锚字时，coordinator 才执行 route push；目标 `/artbreeze` mount 后继续同一 ring 角度，再按 `CP0.4` 冻结方案进入选定影片/DOM 镜头，不硬编码从母版 `00:00` 顺序播放。
- fallback path 固定为“现有 CoScroll DOM/poster fallback → viewport-normalized 静态缺口 ring → 正常 route commit”；payload 使用 `signalSource=fallback`、零角速度和稳定 gap phase，目标不依赖真实 signal 才能 ready。
- 不使用 `preserveDrawingBuffer`、Canvas screenshot、AfterimagePass 或全屏 feedback RenderTarget。
- reduced-motion 使用“玉字淡出 → 静态缺口圆环 → ArtBreeze poster”的三步离散状态。

**Execution note:** 先为 CoScroll terminal 前的 source-match 截图和旋转行为添加 characterization coverage，再修改 rotation signal 接线。

**Patterns to follow:**
- `CoScrollJadeAnchor` 的当前 rotation smoothing 和速度 clamp。
- `ChapterTransitionVisual` 的持久 DOM ownership。
- `docs/miralith-transition-system/TRANSITION_PLAN.md` 的 path density、pause-frame 和 glow ceiling。

**Test scenarios:**
- **Happy path:** CoScroll terminal 后继续滚动，玉字加速、残影出现、圆环闭合，再进入 `/artbreeze`。
- **Availability:** preview 未激活且 04 unpublished 时 CoScroll 仍可无限循环；preview 激活或 04 published 后第一次正向到达末端进入 terminal。
- **Anchor integrity:** terminal-hold 与 exit 全程使用真实末字“空”，网络中不请求“道”资产。
- **Integrity:** terminal 前的 CoScroll 不渲染残影层，Silk、歌词和冷玉构图与当前版本一致。
- **Continuity:** route pathname 变化前后 ring 的中心、直径和旋转方向一致，没有黑闪或跳位。
- **Editorial binding:** bridge 的视频入点、等待镜头位置、文字和声音与 `CP0.4` 一致；更改 freeze 后旧实现证据自动失效并重新进入 Stage 2 review。
- **Edge case:** 用户在 commit 阈值前反向滚动，残影退回且不会开始路由导航。
- **Input:** transition commit 后旧 wheel inertia 不推进 ArtBreeze 时间线；需要新一笔输入。
- **Recovery:** 从 ArtBreeze back 返回 `terminal-hold`，`exitProgress=0`；刷新/直接访问从正式初始进度进入普通 timeline。
- **Error path:** ArtBreeze 视频未 ready 时 ring 保持或转为 poster fallback，不露出空白页面。
- **Forced fallback:** terminal 前触发 context lost、模型失败或持续 nil rotation signal 时，`500ms` deadline 后出现静态缺口 ring 并完成导航；迟到 signal 不造成角度跳变，页面不会停在 terminal。
- **Accessibility:** reduced-motion 不出现高速旋转或连续残影。
- **Performance:** 过渡中不创建第二个 WebGL context 或全屏反馈纹理。

**Verification:**
- 任意 pause-frame 都能读出“旋转痕迹正在成为 loading”，而不是随机 motion blur。
- `/coscroll` 仍能单独访问、返回和使用 fallback。

- [ ] **Unit 5: Build the ArtBreeze → AeScape → Focuence cinematic route**

**Goal:** 在 `/artbreeze` 内完成西西弗斯 scrub、主动发送、伪共时性回答、画框变窗框、AeScape scrub/展示和 Focuence 自动播放。

**Requirements:** R3, R4, R5, R6, R7, R8, R14, R15, R19, R20, R21, R22, R23, R24

**Dependencies:** Units 1–4

**Files:**
- Create: `apps/site/components/post-coscroll/ArtBreezeSequence.tsx`
- Create: `apps/site/components/post-coscroll/NarrativeController.tsx`
- Create: `apps/site/components/post-coscroll/NarrativeSegmentTrack.tsx`
- Create: `apps/site/components/post-coscroll/ScrollScrubVideo.tsx`
- Create: `apps/site/components/post-coscroll/CinematicPlaybackGate.tsx`
- Create: `apps/site/components/post-coscroll/useMediaPlaybackSession.ts`
- Create: `apps/site/components/post-coscroll/FramePortal.tsx`
- Create: `apps/site/content/artBreezeSequence.ts`
- Modify: `apps/site/app/artbreeze/page.tsx`
- Modify: `apps/site/app/globals.css`
- Create/Test: `tests/e2e/artbreeze-sequence.spec.ts`

**Approach:**
- `NarrativeController.tsx` 与 `useMediaPlaybackSession` 必须消费 Unit 3 已通过的 state/attempt contract；若实现需要新增 ownership 或状态转移，先标记 `CP1.3 REOPENED`，不能在组件内出现第二套隐式状态机。
- route 只创建一个主 ScrollTrigger，由 `NarrativeController` 根据已展开 segment 的实际 offsets 计算 local progress；DOM、ring、frame 和视频 seek 不各自创建竞争 timeline。
- ArtBreeze 前段用 scrub 驱动独立网页剪辑；视觉循环可以重复节奏，但 route progress 始终单调。
- 在 `await-send` 状态冻结在发送帧并进入有限 sticky shelf；下游 segment 不进入文档流，页面不持续 prevent wheel/touch。显示真实可聚焦的发送按钮和“跳过回答并继续”。
- answer video 在到达 `await-send` 前已经挂载于稳定 DOM 层、绑定 source 并预热 metadata/首个 Range；从 await 到 playing 不能因条件渲染替换实例。
- 发送 click 与 Enter handler 在同一 user activation task 内先对该实例直接调用 `play()`，再切换 controller 状态；pending 使用 `answer-starting`，fulfilled/`playing` 后才显示 pause 并进入 `answer-autoplay`。
- `useMediaPlaybackSession` 为每次 send/play/resume/replay 分配单调 attempt id，并将其与当前 route transition、segment 和 video element 绑定；所有 Promise 和 media-event continuation 在改变状态前验证 active attempt。
- answer autoplay 期间沿用 shelf，保持可见 pause、skip、replay；原生滚动只改变 shelf 内物理位置，不 seek 影片。正常 `ended` 写 completed；明确 skip 写 skipped，并显示回答摘要与《星月夜》尾帧，再展开下一 segment。
- 反向越过 autoplay shelf 入口时 controller 进入 `reverse-before-complete`：先失效 attempt、pause、写 `paused/ready + mediaTime`，再允许用户回到上游。返回 shelf 后必须由 Resume/Replay 创建新 attempt；不自动恢复声音。
- gate 释放时保持当前 sticky visual 的 viewport anchor，刷新 ScrollTrigger 并等待 160ms inertia settle；旧滚动惯性不能直接消费新 segment。
- answer 元素/source/metadata 尚不可用、同步调用失败或 `video.play()` Promise 被拒绝时，保持发送后的同一语义状态并展示明确的“播放回答”控制；不能在 effect/ready event 中排队自动有声补播，不能把 rejection 当作影片完成，也不能让 timeline 自动越过回答。
- skip、cancel、反向离场、route transition、unmount 或新 replay 会同步 invalidation 并 pause。旧 Promise 迟到 fulfill 时再次 pause；迟到 reject/playing/ended 不更新当前 UI、snapshot 或 completed outcome。
- answer 停在《星月夜》实际尾帧，DOM frame 接管边框；视频本身不承担精确 frame morph。
- AeScape 云海在同一 `FramePortal` 内出现，scrub 到 `05.60s` 时边框从画框材质过渡成窗框和玻璃反射。
- AeScape `16.47s` 后切自动播放；Focuence 随后完整播放一次。
- Focuence 片尾文字、马群余光和界面点位收束成 constellation handoff seed；该 seed 由持久转场层带到 `/constellation`。
- answer、AeScape 和 Focuence 的 `waiting/stalled/ended-too-early` 统一交给 playback watchdog；异常不能被当成 completed media。
- 产品信息只在每段结束后以简短 dossier marker 出现；点击才展开角色、状态和链接。

**Test scenarios:**
- **Scrub mapping:** route 进入指定语义 stop 时，ArtBreeze video time 落在对应已确认时间码容差内。
- **Input:** 到达发送帧前 click 不启动 answer；发送按钮或 Enter 只启动一次有声 autoplay。
- **User activation:** answer video 在 `await-send` 前已经存在且 source 不变；click/keydown 的同一 handler 直接发起 `play()`，没有经由 React effect、`canplay` 或 timeout 才调用。
- **Manual fallback:** video 未挂载/`HAVE_NOTHING` 或 `play()` Promise rejected 时不在之后的 ready event 自动发声；页面显示“播放回答”，第二次 click 才启动，skip 与字幕仍可用。
- **Delayed fulfill:** `play()` pending 后用户 skip/cancel、反向离场或导航，旧 Promise 再 fulfilled/触发 `playing` 时 video 保持 paused，不进入 autoplay、不发声、不覆盖 snapshot。
- **Delayed reject:** attempt A pending 后用户发起 replay B，A 才 rejected 时不能把 B 切回 manual-ready 或显示旧错误；只有 B 的 continuation 可以改变当前状态。
- **Unmount cleanup:** answer-starting 期间 route unmount 会失效 attempt 并 pause；之后任何旧 media event 都不能写 completedMediaIds。
- **Physical scroll:** await/autoplay 未释放时下游 DOM 不可达，但 wheel/touch 没有持续 `preventDefault()`；用户始终可通过 skip 释放，并且释放后需新输入才推进。
- **Reverse before complete:** autoplay 中反向跨过 shelf 入口会立即 pause 并保存当前时间，不标记 completed/skipped；影片离屏无声音，再次进入只显示 Resume/Skip/Replay，Resume 由新 attempt 继续。
- **Alignment:** gate 前后 sticky frame 的 viewport position 不跳变；ScrollTrigger refresh 不把当前 stop 映射到错误的下一段 progress。
- **Autoplay:** answer 完成后停在 `01:35.35` 的画面，不进入品牌/二维码。
- **Continuity:** AB 尾帧收成画框后，AeScape 云海在同一矩形内出现，`05.60s` 后读为真实窗。
- **Mode boundary:** AeScape `00:00–00:16.47` 由 scrub 控制，后段不受滚轮 seek。
- **Playback:** Focuence 在进入可见阈值时播放一次；反向滚动不会不断重新启动，Replay 可以明确重播。
- **Recovery:** back/refresh 到 `await-send` 仍停在发送；已完成 answer/Focuence 保持尾帧；离场时处于 playing 的媒体恢复为 paused/ready 且不自动有声。
- **Skip/accessibility:** 键盘可以推进语义 stop、发送、暂停和跳过；焦点不会被 pinned 容器困住。
- **Error path:** 任一视频解码失败时使用该段 poster，并仍能进入下一语义 stop。
- **Watchdog:** `waiting/stalled` 超时出现 buffering/retry/skip；`ended-too-early` 不写 completedMediaIds；正常结束只写一次完成状态。

**Verification:**
- 用户在看到产品名之前，已经经历等待、选择意义、打开窗和注意力收束。
- 页面没有三个独立 ScrollTrigger 同时写同一视频或 transform。

- [ ] **Unit 6: Build the constellation and overflowing media vitrines**

**Goal:** 完成 Focuence 片尾星群、星 + 卡导航、SonoScope 弹幕越界、Sadine 实时鱼和宇宙门槛。

**Requirements:** R8, R9, R10, R11, R14, R15, R16, R19, R20, R21

**Dependencies:** Units 1–3, 5

**Files:**
- Create: `apps/site/components/post-coscroll/ConstellationSequence.tsx`
- Create: `apps/site/components/post-coscroll/ProjectStarField.tsx`
- Create: `apps/site/components/post-coscroll/MediaVitrine.tsx`
- Create: `apps/site/components/post-coscroll/SonoScopeVitrine.tsx`
- Create: `apps/site/components/post-coscroll/SadineVitrine.tsx`
- Create: `apps/site/components/post-coscroll/DanmuOverflowLayer.tsx`
- Create: `apps/site/components/post-coscroll/FishOverflowLayer.tsx`
- Create: `apps/site/components/post-coscroll/CosmicThresholdVitrine.tsx`
- Create: `apps/site/content/constellationProjects.ts`
- Create: `apps/site/content/sonoscopeDanmu.ts`
- Modify: `apps/site/app/constellation/page.tsx`
- Modify: `apps/site/app/globals.css`
- Create/Test: `tests/e2e/constellation-sequence.spec.ts`

**Approach:**
- 星群有默认滚动路线，同时每颗星和对应卡都是可聚焦链接；访问过的节点保持微弱亮度，形成用户路径。
- 星点关系来自真实主题与媒介，不使用均匀圆环或随机银河。
- `MediaVitrine` 统一容器坐标、scroll 位移/缩放、poster、播放状态和 dossier，但允许每个作品提供不同的边界行为。
- SonoScope 使用完整 11.5 秒片段；弹幕 cue 与视频时间同步，文字越过容器并可被指针轻微扰动或短暂停留。
- Sadine 使用推荐 12 秒剪辑；视频是环境层，6–12 条实时前景鱼受指针光场吸引/避让并能游出容器。
- 精细指针使用 hover/移动形成光场；触屏使用按住或拖动形成吸引点；没有 hover 的设备在无触摸时回到缓慢自主游动，不丢失 Sadine 的生命感。
- 鱼和弹幕使用 DOM/2D overlay，不另开 WebGL context；低档设备减少数量，fallback 保留静态越界构图。
- 宇宙剪辑从 `01:07.30` 自动播放到 `01:14.20`，停在眼睛；蓝色虹膜/高光扩展为进入 `/client-works` 的水面门槛。
- Focuence → constellation 使用 `focuence-stars` payload，宇宙门槛 → client works 使用 `cosmic-water` payload；目标 route 缺少 payload 时使用各自默认稳定入口。
- SonoScope、Sadine 和宇宙门槛的 autoplay shelf 复用 `NarrativeController` gate contract；视频 stalled 或提前 ended 时保留 retry/skip，不自动点亮下一个星点。
- TaBient 不进入 v1 数据清单或页面；以后只有在声音交互和主线位置确认后再加入，避免为未来节点预留空抽象。

**Test scenarios:**
- **Navigation:** 默认滚动依次到 SonoScope、Sadine、宇宙门槛；点击星卡可以直接进入对应语义 stop。
- **State:** 已访问星点在 route 内保持 visited 状态，刷新后不要求持久化。
- **SonoScope:** 弹幕在指定 cue 出现并越过容器；视频失败时文字仍有静态语义版本。
- **Sadine:** 指针进入光场后前景鱼响应，离开后回到自然运动；视频层和鱼层生命周期同步清理。
- **Cosmic:** 视频结束于 `01:14.20`，不会显示 `01:14.30` 的泳池镜头。
- **Handoff:** Focuence star origin 与 constellation seed 连续；cosmic eye highlight 与 client water origin 连续；payload version 错误时仍能稳定直达目标 poster。
- **Playback failure:** SonoScope/Sadine/cosmic 中途 stalled 或 ended-too-early 时不写 completed 状态，用户可以 retry 或 skip 后继续。
- **Reduced motion:** 星群静态、弹幕不高速横穿、鱼使用少量离散位置，所有项目链接仍可用。
- **Performance:** 离场容器暂停视频和动画；同时解码的视频不超过当前和预热下一段。

**Verification:**
- 三个容器共享视觉语法，但 SonoScope 读作语言越界、Sadine 读作生命越界、宇宙混剪读作容器消失。
- 星群既能引导默认路线，也能作为可访问项目索引。

- [ ] **Unit 7: Build distinct delivered-work containers for Dulwich, Li, and UGCFlow**

**Goal:** 使用真实成片/录屏完成从作者实验到真实交付与多维裂变的落地章节。

**Requirements:** R11, R12, R13, R14, R15, R19, R20, R21

**Dependencies:** Units 1–3, 6; Li/UGCFlow final recording assets

**Files:**
- Create: `apps/site/components/post-coscroll/ClientWorksSequence.tsx`
- Create: `apps/site/components/post-coscroll/DulwichFilmVitrine.tsx`
- Create: `apps/site/components/post-coscroll/LiWebsiteVitrine.tsx`
- Create: `apps/site/components/post-coscroll/UGCFlowFractureVitrine.tsx`
- Create: `apps/site/content/deliveredWorks.ts`
- Modify: `apps/site/app/client-works/page.tsx`
- Modify: `apps/site/app/now-building/page.tsx`
- Modify: `apps/site/app/globals.css`
- Create/Test: `tests/e2e/delivered-works-sequence.spec.ts`

**Approach:**
- 宇宙眼睛的蓝色高光扩展成水面，再稳定为第一个真实作品屏幕。
- Dulwich 容器按“成片银幕”处理：完整画面、无伪浏览器控制，必要时使用现成总成片或 12 段真实素材的网页剪辑。
- Li 容器按“人物身份窗口”处理：保留真实网站滚动、hover 和页面转换的录屏语法。
- UGCFlow 从单一录屏开始，随 scroll 分裂为不同比例、地区、角色或平台版本；点击任一分屏可以暂时 solo。
- 三段均在体验后显示简洁档案：Client / Role / Scope / Delivered / Link。档案不覆盖影片核心构图。
- UGCFlow 结束后，所有分屏重新对齐并收成 About / Contact 的单一人物入口。
- 每个项目通过 route state adapter 记录 semantic stop、completed/skipped media outcome 和 solo/matrix 状态；返回时不自动重播已完成/跳过成片，也不恢复离场前的有声 playing 状态。

**Test scenarios:**
- **Dulwich:** 成片按一次完整播放，容器不显示浏览器式 UI；缺少总成片时可切换到已确认的 12-shot 派生剪辑。
- **Li:** 录屏保持真实页面比例和清晰度，poster fallback 保留身份网站语义。
- **UGCFlow:** scroll 裂变阶段从单画面稳定扩展到多画面；solo 后能返回总体矩阵。
- **Asset gate:** Li 或 UGCFlow final recording 尚未接入时，页面明确显示档案占位并跳过媒体，不使用虚假录屏。
- **Navigation:** 用户可跳过任一成片并继续下一项目或 About / Contact。
- **Recovery:** 返回 Dulwich/Li/UGCFlow 时恢复最后语义 stop 和尾帧/矩阵状态；playing 状态归一为 paused/ready。
- **Playback failure:** 中途 stalled 或提前结束显示 retry/skip，不能把不完整录屏当作 Delivered 完成。
- **Reduced motion:** 容器不连续缩放或裂变，改为离散单屏 → 多屏状态。

**Verification:**
- 即使三个项目都使用视频，也能明确读出“动态成片 → 身份网站 → 多维生产系统”的递进。
- 项目档案与真实录屏一致，不声明影片中未展示的交付结果。

- [ ] **Unit 8: Harden input, audio, accessibility, performance, and visual review**

**Goal:** 统一后半段输入权、声音会话、降级、深链恢复和视觉验收，保证长叙事可完成而不劫持用户。

**Requirements:** R4, R5, R14, R15, R16, R18, R19, R20, R21, R22

**Dependencies:** Units 1–7

**Files:**
- Create: `apps/site/components/post-coscroll/useNarrativeInputOwner.ts`
- Modify: `apps/site/components/post-coscroll/useMediaPlaybackSession.ts`
- Create: `apps/site/components/post-coscroll/useMediaPlaybackWatchdog.ts`
- Modify: `apps/site/components/post-coscroll/PostCoScrollRouteShell.tsx`
- Modify: `apps/site/components/chapter-transition/preloadChapterTarget.ts`
- Modify: `apps/site/app/globals.css`
- Modify/Test: `tests/e2e/post-coscroll-media.spec.ts`
- Modify/Test: `tests/e2e/artbreeze-sequence.spec.ts`
- Modify/Test: `tests/e2e/constellation-sequence.spec.ts`
- Modify/Test: `tests/e2e/delivered-works-sequence.spec.ts`

**Approach:**
- 每个 route 维护明确 input owner：scroll timeline、await-send、autoplay controls、local pointer 或 route transition；owner 切换后丢弃前一阶段惯性输入。
- 通用 playback session 将 answer 的 attempt-generation contract 扩展到所有 autoplay media：任何 segment ownership 变化、新播放请求、skip/cancel、visibility hidden、route transition 或 unmount 都 invalidate + pause，stale continuation 只能被忽略或再次 pause。
- `NarrativeController` 的 gate release、history restore 和 route transition 都先持久化 semantic snapshot，再改变 DOM 高度或 pathname；restore 期间 controller 不消费 ScrollTrigger update。
- ArtBreeze 发送动作只保证当次 answer 拥有可靠的 user activation；answer video 预挂载，发送 handler 直接调用并检查 `play()`，任何 ready/effect 回调都不得补发有声播放。共享会话记录用户的 mute / unmute 偏好，但不假设这份激活能跨影片或跨路由永久绕过浏览器自动播放策略。
- 后续影片默认允许 muted inline autoplay；只有在当前 `play()` 被浏览器接受且用户已明确选择有声时才开启声音。任何 play rejection 都回到 poster + 显式播放按钮，字幕和语义推进不依赖声音成功。
- 所有 cinematic 段提供可聚焦的 pause / skip / replay，并支持 Space、Enter、PageDown 和方向键的语义推进。
- reduced-motion 不运行视频 scrub、残影、快速弹幕或连续容器缩放；使用关键帧 poster、简短淡入和完整文字说明。
- 移动端优先使用分段关键帧与短 autoplay，不强行对长视频进行高频 seek。
- 宽屏且具精细指针时保留完整 frame/constellation/overflow 构图；窄屏或 coarse pointer 下改为按叙事顺序纵向排列的星卡与全宽播片，越界元素只能越过容器、不能越过 viewport 安全区，控制目标不小于 44×44 CSS px。
- 每一段都有与视觉同步的 DOM 标题、字幕/文字摘要和项目链接；纯装饰残影、鱼和星尘对读屏隐藏，星群在语义层表现为有序项目导航。
- 每段离场时暂停视频、取消 frame callback、移除 pointer/wheel listener，并释放非缓存纹理/Canvas。
- playback watchdog 统一处理 startup、`waiting/stalled`、seek timeout 和 `ended-too-early`；只有满足 manifest duration tolerance 的正常 ended 才能写 completedMediaIds，显式 skip 单独写 skippedMediaIds。
- 关键视觉验证覆盖桌面、窄屏、reduced-motion、forced fallback 和慢媒体网络；只对这一关键叙事路径使用 Playwright 视觉与输入验证。

**Test scenarios:**
- **Input isolation:** autoplay 期间 scrub timeline 不写 video time；route transition 期间所有本地输入暂停。
- **Audio:** 未发送前影片不强制有声；发送后 answer 可以有声，mute 偏好延续到后续影片，但跨路由 play rejection 会回到显式播放控制而不是卡住或假完成。
- **Activation timing:** fresh-origin 策略下，发送 handler 的直接 `play()` 成功时才进入 playing UI；人为延迟到 effect/canplay 的调用被视为失败路径并落到二次播放控制。
- **Attempt races:** delayed fulfill/reject/playing/ended 在 skip、reverse、new replay、navigation 和 unmount 后均不能复活旧 media、发声、覆盖新 UI 或写 completed outcome。
- **Reverse ownership:** 未完成 autoplay 反向离开 shelf 后立即暂停并写 paused/ready；返回时必须显式 Resume，且下游仍保持折叠直到正常 ended 或 skip。
- **Keyboard:** 用户不用鼠标也能发送、暂停、跳过、重播、选择星卡和到达 Contact。
- **Responsive/semantic:** 窄屏按既定项目顺序呈现，无横向滚动；读屏可以依次获得段落标题、字幕摘要、播放控制和项目链接，不朗读装饰鱼群或残影。
- **Recovery:** 刷新或返回至 scene-local anchor 后，页面恢复稳定 poster/尾帧，不意外自动播放有声内容。
- **Fallback:** WebGL context lost、video decode failure、startup timeout、mid-play stall 和 slow network 都有可读、可重试、可跳过的 DOM 路径。
- **Snapshot migration:** legacy 01–03 snapshot、current schema、未知 schema/build 分别走兼容恢复、精确语义恢复和确定性默认入口。
- **Cleanup:** 离开 route 后没有继续增长的 video time、requestAnimationFrame、wheel listener 或 Canvas context。
- **Visual:** CoScroll ring、AB/AS frame、Focuence star seed、overflow containers 和 cosmic threshold 的 pause-frame 构图符合设计。

**Verification:**
- 一次完整默认路径可从 CoScroll 走到 About / Contact，不需要刷新，不出现输入死锁。
- fallback 与 reduced-motion 用户仍能理解相同项目顺序和核心意义。

- [ ] **Unit 9: Publish immutable media and promote the canonical chapter registry**

**Goal:** 在本地叙事、真实素材和 hardening 全部通过后，把确切媒体发布到已验证 CDN，让 production build 只引用 immutable hash，并以独立 release gate 将 04–07 从 preview 提升为 published。

**Requirements:** R12, R13, R16, R18, R21, R23

**Dependencies:** Units 1–8；`CP5.4 Delivered Work GO`、`CP6.1 Runtime Hardening` 与 `CP6.2 Accessibility / Fallback / Visual`；Li/UGCFlow 最终录屏；真实 CDN/object-storage base URL 与部署凭据。

**Files:**
- Create: `apps/site/generated/post-coscroll-media-manifest.json`
- Create: `apps/site/lib/media/canonicalizePostCoScrollMediaBaseUrl.ts`
- Modify: `apps/site/content/postCoScrollMedia.ts`
- Modify: `apps/site/lib/media/resolvePostCoScrollMediaManifest.server.ts`
- Create: `apps/site/scripts/publish-post-coscroll-media.mjs`
- Create: `apps/site/scripts/verify-post-coscroll-media-release.mjs`
- Create: `apps/site/scripts/promote-post-coscroll-release.mjs`
- Modify: `apps/site/package.json`
- Modify: `apps/site/.env.example`
- Modify: `apps/site/content/miraLithChapters.ts`
- Local publication candidate: `apps/site/.generated/post-coscroll-release/`
- Modify/Test: `tests/e2e/post-coscroll-media.spec.ts`
- Modify/Test: `tests/e2e/chapter-navigation.spec.ts`
- Modify/Test: `tests/e2e/chapter-transition.spec.ts`

**Approach:**
- publication mode 从 committed source spec 与已经验收的本地派生生成 content-hashed candidate bundle；母版、凭据、绝对路径和本地 preview manifest 都不进入 deploy manifest 或客户端。
- 上传只写 immutable key。provider adapter 完成后，remote verify 对每个对象检查 bytes/hash、MIME、CORS、Range、immutable cache、duration/frame rate 和首尾 frame hash；任一对象失败都不 finalize。
- verify/finalize 与 Next build 使用同一 canonical base URL helper。receipt 与 deploy manifest 同时记录 `verifiedOrigin`、`verifiedBasePath`、`verifiedBaseUrlSha256`、release id、source-spec hash、editorial-freeze hash 和验证时间。
- 只有远端验证全部通过后才生成 committed deploy manifest；`postCoScrollMedia.ts` 在 production 静态导入该文件，不从本地 preview、远端 `latest` 或 runtime 可切换 flag 解析资产。
- production build 对 candidate、stale source spec、stale editorial freeze、错误 origin/base path/hash、缺失 receipt、超预算或 required media pending 全部 fail closed；04–07 仍为 preview 时可以用明确 unpublished fallback 完成现有 01–03 build。
- promotion script 只生成 release/chapter-set 与唯一 registry availability diff，并复核 `CP6.1–CP6.2` 与媒体 receipt；它不能把上传、验证、构建和公开合并成一次隐式写操作。
- release candidate 只允许在 canonical registry 应用这份 availability diff，将目标章节从 `preview` 改为 `published`；`publishedMiraLithChapterHrefs` 与 `publishedMiraLithChapters` 继续作为派生过滤视图自动更新。随后构建并验证 exact staging artifact，将 artifact hash/build revision 写入 `CP6.3`。
- `CP6.4 Production Promotion GO` 只批准把 `CP6.3` 的同一 artifact 提升到 production；批准后若 registry、代码、manifest、环境 base URL 或 build 任一变化，必须重开 `CP6.3`，不得边发布边重建。
- 旧 hash 资产按当前 + 前两个 release 且不少于 30 天保留；GC 依据受保护 deploy manifests 做 mark-and-sweep。回滚先切回旧 build/manifest，不能依赖重新上传同名对象。
- CDN/provider credentials 只存在于部署 secret；`NEXT_PUBLIC_MIRALITH_MEDIA_BASE_URL` 只包含已验证公开 base URL，不携带 token。

**Test scenarios:**
- **Delivery:** production asset URL 使用 content hash，响应支持 Range、正确 MIME/CORS 和 immutable cache；本地 generated directory 不进入 Git 或 production artifact。
- **Build binding:** 04–07 全部 preview 时，schema-valid unpublished fallback 不破坏现有 production build；一旦章节进入 published set，finalized deploy manifest、receipt 或 source/editorial hash 任一缺失/过期都会使 build 失败。
- **Pending isolation:** Li/UGCFlow 为 pending 且所属 route 未发布时 build 使用明确 fallback；尝试发布含 required pending media 的 route 时 promotion/build gate 失败。
- **Promotion ownership:** promotion 对正确 release/chapter set 生成唯一可评审 diff；错误 release id、缺失 required media、未通过 checkpoint 或超预算时拒绝。release candidate 只能应用该 diff；production promotion 必须复用已经记录的 exact artifact hash，不能重新构建。
- **Origin binding:** verify 与 build/promotion 的 canonical base URL 完全一致时通过；scheme、host、显式/默认 port、path prefix 或规范化 hash 不同都要求重新 verify/finalize。
- **Rollback:** 回滚到上一 deploy manifest 后所有旧 hash 仍可 Range 读取；GC dry-run 不会标记任何受保护 release 对象。
- **URL safety:** production base URL 必须是 HTTPS；asset key 必须是无 `..` 的相对 key，不能构造任意协议或主机。
- **Budget:** entry/current-next/route/catalog 任一预算超限时 verification 失败，并打印超限媒体 id 与字节差额。
- **Registry:** 只改变 canonical registry 的 availability；正式 rail、terminal-next、preload 与 metadata 通过派生视图一致点亮，preview session 行为不回归。

**Verification:**
- production network 中不出现原始 HEVC 母版、本地 preview URL 或未验证 origin。
- production build 引用的每个 media id 都能追溯到 editorial freeze、source spec、远端对象、receipt 和 deploy manifest。
- `CP6.4` 前正式站点只公开 01–03；通过后 04–07 的 rail、转场和预载一次性来自同一 canonical registry 状态。

## System-Wide Impact

- **Interaction graph:** CoScroll virtual terminal、access resolver、typed handoff、persistent transition visual、server-only media resolver、NarrativeController、attempt-scoped playback session、playback watchdog 和 local pointer overlays 构成新的跨层接缝；任一时刻仍只有一个 input owner。
- **Error propagation:** 模型/视频错误先变成当前章节的 visible fallback/buffering state；startup failure 可以触发 destination fallback，中途 stall/early-ended 只能 retry/skip，不能伪造 completed 或让全局 veil 永久停留。
- **State lifecycle:** scrub、await-send、autoplay、reverse-before-complete、hold、completed/skipped media、preview scope 和 route transition 都有 versioned capture/restore 与 cleanup；旧 route 的异步 media continuation 同时由 playback attempt、segment ownership、element identity、transition id/pathname 过滤。
- **Registry parity:** known/preview/published resolver 是 rail、terminal next、direct links、preloader、coordinator、history 和 metadata filtering 的共同来源。
- **Handoff lifecycle:** payload 只存在于 active cross-route transition；semantic return snapshot 独立持久化，二者不能相互替代。
- **Asset lifecycle:** 当前媒体与下一媒体可同时存在于 decode/preload window；更远媒体不加载，离场请求 abort、视频暂停。本地 preview 与 production deploy manifest 由 server-only resolver 严格隔离；CDN origin/base path、Git/catalog budget 和旧 release 保留由 manifest verification 统一约束。
- **Unchanged invariants:** 01–03 的项目内容、单 active Canvas 和 ready/fallback 契约保持不变；04 不可访问时 CoScroll 继续当前循环。仅在 preview/published next 可达后启用有限 terminal，legacy return snapshot 继续兼容。

## Stages and Checkpoints

Stage 是一组有边界的制作工作，checkpoint 是进入下一 Stage 前必须停下来的证据门。所有状态统一写入 `docs/post-coscroll/CHECKPOINTS.md`，只允许 `NOT STARTED → IN REVIEW → PASS`；证据失效或上游决定变化时改为 `REOPENED`。下一 Stage 只有在当前 Stage 的所有 checkpoint 都为 `PASS` 后才能开始。

Checkpoint 分三类：

- **TECH：** 由可复现的文件、测试、capture、manifest 或网络验证证明；
- **AUTHOR：** 必须由作者明确 review 和选择，实施者不能代替作者判定；
- **RELEASE：** 必须绑定确切 release、build、CDN receipt 与 registry diff，不能用本地演示代替。

| Stage | Objective | Primary units | Blocking exit |
|---|---|---|---|
| Stage 0 | 拆真实首段、比较接法、确认是否契合 | Unit 0 | `CP0.4 Editorial Freeze` |
| Stage 1 | 建立本地媒体、访问、handoff、恢复和播放状态契约 | Units 1–3 | `CP1.4 Architecture Ready` |
| Stage 2 | 实现 CoScroll → ArtBreeze 首段 production thin slice | Unit 4；Unit 5 首段 | `CP2.4 First Bridge GO` |
| Stage 3 | 完成 ArtBreeze → AeScape → Focuence 情绪主线 | Unit 5 其余部分 | `CP3.4 Core Narrative GO` |
| Stage 4 | 完成星群、SonoScope、Sadine 与宇宙门槛 | Unit 6 | `CP4.4 Constellation GO` |
| Stage 5 | 完成 Dulwich、Li、UGCFlow 与 About / Contact 收束 | Unit 7 | `CP5.4 Delivered Work GO` |
| Stage 6 | 完成全链 hardening、CDN release 与正式发布 | Units 8–9 | `CP6.4 Production Promotion GO` |

### Stage 0 — Editorial fit before implementation

本 Stage 只拆片和做 proxy，不写正式转场、route timeline 或 production media contract。它回答的不是“能不能做”，而是“哪一种接法最能把人带入等待和西西弗斯困境”。

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP0.1 Asset Truth` | TECH | CoScroll 真实末态 capture；ArtBreeze `00:00–00:18.53` ffprobe 数据、逐镜 contact sheet、PTS/frame hash、声音与文字 shot map | 所有候选镜头、圆环首次出现位置、声音入点和 fallback 状态均可追溯到真实源文件 | 补抓帧、重做 PTS 或补齐素材；不得开始样片选择 |
| `CP0.2 Bridge Variants` | TECH | A source-order、B ring-first、C hybrid 三版线性样片与 scrub animatic；统一的中心/尺寸/方向/明暗/声音比较表 | 三版从同一 CoScroll 末态开始、覆盖同一评审范围，差异来自剪辑选择而非完成度不一致 | 重做缺失或不可公平比较的版本；不得把唯一完成的一版当默认答案 |
| `CP0.3 Editorial GO` | AUTHOR | 三版样片、比较结论、补充素材清单与作者批注 | 作者对一个确切样片版本明确给出 GO，并能说清“为何它读作困境而非 spinner”；任何混合或修改要求都必须先做成新样片再 review，不能把修改意见本身当作通过 | `NO-GO` 或修改意见都留在 Stage 0，重剪、补场景、重做声音后再次 review |
| `CP0.4 Editorial Freeze` | AUTHOR + TECH | `first-sequence-editorial-decision.md`：选定顺序、半开 PTS、frame hash、声音、文字、DOM/视频职责、连续性参数、补充素材、版本 hash 与作者确认 | 另一实现者无需猜测即可填写 source spec；所有首段决策只有一个当前版本 | 任一冻结项改变即标记 `REOPENED`；Stage 1–2 的相关证据全部失效并按影响范围重跑 |

### Stage 1 — Architecture and local media contracts

只有 `CP0.4` 通过后才开始。此 Stage 可以写基础设施和 contract fixture，但不制作完整后半段视觉。

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP1.1 Local Media Contract` | TECH | source spec、toolchain report、真实本地派生、`manifest.preview.json`、local resolver 与 production-isolation 测试 | 首段严格绑定 editorial-freeze hash；无 CDN 可真实播放；production 无法进入 local-preview 分支 | 修复 source/manifest/resolver；不得用 poster fallback 假装 local playback 已通过 |
| `CP1.2 Chapter Access Graph` | TECH | known/preview/published access matrix；tab/build-scoped preview session；back/forward、伪造 state、production rail isolation 与 ArtBreeze local playback tests | preview 03→04→05→06→07 可走而 production/public rail 仍只暴露 01–03；直接 known history 无永久 veil；本地 ArtBreeze manifest 真实播放 | 留在 Unit 2 修 contract；不得在 route 内另写一套临时状态绕开 |
| `CP1.3 Playback / Scroll State Model` | TECH | `NarrativeController` 状态表与 fixture：direct user-activation、二次播放、attempt generation、reverse-before-complete、sticky release | 每个状态只有一个 input owner；迟到 Promise/event 不复活媒体；离开 shelf 立即 pause；任何 gate 都可 skip | 修改状态机和 fixture，直到没有未定义 transition；不进入真实长片编排 |
| `CP1.4 Architecture Ready` | TECH | CoScroll 当前行为 characterization；terminal state table；nil-signal deadline；本地媒体/registry/handoff/recovery/playback 的联合 contract review | 当前 01–03 行为有保护；Stage 2 所需入口、失败路径和持久化时机均有唯一约定，无 unresolved architecture branch | 继续 Stage 1；若根因是首段剪辑变化，重开 `CP0.4` |

### Stage 2 — CoScroll → ArtBreeze production thin slice

只实现从 CoScroll 最后正常状态到 `CP0.4` 选定 ArtBreeze 首段结束的连续体验，不提前接完整回答、AeScape 或 Focuence。

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP2.1 CoScroll Source Integrity` | TECH | terminal 前 source-match screenshots/tests；无 accessible next 时循环；有 next 时第一次正向到末端进入 hold；back 恢复 | Silk、冷玉、歌词、普通旋转不变；真实末字仍是“空”；terminal 可达且可逆 | 修复回归；任何 01–03 视觉污染都阻止后续 thin slice review |
| `CP2.2 Live / Fallback Ring Continuity` | TECH | live signal capture、forced context-loss/model/nil-signal capture、typed payload dump、route pause-frames | live 路径保持中心/尺寸/方向/缺口相位；fallback 在 deadline 内导航；无黑闪、双 Canvas 或永久 terminal | 留在 Stage 2 调 bridge/fallback；不得只验证其中一条路径 |
| `CP2.3 Frozen Edit Thin Slice` | TECH | 从 CoScroll 最后 `2–3s` 到首段结束的一次连续 scroll capture；freeze-vs-runtime diff；输入和 transfer budget report | 镜头/声音/文字与 `CP0.4` 一致；滚动有积累且单调；旧惯性不偷跑；本地真实媒体无 fallback 冒充 | 实现偏差就在 Stage 2 修；若发现冻结方案本身不成立则重开 `CP0.3–CP0.4` |
| `CP2.4 First Bridge GO` | AUTHOR | 三张 pause-frame（玉字加速、残影闭环、ArtBreeze 接管）、完整 capture、fallback capture 与已知取舍 | 作者确认它读作“徒劳的旋转留下痕迹并成为等待”，而非普通 loading、产品片头或炫技 | `NO-GO` 不进入 Stage 3；按判断回到 Stage 2 调实现，或回 Stage 0 重做剪辑 |

### Stage 3 — ArtBreeze → AeScape → Focuence core narrative

本 Stage 才补齐完整 ArtBreeze、主动发送与回答、画框变窗框、AeScape 双模式和 Focuence 片尾成星。

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP3.1 ArtBreeze Emotional Arc` | TECH + AUTHOR | loading/cycle/幸福句/快切/输入/发送/回答的连续 capture；scrub map；answer activation、skip、reverse、watchdog tests | 先让人感到重复与烦躁，再出现主动提问与意义；发送是真动作；回答不被滚轮强迫有声播放 | 调镜头、停顿、scroll distance 或状态；若首段根因变化则重开 Stage 0 |
| `CP3.2 AB → AS Frame Continuity` | TECH | 《星月夜》尾帧、同框云海、`05.60s` 窗框显影的 pause-frame 与 resize/reduced-motion capture | 画框与窗框保持同一视觉锚点；云海像从画中打开成真实窗，不像两个视频换片 | 留在 Stage 3 调 FramePortal、裁切或 timing |
| `CP3.3 AeScape → Focuence → Stars` | TECH | AeScape scrub/autoplay boundary、Focuence 完播、star handoff payload 与 direct fallback capture | `16.47s` 模式边界稳定；Focuence 只播放一次；片尾读作信息被重新组织成关系，而非随机星空 | 修 mode boundary、剪辑或 seed；不得靠下一页遮住错误片尾 |
| `CP3.4 Core Narrative GO` | AUTHOR | 从“推石头”到“群星出现”的无剪断 review capture、文字/声音摘要和已知取舍 | 作者确认主线能概括为“徒劳 → 主动选择 → 打开 → 收束 → 群星”，产品身份没有抢在情绪之前 | `NO-GO` 留在 Stage 3；只在首段选择被推翻时重开 Stage 0 |

### Stage 4 — Constellation / SonoScope / Sadine / Cosmic

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP4.1 Constellation Navigation` | TECH | 默认路线、星卡直达、键盘顺序、visited state、direct fallback 与性能 capture | 星群既是有关系的叙事场，也是可访问项目索引；不是普通网格或随机银河 | 调数据关系、构图与导航后重验 |
| `CP4.2 SonoScope Overflow` | TECH + AUTHOR | 11.5s 播片、弹幕 cue 表、越界/指针/reduced-motion/fallback capture | 弹幕服务《月光》与陪伴主题，能越过容器但不遮挡标题和控制 | 调文案、节拍、越界安全区；不以烧进视频替代可编辑 cue |
| `CP4.3 Sadine Interaction` | TECH + AUTHOR | 真实 12s 剪辑、指针/触摸/自主鱼、低档与 fallback capture、cleanup report | Sadine 明确读作交互作品；鱼群对光场有生命感且不引入第二重 Canvas | 调数量、运动或层级；不能退化成纯播片后宣称通过 |
| `CP4.4 Constellation GO` | AUTHOR | Focuence 星群 → SonoScope → Sadine → 宇宙眼睛 → 水面门槛连续 capture | 三种容器共享语言但语义各异；宇宙混剪停在眼睛，水面自然开启真实落地 | `NO-GO` 留在 Stage 4，按具体段落重做 |

### Stage 5 — Delivered work and now-building proof

Li 与 UGCFlow 最终录屏是本 Stage 的硬输入；缺失时可以继续完善容器和 fallback，但不能通过 `CP5.1` 或退出 Stage 5。

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP5.1 Final Asset Truth` | TECH | Dulwich 总成片或 12-shot 决策；Li/UGCFlow 最终录屏；source hash、PTS、frame hash、角色/交付档案 | 三个项目全部来自真实成片/软件录屏，档案声明能被画面或项目事实支持 | 等待或补录真实素材；禁止用伪 UI、生成式替身或无依据文案过 gate |
| `CP5.2 Distinct Container Behaviors` | TECH + AUTHOR | Dulwich 银幕、Li 身份窗口、UGCFlow 单屏→矩阵→solo 的连续 capture | 即使都是视频，也能读成“动态成片 → 身份网站 → 多维生产系统” | 调剪辑、比例、容器行为；不能只换标题 |
| `CP5.3 Handoff / Recovery / Completion` | TECH | cosmic-water 接力、direct entry、back/refresh、completed/skipped、stall/early-ended、About/Contact 键盘路径 | 水面与首个真实屏幕连续；状态不误重播/发声；默认和 fallback 都能到 Contact | 修 handoff、snapshot 或 watchdog，留在 Stage 5 |
| `CP5.4 Delivered Work GO` | AUTHOR | 从宇宙眼睛到 About / Contact 的完整 capture、项目档案与素材追溯表 | 作者确认“作品 → 真实落地 → 正在建造 → 人”成立，且没有重新变成产品发布会 | `NO-GO` 留在 Stage 5；素材本身不够则回 `CP5.1` 补录 |

### Stage 6 — Hardening, immutable release, and promotion

Stage 6 先完成体验 hardening，再发布媒体；不能先把 CDN 配好就认为可以公开。

| Checkpoint | Type | Required evidence | Pass criteria | Fail / reopen action |
|---|---|---|---|---|
| `CP6.1 Runtime Hardening` | TECH | desktop/mobile、慢网、startup/stall/early-ended、attempt race、cleanup、单 Canvas、route/transfer/catalog budget report | 默认全链无输入死锁、离屏发声、stale event、资源泄漏或超预算；真实媒体和 watchdog 均工作 | 修复并重跑相关 Stage 2–5 checkpoint；行为变化时更新 capture |
| `CP6.2 Accessibility / Fallback / Visual` | TECH + AUTHOR | keyboard、screen-reader semantics、44×44 controls、reduced-motion、context/video fallback、窄屏与关键 pause-frame review | 所有用户能按相同语义顺序完成 03→07；降级仍保留意义；关键构图经作者确认 | 修复后重验；不得以“可跳过整个体验”代替逐段可达 |
| `CP6.3 Verified Release Candidate` | RELEASE | immutable upload receipt、Range/MIME/CORS/cache/hash 验证、canonical origin/base-path binding、deploy manifest、唯一 registry availability diff、应用该 diff 的 exact staging artifact、artifact hash、staging smoke、rollback dry-run | release/source/editorial/build/artifact hash 完全匹配；required media 无 pending；`160 MB` catalog 与各级预算通过；rail/terminal/preload/metadata 在 staging 派生一致；旧 release 可回滚 | 不 promotion；修资产、provider、registry diff、预算或环境 URL 后重建并产生新的 artifact hash |
| `CP6.4 Production Promotion GO` | AUTHOR + RELEASE | `CP6.1–CP6.3` 证据、exact staging review URL/artifact hash、production deployment plan 与 rollback plan | 作者批准公开；部署系统确认将提升同一 artifact、不会重新构建或追加代码变化 | production 保持旧 artifact；任何候选变化都重开 `CP6.3`，不得以直接改旧 published export 绕过 gate |

## Success Metrics

- 首段正式实现开始前，真实 CoScroll 末态与 ArtBreeze `00:00–00:18.53` 已完成逐镜拆解，A/B/C 三种接法均有可比较样片，作者的 GO 与 editorial freeze 可追溯；没有把母版顺序当成未经验证的默认网页顺序。
- CoScroll 的旋转残影在视觉上连续成为 ArtBreeze loading ring，路由切换过程中没有黑闪、中心跳位或方向反转。
- preview/published next 不可达时 CoScroll 保持现有循环；可达时第一次正向到达 48 秒末端即以真实“空”进入可逆 terminal，back 返回 terminal-hold 而不是半截残影。
- preview scope 能随当前 tab 的 push/back/forward 传播，但生产 rail、terminal-next 和 metadata 始终只暴露 published 章节。
- ring/star/water handoff 都使用类型化 payload；payload 丢失或版本错误时仍有稳定 direct fallback。
- CoScroll angle/speed 不可用时会在有限 deadline 内走静态缺口 ring 并正常导航，不会永久等待 Canvas 或模型恢复。
- ArtBreeze scrub、发送与回答使用已确认的实际时间码，默认主线不出现二维码结尾。
- answer video 在 `await-send` 前预挂载；发送 handler 直接调用并检查有声 `play()`。任何异步 ready/rejection path 都不会偷偷自动补播，且始终有第二次“播放回答”控制。
- skip、cancel、反向离场、新 replay、navigation 或 unmount 后，任何迟到的 `play()` fulfill/reject 与 media event 都不会复活旧播放、发声、覆盖新状态或误写 completed。
- await-send/autoplay 不使用无限 pin 或持续 wheel interception；用户可 skip，gate 释放后布局无跳位且旧惯性不推进下一段。
- 未完成 autoplay 可以反向离开 shelf；离开即 pause 并保存 paused/ready，返回后由显式 Resume 继续，不发生离屏有声播放。
- ArtBreeze 画框与 AeScape 窗框在同一屏幕区域连续变化。
- Focuence 之后的星群读作“失序被重新组织”，不是随机科技星空。
- SonoScope 弹幕和 Sadine 鱼能越过容器，但不遮挡章节标题和可操作 UI。
- 宇宙混剪默认结束在 `01:14.20`，实际落地章节由泳池门槛顺畅接入。
- 三个真实项目即使都采用录屏，也能凭容器行为和剪辑读出清晰差异。
- 默认、键盘、reduced-motion 和 fallback 路径都能完成 03 → 07。
- production 不加载 HEVC 母版，不并行运行两个重 Canvas，不在离场后继续播放影片。
- route reveal、current-next、单 route 和 production catalog 均在预算内；production 视频来自支持 Range 与 immutable cache 的 CDN，不进入 Git 历史。
- 无 CDN 的本地 Stage 2 review 会实际消费并播放经过校验的 preview manifest；production build 无法启用或携带该本地分支。
- source spec 与 deploy manifest 可追溯；所有 clip 使用半开 PTS 区间，production Next build 只引用上传并验证过的 immutable hash，旧 release 资源可完成回滚。
- verify receipt、deploy manifest、Next build 和 promotion gate 使用完全相同的 canonical CDN origin/base path/hash；环境 URL 改变时发布被阻止。
- 播放中刷新最多丢失 2 秒进度，semantic stop、send/skip/completed 等 outcome 不因只在 route transition 时写快照而回退。
- startup、mid-play stall 与 ended-too-early 都能诊断、retry/skip；错误结束不写 completedMediaIds，显式 skip 只写 skippedMediaIds。
- Stage 2/3 的连续 capture 经作者 review 后，主线能被概括为“徒劳 → 主动选择 → 打开 → 收束 → 群星”，而不是“连续播放产品宣传片”。

## Risks & Dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| 未拆真实首段就先写架构/动画 | 技术 contract 固化错误入点，最后只能让故事迁就实现 | Stage 0 三版样片 + AUTHOR GO + editorial freeze；`CP0.4` 前禁止正式转场实现 |
| 首段样片只完成一版便进入评审 | “选择”变成对唯一成品的被动接受，无法判断真正契合 | A/B/C 使用同一源末态、评审范围和完成度；`CP0.2` 未通过不得进入 AUTHOR review |
| 长视频 scrub seek 卡顿 | ArtBreeze 情绪断裂 | 拆分网页剪辑、短关键帧间隔、route 级单一 seek owner |
| CoScroll terminal 与当前无限循环冲突 | 03 无法自然进入 04 或提前破坏线上行为 | accessible-next 条件化 narrative mode；无 preview/published target 时保留 wrapped ritual time |
| preview route 被 coordinator 拒绝或意外公开 | Stage 2 无法联调，或未完成页面进入生产导航 | known/preview/published resolver + tab/build-scoped preview session + shared access tests |
| handoff/recovery 仍靠 routeProgress 猜测 | ring 跳相、返回重播回答/Focuence | versioned discriminated handoff + typed route capture/restore adapter |
| autoplay gate 与物理滚动脱节 | 用户越过影片或被无限 pin | finite sticky shelf、下游折叠、显式 skip、layout-preserving release |
| 残影实现污染 CoScroll 正片 | 已验收画面回归 | terminal-only mount window + characterization coverage |
| 跨路由 ring/star/water 跳位 | 关键转场失败 | normalized typed payload、transition id 和 invalid-payload direct fallback |
| 自动播放变成滚动劫持 | 用户无法掌控节奏 | 主动发送、pause/skip/replay、明确 input owner |
| 连续播片显得模板化 | 后半段再次变成作品列表 | 不同容器边界行为；SonoScope、Sadine、UGCFlow 分别越界 |
| 音频被浏览器阻止 | 回答和 SonoScope 失去效果 | 发送只激活当次回答；后续默认 muted inline，捕获 `play()` rejection 并回到显式播放按钮，字幕始终可用 |
| 点击后经 React effect 才调用 answer `play()` | 丢失 WebKit user activation，第一次发送无声或失败 | answer video 预挂载；click/keydown handler 直接调用；pending/rejected 状态明确，ready event 不自动补播 |
| 旧 `play()` Promise 在 skip/导航后迟到 | 影片重新离屏发声、覆盖新 replay 或误写完成 | monotonic playback attempt、segment/element/transition ownership 校验；invalidation 同步 pause，stale fulfill 再次 pause |
| 未完成 autoplay 反向离开 shelf | 影片在屏外继续播放或返回时状态不明 | reverse-before-complete ownership state；越过入口即 pause/write paused-ready，返回只允许显式 Resume/Skip/Replay |
| 手机高频 seek 不稳定 | 移动体验掉帧 | 离散关键帧、短 autoplay、静态替代，不照搬桌面 scrub |
| Li / UGCFlow 录屏未入库 | 06/07 无法最终验收 | 作为明确资产 gate，不伪造内容；其余单元可先完成 |
| FFmpeg/源素材未声明 | Stage 0/Unit 1 在不同机器不可复现，或大视频误进 Git | toolchain check、source/output root、版本/hash manifest、gitignored local output |
| CDN/provider 未到位或不满足 contract | Stage 6 无法生成可发布 build | Unit 9 独立 publication gate；Range/CORS/cache/origin binding 未通过时保持 preview |
| preview manifest 已生成但页面不消费 | 无 CDN 的 Stage 2 只能看到 fallback，无法验证真实派生视频 | server-only local-preview resolver、显式 dev mode、完整 manifest/file validation、production build isolation |
| source spec、deploy manifest 与 Next build 脱节 | build 引用未上传 key，或回滚后资源 404 | committed two-layer manifests、remote verify 后 finalize、build-time hash guard、旧 release 保留与 mark-and-sweep GC |
| verify CDN 与 build 环境 URL 不同 | 通过 gate 后请求未经验证的 host/path | receipt 绑定 canonical origin/base path/hash；build 与 promotion 完全匹配，变化即重新 verify |
| 浮点秒边界重复或漏帧 | AeScape 接缝顿挫，宇宙剪辑露出泳池帧 | source time base + `[startPTS,endPTSExclusive)` + 首尾 frame hash 验证 |
| Snapshot 只在章节转场时写 | 播放中刷新恢复到旧 stop、重复回答 | 语义立即写、mediaTime 2 秒节流写、pagehide 同步写、coordinator 离场前最终 capture |
| rotation signal 永远为 nil | CoScroll 卡在 terminal 无法进入 04 | 显式 readiness/fallback status、500ms deadline、静态缺口 ring forced-fallback 测试 |
| 视频总体积过大 | 首次进入延迟并膨胀仓库/部署 | 语义拆片、entry/current-next/route/catalog hard caps、immutable CDN、母版和派生视频不进 Git |
| 视频中途 stalled 或提前 ended | gate 永久停留或错误进入下一项目 | centralized watchdog、buffering/retry/skip、duration tolerance、completed state guard |

## Documentation / Operational Notes

- `docs/post-coscroll/CHECKPOINTS.md` 是 Stage gate 的唯一状态账本；每个 PASS 都必须链接到可复现证据，AUTHOR checkpoint 记录作者原话或明确批准，不能只写“看起来没问题”。
- `first-sequence-shot-map.md` 与 `first-sequence-editorial-decision.md` 是 source spec 的上游；任一冻结项变化都必须更新版本 hash、标记 `CP0.4 REOPENED`，并重跑受影响的 Stage 1–2 证据。
- 实施后更新 `reference/美学视觉和落地设计.md` 中 04–07 的最终媒体与交互决策。
- 更新 `docs/miralith-transition-system/TRANSITION_PLAN.md` 的 CoScroll → ArtBreeze 小节：旧文档中的“经文展开成风线”由本计划的“旋转残影 → loading ring”取代。
- 媒体剪辑清单必须记录来源时间码与派生文件，后续更换编码不得改变叙事时间轴。
- committed source spec 与 generated deploy manifest 分别记录剪辑意图和远端发布事实；deploy manifest 只能由 remote verify/finalize script 写入，production Next build 静态导入并校验 editorial-freeze、source-spec、receipt 与 verified base URL hash。
- 本地制作说明记录 `MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview` 的 server-only 使用范围、preview manifest/file 校验和 production build 禁用条件；该模式不是公开 runtime feature flag。
- 新增 preview session、handoff payload、return snapshot 和 media manifest 的 schema version；build revision 变化时不得盲目复用旧 session/snapshot。
- production 部署文档记录 candidate prepare、immutable upload、Range/CORS/cache/hash 与 canonical base URL verify、manifest finalize、唯一 canonical registry availability diff、exact staging artifact、同 artifact production promotion 与回滚/GC 顺序；Next build 本身不依赖媒体转码二进制，`CP6.4` 后也不得重新构建。
- 04–07 在 production 上于 `CP6.4` 前保持 unpublished；只有隔离 release candidate 可以为构建 exact staging artifact 应用唯一 availability diff。

## Sources & References

- `reference/美学视觉和落地设计.md`
- `docs/miralith-transition-system/TRANSITION_PLAN.md`
- `docs/plans/2026-07-14-001-feat-scroll-chapter-transition-plan.md`
- `apps/site/content/miraLithChapters.ts`
- `apps/site/components/chapter-transition/ChapterTransitionProvider.tsx`
- `apps/site/components/chapter-transition/chapterTransitionTypes.ts`
- `apps/site/components/chapter-transition/useChapterTerminalGate.ts`
- `apps/site/components/chapter-transition/ChapterTransitionVisual.tsx`
- `apps/site/app/coscroll-spike/CoScrollSpikeExperience.tsx`
- `apps/site/app/coscroll/page.tsx`
- `packages/coscroll-scene/src/sourceTimeline.ts`
- `packages/coscroll-scene/src/assetManifest.ts`
- `packages/coscroll-scene/src/CoScrollJadeAnchor.tsx`
- `packages/coscroll-scene/src/CoScrollSceneContent.tsx`
- `tests/e2e/coscroll.spec.ts`
- [WebKit: New `<video>` Policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/)
- [Chrome for Developers: Autoplay policy in Chrome](https://developer.chrome.com/blog/autoplay/)
- External supplied source asset labels: `artbreeze-full.MP4`, `artbreeze-short.MP4`, `aescape-short.MP4`, `focuence-short.MP4`, `SonoScope-short.mp4`, `sadine-full.mov`, `混剪-我们是宇宙感受自身的方式.MP4`
