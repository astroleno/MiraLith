# LuBirth 地月视觉差距复查

> 记录日期：2026-04-29  
> 范围：只看 LuBirth 地月视觉层，包括滚动性能、星空背景、代码云层、大气渐变/Karman 弧光、极光。不评文字排版。

## 当前结论

当前稿已经有地球、月亮、星空、大气、云层、极光相关代码，但关键视觉层没有稳定成为用户可感知的画面。问题不再是“没有写”，而是“写了但没有在正式滚动体验中成立”。

用户反馈必须作为下一轮修复的阻塞项：

1. 滚动起来很卡；星空背景不应该跟着滚动；现在背景也太暗淡，完全看不清。
2. 云层主要应该看到有厚度的代码云层，需要一直旋转；现在完全没看到。
3. 地弧的渐变光没看到，极光也没看到；这些 shader 层理论上应该和代码云层一样容易被视觉验证，但三者都没有实现到可见状态。

## 复查证据

本轮复查截图：

- `screenshots/lubirth-current-review-all-final.png`：最终地月同框，星空可见度低，地球大气/Karman/极光基本不可辨认。
- `screenshots/lubirth-current-review-atmosphere-near.png`：只保留大气层时，近地弧线存在，但整体更像一条柔边，缺少清晰的高能蓝白渐变弧光。
- `screenshots/lubirth-current-review-aurora-near.png`：只保留极光时，近地帧能看到很淡的绿色烟雾，但不像有明确结构的极区帘幕。
- `screenshots/lubirth-current-review-aurora-final.png`：最终帧极光不可见。

轻量滚动 smoke test 在 headless Chromium 下也出现长帧间隔。该结果不能当作精确 FPS，但和用户“滚动卡”的主观反馈一致，足以把滚动性能列为阻塞问题。

## 问题拆解

### 1. 星空背景

现状：

- `LandingSpaceBackground` 是 R3F 场景内的天空球和点星，跟随同一个相机视角渲染。
- Opening timeline 滚动时会改变 camera/lookAt，星空因此产生跟随滚动的视觉漂移。
- 背景纹理和点星都偏暗：`textureMaterial` 里的星点贡献被压低，`PointsMaterial` 在有背景纹理时透明度也较低。

差距：

- 用户期待的是“宇宙背景固定为稳定场”，不是随滚动镜头一起明显滑动。
- 星空需要成为可读的深空层，而不是只有少量暗点。

建议：

- 把星空拆成屏幕空间背景 pass，或者让 sky dome 永远跟随 camera position/rotation 的反向策略，使滚动只驱动地月，不驱动背景漂移。
- 加一个 `debug=stars` 或 `visualDebugLayer` 扩展，用于只看星空层。
- 提高星空背景曝光和点星 opacity，但限制亮星数量，避免变成噪点墙。

### 2. 代码云层

现状：

- `LandingCloudLayer` 已有多层 shell 和 `time` uniform。
- 但正式画面里云层厚度和独立旋转不明显，近地帧主要看到的是地表贴图上的云和白色云块，而不是有体积的代码云层。
- `time` 只影响 shader 内部风场，缺少可被肉眼识别的 cloud shell 自转或相对地球漂移。

差距：

- 用户期待“看到有厚度的代码云层，并且一直旋转”。
- 当前效果缺少明确的层间视差、边缘体积和持续运动信号。

建议：

- 让 `cloudGroup` 或每层 cloud shell 有轻微独立 yaw/pitch drift，和地球本体旋转区分开。
- 在 near-earth 阶段提高 shell 边缘密度和高光，让“厚度”先成立，再回收强度。
- 增加 `debug=clouds`，截图时只显示地球基础层 + 代码云层，避免被地表贴图云混淆。

### 3. 地弧渐变光 / Karman 弧光

现状：

- `LandingAtmosphere` 里已有多层 atmosphere、close airglow 和 Karman-line shader。
- 近地单层截图能看到蓝边，但太柔、太暗；最终帧几乎不可见。
- Karman 弧光的强度随 `closeStage` 快速衰减，滚动到最终地月同框时没有保留足够视觉签名。

差距：

- 真实太空照片里的地球边缘通常有“极薄蓝白线 + 外侧低强度蓝雾”的明确层次。
- 当前更像轻微 rim light，缺少“渐变扩散卡门线弧光”的识别度。

建议：

- 把近地弧光拆成可调的三层：white needle、blue shelf、outer diffusion。
- 最终帧保留低强度但可见的 blue rim，不要完全消失。
- 使用截图验收：`debug=atmosphere&progress=0` 必须能看到明确白线、蓝带、外雾三层；`progress=1` 也要保留细蓝边。

### 4. 极光

现状：

- `LandingAurora` 已有多层 curtain shader。
- 近地单层截图只能看到很淡的绿色烟雾，缺少帘幕结构。
- `reveal = 1 - smoothstep(0.28, 0.88, progress)` 会让极光在最终地月同框时被完全隐藏。
- 自动质量可能落到 low；low 档又会降低 active layer count 和 intensity。

差距：

- 用户期待极光是可见的 shader 效果，不是几乎看不到的辅助气氛。
- 当前极光既不稳定可见，也不具备足够“极区帘幕”形态。

建议：

- 调整 reveal 曲线，让极光在 near-earth 和最终帧至少各有一个可见窗口。
- 增强 curtain 的竖向 strand 对比，减少烟雾化横向扩散。
- high/medium 档至少保留 2-4 层 curtain；low 档可以少层，但不能完全不可见，除非 reduced motion。

### 5. 滚动卡顿

现状：

- 星云背景、点星、地球 shader、云层 raymarch、atmosphere scattering、aurora curtain 同时参与同一 R3F canvas。
- 滚动时 camera、earth transform、moon placement、sun direction、DOM GSAP timeline 同时更新。
- headless smoke test 观测到长帧间隔；用户实机也报告卡顿。

建议：

- 先做可视层预算：stars、earth、clouds、atmosphere、aurora 分层开关，逐层测滚动。
- 默认滚动路径减少 shader 同时高强度工作，重层只在近地关键帧出现。
- 把背景星空和前景 shader 的更新频率解耦，避免滚动每帧驱动所有层。

## 下一轮验收标准

下一轮不以“代码存在”为通过标准，以截图和滚动体感为通过标准：

- 滚动 0 -> 1 不出现明显卡顿；至少完成一次 Chrome Performance 或 Playwright smoke profile 记录。
- 星空背景在滚动时保持稳定，不出现明显跟随相机滑动；背景可读但不抢地月主体。
- `debug=clouds` 能单独看出有厚度的云层，并且非截图模式下持续旋转。
- `debug=atmosphere` 在 `progress=0` 和 `progress=1` 都能看出地弧渐变光，近地帧有白线、蓝带、外雾三层。
- `debug=aurora` 在近地帧能看出极光帘幕结构，最终帧至少保留一处可见但克制的极光/airglow 痕迹。
- 常规 `copy=hidden` 截图能同时看到：稳定星空、地球体积云层、地弧蓝白线、极光帘幕。

## 建议执行顺序

1. 加视觉调试层开关：`stars`、`clouds`、`atmosphere`、`aurora`、`all`。
2. 先修星空背景固定和亮度，因为它影响滚动体感与整体空间读法。
3. 再修云层独立旋转和厚度可见性，确保“代码云层”不是只存在于 shader 里。
4. 单独调 Karman 弧光三层结构，先让近地帧成立，再让最终帧保留低强度签名。
5. 最后调极光 reveal 和帘幕形态，避免和地弧、大气、云层互相盖掉。
