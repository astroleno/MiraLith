# MiraLith MVP Definition

状态：草案 v0.1  
日期：2026-04-24  
范围：完成项目初始化，并定义 v1.0 MVP 的可交付边界。

## 1. MVP 一句话

MiraLith v1.0 是一个无后端的前端视觉 MVP：用中文主文案、英文副句、LuBirth 地月视觉和 Theatre.js 滚动时间轴，完成一个有强记忆点的前两屏个人场域入口。

## 2. 当前结论：暂不需要后端

v1.0 不需要后端。

原因：

- 没有用户账号、权限、支付、评论、收藏等动态用户系统。
- 没有必须在线编辑的 CMS 需求。
- 没有需要持久化的表单或线索管理。
- 项目内容数量可控，适合先用本地 typed data 管理。
- 首页体验的难点在视觉架构、性能预算、滚动编排和移动端 fallback，不在数据服务。
- Vercel + Next.js 静态生成足够支撑首版发布、SEO、OG metadata 和后续项目页。

v1.0 可以使用：

```text
Next.js App Router
Static generation
Local typed content
R3F / Three.js
Theatre.js
CSS / SVG fallback
Vercel deploy
```

不需要：

```text
数据库
登录系统
CMS 后台
自建 API 服务
表单服务
任务队列
实时数据
对象存储上传链路
```

## 3. MVP 范围

### 必须有

- Intro / Loading Mark。
- Opening / LuBirth Ritual Field。
- LuBirth Zoomable Project Window。
- 中文主文案 + 英文副句。
- Theatre.js 控制 Opening -> LuBirth Window 主转场。
- 轻量 `@miralith/lubirth-hero`，不嵌入 LuBirth 全量 app。
- 本地 typed content。
- WebGL fallback poster。
- reduced-motion 体验。
- mobile portrait / mobile landscape / desktop 构图验证。
- 首页 title、description、基础 OG metadata。

### 明确不做

- Radio Gaga 正式章节。
- CoScroll 正式章节。
- ArtBreeze 正式章节。
- 实验星群。
- Selected Commissions。
- Now Building 完整区块。
- About / Contact 完整落地页。
- 项目详情页矩阵。
- CMS。
- 后端 API。
- 线索表单沉淀。
- analytics 强依赖。

这些进入 v1.1+。

## 4. MVP 用户体验

访问者进入页面后应该经历：

```text
极短 intro
  -> MiraLith / 光碑 / 地月场出现
  -> 中文主标题建立气质
  -> 英文副句给国际可读性
  -> 滚动推动 Theatre timeline
  -> 地月仪式场收束为 LuBirth 项目窗口
  -> 用户可 hover / tap zoom
  -> 可进入 expanded 状态或跳转了解 LuBirth
```

核心感受：

- 不是简历站。
- 不是项目列表。
- 是一个人的视觉入口。
- 第一眼记得住。
- 看得出能做复杂交互，但不炫技失控。

## 5. MVP 技术边界

### 应用层

- `apps/site` 使用 Next.js App Router。
- 首页先只渲染 v1.0 三段：Intro、LuBirth Field、LuBirth Window。
- 未来章节数据可以先存在 content 文件里，但不进入 v1.0 页面主流程。

### 内容层

- 内容放在 `apps/site/content`。
- 使用 TypeScript typed data。
- 文案字段建议同时支持：

```ts
{
  titleZh: string;
  titleEn?: string;
  subtitleZh: string;
  subtitleEn?: string;
  bodyZh: string;
  bodyEn?: string;
}
```

### 视觉层

- `packages/lubirth-hero` 负责地月视觉。
- `packages/visual-core` 负责 quality、viewport、scroll、Theatre binding。
- `lubirth-hero` 不直接依赖站点内容。
- Theatre.js 由 `apps/site` / `visual-core` 编排，不强塞进 `lubirth-hero` 内部。

### 资源层

- 首屏资源硬上限 3MB。
- LuBirth 原始 8K/2K 资产不直接进入首屏。
- expanded 资源必须 lazy load。
- fallback poster 必须存在。

## 6. MVP 验收标准

### 功能

- 首页可以运行并展示 Intro、LuBirth Field、LuBirth Window。
- 滚动能驱动 Opening -> Window 转场。
- hover / tap 可以触发 zoom 或 expanded。
- Esc / close 可以退出 expanded。
- WebGL 失败时仍能读懂页面。

### 体验

- 中文主文案自然，英文副句不抢戏。
- 第一屏像仪式场，不像普通 hero。
- 文字不遮挡地球/月球核心构图。
- reduced-motion 下不强制大幅镜头运动。

### 性能

- mobile 首屏传输不超过 3MB。
- 3 秒内出现可接受首屏。
- mobile DPR clamp。
- low tier 禁用重后处理。

### 验证

- `pnpm build` 通过。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过。
- Playwright 截图覆盖 desktop、mobile portrait、mobile landscape。
- Canvas 非空像素检查通过。

## 7. 什么时候需要后端

以下需求出现时，再考虑后端：

| 需求 | 后端形态 |
| --- | --- |
| 联系表单需要沉淀和通知 | Serverless function / form provider |
| 内容需要在线编辑 | Headless CMS |
| 项目数据需要频繁更新 | CMS or database |
| 需要访问统计和转化分析 | Vercel Analytics / Plausible / Umami |
| 需要用户登录或私密内容 | Auth + database |
| 需要上传图片 / 视频资产 | Object storage + signed upload |
| 需要动态生成 OG 图 | Next route handler / edge function |

即使未来需要，也不一定要“自建后端”。优先顺序应该是：

```text
Static only
  -> Serverless helper
  -> Managed service
  -> Real backend
```

## 8. 初始化完成定义

项目初始化完成时，应具备：

- `.planning/PROJECT.md`、`.planning/REQUIREMENTS.md`、`.planning/ROADMAP.md` 已对齐 v1.0。
- `docs/prd.md`、`docs/tech-stack.md`、`docs/migration-plan.md` 已对齐 v1.0。
- 本 MVP 文档确认无后端首版策略。
- README 指向关键文档。
- 下一步可以直接进入 Phase 1：Next / pnpm workspace scaffold。

---
*Last updated: 2026-04-24 after MVP definition*
