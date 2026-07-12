# MiraLith PRD

状态：草案 v0.2  
日期：2026-04-24  
产品类型：个人场域站 / 互动叙事作品集 / 世界观入口  
核心参考：Shopify Editions 式固定 WebGL 视觉层 + DOM 内容层 + scroll timeline

## 0. 当前对齐决策

- v1.0 先把 LuBirth 前两屏做到惊艳：`Opening / LuBirth Ritual Field` + `LuBirth Zoomable Project Window`。
- 主站文案采用中文为主、英文副句的节奏。
- Theatre.js 从第一阶段进入主转场管线，用于第一屏到第二屏的 camera、shader、light、mesh transform 编排。
- Radio Gaga、CoScroll、ArtBreeze、实验星群、商业作品、Now Building、About / Contact 作为 v1.1+ 扩展，不阻塞 v1.0。

## 1. 产品一句话

MiraLith 是一个以 LuBirth 为世界观入口的个人场域站：它把项目、实验、商业作品和主业收束成一个连续的视觉叙事，让访问者先进入一个场景，再理解一个人。

## 2. 目标

### 产品目标

- 第一屏建立强记忆点：MiraLith 不是简历站，而是个人宇宙入口。
- 用 LuBirth 地月系统承载「看见」「出生」「轨道」「铭刻」这些核心意象。
- 用 Shopify Editions 式滚动叙事能力，先把 LuBirth opening 打磨成可扩展的视觉母体。
- 让项目多但不乱：主线章节 + 实验星群 + 现实交付。
- 支持未来持续加入项目、组件和章节。

### 体验目标

- 首屏像一场仪式，而不是普通 hero。
- 动效慢、准、克制，有矿物/月光/碑刻质感。
- 3D 与文字不是互相抢戏，而是共同服务叙事。
- 手机横屏可看，低性能设备有 fallback。
- 3 秒内看到可接受的首屏画面。

### 工程目标

- 首屏传输硬上限 3MB。
- LuBirth 首页版不直接嵌全量 LuBirth app。
- WebGL 视觉与 DOM 内容分层，内容可索引、可访问。
- 所有重视觉能力都有 quality tier 和 fallback。

## 3. 非目标

- 第一版不做完整 CMS。
- 第一版不做全量多语言后台。
- 第一版不做完整长首页，先发布 LuBirth 前两屏。
- 第一版不把 LuBirth 所有功能搬进首页。
- 第一版不复刻 Shopify 全部复杂彩蛋。
- 第一版不追求每个项目都有完整 3D 场景，先保 LuBirth 前两屏。
- 第一版不把 CoScroll 全量应用搬进首页，只迁入轻量章节场景。
- CoScroll 不取代 LuBirth 第二屏；站点第二屏仍然是 LuBirth Zoomable Project Window。

## 4. 目标用户

### Primary

- 对 AI、视觉、互动产品、个人叙事感兴趣的访问者。
- 潜在合作方、客户、投资人、招聘/合作联系人。
- 想快速理解「左博文在做什么、审美是什么、能交付什么」的人。

### Secondary

- 技术同行、设计同行、创作者朋友。
- 进入具体项目链接的用户。
- 后续从社交平台或作品链接进入的观众。

## 5. 信息架构

长期首页顺序：

```text
00 Intro / Loading Mark
01 Opening / LuBirth Ritual Field
02 LuBirth Zoomable Project Window
03 Radio Gaga
04 CoScroll
05 ArtBreeze
06 Constellation of Experiments
07 Selected Commissions
08 Now Building
09 About / Manual / Contact
```

v1.0 发布范围：

```text
00 Intro / Loading Mark
01 Opening / LuBirth Ritual Field
02 LuBirth Zoomable Project Window
```

v1.1+ 扩展范围：

```text
03 Radio Gaga
04 CoScroll
05 ArtBreeze
06 Constellation of Experiments
07 Selected Commissions
08 Now Building
09 About / Manual / Contact
```

## 6. 核心叙事

```text
世界观入口
  LuBirth：出生、地月、时间、个人坐标

情感系统
  Radio Gaga：父母、声音、AI 播客、硬件想象

数字仪式
  CoScroll：滚动时代的赛博转经筒

日常微体验
  ArtBreeze：把 AI 等待变成艺术观看

实验星群
  插件、网站、视觉工具、浏览器仪式、委托界面

现实工作
  feeling.love / feeling.video / About / Contact
```

## 7. 首页关键章节

### 00 Intro

用途：极短加载和气质建立。

要求：

- 使用 CSS/SVG，不依赖 WebGL。
- 显示 MiraLith 标志或光碑线条。
- 时长短，不能阻塞进入首屏。
- 如果 WebGL 加载慢，Intro 过渡到 fallback poster。

### 01 Opening / LuBirth Ritual Field

用途：第一屏，MiraLith 的世界观入口。

画面：

- 全屏 WebGL / Canvas。
- 地球缓慢自转。
- 固定日期月球，默认 `1993-08-01T12:00:00Z`。
- 地弧辉光、卡门线感、少量 aurora。
- 深蓝黑、黑曜石、月光、旧纸金、细颗粒。
- 文字像刻在光里，不放在普通卡片里。

文案方向：

```text
MiraLith
把看见之物，刻成作品。

A personal field of vision, intelligence, and form.
```

交互：

- 鼠标移动轻微视差。
- 滚动时从仪式场推进到第二屏项目窗口。
- reduced-motion 下只保留慢速或静态画面。

验收：

- 不加载 LuBirth 全量应用。
- 首屏 3s 内有可接受画面。
- 手机横屏中，标题不遮挡地球/月球核心构图。

### 02 LuBirth Zoomable Project Window

用途：第二屏，展示 LuBirth 项目本体。

画面：

- 从第一屏全屏地月场收束成一个 project viewport。
- 保留小图、zoom-in、expanded 大图。
- 同一套 `@miralith/lubirth-hero` visual kernel 驱动；生产首页挂载 `EarthMoonScene`，不重建完整场景，也不另起 Canvas。
- 右侧或下方出现项目说明，不做厚重卡片。

文案方向：

```text
LuBirth 地月人
A cosmological interface for birth, time, and self-recognition.
```

交互：

- hover 或滚动进入 zoom-in。
- 点击打开 expanded 大图或项目详情。
- expanded 允许更高质量，但必须按需加载。

验收：

- 小图、zoom-in、expanded 三种状态可达。
- 大图状态不超过移动端内存预算。
- 返回/关闭后不残留重资源或重复 canvas。

### 03 Radio Gaga

用途：从宇宙落到家庭、声音与硬件。

核心表达：

```text
Radio Gaga
An AI podcast system made for parents.
From signal to script, from script to voice.
```

视觉方向：

- 硬件装置、声波环、信息卡流。
- LuBirth 轨道线转为声波。
- 比赛奖项作为角标，不抢主叙事。

### 04 CoScroll

用途：进入数字仪式。

核心表达：

```text
CoScroll
A cyber prayer wheel for the scrolling age.
```

视觉方向：

- 垂直文字圆柱或转经筒。
- 滚轮驱动文字转动。
- 暗金、深蓝、矿物黑。
- 玉质锚字位于中心，字句在其前后穿行。
- 前层字句清晰浮在模型前，后层字句被模型遮挡或半吞入暗场。

MiraLith 版实现原则：

- 使用轻量 `CoScrollScene`，不 iframe、不搬全量 CoScroll app。
- 用章节 `progress` 驱动视觉时间，不复用 CoScroll 音频时间轴。
- 第一版只保留 1-3 个锚字模型和少量经文/短句。
- 低性能设备使用 poster 或短循环视频 fallback。
- `CoScrollScene` 接口文档先以 v0.1 草案固定边界，正式实现前用 visual spike 确认一个锚字、前后文字层和压缩资产仍能保留原体验的精神。

验收：

- 不影响 LuBirth 首屏和第二屏资源预算。
- WebGL 失败时，DOM 中仍有 CoScroll 的项目标题、说明和链接。
- reduced-motion 下不强制滚轮驱动，保留静态玉字/经文构图。
- 首页模式下不另起独立 Canvas，必须挂入 MiraLith 共享视觉层。

### 05 ArtBreeze

用途：从宏大仪式落到日常微体验。

核心表达：

```text
ArtBreeze
Turning AI waiting time into a moment of art.
```

视觉方向：

- AI 对话窗口、等待态、艺术图像浮现。
- 轻、短、像呼吸。

### 06 Constellation of Experiments

用途：收束小项目，不让项目列表显得散。

项目分组：

```text
Ambient Browser
  ArtBreeze / WaitWiki / TaBient / FoCuence / AeScape

Commissioned Interfaces
  Li Charlie Shi Website / Dulwich Homepage Animation

Companion Systems
  SonoScope / Coze 亲子视频工作流 / n8n 心理学类型模板

Knowledge / Canvas
  News Nook / UGC 裂变平台 / 无限画布
```

交互：

- 默认是悬浮星群。
- hover 显示一句话说明和小预览。
- 点击进入详情或外链。

### 07 Selected Commissions

用途：证明审美和技术可真实交付。

内容：

- Li Charlie Shi Website。
- Dulwich Homepage Animation。

要求：

- 克制，不抢主线。
- 更像可信度背书，而不是作品集主角。

### 08 Now Building

用途：把主业接入个人创作路径。

内容：

```text
Currently building

feeling.love
AI-native product for family connection and parent-child companionship.

feeling.video
AIGC video / short drama production platform.
```

### 09 About / Manual / Contact

用途：让访问者落地到人和联系方式。

内容：

- 左博文是谁。
- Getty Images / AIGC / 产品 / 视觉系统相关背景。
- GitHub、社交链接、合作联系。
- 可选个人说明书。

## 8. LuBirth 首页版需求

### 功能需求

- 使用 MiraLith 专用轻量包 `@miralith/lubirth-hero`；生产首页使用 `EarthMoonScene`，`EarthMoonHero` 仅作为 demo/dev standalone wrapper。
- 支持 `field`、`window`、`zoomed`、`expanded` 四种 mode。
- 支持固定日期，默认 `1993-08-01T12:00:00Z`。
- 地球自转速度可配置。
- 固定太阳方向可配置。
- 月球屏幕位置、尺寸可配置。
- 大气辉光、地弧辉光可配置。
- Aurora 可开关，使用 procedural noise。
- 支持低性能 fallback poster。

### 资源需求

- 地球低清贴图：512 或 1024，WebP/AVIF/KTX2。
- 月球低清贴图：512 或 1024，WebP/AVIF/KTX2。
- 不加载 moon normal、earth displacement、8K clouds、BGM。
- 星空优先 procedural，不加载大星空贴图。

### 交互需求

- 首屏轻微视差。
- 第二屏 hover/scroll zoom-in。
- 点击 expanded。
- Esc 或关闭按钮返回。
- 触摸设备使用 tap，不依赖 hover。

## 9. 性能与质量要求

### 加载

| 指标 | 目标 |
| --- | --- |
| 首屏传输 | mobile 目标 2.4MB，硬上限 3MB |
| 首屏可见 | 3s 内 |
| WebGL fallback | WebGL 不可用时仍可读完整内容 |
| 首屏字体 | 系统字体或极小 subset，不因字体阻塞渲染 |

### 运行

| 场景 | 目标 |
| --- | --- |
| Desktop high | 视觉完整，滚动稳定 |
| Laptop medium | 禁用部分后处理，保持流畅 |
| Mobile landscape | DPR clamp，禁用重后处理和 clouds |
| Low tier | 静态 poster + DOM 内容 |

### 质量分级

- high：完整 LuBirth hero、aurora、轻 clouds、较高 DPR。
- medium：无 clouds，保留 aurora 和大气。
- low：只保地球、月球、大气辉光。
- fallback：静态 poster + CSS/SVG。

## 10. 可访问性

- DOM 文案必须完整，不依赖 canvas 才能理解页面。
- 所有交互元素可键盘访问。
- expanded 大图有关闭按钮和 Esc 支持。
- `prefers-reduced-motion` 下禁用强滚动动画。
- 颜色对比满足可读性。
- Canvas 提供 aria-label 或旁路说明。

## 11. SEO 与分享

- 首页有明确 title/description。
- 每个项目可有独立详情页与 OG 图。
- 首屏文案是 HTML，不是 canvas 字。
- 项目数据使用 typed data，方便生成 metadata。

## 12. 成功指标

### 定性

- 访问者第一眼能感到这是一个有世界观的个人站。
- LuBirth 被理解为 MiraLith 的入口神话，而不是普通项目卡。
- 项目多但不乱，有连续叙事。

### 定量

- Mobile 首屏传输不超过 3MB。
- 3s 内出现可接受首屏。
- WebGL 失败时内容仍完整。
- Lighthouse 性能和可访问性进入可接受区间。
- 手动 Playwright 截图检查桌面、手机竖屏、手机横屏三种构图。

## 13. 里程碑

### M0 文档与骨架

- 技术栈定稿。
- PRD 定稿。
- Next + pnpm workspace 初始化。
- 基础设计令牌和页面骨架。

### M1 LuBirth Hero 内核

- `@miralith/lubirth-hero` 轻量包。
- `field/window/zoomed/expanded` preset。
- 低清地球/月球资产。
- 大气、地弧辉光、aurora 初版。
- 移动横屏验证。

### M2 首页前两屏

- Intro。
- Opening / LuBirth Ritual Field。
- LuBirth Zoomable Project Window。
- 滚动过渡。
- 首屏性能预算检查。

### M3 v1.0 性能与发布

- Quality tiers。
- Fallback poster。
- Lighthouse / Playwright 验证。
- SEO / OG 基础。
- 首版发布。

### M4 v1.1 主线章节

- Radio Gaga。
- CoScroll。
- ArtBreeze。
- 基础 scroll timeline 扩展。
- `CoScrollScene` 接口文档、visual spike 和 fallback 方案。
- CoScroll 资产预算表、压缩后模型和 poster/video fallback。
- 通过 readiness gate 后再进入文件级迁移实现。

### M5 v1.1 星群与落地信息

- Constellation of Experiments。
- Selected Commissions。
- 项目详情页模板。
- About / Contact。

## 14. 风险

- WebGL 资产过重导致首屏超过 3MB。
- Theatre.js 从第一阶段引入后，如果管理范围过大，会把 M1 变成调参黑洞。
- 过早引入 Rive/复杂 3D，拖慢 LuBirth 前两屏。
- LuBirth 全量代码耦合太重，抽取成本高。
- CoScroll 全量迁入导致音频、模型、字体和配置系统污染主站。
- CoScroll 如果另起 Canvas 或每帧 React setState，会破坏固定视觉层架构。
- CoScroll 如果只按 `progress/active/quality/reducedMotion` 四个 props 开工，会遗漏 `visualTime`、`duration`、`lyrics`、`currentAnchor`、`scrollVelocity` 等真实视觉状态。
- 手机横屏构图被文字遮挡。
- 动画过密，让 MiraLith 从“仪式感”变成“炫技站”。

## 15. 当前决策

- 技术栈采用 Next.js App Router，不采用纯 Vite 主站。
- v1.0 范围锁定 LuBirth 前两屏，不追求一次完成整条首页长叙事。
- 主站文案采用中文为主、英文副句。
- Theatre.js 从第一阶段接入，但只服务 Opening → LuBirth Window 的主转场和少量可调视觉参数。
- LuBirth 两屏都要：第一屏全屏仪式场，第二屏可 zoom 项目窗口。
- 首页版 LuBirth 是轻量视觉摘录，不是全量 app 嵌入。
- 首屏硬预算 3MB。
- Shopify 是工程和体验参考，不是逐像素复刻对象。
- CoScroll 是 v1.1 主线章节，不是站点第二屏。
- CoScroll 采用轻量 scene package 迁移策略；接口文档已建立 v0.1 草案，下一步先做 Phase 1 scaffolding 和 visual spike，再写文件级迁移计划。
