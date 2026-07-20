# CP0.2 — CoScroll → ArtBreeze Bridge Variants

状态：`IN REVIEW`

版本：`cp02-v1`

本文件记录三个同等完成度的本地评审样片及比较结论。它不是 CP0.3 Editorial GO，不是 CP0.4 freeze，也不实现正式路由、Canvas 残影、ScrollTrigger、production media contract 或 CDN。

## 1. 共同评审基线

三版都使用同一真实 CoScroll 输入和同一 ArtBreeze 目标，而非伪造一个已经存在的 terminal：

| 项 | 共同基线 |
| --- | --- |
| CoScroll 开端 | 当前 `/coscroll` 的真实 `data-coscroll-progress=0.9994`、可见锚字“空”。本地 capture 为 `2.5s` / 75 帧 H.264 review proxy，由真实 live-end 截帧序列构成；没有现有 terminal、粒子残影或 CoScroll 正式音轨。 |
| 离线桥 | `2.0s` / 60 帧的 **offline editorial particle proxy**：从捕获瞬时姿态的“空”采样，顺时针加速、笔画粒子化并收束到影片环。它不是 production Canvas，也不能把静态 fixture 当作实时 yaw 的生产采样源。 |
| 影片 target | letterbox 保留；coded raster `1920×1080`、active picture `y=[135,945)`。接管目标为稳定窗 `[n=355,n=363)`；三版实际影片接管都从 `n=355` 开始。 |
| 目标连续性参数 | center `(949.67,556.25)`；outer diameter `114.38px`；line width `8.04px`；gap `80°`、gap center `222°`（screen-space）；顺时针约 `396.4°/s`；CP0.1 canonical analytic color `#F3832F`，近白 active-picture 背景。 |
| 共同时长 | 线性视觉均为 691 帧 / `23.033333s`：真实 CoScroll `2.5s` + 离线桥 `2.0s` + ArtBreeze 候选窗 `00:00.000–00:18.533333`。容器出现的约 `20ms` AAC padding 不是新增画面。 |

持续化来源与哈希见 [CP0.2 media manifest](evidence/cp0.2-bridge-variants-manifest.json)。CP0.1 源文件事实、半开 PTS 和 ring constraints 仍以 [shot map](first-sequence-shot-map.md) 为准。

## 2. 三版线性样片

| 版 | 实际编辑顺序 | 线性样片 | 初始声音处理 |
| --- | --- | --- | --- |
| A — Source Order | CoScroll → particle proxy → ArtBreeze `[n=0,n=556)`，保持母版 source order。 | [A-source-order-linear.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/A-source-order-linear.mp4) | CoScroll / bridge 静默；之后保留 ArtBreeze source-content audio。 |
| B — Ring First | CoScroll → particle proxy → ArtBreeze `[n=355,n=556)`（真实稳定环、文字、尾退）→ `[n=0,n=355)`（QR / LOADING / 等待者 / 白场 / 环形成）。候选窗每帧恰好一次，但为测试目的被重排。 | [B-ring-first-linear.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/B-ring-first-linear.mp4) | CoScroll / bridge 静默；从真实 `n=355` 影片段开始保留 source-content audio。 |
| C — Hybrid | CoScroll → particle proxy → ArtBreeze `[n=0,n=355)` 上的**本地 DOM-ring stand-in** → 未覆盖的真实影片 `[n=355,n=556)`。stand-in 在前段持续顺时针转动并在最后约 6% 退场，真实环从 `n=355` 接管。 | [C-hybrid-linear.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/C-hybrid-linear.mp4) | 静默穿过 CoScroll、桥、QR / LOADING；等待者 `n=116` 对应的编辑 `t=8.367s` 才进入 ArtBreeze source-content audio。 |

三版都保留母版上下黑边；没有裁切填满。所有 C 中的 DOM ring 都只存在于 gitignored 的本地 review proxy，不能被误读为已有正式 DOM 组件。

![CP0.2 三版接力比较](/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v1/review/CP02-bridge-variants-contact-sheet.jpg)

独立桥接视觉可看：[particle proxy near handoff](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/review/bridge-near-handoff.png)、[B real stable-ring handoff](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/review/B-ring-first-handoff-target.png)、[C DOM-ring over waiter](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/review/C-hybrid-dom-ring-waiter.png)。

## 3. 低保真 scroll-scrub 证据

每版同时有一个可线性播放的 scrub review movie，显示 `0.00 → 0.67` 前进、`0.67 → 0.42` 反向撤回、再由 `0.42 → 1.00` 推进。它是离线评审录像，明确标注为 local scrub，**不是**已接入的 ScrollTrigger。

| 版 | scrub review movie | 真实本地滚动页 |
| --- | --- | --- |
| A | [A-source-order-scrub-demo.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/A-source-order-scrub-demo.mp4) | `scrub/scrub-review.html?variant=A` |
| B | [B-ring-first-scrub-demo.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/B-ring-first-scrub-demo.mp4) | `scrub/scrub-review.html?variant=B` |
| C | [C-hybrid-scrub-demo.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/C-hybrid-scrub-demo.mp4) | `scrub/scrub-review.html?variant=C` |

另有一个仅在 `.generated` 内的静态 review surface： [scrub-review.html](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/scrub-review.html)。它用 61 个预渲染帧映射 native scroll，不属于 site route。实际浏览器 CUA 前进 / 反向 / 再前进的结果已持久化在 [native scroll interaction trace](evidence/cp0.2-scrub-interaction-trace.json)：三版都复现 frame `0 → 15 → 30 → 45 → 30 → 23 → 60`，对应 scroll `0 → 2160 → 4320 → 6480 → 4320 → 3240 → 8640`。因此撤回是对应的视觉撤回，而不是在反向时额外加入新情节。

## 4. 连续性与读法比较

| 维度 | A — Source Order | B — Ring First | C — Hybrid |
| --- | --- | --- | --- |
| 中心 / 尺寸 | particle proxy 到 target 后立即回到 source-order QR / LOADING；真实环稍后以同一影片几何出现。空间参数本身一致，但不是一次直接交棒。 | particle proxy → `n=355` 为直接、最小中心与直径跳位的匹配。 | proxy 与 stand-in 保持 target center / diameter；stand-in 退后由 `n=355` 接管，空间连续。 |
| 方向 / gap 相位 | proxy 按目标顺时针收束；source-order 在等待后才抵达影片真实环。 | 直接进入稳定窗，最容易读出同一顺时针、同一开口相位。 | stand-in 以约 `396.4°/s` 顺时针维持，并在进入 `n=355` 前退场；视觉连续但它是本地替身。 |
| 亮度 / 色温 | 暖橙近白环后重置到 QR 黑、LOADING 黑、冷蓝等待者，再经白场回到暖橙；“重启 / 等待”的因果最清楚。 | 暖橙近白环与“推石头”先到，随后硬回 QR / LOADING 黑；视觉交棒最好，但叙事存在回跳。 | 暖橙 ring 在黑 LOADING、冷蓝人物、白 UI 上持续，最终落到暖橙影片环；可测试 DOM 职责，但容易显得覆盖内容。 |
| 声音 | 保留 source-content audio 是默认初始方案；随后单独比较三种入点。 | 真实环时即进入 source-content audio；与视觉交棒一致。 | 静默至等待者，可减轻开头的“产品 loading”语义，但尚未做完整音频 3×3。 |
| 节奏 / “推石头” | 等待者与白场先累积，再由环和逐字句子解释困境；往前滚更像逐层推上去。 | 先给结论、后退回等待；比较像循环回放，需作者判断这是否是“重复”而非剪辑倒退。 | persistent ring 使滚动的机械循环非常清楚，但也把人物脸上的运动读成 spinner。 |
| 最显著风险 | 环在中段被 LOADING 重置，直接“网页环交影片环”的承诺最弱。 | 文字 / 环后回 QR / LOADING 的回跳，可能被读为普通 seek 或倒带。 | DOM ring 覆盖 LOADING 和等待者，最容易被读成品牌 loading / 转场炫技。 |

## 5. 暂定领先视觉方案的声音对比

基于当前本地比较，**A 仅作为声音测试的暂定领先样片**：它保留“等待 → 白场 → 困境文字”的因果，并未被选择为最终剪辑。此选择不构成 CP0.3 GO。

| 声音版 | 文件 | 精确入点 / 限制 |
| --- | --- | --- |
| 1 — 保留 ArtBreeze 原声 | [A-audio-1-artbreeze-original.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-1-artbreeze-original.mp4) | source order 在编辑 `t=4.500s` 进入；CP0.1 量得首个非静默样本约为 `t=4.639s`。 |
| 2 — 开头静默，困境后入声 | [A-audio-2-silent-until-dilemma.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-2-silent-until-dilemma.mp4) | 静默至等待者 `n=116`，即编辑 `t=8.367s`。 |
| 3 — CoScroll 残响跨环 | [A-audio-3-residue-then-artbreeze.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-3-residue-then-artbreeze.mp4) | `t=0–4.500s` 是低电平合成 `72Hz` **review-only residue**，之后接 ArtBreeze source-content audio。当前 CoScroll 没有可继承的 production audio，因此该声音只能测试时机，绝不能冻结为“现有源声”。 |

## 6. 可供作者作出 CP0.3 判断的问题

请针对一个**确切的线性样片文件和声音文件**作答，而非只给“混合一下”或修改方向：

1. 它是否读成“重复、等待与推着看不见的石头”，而不是 spinner、品牌 loading 或炫技转场？
2. 若选择 B，`环 / 文字 → LOADING / 等待` 的回跳是否是有意的“周而复始”，还是普通 seek？
3. 若选择 C，DOM ring 是否必须在人物镜头前撤出，或应当彻底取消 persistent DOM 职责？
4. A 的哪一种声音入点最能避免把 LOADING 当作产品状态？
5. 是否需要补一个新镜头 / 场景，而不是从 A/B/C 中直接选？

若作者给的是修改意见、混合建议或 NO-GO，先生成新的确切样片并重新评审；不得直接将其记为 GO。CP0.4 仍锁定。
