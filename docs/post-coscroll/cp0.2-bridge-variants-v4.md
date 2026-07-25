# CP0.2 — CoScroll → ArtBreeze Bridge Variants v4

状态：`CP0.2 PASS — TECH / CP0.3 IN REVIEW — AUTHOR`

版本：`cp02-v4-real-yaw`

定位：`历史 real-yaw motion baseline；当前作者评审集合为 cp02-v9`。当前状态与 A/B/C 入口见 [v9 parity comparison](cp0.2-v9-parity-comparison.md)。

本轮只替换本地评审桥段的字符运动投影；不实现正式 Canvas / 粒子系统、路由、ScrollTrigger、production media contract 或 CDN。

## 1. v3 的平面转字错误与 v4 修正

`cp02-v3` 虽保留了负 yaw 的速度符号，却把 captured glyph 作为平面图像执行了 screen-plane rotation。这把真实 CoScroll 的 `rotation.y` 立体 yaw 误译为屏幕 Z 轴上的平面转字，故不再是当前候选。

真实 source 的主旋转是 `anchorGroup.current.rotation.y = rotationRef.current`；`rotation.x` / `rotation.z` 只是极小的随 yaw 摆动，见 [CoScrollJadeAnchor.tsx](../../packages/coscroll-scene/src/CoScrollJadeAnchor.tsx#L621)。v4 的实体“空”不使用 `Image.rotate`、二维旋转矩阵或其他 screen-plane transform：它在可见实体区间按真实 live capture 的 `frame-014 → frame-043` 姿态连续取样，在其真实 3D yaw / foreshortening 中从笔画内部解体；实体消失后的粒子源才收至 `frame-044`。

实体可见的解体区间是 bridge progress `[0.08,0.47]`；对应 60 帧 bridge 的第 `0…27` 帧，真实 yaw fixture 从 `14 → 43` 发生 20 次姿态变换。之后只剩由这些笔画采样而来的 `#65B1D9` 蓝粒子与蓝色缺口环。负 yaw 的加速、蓝色粒子和常量相位偏移仍保留；常量 offset 只选择最终 `n=355` gap phase，不会添加反向角速度。

## 2. 共同 bridge 与影片目标

| 项 | v4 约束 / 证据 |
| --- | --- |
| 字符运动 | 当前真实 source-match `baseSpeed=-0.32` 直接累加到 `rotation.y`。实体阶段使用真实 browser capture 的 yaw pose；不再将字符本体平面旋转。 |
| 粒子与色彩 | 粒子从每个真实 yaw pose 的大笔画 mask 采样；粒子与先形成的开口环保持 `#65B1D9` 冷玉蓝，最终才短暂暖化交给影片。 |
| 相位 | `φ(t)=θ(t)-θ(2.0)`，所以 `dφ/dt=dθ/dt<0`。没有 v3 之前曾出现的相位收敛反向，也没有 v3 的平面字转法。 |
| 影片目标 | letterbox 保留；实际 `n=355` 起的稳定交棒窗仍是 `[n=355,n=363)`；center `(949.67,556.25)`、outer diameter `114.38px`、line `8.04px`、gap `80° / 222°`。 |
| 动作证据 | [v4 real-yaw bridge](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/bridge-real-yaw/coscroll-real-yaw-blue-particles-v4.mp4)；[motion contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/review/bridge-motion-real-yaw-contact-sheet.jpg)。 |

![v4：真实 rotation.y 姿态解体，不作平面转字](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v4/review/bridge-motion-real-yaw-contact-sheet.jpg)

## 3. 三版同等完成度线性样片

三版均为 `691` 个视觉帧 / `23.033333s`：真实 CoScroll `2.5s` + v4 bridge `2.0s` + 同量 ArtBreeze 候选窗。前 `4.5s` 没有 production CoScroll audio；后段是母版音频内容的 AAC review transcode。

| 版 | 编辑顺序 | 线性样片 |
| --- | --- | --- |
| `A-source-order-real-yaw-v4` | CoScroll → v4 real-yaw bridge → ArtBreeze `[n=0,n=556)`。 | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/A-source-order-real-yaw-v4.mp4) |
| `B-ring-first-real-yaw-v4` | CoScroll → v4 real-yaw bridge → `[n=355,n=556)` → `[n=0,n=355)`。 | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/B-ring-first-real-yaw-v4.mp4) |
| `C-hybrid-real-yaw-v4` | CoScroll → v4 real-yaw bridge → `[n=0,n=355)` local DOM-ring review stand-in → `[n=355,n=556)`。 | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/C-hybrid-real-yaw-v4.mp4) |

C 的 DOM ring 仍只是被忽略的本地 review stand-in；它不是当前页面 terminal，也不授权正式 DOM ring。

## 4. 低保真 scroll-scrub

三版均复用同一回放时基：`0.000 → 0.369 → 0.152 → 1.000`，验证前进积累、反向撤回与再前进；不含 production ScrollTrigger。

| 版 | scrub capture |
| --- | --- |
| A | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/A-source-order-real-yaw-v4-scrub-demo.mp4) |
| B | [B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/B-ring-first-real-yaw-v4-scrub-demo.mp4) |
| C | [C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/C-hybrid-real-yaw-v4-scrub-demo.mp4) |

每条 scrub 是 `991` 帧 / `33.033333s`，由线性 `t=0–8.5s`、反向 `t=8.5–3.5s`、恢复 `t=3.5–23.033333s` 组成。

## 5. 作者评审入口

请先判断共同 bridge：实体“空”是否已读作真实 3D yaw 中解体，而不再像一张平面字绕屏幕旋转；蓝粒子和环是否仍保留同一方向的动势。之后再在 A/B/C 中判断等待者、白场与困境的排序。

`cp02-v4` 只是新的确切 review version，不构成 CP0.3 GO，也不冻结声音或进入 Stage 1。

## 6. v8：完成原始 B 顺序的精确复核对象

`cp02-v7` 已完成 `n=355` 相位和几何修正，但只播放到母版 `n=534`，没有包含 B 定义里的 `[n=0,n=355)` 等待者后置段。作者选择**保留原始 B 顺序**，所以 v8 不把等待段删掉，也不将 v7 重新命名为新的编辑方案。

v8 的完整顺序为：网页 review bridge `[0,109)` / `3.633333s` → ArtBreeze `[n=355,n=556)` / `PTS=[1,065,000,1,668,000)` → ArtBreeze `[n=0,n=355)` / `PTS=[0,1,065,000)`。终片为 `665` 帧 / `22.166667s`，因此包含 B 所需的影片圆环与“我们每天都在推着一块看不见的石头”，随后完整回到 `LOADING`、等待者、白场和真实圆环的原始首段。

| 项 | v8 复核结果 |
| --- | --- |
| 网页 → 影片 | 解码终片的最后网页环与 `source n=355` 的中心差 `0.06px`、半径差 `0.15px`、gap `155° → 154°`；环 ROI 中位 RGB 差 `[4,5,3]`。同一 browser/web review 输出经短暖化后交给真实影片环。 |
| 源片内容 | `n=355`、`n=555`、`n=0` 的终片与同缩放母版 SSIM 分别为 `0.995704`、`0.996667`、`0.998992`；差异来自 H.264 review transcode。 |
| 声音 | 网页保持静默，进入 `n=355` 及半开 endpoint 回跳均用 `12ms` review fade，消除了 v7 静默直拼的高幅度瞬态。 |
| 评审媒体 | [v8 linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/B-ring-first-v8-complete-n355-phase-aligned-faded-source-audio.mp4)、[complete contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/B-ring-first-v8-complete-contact-sheet.png)、[both-boundary contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/B-ring-first-v8-complete-boundaries-contact-sheet.png)。 |
| Durable identity | [v8 manifest](evidence/cp0.2-v8-b-ring-first-complete-manifest.json)、[boundary snapshot](evidence/cp0.2-v8-b-ring-first-complete-boundary-measurements.json)。 |

这仍是历史 B 的精确复核对象，不替代当前 v9 的受控三版集合，也不授权 production 路由、Canvas terminal、ScrollTrigger、CDN 或 Stage 1。

## 7. v9：同基线 A/B/C、QR 后移与四帧曝光

作者选择：**QR / title slate 后移至真正体验片尾，首段从 `n=4` 开始；暗场→白场采用四帧曝光退场。** 因此 v9 不再让 `n=0…2` QR 卡或 `n=3` 黑帧在“推石头”文本之后插入等待段。

三版共用 v8 已验证的 `109` 帧网页前缀（真实负 `rotation.y` yaw、opaque cutout、浅玉粒子、可读蓝环、短暖化）、`960×540 / 30fps`、网页静默和 `12ms` source-audio fade 基线；每版都提供 `900` 帧 / `30s` 的同一 `0.000 → 0.369 → 0.152 → 1.000` scrub trace。

| 版 | 编辑顺序 | 线性样片 | scrub |
| --- | --- | --- | --- |
| `A-source-order-v9` | web `[0,109)` → 四帧暗化至 `n=4` → source `[n=5,n=556)`；逻辑 source `[n=4,n=556)`。 | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/A-source-order-v9-qr-deferred-exposure.mp4) | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/A-source-order-v9-qr-deferred-exposure-scrub.mp4) |
| `B-ring-first-v9` | web `[0,109)` → 四帧曝光至 `n=355` → source `[n=356,n=556)` → 四帧暗化至 `n=4` → source `[n=5,n=355)`；逻辑 source `[n=355,n=556) → [n=4,n=355)`。 | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4) | [B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/B-ring-first-v9-qr-deferred-exposure-scrub.mp4) |
| `C-hybrid-v9` | web `[0,109)` → 四帧暗化至 `n=4` + local DOM-ring stand-in → source `[n=5,n=355)` + stand-in → source `[n=355,n=556)`。 | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/C-hybrid-v9-qr-deferred-exposure.mp4) | [C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/C-hybrid-v9-qr-deferred-exposure-scrub.mp4) |

### v9 连续性与限制

- B 的解码全帧 YAVG 从 `30.5777` 经 `67.6324`、`104.667`、`141.724` 到 `178.628`；每步 YDIF 约 `38.6–38.9`，不再是 v8 的单帧 `154.31` 跳变。见 [exposure proof](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/B-web-to-n355-exposure-boundary-v9.jpg)。
- B 从 `n=555` 返回时同样经四帧暗化落到 `n=4` LOADING，且没有 QR；两个 source audio 段各有 `12ms` fade，保留 `0.1s` 静默 pocket，仍须作者戴耳机确认情绪/音乐回跳。见 [return proof](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/B-n555-to-n4-qr-deferred-boundary-v9.jpg)。
- C 的 persistent ring 是**故意保留的风险测试**：它在等待者和 UI 上可能读作 spinner。见 [C takeover proof](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/C-dom-ring-takeover-v9.jpg)。它不是正式 DOM / Canvas 设计决定。
- v9 的稳定 identity、source mapping、SSIM 与完整 checksum 位于 [durable manifest](evidence/cp0.2-v9-parity-qr-deferred-exposure-manifest.json)、[boundary snapshot](evidence/cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json) 和 [checksum index](evidence/cp0.2-v9-parity-qr-deferred-exposure-checksums.sha256)。

**`CP0.2 — PASS (TECH)`，`CP0.3 — IN REVIEW (AUTHOR)`。** v9 已恢复同基线的 A/B/C、公平 scrub 与当前统一比较表；详见 [v9 parity comparison](cp0.2-v9-parity-comparison.md)。作者现在评审 A/B/C；任何选择仍须指向确切 v9 文件和 SHA，不能由执行者替代为 Editorial GO。
