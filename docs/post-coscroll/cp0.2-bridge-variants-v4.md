# CP0.2 — CoScroll → ArtBreeze Bridge Variants v4

状态：`IN REVIEW — CP0.3 NOT OPEN`

版本：`cp02-v4-real-yaw`

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
