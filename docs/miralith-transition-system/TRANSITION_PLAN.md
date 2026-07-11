# MiraLith Transition System Plan

状态：草案 v0.3  
日期：2026-05-11  
范围：长期首页主线，从 LuBirth 到 Radio Gaga、ESP32、CoScroll，以及后续 ArtBreeze、实验星群、商业作品与 About / Contact 的转场语言。

## 1. 一句话决策

MiraLith 的主转场语言应坚持 **路径带粒子**，而不是纯 SVG，也不是全站 FBO 粒子。

内部原则：

```text
MiraLith transitions are traced, not exploded.
```

中文解释：

```text
转场不是炸开，而是沿着一条被刻出来的线，换一种形态继续流动。
```

这意味着：

- 路径是骨架：轨道线、声波线、电路 trace、经文螺旋线、风线、星群连线。
- 粒子是能量：只沿路径流动、脱落、聚合，不铺满全屏。
- 3D 物体是锚点：地月、radio、ESP32、ice-jade 锚字、作品窗口。
- SVG/DOM 负责清晰叙事：线、标记、刻度、章节关系和可读文字。
- Shader/FBO 粒子负责阈值时刻：只在真正发生“物质形态转换”的节点出现。

## 2. 为什么不是纯 SVG

纯 SVG 的优点是清晰、轻、可控，适合 loading mark、路径描边、章节标记和 fallback。但 MiraLith 的主视觉已经是 WebGL + DOM 分层，纯 SVG 会让几个关键节点缺少物质感：

- LuBirth 的地月空间需要深度、空气辉光和遮挡关系。
- Radio Gaga 到 ESP32 是从模拟物件进入计算核心，单靠线条会显得太平。
- CoScroll 的 ice-jade 锚字、前后文字遮挡、black-blue SilkR3F 场需要 3D 纵深。

所以 SVG 应该作为 **路线图和叙事线**，不作为全部视觉。

## 3. 为什么不是全站粒子

FBO 粒子很适合表现转译、雾化、重组，但如果全站都用，会有三个问题：

- 叙事变弱：每章都爆开，会让 LuBirth、Radio Gaga、CoScroll 的材料差异被抹平。
- 性能变重：FBO + Float texture + points 对移动端和低性能设备不友好。
- 审美变泛：全局粒子容易变成常见的“科技粒子站”，削弱 MiraLith 的矿物、月光、碑刻、仪式感。

因此 FBO 粒子只作为少数强节点使用，尤其是 Radio Gaga 到 ESP32。

## 4. 视觉论文

MiraLith 的整体运动像一条被刻进空间里的线：它先是天体轨道，然后落成家庭声音，再变成电路与照护核心，最后进入文字、风、星群和现实作品网络。

内容顺序：

```text
00 Intro / Loading Mark
01 Opening / LuBirth Ritual Field
02 LuBirth Zoomable Project Window
03 Radio Gaga
   - radio object
   - ESP32 care core as implementation state, not a separate portfolio chapter
04 CoScroll
05 ArtBreeze
06 Constellation of Experiments
07 Selected Commissions
08 Now Building / About / Contact
```

交互计划：

- 滚动驱动一条共享路径从章节到章节变形。
- 鼠标或触摸只提供轻微视差和局部扰动，不改变主时间轴。
- 粒子强度由章节阈值和滚动速度共同决定，reduced-motion 必须遵守 `8.5 Motion / Reduced-Motion Contract`。
- 任何 pinned / cinematic scroll 段都必须有键盘路径和跳过入口，不能只服务滚轮用户。

## 5. 全局转场语法

### 5.1 路径层

路径层是整站最重要的连续性来源。

可用形态：

- LuBirth：地月轨道、地弧切线、月球运行弧。
- Radio Gaga：天线弧、声波环、调频刻度。
- ESP32：PCB trace、pin-to-pin 线路、core glow ring。
- CoScroll：竖向螺旋路径、经文圆柱的切线、玉字遮挡边界。
- ArtBreeze：浏览器角落展开的风线、画作边缘流线。
- Constellation：项目星点之间的连线。
- Selected / About：更克制的 editorial route line。

实现建议：

- 近景、需要深度遮挡的路径用 Three.js `Line2`、tube geometry 或自定义 shader line。
- UI 标记、章节刻度和 fallback 用 SVG path。
- 所有路径都由统一的 `globalProgress`、章节局部 `chapterProgress` 和跨章节 `transitionProgress` 驱动。

路径语法硬规则：

- Stroke weight：UI/SVG 标记线控制在 `1px -> 1.5px`，主视觉路径控制在屏幕短边的 `0.12% -> 0.28%`，不允许为了“更科技”无限加粗。
- Curvature：优先使用长弧、切线、螺旋和电路折线；禁止无意义的随机贝塞尔蛇形。
- Density：同一 pause-frame 内可见主路径不超过 3 条，辅助路径不超过 7 条；路径多时必须有明确主从层级。
- Draw speed：主路径描边速度要慢于粒子速度；路径负责“被刻出”，粒子负责“正在流动”。
- Glow ceiling：路径 glow 只能做薄边缘，不做大面积 bloom；高光不能吞掉线的骨架。
- Split / reconnect：路径分叉必须对应叙事分叉，如信号分流、信息处理、星群项目展开；重连必须指向新的章节锚点。
- Material ramp：LuBirth 偏月光蓝白，Radio 偏暖琥珀，ESP32 偏冷青蓝，CoScroll 必须先匹配 source gate 的 black-blue SilkR3F field 与 cold cyan-white / ice-jade material；金色只能在截图审批后作为极小 accent。ArtBreeze 偏纸面柔光，后段 Selected / About 降为低饱和索引线。
- Pause-frame：任意滚动暂停点，路径都必须像有意图的构图，不能像调试线或随机 motion trail。

### 5.2 粒子层

粒子只做三件事：

- 沿路径流动，表现时间和信号。
- 在阈值处脱离路径，表现物质转换。
- 在目标锚点附近聚合，完成转场。

粒子禁忌：

- 不做全屏随机星尘。
- 不做每章同款爆散。
- 不遮挡主文字。
- 不在移动端强制启用高数量 FBO。

### 5.3 锚点层

每章都必须有一个强视觉锚点：

- LuBirth：地球 / 月亮 / 地弧。
- LuBirth Window：项目窗口 / 被框起的地月视口。
- Radio Gaga：收音机。
- ESP32：板载核心与输出字幕。
- CoScroll：ice-jade 锚字。
- ArtBreeze：等待中的浏览器 / 艺术浮窗。
- Constellation：实验星群。
- Selected / About：作品索引线、现实身份与联系入口。

路径可以流动，但锚点不能含混。用户应该在任何一屏都知道自己在哪个章节。

### 5.4 章节强度曲线

整站不能每一段都满格。推荐视觉强度曲线：

| Chapter | Intensity | Rule |
| --- | --- | --- |
| Intro | 2/5 | 快、轻、只建立刻线和世界入口 |
| LuBirth Opening | 5/5 | 第一记忆点，允许最大空间感 |
| LuBirth Project Window | 3/5 | 从神话收束到项目说明 |
| Radio Gaga | 4/5 | 具象硬件和家庭信号，暖一点 |
| Radio -> ESP32 | 4.5/5 | 唯一强粒子转译，但持续时间短 |
| ESP32 Core | 3.5/5 | Radio Gaga 内部 scene state，亮核心，不单独成为作品章节 |
| CoScroll | 4/5 | 仪式感强，black-blue / ice-jade source-match 优先，粒子弱于 Radio -> ESP32 |
| ArtBreeze | 2/5 | 明显放轻，像呼吸 |
| Constellation | 3/5 | 网络感明确，但不变成模板星空 |
| Selected / Now / About | 1.5/5 | 信息优先，转场降为秩序层 |

硬规则：

- 不允许两个连续长章节都保持 `4.5/5` 以上。
- 强粒子只能在短阈值出现，不能成为章节常驻背景。
- 后半段视觉强度必须下降，让用户回到理解、合作和联系。
- 每个 pause-frame 都要能说明当前章节，而不是只展示一段漂亮运动。

## 6. 分段转场计划

### 6.1 Intro -> LuBirth

叙事目标：从 MiraLith 标记进入宇宙仪式场。

视觉：

- CSS/SVG loading mark 是一条短刻线。
- 刻线延展成地月轨道。
- 轨道一端出现月亮，另一端露出地球弧线。

技术：

- 首屏前使用 CSS/SVG，不能阻塞 WebGL。
- WebGL ready 后，SVG path 与 Three 场景里的地月构图对齐。
- 如果 WebGL 慢，SVG mark 直接过渡到 fallback poster。

验收：

- 3 秒内有可接受画面。
- loading mark 不像独立 logo 动画，而像 LuBirth 轨道的前奏。

### 6.2 LuBirth Opening -> LuBirth Project Window

叙事目标：从世界观入口收束到第一个项目。

视觉：

- 地球上缘和月球位置不消失，而是被一条光学边框“取景”。
- 地弧切线变成项目窗口的上边界或焦点线。
- 轨道路径缩进为窗口内部的细线系统。

技术：

- 继续使用同一个 `@miralith/lubirth-hero` visual kernel。
- 不另起 Canvas。
- DOM 项目说明和 WebGL 视口共同响应同一段 scroll timeline。

验收：

- 用户感觉是“镜头收束”，不是进入了另一张卡片。
- 移动端文字不遮挡地球/月球核心构图。

### 6.3 LuBirth -> Radio Gaga

叙事目标：从宇宙轨道落到家庭信号。

视觉：

- 地月轨道线变成 radio 天线弧线。
- 地弧蓝边逐渐变成暖色声波。
- 少量月尘光点沿轨道移动，进入 radio 的喇叭或旋钮。
- Radio Gaga 的收音机成为新锚点。

技术：

- 主路径可由 SVG/Three path morph 承接。
- 粒子只用普通 GPU points 或轻量 instanced points，不需要 FBO。
- DOM 文案可以与路径构图呼应，但主标题和主说明必须遵守 `8.6 DOM Copy Readability Contract`，不能变成沿曲线旋转的装饰字。

验收：

- 观感是“轨道变成信号”，不是突然切项目。
- 过渡中不出现大面积抽象粒子云。

### 6.4 Radio Gaga -> ESP32 Care Core

叙事目标：从模拟物件进入计算核心。

这是最适合引入 `the-magical-world-of-particles-with-react-three-fiber-and-shaders` reference 的节点。
ESP32 在首页信息架构里是 **Radio Gaga 的硬件实现状态和能力证明**，不是单独作品章节。只有当后续为 ESP32 建立独立项目名、价值句、proof asset / link 和 CTA 时，才把它提升为独立 portfolio item。

视觉：

- radio 喇叭、旋钮、天线附近出现蓝白粒子。
- 粒子受 curl noise 扰动，像声音、资讯和记忆被抽离。
- 粒子沿电路 trace 收束到 ESP32 core。
- ESP32 亮起后，粒子退为很细的 core halo。

当前 Radio Gaga 时间轴可对齐：

- radio 淡出：约 `0.145 -> 0.225`。
- ESP32 淡入：约 `0.17 -> 0.39`。
- 粒子峰值建议：`0.18 -> 0.32`。

技术：

- 把 reference 改成项目内的 `RadioGagaParticleTransition.tsx`。
- 不使用独立 `<Canvas>`，挂入现有 `VisualCanvas`。
- 不使用 `raw-loader`，shader 写成 TS 字符串或本项目可接受的 shader module。
- high 使用 `128x128` FBO，medium 使用 `96x96` FBO 或普通 points，low 不分配 FBO、只用普通 points 或 path glow。
- reduced-motion 下关闭 curl simulation，只保留静态路径 glow。
- 实际启用必须服从 `8.4 FBO Particle GPU Budget`，预算不通过时直接降级。

验收：

- 粒子必须有明确起点和终点。
- ESP32 出现时，粒子不能挡住板子主体和字幕输出。
- 移动端帧率优先于粒子数量。
- 用户应理解 ESP32 是 Radio Gaga 的 care core / embedded prototype，而不是突然出现的第三个项目。

### 6.5 ESP32 -> CoScroll

叙事目标：从照护电路进入文字仪式。

视觉：

- ESP32 的 PCB trace 拉长为竖向螺旋。
- 声波纹理逐渐变成文字流。
- 粒子从“电子光点”变成更慢、更细的光尘。
- ice-jade 锚字在螺旋中心出现，文字开始前后穿行。

技术：

- 不继续使用强 FBO 粒子。
- 使用路径 + glyph texture / text mesh / DOM text layer 的组合。
- CoScroll 章节继续遵守轻量 scene package，不迁入完整 app。

验收：

- 用户能读出“声音的流动 -> 经文的滚动”。
- ice-jade 锚字必须成为章节第一视觉锚点。
- 后层文字需要被模型遮挡或半吞入暗场，保留 CoScroll 灵魂。

### 6.6 CoScroll -> ArtBreeze

叙事目标：从宏大数字仪式缩小为日常微体验。

视觉：

- 经文圆柱被轻轻展开，变成浏览器等待区的一组风线。
- 冷白 scripture columns 减弱，转成画作边缘的柔光和纸面纹理。
- 中央玉字退场，浏览器 / 对话窗口成为锚点。

技术：

- 以 SVG/DOM 路径和 CSS/Three 轻量 plane 为主。
- 不使用 FBO。
- 可用短循环 shader 表现“风吹过画面”，但不能变成新的粒子主场。

验收：

- ArtBreeze 是前面宏大章节后的呼吸，不应继续推高视觉噪声。
- 等待区域和艺术图像必须清楚可见。

### 6.7 ArtBreeze -> Constellation of Experiments

叙事目标：从一个微体验打开为一组实验星群。

视觉：

- 浏览器角落的小浮窗收缩成一个星点。
- 这颗星点拉出连线，其他实验项目依次浮现。
- 风线变成星群网络的连接线。

技术：

- 主要使用 Three points + SVG/DOM labels。
- 项目点可以按 hover 或 scroll 获得局部亮度。
- 低性能设备用静态星图 fallback。
- 星点布局不能用均匀圆环、普通网格或随机星空；位置应由项目关系决定，如项目类型、时间、媒介、商业/实验属性和与主线章节的距离。
- 连线必须表达真实关系：同一主题、同一技术栈、同一客户类型或同一创作问题；不能只是为了填满画面。

验收：

- 星群不是普通作品卡片网格。
- 每个星点需要有清晰 label 和可达链接，不牺牲可访问性。
- 用户能通过星点分组看懂哪些是实验、哪些是商业作品、哪些是正在构建的方向。

### 6.8 Constellation -> Selected / Now / About

叙事目标：从实验网络落到现实交付和本人入口。

视觉：

- 星群连线逐渐收束成更克制的索引线。
- 商业作品、Now Building、About 不再使用强 3D 转场，转为 editorial rhythm。
- 路径仍然存在，但降到背景秩序层。

技术：

- DOM + SVG 足够。
- 只保留轻微 hover reveal 和滚动进度描边。

验收：

- 结尾让人看懂能合作什么、怎么联系，不再继续展示视觉技术。
- 整站从神话入口回到现实身份。

## 7. 技术选型表

| 技术 | 用在哪里 | 不用在哪里 | 原因 |
| --- | --- | --- | --- |
| SVG path | loading、章节标记、UI 线、fallback | 强遮挡和 3D 空间深度 | 清晰、轻、可访问，适合叙事骨架 |
| Three path / line / tube | 轨道、声波、电路线、CoScroll 螺旋 | 纯文字 UI | 能进入 3D 空间，与模型共享相机 |
| 普通 GPU points | LuBirth 月尘、Radio 信号点、星群 | radio -> ESP32 核心转译峰值 | 轻量，适合路径流动 |
| FBO curl particles | Radio -> ESP32 | 全站常驻、CoScroll 后续段落 | 只用于强物质转译，避免泛化 |
| DOM/SVG labels | 项目文案、章节标题、可点击链接 | WebGL 内部长期文字 | 可索引、可访问、易响应 |
| CSS transition | loading、fallback、低成本 hover | 复杂 3D 编排 | 稳、轻、适合低档设备 |

## 8. Interaction, Canvas And Timeline Contracts

### 8.1 Keyboard And Skip Path

主体验可以 scroll-driven，但不能 scroll-only。

Keyboard behavior:

- `Tab` / `Shift+Tab`：按 DOM 语义顺序进入章节标题、主要 CTA、项目链接和 contact；pinned visual sections 不得 trap focus。
- `Space` / `PageDown` / `ArrowDown`：当焦点不在表单、按钮或链接上时，推进到当前 cinematic 段的下一个语义 stop 或下一章节。
- `PageUp` / `ArrowUp`：回到上一个语义 stop 或上一章节。
- `Home`：回到 MiraLith / LuBirth 开始处。
- `End`：跳到 About / Contact 或最后一个主要联系入口。
- `Enter`：只激活当前 focusable element，不触发隐藏的视觉时间轴副作用。

Skip path:

- 页面顶部必须提供可见 focus 状态的 `Skip visual narrative` / `跳过视觉叙事` 链接。
- 目标应跳到 `Selected / Now / About / Contact` 之前的实用信息入口，不能只跳过一小段动画。
- 在 fallback 和 reduced-motion 模式下仍保留 skip link。
- 如果 WebGL loading 超过阈值，skip link 仍应先于视觉资源可用。

### 8.2 HomeSceneArbiter

所有 **active WebGL chapters** 挂入同一个 `VisualCanvas`，但必须有一个上层仲裁者管理场景所有权。建议命名为 `HomeSceneArbiter` 或 `HomeVisualSceneRouter`。它不管理纯 DOM / SVG / poster-first 段落。

它负责：

- Camera ownership：统一控制相机 `fov`、`near/far`、position、lookAt、viewport fit，不允许章节组件互相抢相机。
- Scene environment：统一管理 `scene.background`、`scene.fog`、tone mapping、clear color；章节如需修改，必须通过 lease 进入并在退出时恢复。
- Light ownership：定义全局 key/fill/rim light 池；章节只提交 light intent，不直接创建不可控的常驻灯组。
- Render layers：划分 background、anchor model、transition path、particle、foreground helper、debug 层，避免粒子遮挡 DOM 语义内容或模型主体。
- Mount windows：每个章节都有 `preloadWindow`、`activeWindow`、`cooldownWindow`；transition 只能在窗口内分配 GPU 资源。
- Asset lifecycle：统一处理 preload、dispose、fallback trigger 和 route leave cleanup，不能由单个章节偷偷长期持有大纹理、FBO 或 GLB。
- Debug visibility：提供 query 参数或 dev flag 显示当前 chapter、globalProgress、chapterProgress、transitionProgress、quality tier 和 active layers。

章节 scene package 的边界：

- 可以渲染自己的锚点、局部路径和局部粒子。
- 可以声明所需相机 framing、灯光强度、背景意图和资产清单。
- 不可以创建自己的 Canvas。
- 不可以长期改写全局 camera、scene background/fog、renderer state。
- 不可以在 inactive 状态继续跑 useFrame heavy work。

Scope limits:

- Selected Commissions、Now Building、About / Contact 可以完全绕过 arbiter，使用 DOM/SVG/poster-first 布局。
- fallback sections 可以绕过 arbiter。
- 当页面进入 portfolio/contact zones，`VisualCanvas` 可以 idle、降低 DPR、暂停 frame loop 或按需 unmount。
- 只有 active WebGL chapters 和它们之间的 WebGL transition 需要受 arbiter 管。

### 8.3 Timeline Coordinates

必须区分四种进度，避免把 Radio Gaga 的局部时间轴误用成整站坐标：

```ts
interface HomeTimelineFrame {
  globalProgress: number;       // 整个首页 0..1
  chapterId: string;            // 当前主章节
  chapterProgress: number;      // 当前章节内部 0..1
  transitionId?: string;        // 当前跨章节转场
  transitionProgress?: number;  // 当前转场内部 0..1
  scrollVelocity: number;
}
```

命名约定：

- `globalProgress` 只属于首页总 timeline。
- `chapterProgress` 只属于当前章节。
- `transitionProgress` 只属于两个章节之间的转场。
- 现有 `RadioGaga` 的 `0.145 -> 0.225`、`0.17 -> 0.39` 等数值是 **Radio Gaga scene-local progress**，不能直接当作 homepage global progress。
- DOM 和 WebGL 必须从同一个 timeline source 派生状态；禁止 DOM 用 ScrollTrigger A，WebGL 用另一个 ScrollTrigger B 各自解释。

同步规则：

- 同一帧内先更新 timeline frame，再更新 WebGL scene，再写 DOM CSS variables。
- DOM 文案 opacity、WebGL 模型 transform、路径 drawProgress、粒子 opacity 必须引用同一个 `chapterProgress` 或 `transitionProgress`。
- 任何章节如果需要压缩/扩展内部时间轴，必须通过 adapter 显式映射，如 `mapRadioGagaProgress(chapterProgress)`。

### 8.4 FBO Particle GPU Budget

Radio -> ESP32 是唯一允许 FBO curl particles 进入主线的强节点，但预算必须比“粒子数量”更硬。

默认预算：

| Quality | Particle texture | Render targets | Texture type | Sim cadence | Pass count | Fallback |
| --- | --- | --- | --- | --- | --- | --- |
| high | `128x128` | max 2 | prefer `HalfFloatType`, allow `FloatType` only after extension check | every frame while active | 1 sim + 1 draw | ordinary GPU points |
| medium | `96x96` | max 2 | `HalfFloatType` preferred | 30fps or every other frame | 1 sim + 1 draw | ordinary GPU points |
| low | no FBO by default | 0 | none | none | draw only | path glow + sparse points |
| fallback | none | 0 | none | none | none | SVG/poster |

Memory limits:

- Transition-owned render targets should stay under `8MB` total in high and `4MB` total in medium.
- Data textures, render targets and particle geometry must be counted together when evaluating a transition.
- If device memory is unknown, assume medium limits; if `navigator.deviceMemory <= 4`, disable FBO.
- Curl simulation requires ping-pong render targets; reading from and writing to the same texture is invalid. If two render targets cannot be allocated, medium falls back to ordinary GPU points.

Hard triggers to disable FBO:

- `reducedMotion === true`。
- quality tier is `low` or `fallback`。
- Required float/half-float render target support is missing.
- Renderer reports context loss or repeated compile/link failure.
- Transition is outside `preloadWindow` / `activeWindow` / `cooldownWindow`。
- GPU work causes visible hitching during scroll on target mobile devices.

Lifecycle rules:

- FBO resources are allocated only when entering preload or active window.
- Simulation stops when particle opacity is below `0.02` for more than 2 frames.
- All render targets, data textures and shader materials are disposed on cooldown exit.
- No FBO allocation is allowed in reduced-motion mode.

### 8.5 Motion / Reduced-Motion Contract

Reduced motion is not “same animation but slower.” It is a separate contract for preserving meaning with minimal motion.

Hydration-safe state:

```ts
type MotionPreference = "unknown" | "reduced" | "no-preference";
```

- Initial client render must treat `unknown` as static / no-FBO / no autonomous loop.
- FBO-capable transitions mount only after preference resolves to `no-preference`.
- `unknown` may show static path, poster, DOM copy and non-animated anchors.
- `reduced` and `unknown` both disallow FBO allocation, curl simulation, pointer parallax and idle loops.

Allowed in reduced-motion:

- Static or one-step chapter poster.
- Discrete opacity fades.
- Short, non-looping keyframe states.
- Static path glow that marks relationship between chapters.
- Manual hover/focus states that do not autoplay.

Disallowed in reduced-motion:

- FBO allocation and curl simulation.
- Autonomous loops, orbiting dust, idle spin and continuous parallax.
- Pointer-driven camera parallax.
- Fast path draw, path chasing, flickering glow and high-frequency opacity changes.
- CoScroll continuous text rotation.

Implementation rule:

- Reduced-motion state must be known before allocating heavy visual resources.
- If `prefers-reduced-motion` changes at runtime, active simulations stop and release resources.
- QA must capture reduced-motion screenshots for the same pause points as normal mode.

### 8.6 DOM Copy Readability Contract

Primary text must remain readable before it becomes expressive.

Safe zones:

- Desktop: primary chapter copy should sit in a stable left or right column no wider than `38rem`, with at least `8vw` horizontal margin.
- Mobile: primary copy should use top or bottom safe zones, not the center of the 3D anchor; keep at least `16px` viewport padding.
- Short landscape: copy may collapse to one concise label + CTA; long body copy should move below the visual.

Typography:

- Primary chapter labels: minimum `18px` mobile, `22px` desktop.
- Body summary: minimum `15px` mobile, `16px` desktop.
- Max line length: `42 -> 64` characters for English, `18 -> 28` Chinese characters.
- No negative letter spacing for small labels.

Contrast and layers:

- Text contrast must meet WCAG AA against its actual rendered background.
- Primary labels sit above decorative path/particle layers.
- Particles and paths may pass behind text only if opacity/glow is capped enough to preserve contrast.

Hard bans:

- Primary project labels cannot be curved, rotated, orbiting, or attached to moving paths.
- Path-following text is allowed only for decorative secondary marks.
- A chapter cannot rely on WebGL text as its only readable title.

### 8.7 Semantic Fallback And Screen-Reader Narrative

Canvas and decorative visual layers stay `aria-hidden="true"` unless they become intentionally interactive.

Every chapter needs a semantic DOM equivalent:

- `section` with stable `id` and accessible name.
- `h2` project / chapter title.
- Project type, for example `Worldview entrance`, `AI hardware / family audio`, `Digital ritual`, `Browser micro-experience`.
- One concise summary sentence.
- One primary CTA or next-step link when applicable.
- Optional `sr-only` transition summary, for example: `The LuBirth orbit line becomes the Radio Gaga signal arc.`

Fallback requirements:

- Fallback is not just a poster; it must preserve chapter title, project type, summary and CTA.
- Screen-reader users should understand the project sequence without WebGL.
- Contact / About must remain reachable from fallback and reduced-motion paths.

## 9. 推荐工程结构

不要为每个 active WebGL 段创建独立 Canvas。Selected / About / Contact 和 fallback/poster-first 段可以绕过 WebGL arbiter。长期结构可以朝下面收敛，但共享 primitives 必须在真实 LuBirth -> Radio 薄切片验证后再抽取：

```text
apps/site
  components/
  visual/
    VisualCanvas.tsx
    scenes/

packages/visual-core
  scroll/
  quality/
  transitions/
    pathMorph.ts
    transitionFrame.ts
    particleBudget.ts

packages/radio-gaga-scene
  RadioGagaParticleTransition.tsx

packages/coscroll-scene
  CoScrollSceneContent.tsx
```

Extraction rule:

- First implementation lives as a thin vertical slice in `apps/site` and existing scene packages.
- Only after the slice proves taste, accessibility, keyboard behavior and fallback should code move into `packages/visual-core/transitions`.
- Avoid building a general transition platform before one user-facing transition works.

建议抽象：

```ts
interface MiraLithTransitionFrame {
  globalProgress: number;
  chapterId: string;
  chapterProgress: number;
  transitionId?: string;
  transitionProgress?: number;
  scrollVelocity: number;
  reducedMotion: boolean;
  qualityTier: "high" | "medium" | "low" | "fallback";
}

interface PathTransitionState {
  opacity: number;
  drawProgress: number;
  morphProgress: number;
  glow: number;
}

interface ParticleTransitionState {
  enabled: boolean;
  count: number;
  opacity: number;
  turbulence: number;
  attractorStrength: number;
}
```

这些状态不必一次性全部实现，但要让后续章节共用同一套语言，而不是每个 scene 重新发明转场。

## 10. 质量档与降级

### High

- 完整 Three path。
- Radio -> ESP32 可用 `128x128` FBO 粒子。
- CoScroll 保留真实前后遮挡。
- 星群使用 GPU points + labels。

### Medium

- Three path 保留，减少 segments。
- Radio -> ESP32 使用 `96x96` FBO 或普通 points。
- CoScroll 保留一个 ice-jade 锚字和简化文字层。

### Low

- 路径优先，粒子大幅减少。
- Radio -> ESP32 使用普通 points 或 path glow。
- CoScroll 可减少文字层数量。

### Fallback

- 使用 SVG path + poster/video still。
- 所有章节锚点保持可识别。
- 不依赖 WebGL 才能理解主线。

### Reduced Motion

- 遵守 `8.5 Motion / Reduced-Motion Contract`。
- 不分配 FBO，不运行 curl simulation，不启用 pointer parallax。
- 路径使用静态 glow、离散 fade 或短 keyframe 状态表达关系。
- CoScroll 文字滚动变成分段淡入或静态前后层构图。

## 11. 实施阶段

### Phase 0：定转场母语与薄契约

产物：

- 本文档确认。
- 章节路径命名表。
- `HomeSceneArbiter` / `HomeVisualSceneRouter` 的 contract 草案，不做完整平台。
- timeline coordinates contract。
- hydration-safe motion preference contract。
- keyboard / skip path contract。
- DOM readability 与 semantic fallback contract。
- Radio -> ESP32 FBO budget contract。

验收：

- LuBirth、Radio、ESP32、CoScroll 的路径形态都能用同一套词汇解释。
- 单 Canvas 所有权、场景环境、灯光、层级和资产生命周期有明确 owner 草案。
- Radio Gaga 的局部时间轴不会被误当成整站 global timeline。
- 还没有抽取 `visual-core/transitions`；先等真实薄切片证明需要哪些 primitives。

### Phase 1：LuBirth -> Radio Thin Vertical Slice

产物：

- 在 `apps/site` 里做真实 LuBirth -> Radio 薄切片。
- 使用真实 LuBirth 构图、Radio Gaga 锚点和一段真实轨道 -> 天线 / 声波路径。
- 最小本地 arbiter，只管理这段 slice 需要的 camera、scene environment、layers 和 cleanup。
- SVG / DOM / Three 对齐测试。
- keyboard progression、skip visual narrative、semantic fallback 和 reduced-motion unknown state。
- desktop/mobile pause-frame 截图。

验收：

- 访问者能在不解释的情况下读出“轨道变信号”。
- 主标题、项目类型、summary 和 CTA 在 desktop/mobile 上可读。
- 相机、background/fog、lights、render layers 和 cleanup 在这段 slice 内有 owner。
- DOM 与 WebGL 共享同一个 timeline frame。
- `MotionPreference: "unknown"` 首屏不分配 FBO、不跑 loop。
- reduced-motion 下没有 FBO、curl、pointer parallax 或 autonomous loop。
- keyboard-only 用户可以跳过视觉叙事并到达后续内容 / contact。

### Phase 2：Single Canvas Integration Hardening

产物：

- 从 Phase 1 的真实 slice 提炼最小 `HomeSceneArbiter`。
- 明确 active WebGL chapters、fallback sections、portfolio/contact zones 的边界。
- 建立 debug overlay：chapter、globalProgress、chapterProgress、transitionProgress、quality tier、active layers。
- 建立 canvas idle / pause / unmount 行为。

验收：

- 抽取出来的 primitives 服务真实 slice，而不是反过来限制视觉。
- Selected / About / Contact 可以绕过 arbiter。
- Canvas 在 portfolio/contact zones 可以 idle 或 unmount。
- fallback 和 reduced-motion 模式仍能识别章节和转场关系。

### Phase 3：Radio -> ESP32 粒子原型

产物：

- `RadioGagaParticleTransition.tsx`。
- quality tier 粒子预算。
- reduced-motion 降级。
- FBO extension detection 和 hard fallback triggers。

验收：

- 粒子有起点、路径和终点。
- 不遮挡 ESP32 与最终字幕。
- 移动端低档不崩帧。
- reduced-motion 和 low/fallback tier 不分配 FBO。

### Phase 4：ESP32 -> CoScroll 路径与文字转译

产物：

- 电路 trace 到螺旋经文路径。
- CoScroll ice-jade 锚字入场。
- black-blue SilkR3F field 与 cold cyan-white scripture columns source-match。

验收：

- 保留“声音的流动 -> 经文的滚动”的叙事。
- 不把 CoScroll 全量 app 搬入首页。
- 不引入 gold mineral jade，除非 source-match 截图审批后作为极小 accent。

### Phase 5：后续章节轻量转场

产物：

- CoScroll -> ArtBreeze 风线。
- ArtBreeze -> Constellation 星群。
- Constellation -> Selected / Now / About 索引线。

验收：

- 后半段视觉强度逐步下降，帮助用户回到信息理解和联系入口。

### Phase 6：全链路视觉 QA

产物：

- desktop 截图序列。
- mobile 截图序列。
- reduced-motion 截图序列。
- 性能记录。
- keyboard walkthrough 记录。
- screen-reader semantic outline 检查。

验收：

- 任意章节暂停时都有清晰锚点。
- 转场连续，但每个章节气质不同。
- 文案不被粒子和路径遮挡。
- 非视觉用户可以通过 DOM outline 理解章节、项目类型、summary 和 CTA。

## 12. 验收清单

- LuBirth 看起来是世界观入口，不是普通 hero。
- LuBirth -> Radio 是轨道转信号。
- Radio -> ESP32 是全站唯一强粒子转译节点。
- ESP32 -> CoScroll 是电路转经文，不是继续粒子爆散。
- CoScroll 保留 ice-jade 锚字和前后文字遮挡。
- ArtBreeze 明显变轻，像一次呼吸。
- 星群不是卡片网格，而是实验网络。
- 结尾回到现实信息，不继续炫技。
- high / medium / low / fallback 都有明确视觉策略。
- reduced-motion 不只是关闭动画，而是保留静态叙事。
- 访问者在每个章节 3 秒内能识别当前项目名称和项目类型。
- 访问者不需要听解释，也能理解从 LuBirth 到 Radio Gaga 到 CoScroll 的大致叙事方向。
- 访问者能在后半段理解你能交付什么、能被为什么事情雇佣或合作。
- Contact / About 入口在视觉叙事后仍然明确可达。
- fallback 和 reduced-motion 模式下，项目识别、合作理解和联系路径都不丢失。

## 13. Comprehension QA Gates

视觉隐喻通过不等于首页通过。每个关键里程碑都要增加理解测试。

最低测试方式：

- 给未参与项目的人看 3 个 pause-frame：章节开始、转场中点、章节结束。
- 不解释背景，让对方回答“这是什么项目”、“它大概做什么”、“我能为什么联系这个人”。
- desktop、mobile、fallback、reduced-motion 各跑一次。

通过标准：

- LuBirth：能识别这是 MiraLith 的世界观入口，并知道它与出生、地月、时间有关。
- Radio Gaga：能识别这是为父母/家庭声音/AI 播客或硬件相关的项目。
- ESP32：能识别 radio 的信息被转入 Radio Gaga 的计算/硬件核心，而不是突然换模型或出现独立第三项目；它证明 embedded / AI hardware prototyping 能力。
- CoScroll：能识别这是文字、滚动、仪式相关的项目，而不是普通粒子/字效。
- 后半段：能理解实验、商业作品、Now/About/Contact 的信息层级。
- Contact：用户能在不滚回顶部、不理解全部转场故事的情况下找到联系入口。

失败处理：

- 如果用户只记住“很酷的粒子”，减少粒子并加强路径/锚点/文案。
- 如果用户说不出项目用途，增加 DOM 标题或章节标签清晰度。
- 如果用户找不到合作/联系入口，降低后半段视觉强度并提高信息布局优先级。

## 14. 风险与约束

- 如果每章都追求高能转场，整站会失去节奏。
- 如果路径系统太抽象，用户会看不懂项目之间的叙事关系。
- 如果 FBO 粒子进入太多章节，性能和审美都会被拖累。
- 如果 CoScroll 迁入过重，会破坏 LuBirth-first 的首页架构。
- 如果后半段还保持强 3D，商业作品与联系入口会被淹没。
- 如果没有 `HomeSceneArbiter`，单 Canvas 会变成多个章节互相抢 camera、lights、background 和 GPU 生命周期。
- 如果没有 path grammar，路径 morph 很容易退化成通用科技线条。
- 如果 reduced-motion 只做“慢一点”，这个 motion-led 首页仍然会对敏感用户不友好。

## 15. 当前开放问题

- LuBirth -> Radio 的路径 morph 是否先用 SVG overlay 验证，再迁入 Three 空间？
- Radio -> ESP32 的粒子颜色应更偏蓝白电波，还是带一点 radio 的暖色记忆？
- CoScroll 第一版 ice-jade 锚字固定用 `心`，还是在 `心 / 空 / 道` 中切换？
- ArtBreeze 是否需要真实艺术图片素材，还是先用生成/占位图做转场 spike？
- 后续 Selected Commissions 是否保留一点星群连线，还是完全转入 editorial layout？
- `HomeSceneArbiter` 应先落在 `apps/site/visual`，还是先在 `packages/visual-core` 提供无 UI 的 router primitives？
- path grammar 是否需要单独产出视觉样张，作为设计 QA 基准？

## 16. 建议下一步

先做三个动作，不要先造完整平台，也不要一次性铺完整长首页：

1. **Phase 0 contract pass**
   - 确认本文档里的 timeline、motion unknown state、keyboard / skip path、DOM readability、semantic fallback、FBO budget。
   - 目标是让风险被命名，但不先抽象平台。

2. **LuBirth -> Radio thin vertical slice**
   - 在 `apps/site` 里用真实 LuBirth 和 Radio Gaga 锚点验证轨道线、天线弧和声波环能否自然变形。
   - 同时验证 keyboard、skip link、semantic fallback、DOM safe zones 和 reduced-motion unknown state。
   - 目标是先证明第一段用户可见转场成立。

3. **Single Canvas integration hardening from the slice**
   - 只从 LuBirth -> Radio 薄切片里提炼最小 `HomeSceneArbiter`。
   - 验证 active WebGL chapters、fallback/poster sections、portfolio/contact zones、canvas idle/unmount 边界。
   - 目标是让共享 Canvas 规则服务真实画面，而不是先造平台。

这三个动作成立后，再推进 Radio -> ESP32 particle spike；粒子节点通过后，再推进 ESP32 -> CoScroll。否则太早做后半段或共享平台，会在母语尚未被真实画面验证时扩大返工面。
