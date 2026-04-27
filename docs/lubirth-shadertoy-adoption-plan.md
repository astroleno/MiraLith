# LuBirth Shadertoy Adoption Plan

状态：草案 v0.3
日期：2026-04-27
范围：LuBirth 近地开场到完整地月的反向滚动复刻。

## 1. 目标

把 `reference/shadertoy/LuBirth` 中可稳定迁移的视觉算法吸收到当前 Three/R3F 实现里。本文不是“采用某个 shader”的备忘录，而是实施和验收合同：每一项必须有固定镜头、性能预算、可测容差和截图矩阵。

当前基线代码已经包含：

- `LandingEarth`：地球 day/night/cloud 贴图、云层 relief、云影、晨昏线暖边和城市灯光。
- `LandingAtmosphere`：多层 atmosphere shell、near shell、outer halo、`karmanLineMaterial`。
- `LandingAurora`：线状极光。
- `LandingSpaceBackground`：程序星空和深色背景。
- `openingTimeline`：当前仍是“小地月 -> 近地放大”的两阶段滚动构图，本计划要把叙事方向反转为“近地放大 -> 完整地月”。

后续工作应基于这些现状调参、替换或扩展，不重复造已有行为。

## 2. 固定镜头与硬验收

### 2.1 Scroll Progress

所有视觉验收必须使用以下固定进度：

| 名称 | progress | 目标 |
| --- | ---: | --- |
| `P0_CLOSE` | `0.00` | 首屏就是近地 ISS 视角：地弧在下半屏，绵阳落在目标点，地球不自转。 |
| `P1_PULLBACK` | `0.50` | 滚动中段，镜头从近地地弧退远到完整地月；不得出现月球漂移、地球横跳或光照翻面。 |
| `P2_FIELD` | `1.00` | 终点为完整地月：小地球在下方，月球在上方，地球可恢复缓慢自转。 |

### 2.2 Viewports

必须至少截图以下 viewport：

| 档位 | viewport | DPR |
| --- | --- | ---: |
| desktop-reference | `2048 x 1159` | `1.0` |
| desktop-common | `1440 x 900` | `1.0` |
| mobile-reference | `390 x 844` | capped `1.0` |

desktop-reference 是主验收视角；mobile-reference 用来确认首屏地弧/目标点和终点月球/完整地球都不被裁掉。

### 2.3 Date, Sun And Target

时间和位置必须固定为：

- 本地时间：`1993-08-01T11:03:00+08:00`
- UTC：`1993-08-01T03:03:00Z`
- 绵阳：`lat=31.467`, `lon=104.679`
- 地球纹理坐标约定：
  - `phi = (lon + 180) / 360 * TWO_PI`
  - `theta = (90 - lat) * DEG2RAD`
  - local vector = `[-cos(phi) * sin(theta), cos(theta), sin(phi) * sin(theta)]`
  - 绵阳 local vector = `[-0.216138, 0.522007, -0.825102]`
- 太阳方向基线：`computeSolarDirection("1993-08-01T11:03:00", 104.679, 8)`
  - expected vector = `[-0.681511, 0.314251, 0.660901]`

P0_CLOSE 的 desktop-reference 目标：

- 绵阳投影目标点：`x=1029`, `y=941`
- 容差：`x +/- 24px`, `y +/- 28px`
- 近地 timeline 基线：`earthPitchDeg=-28.5`, `earthYawDeg=-104.25`
- P2_FIELD 远景基线：`earthPitchDeg=0`, `earthYawDeg=-106.6`，进入终点后才允许叠加自动自转。
- 如果相机、FOV、earthScale 或纹理经纬映射改动，必须重新跑投影反算并更新本节数值。

### 2.4 Atmosphere Visual Contract

P0_CLOSE 的近地大气必须接近 ISS 参考照片，而不是普通厚蓝 Fresnel 边：

| 项 | desktop-reference 验收 |
| --- | --- |
| 内侧白线 | 地弧最亮处为连续薄白线，视觉宽度 `2-5px`。 |
| 蓝色中层 | 白线外侧有蓝色层，宽度 `10-22px`，不得超过 `28px`。 |
| 外侧衰减 | 蓝色层外 `32px` 内衰减到背景黑场。 |
| 亮度上限 | 白线不得形成大片纯白块，截图采样 RGB 单通道上限目标 `< 245`。 |
| 暗场 | 外层空间保持 off-black，非星点区域 RGB 平均值 `< 10`。 |
| 阶段差异 | P0_CLOSE 必须更薄、更贴近地弧；P2_FIELD 可保留更软、更远的大气轮廓，但不能抢月球。 |

失败样例：

- 整条地弧变成宽厚蓝边。
- 蓝色 halo 向外扩展超过地球半径视觉高度的 `4%`。
- 白线断成噪点、线段或“白毛”。

## 3. 性能预算

### 3.1 Runtime Budget

| 档位 | 目标 | 上限 |
| --- | --- | --- |
| desktop-reference | `60fps` | p95 frame time `< 18ms` |
| desktop-common | `60fps` | p95 frame time `< 18ms` |
| mobile-reference | `30fps` | p95 frame time `< 34ms` |
| reduced-motion | 无连续自转/极光流动 | 滚动仍响应，无 jump |

### 3.2 Rendering Budget

- DPR：desktop cap `1.25`，mobile cap `1.0`。
- Earth surface shader：每 fragment texture reads 目标 `<= 10`，上限 `12`。
- Cloud enhancement：新增采样最多 `+4` texture reads。
- Atmosphere close scattering：high tier 最多 `8 primary * 2 light`，low/mobile 最多 `4 primary * 1 light`。
- Aurora：high tier 最多 `24` samples，mobile/low 最多 `10` samples。
- 背景：图片 backdrop 不参与每帧动画；程序星空只做静态 geometry/material。
- 不得在滚动时触发布局读写循环；滚动控制继续由 GSAP/timeline 驱动，不直接监听 scroll 后 setState 高频更新。

### 3.3 Fallback

- `quality.tier === "low"`：禁用极光体积采样，保留静态极光 ribbon 或关闭。
- `reducedMotion`：保留最终构图和光照，不进行云层漂移、极光流动、首屏自转。
- 背景图片加载失败：回退到 `LandingSpaceBackground` 当前程序星空。

## 4. 文件采纳判断

### `cloud1.md`

采纳：

- `fbm_clouds` 的多 octave 云密度思路。
- `density_func` 中 coverage threshold 的云边界控制。
- `integrate_volume` 的 Beer-Lambert 透射概念。

不直接采纳：

- 50-step 屏幕空间体积云 raymarch。当前场景已经有 8K 云贴图，整套 raymarch 放在地球表面太重。

落地方式：

- 基于现有 `LandingEarth` cloud shader 调整，不新建独立体积云 pass。
- 云尺度：P0_CLOSE 保留近地弧线上的大陆尺度云团；P2_FIELD 退远后不得形成颗粒化噪点。
- 阴影：沿光方向偏移采样，阴影边缘 soft，日侧云影强度目标 `0.12-0.28`。
- 高光：cloud relief 只强化云顶，不把低频云层整体抬白。
- 晨昏线：云边暖色只在 terminator 附近出现，暖边强度低于白云主高光。

### `atmosphere1.md`

采纳：

- Rayleigh / Mie / absorption 分离。
- scale height：Rayleigh 高、Mie 低、ozone absorption 在中高层。
- light ray optical depth，用少量步进估算日侧大气厚度。

不直接采纳：

- 32 primary steps + 8 light steps 的完整屏幕空间大气散射。当前 hero 需要滚动流畅，完整算法成本过高。

落地方式：

- 在现有 `LandingAtmosphere` shell 内替换核心散射函数。
- P0_CLOSE 使用更薄的 close-scattering profile，并满足 2.4 的像素宽度。
- P2_FIELD 使用较软、较宽但低存在感的远景 atmosphere。

### `transition1.md`

采纳：

- `ray_vs_sphere`、`density`、`optic`、`in_scatter` 的轻量散射结构。
- `phase_ray` / `phase_mie` 的相函数。

用途：

- 作为 P0_CLOSE 近地大气弧光的第一版实现基础。
- 替换当前偏 Fresnel 的 `karmanLineMaterial`，不是额外叠一层更厚 halo。

### `atmosphere-close1.md` / `atmosphere-close2.md`

不采纳算法。

原因：

- 两个文件只是 pass-through `iChannel0` 输出，不包含实际 close atmosphere 算法。

### `aurora1.md` / `aurora2.md`

采纳：

- `triNoise2d` / `fbmAurora` 的三角噪声。
- 体积帘幕的 progressive samples。
- 绿色、黄绿、蓝色随采样层变化的配色。

落地方式：

- 把现有 `LandingAurora` 从 line geometry 改为 shader ribbon/curved planes。
- 高度：贴近地弧上方，不进入月球区域。
- 透明度：P0_CLOSE 最大 alpha 目标 `< 0.28`，P2_FIELD 必须更弱或不可见。
- 边缘：上下边缘必须 soft fade，不允许硬矩形或普通绿色条带。
- 反向滚动淡出区间：`progress 0.18-0.55`，reduced-motion 下静态显示或关闭。

### `atmosphere2.md`

谨慎采纳：

- 只参考曝光、soft saturation、sun glare 的思路。

不直接采纳：

- 这是 Space Glider 的完整 image/postprocess pass，依赖大量状态 buffer，不适合移植到当前 hero。

## 5. 宇宙背景图片

当前仓库还没有找到 LuBirth 原项目的宇宙背景图片，现有可用资产只有地球、云、夜景和月球贴图。

如果找到 LuBirth 原背景图，接入链路必须完整覆盖：

1. 资产放入 `apps/site/public/assets/lubirth/backgrounds/`。
2. `TextureRef` 继续复用现有字段；在 `LandingAssetManifest` 增加 `spaceBackground?: TextureRef`。
3. `DEFAULT_LUBIRTH_ASSETS` 增加 `spaceBackground`。
4. `resolveLandingAssets` 自动合并调用方覆盖。
5. `LUBIRTH_ASSET_BUDGET` 增加背景图片预算，tier 为 `idle` 或 `expanded`，不得阻塞首屏地月关键贴图。
6. `EarthMoonScene` 把 `assets.spaceBackground` 传给 `LandingSpaceBackground`。
7. `LandingSpaceBackground` 优先加载图片作为 large inside sphere/equirect backdrop；失败时回退到当前程序星空。

视觉要求：

- 背景保持深黑蓝，不使用纯黑。
- 星点稀疏，不能抢月球边缘。
- 不使用大块紫蓝渐变或装饰性光斑。
- 图片与程序星空在色调上接近，切换 fallback 不应明显跳风格。

## 6. 实施顺序

### Phase 1：反转滚动编排

- 在 `openingTimeline` 中把当前 `progress 1` 的近地构图作为新的 `P0_CLOSE`，把当前 `progress 0` 的完整地月构图作为新的 `P2_FIELD`。
- 保持 `mapOpeningProgress(progress)` 的外部 API 不变，只反转内部关键帧和语义，避免调用方再做 `1 - progress` 的二次反转。
- 更新 `EarthMoonScene` 的自转规则：P0_CLOSE 和 P1_PULLBACK 不叠加自动 yaw；只有 progress 接近 P2_FIELD 后才允许慢速自转恢复。
- 更新光照插值：首屏直接使用 `DEFAULT_LUBIRTH_SUN_DIRECTION` 对齐绵阳日景；退远过程中平滑过渡到远景半昼半夜，不允许突然翻到夜侧。
- 更新 `MiraLithHome` 的 sr-only 文案和阶段命名：phase one 为近地日景，phase two 为完整地月退远视角。
- Phase 1 验收只看构图和运动，不同时改 shader：P0_CLOSE 目标点稳定，P1_PULLBACK 无跳变，P2_FIELD 地月完整。

### Phase 2：近地大气弧光

- 基于 `transition1.md` 重写 `karmanLineMaterial` 的 fragment shader。
- 保留当前 sphere shell 结构，删除或压低导致厚蓝边的旧 outer halo 贡献。
- 首屏 P0_CLOSE 必须先满足 2.4，不满足不得进入 Phase 3。
- P2_FIELD 的远景 atmosphere 不应继承 P0_CLOSE 的高亮白线强度。

### Phase 3：晨昏线、日景和目标点

- 把 `atmosphere1.md` 的 Rayleigh/Mie 参数压缩进 `LandingEarth` 和 `LandingAtmosphere`。
- P0_CLOSE：按 `1993-08-01T11:03:00+08:00` 对齐日侧，绵阳投影必须落入 `x=1029 +/- 24`, `y=941 +/- 28`。
- P2_FIELD：地球视觉上昼夜各占约一半，容差 `45%-55%`；月球在上方，地球在下方。
- 若新增相机或 timeline 参数，必须同步更新 2.3。

### Phase 4：云层厚度

- 基于 `cloud1.md` 的 density/coverage 思路增强现有贴图采样。
- 云层要有厚度、阴影和云顶 relief。
- 不得出现孤立白线、白毛、均匀噪点或全局发灰。
- P0_CLOSE 中云层不能遮盖绵阳目标点判断；P2_FIELD 中云层不能把小地球变成灰白球。

### Phase 5：极光

- 把 `LandingAurora` 从 line geometry 改为 shader ribbon。
- 使用 `aurora2.md` 的 tri noise。
- 只在夜侧和地弧附近可见，不覆盖主地表目标点。
- 随滚动退远逐步减弱，不能在 P2_FIELD 抢月球和完整地月轮廓。
- mobile/low tier 使用低采样或关闭。

### Phase 6：背景图资产

- 找到 LuBirth 原背景图片后按第 5 节接入 manifest、budget 和 data flow。
- 背景图优先，程序星空兜底。
- desktop/mobile 固定矩阵截图核对。

## 7. 验收矩阵

每个 phase 完成时都要产出截图或明确说明截图工具失败原因。

| Viewport | P0_CLOSE | P1_PULLBACK | P2_FIELD |
| --- | --- | --- | --- |
| 2048x1159 | 绵阳目标点、大气弧光、日景、首屏无自转 | 拉远平滑、无横向跳动、月球不漂移 | 地月比例、半昼半夜、终点可慢速自转 |
| 1440x900 | 大气和云层清晰，目标点不被遮盖 | 滚动稳定，光照不翻面 | 构图不裁切，月球不抢地球 |
| 390x844 | 地弧和目标点不溢出 | 无文字/元素遮挡 | 月球和完整地球同屏 |

通用验收：

- `pnpm typecheck` 必须通过。
- 月球不旋转；反向滚动时月球随退远轻微缩小或保持稳定，不得突然放大。
- 地球在 P0_CLOSE 和 P1_PULLBACK 不自转；到 P2_FIELD 后才可恢复慢速自转。
- 大气层满足 2.4 的像素宽度和亮度约束。
- 云层满足 Phase 3 art direction。
- 极光满足 Phase 4 art direction。
- 性能满足第 3 节预算；如果浏览器截图或性能采样工具失效，必须记录失败原因和替代验证方式。
