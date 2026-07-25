# CP0.2 — CoScroll → ArtBreeze Bridge Variants v2

状态：`SUPERSEDED — NOT A CURRENT CP0.2 CANDIDATE`

版本：`cp02-v2-continuous-blue`

> 历史记录：本版在修复 v1 的停转与暖化问题时，错误地把真实 CoScroll source 的负 yaw 归一化为正向 screen rotation。随后 v3 又把真实 yaw flatten 成平面转字，v4 成为真实-yaw 历史基线；当前作者评审应使用 [v9 parity comparison](cp0.2-v9-parity-comparison.md)。本文件和它的本地媒体只用于复核被替换的配置，绝不是 Editorial GO。

本轮只重做本地评审代理。它不实现正式 Canvas / 粒子系统、路由、ScrollTrigger、production media contract 或 CDN。

## 1. v1 的作者 NO-GO 与本轮修正

作者否决 `cp02-v1` 的共同桥段，原因是它把“空”读成了**停住后**才变粒子，且粒子过早暖化。v1 留作历史 NO-GO 证据，不可再被当作候选结论。

v2 当时采用、现已被否定的共同运动参数是：

1. 当前真实 “空” 的旋转不停止；但它从 live source end 的负 yaw 被错误翻为顺时针 screen rotation。
2. 字符实体仍在转动时，边缘和笔画内部同时剥落成粒子；不是淡出后另起一团粒子。
3. 剥落粒子及其先形成的缺口环保持冷玉蓝；只有最终交给 ArtBreeze 的真实环时才暖化为目标橙色。
4. 粒子环在交棒前继续保留顺时针相位运动，并在结尾匹配 CP0.1 已确认的电影目标 `[n=355,n=363)`。

这仍是离线 editorial fixture：Stage 1 若获单独授权，必须从实际用户当下 yaw / speed 采样或投影，不能把此截帧或静态 mask 当作 production pose。v3 同时移除了任何动态 phase lock，避免在最后一段暗中抵消 source 方向。

## 2. 共同桥段与真实目标

| 项 | v2 约束 / 证据 |
| --- | --- |
| CoScroll 输入 | 真实 live capture 的 `data-coscroll-progress=0.9994`，可见锚字“空”；`2.5s` / 75 帧 H.264 review proxy。没有现成 terminal、粒子残影、正式 DOM ring 或可继承的 CoScroll production audio。 |
| 连续运动 | `2.0s` / 60 帧 bridge proxy；image-space 顺时针，从约 `0.32rad/s` 加速到 CP0.1 影片目标约 `396.4°/s`。实体与粒子共享该旋转动势。 |
| 色彩职责 | 实测 CoScroll source jade `#B0C5D5`；为评审可读性，粒子显式使用冷玉蓝 `#65B1D9`。`progress=0.87` 前不得使用目标橙；最终才过渡到 FFmpeg/BT.709 解析目标 `#F3832F`。 |
| 环的电影目标 | 保留 `1920×1080` coded raster 内的 letterbox，active picture `y=[135,945)`；center `(949.67,556.25)`，outer diameter `114.38px`，line `8.04px`，gap `80°` / center `222°`，顺时针。实际影片从 `n=355` 接管。 |
| 关键帧证据 | [0–2000ms 连续运动 contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/review/bridge-motion-0-2000ms-contact-sheet.jpg)：第一行能看到实体改变姿态且开始碎裂；中段是蓝粒子；随后为蓝色开口环、白场、橙色电影目标。 |

共同 bridge： [continuous-blue particle proxy](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/bridge-proxy-continuous-blue-v2c/coscroll-continuous-blue-particles-v2c.mp4)。它是唯一共享的桥段；A/B/C 只比较其后的剪辑顺序和 DOM / 影片职责。

## 3. 三版同等完成度线性样片

三版的视觉均为 `691` 帧 / `23.033333s`：真实 CoScroll `2.5s` + 连续蓝粒子桥 `2.0s` + ArtBreeze 候选窗的等量 `18.533333s`。MP4 容器的 `23.053s` 是 AAC padding，不是新增画面。前三段无 CoScroll production audio；进入各自第一个 ArtBreeze 段时保留母版音频**内容**的 AAC review transcode。

| 版 | 真实编辑顺序 | 线性样片 | 初始声音 |
| --- | --- | --- | --- |
| `A-source-order-continuous-blue-v2` | CoScroll → 连续蓝粒子桥 → ArtBreeze `[n=0,n=556)`，不重排。 | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/linear/A-source-order-continuous-blue-v2.mp4) | bridge 结束后从 source-order 首段进入母版音频内容。 |
| `B-ring-first-continuous-blue-v2` | CoScroll → 连续蓝粒子桥 → 真实电影 `[n=355,n=556)` → `[n=0,n=355)`；候选窗每帧一次，但为测试目的重排。 | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/linear/B-ring-first-continuous-blue-v2.mp4) | 从真实 `n=355` 影片段进入母版音频内容。 |
| `C-hybrid-continuous-blue-v2` | CoScroll → 连续蓝粒子桥 → ArtBreeze `[n=0,n=355)` 的本地 DOM-ring stand-in → 未覆盖的真实 `[n=355,n=556)`。 | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/linear/C-hybrid-continuous-blue-v2.mp4) | bridge 后从早期影片段进入母版音频内容。 |

所有 C 的 DOM ring 都只在被忽略的本地 review proxy 中存在；它不是当前页面已有能力，也不是正式实现承诺。

![v2 蓝粒子桥与三种后续顺序](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v2/review/bridge-motion-0-2000ms-contact-sheet.jpg)

## 4. 低保真 scroll-scrub capture

每版都有单独的回放式 scrub capture：先前进 `0.000 → 0.369`，再反向撤回 `0.369 → 0.152`，最后前进 `0.152 → 1.000`。反向段是同一线性时间的视觉撤回；没有在倒退时插入新情节，也没有 production ScrollTrigger。

| 版 | capture |
| --- | --- |
| A | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/scrub/A-source-order-continuous-blue-v2-scrub-demo.mp4) |
| B | [B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/scrub/B-ring-first-continuous-blue-v2-scrub-demo.mp4) |
| C | [C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/scrub/C-hybrid-continuous-blue-v2-scrub-demo.mp4) |

capture 的固定段落为线性 `t=0–8.5s` 前进、`t=8.5–3.5s` 反向、`t=3.5–23.033333s` 恢复。它们是本地可播放 review movie，供验证“积累、撤回、再推进”的读法，不是 route 级交互实现。

另有一个仅在 `.generated` 内的本地 review surface：[scrub-review.html](../../apps/site/.generated/post-coscroll-editorial/cp02-v2/scrub/scrub-review.html)（可加 `?variant=A|B|C`）。它用 native scroll 直接映射同一线性 proxy 的 `currentTime`，只供人工复核，不属于 site route。

## 5. v2 比较：本轮应由作者判断的内容

| 维度 | A — Source Order | B — Ring First | C — Hybrid |
| --- | --- | --- | --- |
| 粒子 → 电影环连续性 | blue ring 暖化后先回 `n=0` 的黑场 / LOADING；空间承诺被叙事重启打断。 | 直接落入 `n=355`，中心、尺寸、方向、gap 相位和暖橙目标最连续。 | bridge 的蓝环先交给本地 stand-in，随后才交真实环；连续但增加一个非电影对象。 |
| 等待 / 白场 / 困境 | 保留原始的 LOADING → 等待者 → 白场 → 真实环 / “我们每天…”。 | 先给真实环 / 困境，再回到等待首段；可读作循环，也可能读作普通 seek。 | 等待镜头仍在，但 persistent DOM ring 易压过人的状态。 |
| “周而复始推石头” | 因果最直：等待先积累、困境后揭示。 | 机械循环最直，但需要作者确认“先果后因”的回跳是不是有意。 | 最像持续推转，但也是最容易被误读为 spinner / 品牌 loading。 |
| DOM / 影片职责 | 无 DOM ring；影片 ring 只在其真实 source 时刻出现。 | 无 DOM ring；影片 ring 直接负责交棒。 | DOM ring 仅负责 bridge 后的临时连续性；影片 ring 负责最终真实语义。它是否应存在仍未决定。 |
| 声音状态 | 历史样片使用基本 source-content 方案；尚未冻结。 | 历史样片使用基本 source-content 方案；尚未冻结。 | 历史样片使用基本 source-content 方案；尚未冻结。 |

执行者观察（**不是作者选择**）：v2 已消除 v1 的“停转后变粒子 / 过早暖化”错误；B 的几何交棒仍最直接，A 的叙事因果仍最完整，C 仍暴露 DOM ring 的 spinner 风险。没有一个观察构成 CP0.3 GO。

v1 为 A 做过的 3 种声音入点仍只保留为历史 timing experiment；在作者确认一个 v2 视觉方向前，不把它们移植或冻结为 v2 声音结论。

## 6. 作者评审入口

请针对一个**确切的 v2 线性样片文件**给出 GO、NO-GO 或修改意见：

1. 它是否读作“重复、等待、推着看不见的石头”，而不是 spinner、品牌 loading 或炫技转场？
2. 是否接受“实体持续转动中解体为蓝粒子 → 蓝色缺口环 → 仅最终暖化接真实影片环”的共同桥段？
3. 在 A/B/C 中，等待者与白场应处于真实环之前、之后，还是 C 的临时 DOM 方案应被取消？
4. 视觉版本收敛后，才在该版本上重新比较 3 种声音入点。

修改意见、混合建议和 NO-GO 都必须先产出新的确切样片；不能直接记为 CP0.3 GO。CP0.4 仍锁定。
