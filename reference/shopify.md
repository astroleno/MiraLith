下面按“公开资料可确认”的程度来拆。主要依据是 Shopify Winter ’26 页面本身，以及参与开发者 Arnaud Tanielian 的技术拆解线程；我不会把未经源码包验证的猜测当作确定结论。

## 1. 项目定位

这个页面是 Shopify Editions Winter ’26 的产品发布体验页，主题为 **The Renaissance Edition**，官方页面写明是 “150+ product updates”，并按 Sidekick、Agentic、Online、Retail、Marketing、Checkout、Operations、Shop app、B2B、Finance、Shipping、Developer 等板块组织内容。([Shopify][1])

从奖项和行业展示看，它不是普通营销落地页，而是一个高规格互动站点。Awwwards 的 Shopify Design 页面把 **The Renaissance Edition** 列为 Shopify Design 的项目，并标出 Developer Award、Site of the Month 等记录。([Awwwards][2])

## 2. 总体技术栈判断

### 已确认/高可信部分

| 层级             | 技术/方案                                                                                                     | 作用                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 前端应用           | **React**                                                                                                 | 页面组件和交互状态管理。开发者提到他们优化了 React render loop。([线程阅读器][3])                |
| 状态管理           | **Zustand**                                                                                               | 在需要时用于优化状态更新，避免过多 React 重渲染。([线程阅读器][3])                             |
| 3D/WebGL       | **Three.js + React Three Fiber/R3F**                                                                      | 核心 WebGL 场景、画作/场景渲染、portal scene、shader、post-processing。([线程阅读器][3]) |
| 动画编排           | **Theatre.js**                                                                                            | 给设计师提供类似 After Effects 的时间轴控制，不用改代码就能调 timing。([线程阅读器][3])           |
| 矢量/小动画         | **Rive**                                                                                                  | 页面中 20+ 个覆盖在 WebGL 上方的动画；hover 时播放，线性动画导出为视频。([线程阅读器][3])            |
| 原生 Web 技术      | **CSS / SVG / Canvas / WebRTC / BroadcastChannel / SSE**                                                  | 首屏 SVG/CSS 动画、主 WebGL canvas、彩蛋弹窗视频流同步、实时数据流等。([线程阅读器][3])           |
| 3D 资产链路        | **GLTF、Blender、Substance Painter、Tripo AI、Basis/ETC1S**                                                   | 生成/修整模型、贴图绘制、压缩纹理、降低 GPU 内存。([线程阅读器][3])                             |
| Shopify 后台/内容层 | **metaobjects、metafields、products、collections、markets、Translate & Adapt、Shopify CDN、自定义 App + Admin API** | 这个体验页本身被做成一个真实 Shopify store，而不是纯静态 showcase。([线程阅读器][3])            |
| 性能工程           | **route splitting、dynamic imports、tree shaking、质量分级、实时降级**                                                | 控制包体、按设备能力切换渲染质量。([线程阅读器][3])                                        |

### 需要谨慎对待的部分

有第三方拆解文章称它使用 **React/Remix、Tailwind CSS、Rive**，但该文不是官方源码说明；其中 React/Rive 与开发者线程吻合，Remix/Tailwind 我会归类为“可能但未被开发者线程直接确认”。([Typed SanityPress][4])

我没有看到可靠证据表明核心动画使用了 GSAP 或 Framer Motion。这个项目更像是 **Theatre.js + R3F/Three.js + Rive + CSS/SVG** 的组合，而不是常见的 GSAP ScrollTrigger 站点。

## 3. 动画部分的实现拆解

### A. 主视觉/滚动叙事：Three.js + R3F Portal

核心不是普通 DOM 视差，而是多个 WebGL 场景。开发者说明：每幅“画作”都是一个独立的 WebGL scene，并通过 **R3F Portal** 组织，每个场景可以有自己的 shader、post-processing 和动画。([线程阅读器][3])

这意味着页面结构大概类似：

```txt
React App
 ├─ Scroll / route / section state
 ├─ DOM content layer
 ├─ Fixed WebGL Canvas
 │   ├─ R3F scene root
 │   ├─ Portal scene: painting A
 │   ├─ Portal scene: painting B
 │   ├─ Portal scene: product/desk/POS scene
 │   └─ postprocessing / shader passes
 └─ Rive / video / CSS overlay layer
```

这种架构的好处是：DOM 负责文字、导航、CTA、可访问性；WebGL canvas 负责高成本视觉；两者通过 scroll progress、section index、camera state、timeline state 同步。

### B. 2D 画作变“伪 3D”：depth map + displaced plane

部分画面不是完整 3D 建模，而是从静态画作生成 depth map，然后用 depth map 去 displacement 一个高细分平面，从而得到近似 3D 的前后层次。([线程阅读器][3])

实现思路大致是：

```txt
painting image
   ↓
depth map
   ↓
subdivided plane geometry
   ↓
vertex shader / displacement
   ↓
camera parallax / scroll animation
```

这类方法的成本比完整 3D 场景低，但能制造很强的“画中空间”效果。滚动时，只要轻微移动 camera、mesh、UV 或 shader 参数，就会产生类似多层景深的运动。

### C. 真 3D 模型：Tripo AI → Blender/Substance Painter → GLTF

对于更立体的画面，他们使用 Tripo AI 生成基础 mesh silhouette，再用 Substance Painter 贴图、Blender 做自定义修改、绑定和动画，最后导出 GLTF。([线程阅读器][3])

这个链路说明页面中的某些人物、道具、场景元素不是简单图片层叠，而是可被 rig、shader、camera 和 timeline 控制的真实 3D 资产。

### D. 动画编排：Theatre.js 是关键

Theatre.js 的作用类似“网页里的 After Effects 时间轴”。开发者明确说，设计师可以控制几乎所有动画参数，不需要开发者为了每次 timing 调整而改代码，迭代从数小时缩短到数分钟。([线程阅读器][3])

这类页面如果只靠 `useFrame()`、`scrollYProgress` 或硬编码插值，后期会非常难调。Theatre.js 适合管理：

```txt
scroll progress → Theatre sequence position
Theatre track:
 ├─ camera.position
 ├─ camera.rotation
 ├─ mesh.position / rotation / scale
 ├─ shader uniforms
 ├─ light intensity
 ├─ postprocessing strength
 └─ DOM/Rive/video trigger timing
```

实际项目中通常会把 Theatre 的 timeline 和滚动进度绑定：

```ts
// 伪代码
const progress = getNormalizedScrollProgress(section)
theatreSequence.position = progress * theatreSequence.length
```

这样滚动就变成“播放时间轴”。

### E. Rive 的使用：小动画、hover 动画、视频化降本

页面还有大量 Rive 动画覆盖在 WebGL 场景上方。开发者提到，由于有 20+ 个 Rive 动画叠在 WebGL 上，性能优化很关键：hover 动画先显示第一帧 poster，只有 hover 时才播放；线性动画则通过自定义 Rive-to-video exporter 离线导出，避免主线程实时跑 Rive。([线程阅读器][3])

这点很重要。Rive 很适合精细 UI/插画动效，但如果页面同时有 WebGL、scroll、Rive、视频、DOM 动画，全部实时跑会很重。Shopify 的做法是把动画分成三类：

```txt
需要交互的 Rive → 保留 Rive runtime
只 hover 才动的 Rive → 静态 poster + hover 播放
线性播放的 Rive → 转成视频，减少 runtime 成本
```

### F. 首屏/intro：CSS + SVG，而不是一上来就重 WebGL

开发者说明，intro sequence 需要快速加载，所以主要用 CSS + SVG transition/animation；其中用 SVG 的 `pathLength` 绘制达芬奇线条，用 `transform-box` 做标题文字动画。([线程阅读器][3])

这是很合理的性能策略：首屏先用轻量 SVG/CSS 建立气质，同时后台加载 3D 资产。等 WebGL 资源准备好，再进入复杂场景。

### G. shader 优化：DataTexture、cos/sin、fwidth Sobel

他们不是只“堆 postprocessing”。开发者提到，噪声尽量在第一帧预计算成 **DataTexture**，后续只用简单的 `cos/sin` 做小幅动画；Sobel effect 也用 `fwidth` 优化，减少 3 次 texture lookup。([线程阅读器][3])

这说明动画质感很大一部分来自 shader，但 shader 被严格预算过。高端互动页常见瓶颈不是“能不能做”，而是“滚动时能不能稳定 60fps”。

### H. 彩蛋弹窗：WebRTC + BroadcastChannel + Three.js compositing

最复杂的彩蛋是“透明窗口/钥匙/黑光涂鸦”那类效果。开发者说明：他们把主 Three.js canvas 通过 **WebRTC** 以 60fps stream 到 popup，避免重复渲染一整套场景；再用 **BroadcastChannel** 同步弹窗的位置、尺寸、scroll 和交互事件。popup 自己只跑一个轻量 Three.js scene，把视频流作为 texture 贴到 cube 上，再用自定义 shader 合成黑光/涂鸦效果。([线程阅读器][3])

这套方案的核心是：**主窗口负责重渲染，弹窗只消费视频纹理并做轻量后处理**。

```txt
Main window
 ├─ heavy Three.js canvas
 ├─ captureStream()
 ├─ WebRTC stream
 └─ BroadcastChannel: scroll/position/events

Popup window
 ├─ receive video stream
 ├─ lightweight Three.js scene
 ├─ video texture on geometry
 ├─ shader compositing
 └─ send interaction events back
```

这个实现比“popup 再渲染一套完整 3D 场景”更省 GPU，也能保持两个窗口视觉一致。

## 4. 性能策略

这个页面的性能工程很强，至少有四层：

第一，3D 资产被压缩。团队做了自定义 Electron app，用于降低 GLTF polycount，并把纹理转换成 GPU-friendly 的 Basis/ETC1S；开发者称压缩纹理内存减少 10–100 倍，并能更快上传到 GPU，避免滚动时解码卡顿。([线程阅读器][3])

第二，页面有四档质量系统：High 是完整 3D + post-processing；Medium/Low 使用简化纹理和几何；Fallback 用静态图片替代 3D；WebGL Fallback 则退回纯 CSS。系统会根据 GPU 能力自动检测，并根据实时 FPS 降级。([线程阅读器][3])

第三，包体被严格控制。开发者给出的最终加载体积是 mobile 2.4MB、desktop 4.5MB，并使用 route splitting、dynamic imports 和 aggressive tree shaking；每个 PR 都会审查 size impact。([线程阅读器][3])

第四，运行时避免无意义重渲染。React render loop 被优化，必要时使用 Zustand；Skills Cloud 这类实时组件通过 SSE 获取 live Sidekick usage，而不是把所有东西塞进高频 React 状态更新。([线程阅读器][3])

## 5. 如果要复刻，推荐的技术方案

可以按这个栈搭：

```txt
Framework:
  React / TypeScript
  Remix 或 Vite 均可；若接 Shopify，Hydrogen/Remix 更自然

3D:
  three
  @react-three/fiber
  @react-three/drei
  postprocessing 或自定义 EffectComposer

Animation:
  @theatre/core + @theatre/studio
  Rive runtime
  CSS/SVG animations
  少量 requestAnimationFrame/useFrame

State:
  Zustand
  Scroll progress store
  Quality tier store

Assets:
  Blender
  Substance Painter
  glTF/GLB
  gltf-transform
  KTX2 / Basis / ETC1S
  Draco 或 meshopt
  depth map pipeline

Performance:
  dynamic import
  route splitting
  lazy GLTF loading
  texture compression
  FPS monitor
  device/GPU quality detection
  static image fallback
```

需要注意：不要一开始就上完整 3D。更合理的实现顺序是：

1. 先做 DOM 内容结构和滚动章节；
2. 加一个固定 WebGL canvas；
3. 用 scroll progress 驱动 camera 和 scene state；
4. 把关键画面拆成 R3F portal scenes；
5. 用 Theatre.js 管 timing；
6. 把小动画拆给 Rive/CSS/SVG；
7. 最后做质量分级和 fallback。

## 6. 结论

这个项目的动画核心不是某一个库，而是一个完整 motion pipeline：

**Three.js/R3F 负责主视觉空间，Theatre.js 负责时间轴编排，Rive 负责轻量插画/UI 动效，CSS/SVG 负责首屏和低成本转场，Shopify store/content API 负责真实内容和商品能力，性能系统负责让它在不同设备上可用。**

它的难点也不在“实现一个酷炫 shader”，而在工程化：3D 资产预算、压缩纹理、质量分级、动画调参工具、React 重渲染控制、fallback 策略和包体审查都做得很细。

[1]: https://www.shopify.com/editions/winter2026 "Shopify Editions | Winter '26"
[2]: https://www.awwwards.com/shopifydesign/ "Shopify Design - Awwwards"
[3]: https://threadreaderapp.com/thread/2001335712982147307 "Thread by @Danetag on Thread Reader App – Thread Reader App"
[4]: https://typed.sanitypress.dev/blog/breaking-down-shopify-editions-winter-26?utm_source=chatgpt.com "Breaking Down Shopify Editions Winter '26"
