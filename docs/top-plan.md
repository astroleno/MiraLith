> 2026-04-24 对齐说明：本文保留为长期首页叙事参考。当前 v1.0 范围锁定为 LuBirth 前两屏：Opening / LuBirth Ritual Field + LuBirth Zoomable Project Window；Radio Gaga、CoScroll、ArtBreeze、实验星群、商业作品、Now Building、About / Contact 进入 v1.1+。

你说得对。
我前面那个顺序太像“作品集信息架构”，不够像 **MiraLith 这种个人场域站**。你要参考 Shopify 那种体验，就不应该先讲“我是谁 / 我在做什么”，而应该先把人拖进一个场景。

更合理的落法是：

# **首页不是作品集，是一场进入 MiraLith 的仪式**

核心顺序我建议改成：

```text
01 LuBirth 地月人
02 Radio Gaga
03 CoScroll 赛博转经筒
04 ArtBreeze 艺息
05 Floating Constellation 群星项目
06 Client / Commercial Works
07 Now Building / 主业
08 About / Manual / Contact
```

## 为什么 LuBirth 必须放首页第一屏

**LuBirth 是你的“世界观入口”。**

它有几个其他项目没有的优势：

第一，它天然有天地、出生、时间、命运、东方感、个人叙事。
第二，它和 **MiraLith** 这个名字高度一致：Mira 是看见，Lith 是铭刻，而 LuBirth 正好是“把一个人的出生时刻刻进天地关系里”。
第三，它最容易做成震撼的首屏：地球、月相、轨道、出生时间、星图、石碑、东方纹样、缓慢旋转的宇宙界面。

所以首页第一屏不要介绍你。
第一屏应该像这样：

> **MiraLith**
> Birth, orbit, memory, form.

或者中文：

> **MiraLith**
> 把看见之物，刻成作品。

背景直接是 **LuBirth 的宇宙界面**，用户一进入就看见地月轨道、出生时间、月相、浮动文字、石碑质感 UI。

这比“你好我是左博文”高级很多。

---

## 推荐新版首页叙事

### 01. **Opening / LuBirth：起源场**

这是整站的主视觉。

视觉方式：

* 全屏 WebGL / Canvas
* 地球与月亮缓慢运动
* 一块类似“时间碑”的半透明界面悬浮在中间
* 页面滚动时，视角从宇宙慢慢推进到个人出生坐标
* 鼠标移动有轻微视差
* 文字像刻在光里的碑文，不是普通标题

文案可以是：

```text
MiraLith

A personal field of vision, intelligence, and form.
```

中文副句：

```text
在这里，灵感被看见，也被刻写成作品。
```

然后露出第一个作品：

```text
LuBirth 地月人
A cosmological interface for birth, time, and self-recognition.
```

这个项目不是“作品 01”，而是 **MiraLith 的入口神话**。

---

### 02. **Radio Gaga：从宇宙落到家庭与硬件**

我建议 **Radio Gaga 放第二个**，而不是放后面。

原因：
LuBirth 是“宇宙 / 出生 / 人”。
Radio Gaga 是“家庭 / 父母 / 声音 / 硬件”。
它们之间有很强的情感连续性。

这个顺序会形成：

```text
我从哪里来 → 我如何与家人连接
```

这比 “LuBirth → CoScroll → ArtBreeze” 更有人味。

Radio Gaga 的展示方式可以做得很 Shopify：

* 一个旋转的收音机 / 小音箱 / AI 硬件装置
* 周围漂浮资讯卡、播客文稿、TTS 声波、父母兴趣标签
* 滚动时信息流被吸入硬件，变成一段语音
* 右侧出现“信源 → 评论 → 脚本 → 播放”的流程

文案：

```text
Radio Gaga
An AI podcast system made for parents.
```

中文：

```text
一个为父母定制的 AI 播客生成系统。
```

这里不要只讲“小宇宙比赛第二名”。
比赛结果可以作为角标：

```text
2nd Place · Xiaoyuzhou Vibe Coding Contest
```

重点是：
**这是一个带硬件想象的 AI 家庭内容系统。**

---

### 03. **CoScroll：仪式性转场**

第三个放 **CoScroll**。
它适合作为从“家庭声音”进入“精神仪式”的章节。

视觉上可以从 Radio Gaga 的声波，变成一串转动的经文 / 字符 / 光轮。

转场逻辑：

```text
声音的流动 → 经文的滚动
```

CoScroll 可以做成非常强的交互段落：

* 中央一个巨大的垂直转经筒 / 文字圆柱
* 滚轮滚动时，文字真的在“转”
* 玉质锚字在中间，前后两层经文穿过它
* 背景是暗金、深蓝、矿物黑
* 鼠标靠近时出现细小光尘
* 项目介绍不浮在普通卡片里，而像一张“法器说明书”

文案：

```text
CoScroll
A cyber prayer wheel for the scrolling age.
```

中文：

```text
一个属于滚动时代的赛博转经筒。
```

这一章是你个人审美最特别的地方之一。
它不应该只是群星卡片，应该是主线大章节。

但 CoScroll 在 MiraLith 里不能整站搬运。
它应该被提炼成一个轻量的 `CoScrollScene`：只保留玉质锚字、前后遮挡经文、矿物暗场和滚动仪式感；不迁入完整音频、播放器、全量模型、配置系统和调试页。
这样它会像一枚被嵌入 MiraLith 的活体标本，而不是把另一座站点搬进来。

---

### 04. **ArtBreeze：把仪式缩小成日常体验**

第四个放 **ArtBreeze**。

它和 CoScroll 的关系很好：

```text
CoScroll 是宏大的数字仪式
ArtBreeze 是微小的日常仪式
```

ArtBreeze 的高明之处不是“插件”，而是：
**你改造了 AI 等待时间。**

视觉可以这样做：

* 屏幕中出现一个 AI 对话窗口
* 用户等待模型回复
* 等待区域不是 loading，而是浮现一幅艺术作品
* 滚动时艺术作品像风一样展开、折叠、飘到浏览器角落
* 最后变成一个小圆形悬浮图标

文案：

```text
ArtBreeze
Turning AI waiting time into a moment of art.
```

中文：

```text
让 AI 等待时间，变成一次短暂的艺术观看。
```

这章要轻一点。
它是前面几个宏大项目后的呼吸。

---

## 05. 群星项目：不要列表，要“悬浮星群”

你说得对：
他人的网站、教育网站、一系列插件，不应该和主线项目同级。

它们应该变成一个 **Floating Constellation**。

这一段可以像一个 3D 星图 / 磁场图：

中心是 MiraLith。
周围悬浮小卡：

```text
Li Charlie Shi Website
Dulwich Homepage Animation
SonoScope
WaitWiki
TaBient
FoCuence
AeScape
News Nook
n8n Psychology Template
UGC Platform
Infinite Canvas
Coze Family Video Workflow
```

每张卡不用展开很多。
默认只是一个发光碎片 / 小星体 / 小窗口。

鼠标 hover 时：

* 卡片轻微放大
* 出现一句话说明
* 背景出现一帧预览
* 可点击进入详情页或外链

这一段的标题可以是：

```text
Constellation of Experiments
```

中文：

```text
实验星群
```

副标题：

```text
Small systems, visual tools, browser rituals, and commissioned interfaces.
```

中文：

```text
一些小系统、视觉工具、浏览器仪式与委托界面。
```

这里面可以分成四个星座，不要硬分类成传统作品集：

### **Ambient Browser**

* ArtBreeze
* WaitWiki
* TaBient
* FoCuence
* AeScape

### **Commissioned Interfaces**

* Li Charlie Shi Website
* Dulwich Homepage Animation

### **Companion Systems**

* SonoScope
* Coze 亲子视频工作流
* n8n 心理学类型模板

### **Knowledge / Canvas**

* News Nook
* UGC 裂变平台
* 无限画布

这样别人会觉得你项目多，但不乱。
因为它们被收束成一个宇宙结构。

---

## 06. 商业项目放群星之后，不要太靠前

你给别人做的网站和 Dulwich 动画很重要，但它们不是 MiraLith 的精神入口。
它们应该承担一个作用：

> 证明这些审美和技术不是自嗨，也可以进入真实交付。

所以可以放在群星里，也可以在群星之后单独做一个短区：

```text
Selected Commissions
```

里面只放两个大横卡：

```text
Li Charlie Shi Website
A personal identity website built as a visual portrait.

Dulwich Homepage Animation
Motion design for an international education brand homepage.
```

这一区不要做得太重。
它应该像“可信度背书”，不是主角。

---

## 07. 主业放最后是对的

你说“工作可以放最后面”，我同意。

因为这个站不是求职简历，而是个人场域。
主业放前面会把气质拉回 LinkedIn / 简历站。

最后可以有一个很克制的 **Now Building**：

```text
Currently building

feeling.love
AI-native product for family connection and parent-child companionship.

feeling.video
AIGC video / short drama production platform.
```

这里重点不是“公司介绍”，而是把你的主业和前面的个人项目统一起来：

```text
From personal rituals to family systems,
from AI tools to narrative platforms.
```

中文：

```text
从个人仪式到家庭系统，从 AI 工具到叙事平台。
```

这样主业不是突兀的职业信息，而是你创作路径的延伸。

---

# 最优雅的最终首页结构

我会这样定稿：

```text
00 Intro
MiraLith 标志 / 光碑 / 极短加载动画

01 LuBirth 地月人
宇宙、出生、地月轨道、个人时间

02 Radio Gaga
父母、声音、AI 播客、硬件装置

03 CoScroll 赛博转经筒
滚动、经文、数字仪式

04 ArtBreeze 艺息
AI 等待、艺术弹窗、浏览器微体验

05 Constellation of Experiments
插件、网站、工具、实验项目悬浮星群

06 Selected Commissions
Li Charlie Shi Website / Dulwich Homepage Animation

07 Now Building
feeling.love / feeling.video

08 About
左博文 / Getty Images / AIGC / GitHub / 个人说明书

09 Contact
合作、交流、外链
```

## 更丝滑的转场设计

参考你上传的 Shopify 拆解，关键不是“很多动画”，而是用一个固定的视觉层承载主线。Shopify 那类页面的核心是：DOM 负责文字和可访问性，固定 WebGL Canvas 负责高成本视觉，两者通过 scroll progress、section index、camera state 和 timeline state 同步；主视觉可以拆成多个 R3F portal scene，每个章节有自己的 shader、post-processing 和动画。

MiraLith 可以照这个思路做：

```text
固定 WebGL Canvas
  ↓
章节滚动驱动不同场景
  ↓
LuBirth 宇宙场
  ↓
Radio Gaga 硬件场
  ↓
CoScroll 经筒场
  ↓
ArtBreeze 浏览器场
  ↓
群星项目场
```

转场不要用普通 fade。
建议用“物质变形”：

### LuBirth → Radio Gaga

```text
月球轨道线 → 声波环
出生时间碑 → 播客脚本卡
星尘 → 信息流颗粒
```

### Radio Gaga → CoScroll

```text
声波频谱 → 经文滚动线
硬件旋钮 → 转经筒轴心
信息卡片 → 金色字符
```

### CoScroll → ArtBreeze

```text
经文粒子 → 艺术画作碎片
滚动筒 → 浏览器窗口
仪式空间 → 日常桌面
```

### ArtBreeze → 群星项目

```text
浏览器弹窗 → 多个悬浮窗口
艺术卡片 → 星群卡片
右下角小图标 → 项目星图
```

这会让整个网站像一条连续的“生成路径”，而不是几个项目切来切去。

---

## 技术落法

不要一上来就全 3D。你上传的 Shopify 拆解里也提到，更合理的顺序是先做 DOM 内容结构和滚动章节，再加固定 WebGL canvas，用 scroll progress 驱动 camera 和 scene state，然后把关键画面拆成 R3F portal scenes，用 Theatre.js 管 timing，最后再做质量分级和 fallback。

我建议你的实现分三层：

### 1. 内容层：HTML / React DOM

负责：

* 标题
* 项目说明
* 链接
* 标签
* 可访问性
* 移动端 fallback

### 2. 视觉层：Fixed WebGL Canvas

负责：

* LuBirth 地月系统
* Radio Gaga 硬件装置
* CoScroll 玉质经筒场
* ArtBreeze 浏览器窗口
* 群星卡片空间

### 3. 编排层：Scroll Timeline

负责：

* 章节进度
* camera 运动
* 粒子变化
* 文字入场
* 场景切换
* hover / click 状态

技术栈可以是：

```text
Next.js / React / TypeScript
Three.js + React Three Fiber
Drei
Theatre.js
Zustand
Framer Motion 只做少量 DOM 动效
CSS/SVG 做 intro 和 fallback
```

Shopify 那类体验更接近 **Theatre.js + R3F/Three.js + Rive + CSS/SVG** 的组合，而不是传统 GSAP ScrollTrigger 站；Rive 适合小动画、hover 动画和 UI 插画，线性动画最好视频化或 CSS 化，避免主线程压力。

CoScroll 的迁移也遵守这个思路：

```text
CoScroll 原体验
  ↓
提炼玉质模型 / 遮挡关系 / 背景氛围
  ↓
packages/coscroll-scene
  ↓
由 MiraLith section progress 驱动
  ↓
低性能设备使用 poster 或短视频 fallback
```

不要让 CoScroll 自己管理全局滚动和音频时间。它由 MiraLith 的章节进度驱动，但正式实现不能只依赖 `progress` 一个值；还需要通过 `docs/coscroll-scene-interface.md` 定义 `visualTime`、`lyrics`、`currentAnchor`、`scrollVelocity`、quality tier 和 fallback 的适配状态。

---

## 视觉气质建议

MiraLith 不要太赛博霓虹。
它应该是：

```text
矿物感
月光感
东方暗纹
半透明玻璃
碑刻文字
低饱和金色
深蓝黑背景
微弱颗粒
缓慢但精确的运动
```

关键词：

```text
lunar
mineral
ritual
archive
aura
interface
```

不要用太多紫蓝渐变，那会变普通 AI 官网。
你更适合“黑曜石 + 月光 + 旧纸金 + 数字粒子”。

---

## 首屏可以这样写

```text
MiraLith

把看见之物，刻成作品。
A personal field of vision, intelligence, and form.

Enter LuBirth
```

滚动后进入：

```text
LuBirth 地月人

A cosmological interface for birth, time, and self-recognition.
```

再下一个：

```text
Radio Gaga

An AI podcast system made for parents.
From signal to script, from script to voice.
```

再下一个：

```text
CoScroll

A cyber prayer wheel for the scrolling age.
```

再下一个：

```text
ArtBreeze

Turning AI waiting time into a moment of art.
```

---

## 我的最终判断

你这个站不应该按“职业介绍 → 作品集 → 关于我”来做。
应该按：

```text
世界观入口 → 情感系统 → 数字仪式 → 日常微体验 → 实验星群 → 现实工作
```

也就是：

# **LuBirth → Radio Gaga → CoScroll → ArtBreeze → Constellation → Work → About**

这个顺序最优雅。
它既震撼，又有情绪递进，也能把你从“会做很多项目的人”提升成“有自己宇宙和方法的人”。
