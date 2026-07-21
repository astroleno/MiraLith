# CP0.2 — CoScroll → ArtBreeze Bridge Variants v3

状态：`SUPERSEDED — NOT A CURRENT CP0.2 CANDIDATE`

版本：`cp02-v3-source-direction`

> 历史记录：本版恢复了 source 的负 yaw 符号，却把 captured glyph 作为平面图像进行 screen-plane rotation。作者要求实体“空”保持真实 `rotation.y` 姿态解体；当前评审应使用 [v4 real-yaw variants](cp0.2-bridge-variants-v4.md)。本文件和本地媒体只用于复核被替换的配置，绝不是 Editorial GO。

本轮仅替换本地评审桥段，修正“空”被错误反向的问题。它不实现正式 Canvas / 粒子系统、路由、ScrollTrigger、production media contract 或 CDN。

## 1. 本轮纠正：方向必须从真实 CoScroll source 继承

`cp02-v1` 已被作者否决：它读起来像“空”先停住、随后才粒子化，且粒子过早暖化。`cp02-v2` 修复了停转与色彩问题，却又把真实 source 的负 yaw 归一化成了正向 screen rotation；v3 再次出错于把真实 yaw 展平为平面转字。当前输入是 v4。

真实 source 代码是唯一方向基准：source-match 给 `CoScrollJadeAnchor` 传入 `baseSpeed={-0.32}` 与 `velocityMultiplier={-7.5}`，[CoScrollSceneContent.tsx](../../packages/coscroll-scene/src/CoScrollSceneContent.tsx#L411)；锚字的 `rotationRef.current` 累加后直接写入 `rotation.y`，[CoScrollJadeAnchor.tsx](../../packages/coscroll-scene/src/CoScrollJadeAnchor.tsx#L606)。因此当前作者修正确认的共同约束是：**实体“空”、从它剥落的蓝粒子、以及蓝色缺口环都保持该负 yaw 的同一方向，绝不在桥段内翻向。**

为避免“相位对齐”暗中加入反向角速度，v3 使用的是常量相位偏移：

`θ(t) = -0.32t - 0.5 × 3.2992425775t²`，`φ(t) = θ(t) − θ(2.0)`。

于是 `dφ/dt = dθ/dt < 0` 全程成立：`−18.334649°/s → −396.4°/s`，`t=2.0s` 累计 `−414.734649°`。它选择一条最后落在 `n=355` 缺口相位的轨迹，而不是在末段“拉回”到影片相位。离线 2D review 投影把该负 yaw 显示为逆时针；生产阶段仍必须从实时 3D yaw / speed 采样或投影，不能复用这个瞬时 capture / matte。

ArtBreeze 的真实 stable-window 仍测得为屏幕坐标顺时针。v3 只让桥段在交棒帧匹配其**中心、尺寸、缺口与相位**，不伪造 source 的速度符号来宣称两端方向已连续；影片自身的相反 screen-direction 是仍待作者评审的事实，而不是本轮被掩盖的实现细节。

## 2. 共同 bridge 与目标约束

| 项 | v3 约束 / 证据 |
| --- | --- |
| CoScroll 输入 | 同一真实 live `空` capture，`data-coscroll-progress=0.9994`；`2.5s` / 75 帧 H.264 review proxy。没有现成 terminal、粒子残影、正式 DOM ring 或 production CoScroll audio。 |
| 连续运动 | `2.0s` / 60 帧 bridge；实体保持转动，在边缘与笔画内部解体为粒子。蓝粒子和蓝色开口环继承负 yaw 并加速，常量 phase offset 只决定最终相位、从不反转。 |
| 色彩职责 | source jade 参考 `#B0C5D5`；评审粒子显式 `#65B1D9`。蓝色保留至最终交给影片环的短暂暖化，目标色只在最后接到 canonical FFmpeg / BT.709 `#F3832F`。 |
| 电影几何目标 | 保留 coded raster `1920×1080` 的 letterbox，active picture `y=[135,945)`；center `(949.67,556.25)`，outer diameter `114.38px`，line `8.04px`，gap `80°` / center `222°`；实际影片从 `n=355` 接管。 |
| 动作可视证据 | [v3 motion contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/review/bridge-motion-source-direction-contact-sheet.jpg) 与 [v3 bridge proxy](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/bridge-proxy-source-direction/coscroll-source-direction-blue-particles-v3.mp4)。九帧覆盖实体旋转、笔画内剥落、蓝粒子、蓝色缺口环、白场及最终交棒姿态；三版线性样片紧接着才进入实际 `n=355` 影片环。 |

![v3：负 yaw 连续、蓝粒子、蓝色环、最后交棒](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v3/review/bridge-motion-source-direction-contact-sheet.jpg)

## 3. 三版同等完成度线性样片

三版均为 `691` 个视觉帧 / `23.033333s`：真实 CoScroll `2.5s` + v3 bridge `2.0s` + 同量 ArtBreeze 候选窗 `18.533333s`。容器多出的 AAC padding 不代表新增画面。前 `4.5s` 没有 CoScroll production audio；之后是母版音频内容的 AAC review transcode。

| 版 | 真实编辑顺序 | 线性样片 | 当前声音 |
| --- | --- | --- | --- |
| `A-source-order-source-direction-v3` | CoScroll → v3 bridge → ArtBreeze `[n=0,n=556)`，不重排。 | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/A-source-order-source-direction-v3.mp4) | bridge 后按 source order 进入母版音频内容。 |
| `B-ring-first-source-direction-v3` | CoScroll → v3 bridge → 真实 `[n=355,n=556)` → `[n=0,n=355)`。 | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/B-ring-first-source-direction-v3.mp4) | 从真实 `n=355` 影片段进入母版音频内容。 |
| `C-hybrid-source-direction-v3` | CoScroll → v3 bridge → `[n=0,n=355)` 本地 DOM-ring review stand-in → 真实 `[n=355,n=556)`。 | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/C-hybrid-source-direction-v3.mp4) | bridge 后从早期影片段进入母版音频内容。 |

C 的 DOM ring 只存在于被忽略的本地 review proxy；它不是当前 CoScroll terminal，也不授权正式 DOM ring。

## 4. 低保真 scroll-scrub capture

每版都有同一时基的 scrub capture：`0.000 → 0.369` 前进，`0.369 → 0.152` 反向撤回，`0.152 → 1.000` 再前进。反向段是同一素材的视觉撤回，没有新增情节或 production ScrollTrigger。

| 版 | capture |
| --- | --- |
| A | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/scrub/A-source-order-source-direction-v3-scrub-demo.mp4) |
| B | [B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/scrub/B-ring-first-source-direction-v3-scrub-demo.mp4) |
| C | [C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/scrub/C-hybrid-source-direction-v3-scrub-demo.mp4) |

每个 capture 是 `991` 帧 / `33.033333s` 的本地 review movie：线性 `t=0–8.5s` 前进、`t=8.5–3.5s` 反向、`t=3.5–23.033333s` 恢复。它只验证“积累、撤回、再推进”的读法。

## 5. v3 比较：仍需作者判断的内容

| 维度 | A — Source Order | B — Ring First | C — Hybrid |
| --- | --- | --- | --- |
| 共同 source 方向 | 实体、蓝粒子、蓝环全程继承负 yaw；不再做 v2 的正向归一化。 | 同左。 | 同左。 |
| 粒子 → 电影环 | 交棒后叙事回到 `n=0` 黑场 / LOADING，几何承诺会被叙事重启打断。 | 直接落入 `n=355`，中心、尺寸、gap 相位与暖橙最直接；但影片 screen-direction 的事实差异应被有意识地审阅。 | bridge 的蓝环先交给本地 stand-in，再交真实影片；连续性多一层非电影对象。 |
| 等待 / 白场 / 困境 | LOADING → 等待者 → 白场 → 困境的因果最完整。 | 先困境、后回等待，可能读作循环，也可能读作普通 seek。 | 仍保留等待，但 DOM ring 易被读成 spinner / 品牌 loading。 |
| DOM / 影片职责 | 无 DOM ring；影片 ring 只在其真实 source 时刻出现。 | 无 DOM ring；影片 ring 直接承担交棒。 | DOM ring 仅是 review stand-in；影片 ring 才承载真实语义。 |
| 声音 | 当前仅为 source-content 基线，未冻结。 | 当前仅为 source-content 基线，未冻结。 | 当前仅为 source-content 基线，未冻结。 |

v3 修复的是共同运动方向，不替作者选择 A/B/C，也不把历史 v1 的声音实验迁移为 v3 声音结论。

## 6. 作者评审入口

请针对一个**确切的 v3 线性样片文件**给出 GO、NO-GO 或修改意见：

1. 实体“空”是否清楚地在保持自身旋转方向的同时，从笔画内部变为蓝粒子？
2. 蓝粒子与蓝色开口环是否仍读作同一角动势，而不是停住、翻转或另起 spinner？
3. A/B/C 哪一种更接近“重复、等待、推着看不见的石头”，而非普通 video seek 或炫技转场？
4. 在一个视觉版本真正收敛后，才为它比较三种声音入点。

修改意见、混合建议和 NO-GO 都必须先产出新的确切样片；不能直接记作 CP0.3 GO。CP0.4 仍锁定。
