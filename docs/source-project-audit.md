# MiraLith Source Project Audit

状态：草案 v0.1  
日期：2026-04-24  
范围：粗扫 `/Users/aitoshuu/Documents/GitHub` 下可进入 MiraLith 的项目，判断是否需要调整当前技术栈。

## 1. 总结结论

当前技术栈不需要大改。

继续保持：

```text
Next.js App Router
TypeScript strict
pnpm workspace
R3F / Three.js
Theatre.js for narrative timeline
Zustand
Local typed content
Vercel static deploy
```

需要微调的是 **v1.1+ 项目接入策略**，不是 v1.0 栈：

- 增加正式的 media/demo asset pipeline。
- 增加 `project representation` 类型，不要把所有项目都强行做成 WebGL scene。
- 允许少量 isolated GSAP 用于视觉实验回放，但 Theatre.js 仍是主叙事时间轴。
- 明确禁止把 Vite app、Chrome extension runtime、Cloudflare Worker、Python/CLI 系统作为 MiraLith runtime 依赖。
- v1.0 仍然无后端，只做 LuBirth opening release。

## 2. ArtBreeze

来源：`/Users/aitoshuu/Documents/GitHub/ArtBreeze-public`

### 项目判断

ArtBreeze 是一个 Chrome MV3 extension，在用户和 AI 对话时显示艺术作品，把等待回复的时间转化成短暂观看。它有 content script、background service worker、popup settings、local/sync storage、图片缓存、暗色模式和浮动圆形入口。

### 值得带入 MiraLith 的部分

- “AI 等待时间变成艺术观看”的产品概念。
- 浮动圆形入口 -> 艺术面板展开/折叠的微交互。
- Ambient browser ritual：浏览器日常空间被轻轻改造。
- local-first / privacy 的描述。
- extension anatomy 可以作为小型案例图。

### 不应搬入的部分

- Chrome APIs：`chrome.storage`、`chrome.runtime`、MV3 service worker。
- AI 平台 DOM selector 和 content-script 注入逻辑。
- 全局 injected CSS、高 z-index、固定 ID。
- Google artwork runtime feed 和 Base64 缓存池。
- 临时 package scripts 和版本不一致的 release 元数据。

### MiraLith 表达方式

v1.1+ 使用 **轻量 DOM vignette + poster fallback**：

```text
模拟 AI chat surface
  -> send/enter
  -> 浮动艺术面板出现
  -> 右下角 ArtBreeze 圆形入口折叠
  -> 一句 local-first / waiting as art 说明
```

不做真实 extension demo，不改变 v1.0 栈。

## 3. Radio Gaga

来源：`/Users/aitoshuu/Documents/GitHub/radio-gaga`

### 项目判断

Radio Gaga 是一个为父母定制 AI 播客 / 私人电台的编辑工作流：

```text
n8n / RSS / 微信公号 / 天气 / 热点
  -> 候选池
  -> 儿子编辑选择、排序、加评论
  -> ListenHub 生成脚本 / 音频
  -> Cloudflare Worker / MCP bridge
  -> AI 硬件本地 TTS 播放
```

它最强的地方不是当前控制台 UI，而是“care before automation”：用 AI 系统把家人连接、声音和日常关心具体化。

### 值得带入 MiraLith 的部分

- “儿子给父母建一座私人电台”的叙事。
- candidate -> selected -> draft -> generating -> published 的状态机。
- sources -> editor console -> script -> MCP bridge -> hardware playback 的系统流程。
- human-in-the-loop editorial pattern。
- preview / final publish gate 作为“自动化前的人类照料”。

### 不应搬入的部分

- Vite SPA、`react-router-dom`、hash routing。
- Jotai / TanStack Query / frontend API runtime。
- Cloudflare D1/KV/Hono/MCP Worker 代码。
- n8n hotlist scraping workflow 作为站点依赖。
- ListenHub token/API 调用和硬编码服务 URL。
- newsnook reference assets。

注意：Radio Gaga 代码和文档里可能包含服务 URL 或 token-like 字符串，不能直接复制到公开站点。

### MiraLith 表达方式

v1.1+ 使用 **静态案例 + DOM 流程图 + 轻量硬件/声波场景**：

```text
sources
  -> curated playlist
  -> generated manuscript
  -> MCP bridge
  -> parent hardware / TTS waves
```

不嵌入 Radio Gaga frontend，不把 Cloudflare Worker 变成 MiraLith 后端。

## 4. 其它推荐项目

| Project | 适合度 | 推荐表达 |
| --- | --- | --- |
| `CoScroll` | v1.1 核心章节 | 数字经卷 / Digital Sutra。轻量 scene 或 poster-backed scroll vignette，不搬音频系统和全量模型 |
| `Anicca` | v1.2+ 强概念章节 | thinking instrument / 正反合图谱。用 graph constellation 或小型 branching interaction |
| `SonoScope` | 实验星群 anchor | 声象 / audio-visual systems。用可视化 still/video + 架构 callout |
| `AeScape-public` | Ambient browser paired with ArtBreeze | 天气驱动 tab / browser ritual。用 poster 或小型 DOM scene |
| `UGCFlow` + `fv_website` | Now Building / current work | AI 视频生产工作流 + public surface。用系统图和 restrained credibility section |
| `VoyaTide` | 非视觉可信度案例 | evidence-first research OS。用 artifacts / pipeline diagram，不强行 WebGL |
| `ArtDuo` | 后续艺术/策展节点 | AI curation / museum interface。适合 project detail 或 constellation node |
| `mjid1` / `webm_scroll` / `immerse_gallery` | 视觉研究材料 | 作为 visual studies，使用 short loops / posters，不作为完整项目主角 |
| `licharlieshi_portfolio` / `dulwich_animation` | Selected Commissions | 真实交付背书，用强缩略图或短视频即可 |

## 5. 暂缓或避免

| Project | 建议 |
| --- | --- |
| `prompt-optimizer` / `everything-claude-code` / `seedance-2.0` | 容易像外部工具合集，暂缓进入主叙事 |
| `sm_seeker` | 系统性强但叙事不如 VoyaTide，后续可作为 research systems supporting tile |
| `EndlessPlayer` / `lyric-scroll-loop` | 相关想法已被 CoScroll 吸收，不单独占主位 |
| `MJInDiaryParII` | 可作为 visual sketch，但不符合当前 restrained archival tone |
| agent tooling repos | 以后若有 agent tools appendix 再考虑，不进主情感路径 |

## 6. 技术栈微调建议

### 6.1 Project Representation Types

MiraLith content model 应该支持不同项目表现形态：

```ts
type ProjectRepresentation =
  | 'hero-scene'
  | 'lightweight-scene'
  | 'dom-vignette'
  | 'case-study-flow'
  | 'poster-loop'
  | 'selected-commission'
  | 'external-artifact';
```

这样 Radio Gaga / VoyaTide / UGCFlow 不必被强行做成 WebGL 场景。

### 6.2 Media / Demo Asset Pipeline

v1.1+ 需要正式资产管线：

- poster：WebP / AVIF。
- loop：短 WebM / MP4，必要时支持 alpha video。
- model：GLB + meshopt / KTX2。
- diagram：SVG 或 DOM diagram。
- source asset manifest：记录大小、用途、加载时机、fallback。

### 6.3 Optional Isolated GSAP

Theatre.js 继续作为 MiraLith 主叙事时间轴。

但对于 `mjid1`、`webm_scroll`、`immerse_gallery` 这类本来就是 GSAP/ScrollTrigger 的视觉研究，可允许：

```text
GSAP only inside isolated demo/visual-study module
not in v1.0 critical path
not for global homepage narrative timeline
must have poster/video fallback
```

### 6.4 No Runtime Imports From Source Apps

MiraLith 不从这些项目直接 import runtime：

- Chrome extension runtime。
- Vite SPA router。
- Cloudflare Worker / Hono / MCP。
- n8n workflows。
- Python CLI systems。
- source project node_modules。

可迁入的是内容、概念、压缩后的视觉资产、重新实现的轻量 scene 或 case-study artifact。

## 7. 对 v1.0 的影响

无影响。

v1.0 仍然是：

```text
LuBirth first two screens
Chinese primary copy
English secondary lines
Theatre.js opening timeline
No backend
No full long homepage
```

---
*Last updated: 2026-04-24 after multi-agent source scan*
