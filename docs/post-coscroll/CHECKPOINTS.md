# Post-CoScroll Stage 0 Checkpoints

状态：`CP0.1 — PASS / CP0.2 — IN REVIEW`
本轮范围：CP0.1 的 Asset Truth 已通过；作者随后明确要求继续，现已完成 CP0.2 的 A/B/C 本地评审媒体。历史声音比较不自动迁移为当前 v3 结论。尚未进入 CP0.3、CP0.4、Stage 1 或 Stage 2。

## CP0.1 — Asset Truth

状态：`PASS — 作者确认于 2026-07-20`
以下是已获作者确认的真实素材与当前 source 状态证据。此 PASS 仅覆盖 Asset Truth。

### 作者 PASS 记录

作者确认：**“保留黑边、实时 yaw、接受 n354。CP0.1：PASS。”**
范围说明：此 PASS 不代表 CP0.2 授权，也不是 Editorial GO；**在该确认时** CP0.2 为 `NOT STARTED`。

| 验收项 | 已交付的可核验证据 |
| --- | --- |
| 母版身份、hash、codec、duration、source time base、音频轨 | [shot map §1](first-sequence-shot-map.md#1-artbreeze-母版事实)；[durable FFprobe JSON](evidence/artbreeze-full.ffprobe.json)；[durable whole-file identity](evidence/artbreeze-full.identity.json)。 |
| `00:00.000–00:18.533333` 全窗逐镜与半开 PTS | [shot map §2](first-sequence-shot-map.md#2-全窗逐帧检查与-source-order-review-clips)；[durable 28 条 source-order manifest](evidence/artbreeze-0000-1853-source-slice-manifest.json)。 |
| 每段首帧与最后包含帧可回到母版 | [durable framemd5](evidence/artbreeze-0000-1853.framemd5)；每段边界 hash 同时列在 shot map 的实际切片表。 |
| 硬切、白闪、loader、圆环、逐字文字变化 | [全窗 contact sheet](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/artbreeze-0000-1853-contact-sheet.jpg)；[ring 逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-ring-n290-n384.jpg)；[字幕逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-text-n370-n489.jpg)。 |
| 影片圆环的首次可见、首次 coherent、稳定接管窗与几何/运动/颜色 | [durable ring constraints](evidence/artbreeze-ring-constraints.json)；[active-aperture evidence](evidence/artbreeze-active-aperture.json)；[FFmpeg color provenance](evidence/ring-color-provenance.json)；[first visible](../../apps/site/.generated/post-coscroll-editorial/ring-frames/first-visible.png)、[first complete](../../apps/site/.generated/post-coscroll-editorial/ring-frames/first-complete.png)、[stable target](../../apps/site/.generated/post-coscroll-editorial/ring-frames/stable-target.png)。 |
| 真实 CoScroll source end、参考 glyph matte、空间/旋转/色彩约束 | [live source end](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-live.png)、[glyph reference mask](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-mask.png)、[durable measurements JSON](evidence/coscroll-source-end-measurements.json)、[shot map §4](first-sequence-shot-map.md#4-coscroll-当前真实源末态字符空)。此 mask 是单姿态 fixture，不是实时 yaw 的 production particle source。 |
| DOM fallback 的真实限制 | [fallback reference](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-fallback.png)。它是在一次性本地 tab 以现有 fallback markup/CSS 直接实例化的参考，显示 **“心”**；它不是 runtime failure，也不是“空”的 terminal。 |
| 声音存在与静默边界 | [waveform](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853-waveform.png)、[spectrogram](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853-spectrogram.png)、[frame/audio metrics](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853-frame-metrics.json)。review clips 是 H.264/AAC 代理，保留内容与时间范围而非原 AAC packets。 |
| 可跨机器复核的小型证据 | [evidence README](evidence/README.md)。identity、FFprobe、framemd5、slice manifest、ring constraints、active aperture、color provenance 与 CoScroll measurement 均位于非忽略的 `docs/post-coscroll/evidence/`。 |

### 作者复核结果

1. `n=263` / `00:08.766667` 是白闪 / UI card，而不是圆环；首个中性 loader 是 `n=298`，首个橙色可见弧是 `n=337`；`n=354` 是首个 coherent open ring 的**确认候选标签**，`[n=355, n=363)` 是确认的技术交棒窗。
2. “我们每天都在推着一块 / 看不见的石头”的首字 **“我”** 是 `n=377` / `PTS=1,131,000` / `00:12.566667`，不是与圆环同帧出现。
3. 环色的 `#E77D33` 是非 canonical OpenCV 值；本轮显式 FFmpeg BT.709 测量为 `#F3832F`。两者均不能直接变成 production CSS token，直到真实播放管线冻结。
4. 编码 raster 是 `1920×1080`，实测 active picture 为 `1920×810` / `y=[135,945)`；letterbox 与 crop-to-fill 会产生两套圆环几何。
5. 当前真实 CoScroll 截帧是 `progress=0.9994` 的可见 **“空”**；精确 `48.0s` 会在现有 `wrapTime()` 中回到 `0.0s`。没有既有 terminal、加速尾声、粒子残影或 DOM ring。静态 mask 仅为该 yaw 的 reference fixture。
6. 以后若制作粒子桥，必须遵循已经记录的目标：字符旋转 → 粒子残留 → 字符笔画本体解体 → 粒子重组为 open loading ring → 与影片真实圆环交棒；本 CP0.1 没有实现其中任何一项。

### 作者确认的三个边界

1. 桌面正式显示保留母版 letterbox。
2. 字符从实时用户 yaw / speed 解体；静态 matte 只作 reference fixture。
3. 接受 `n=354` 为首个 coherent-ring 候选，`[n=355,n=363)` 为实际技术交棒窗。

作者确认的是“asset truth 可作为下一阶段输入”，不是 Editorial GO。该 PASS 当时并不自行打开 CP0.2；后续由作者明确要求继续，才开始以下的 CP0.2 review。

版本控制交接：CP0.1 结论提交时必须纳入 `docs/post-coscroll/evidence/`；`apps/site/.generated/post-coscroll-editorial/` 继续只作本地媒体证据。

## CP0.2 — Bridge Variants

状态：`IN REVIEW — 作者尚未作出 Editorial GO`

作者在 CP0.1 PASS 后明确要求继续。该指示仅打开 CP0.2 制作和评审，不等于选择某一版本，也不等于 CP0.3 GO。

### 当前评审：cp02-v3 source-direction blue bridge

v1 已因“停住后才粒子化 / 粒子过早暖化”被作者否决。v2 虽修正这两点，却错误把真实 CoScroll 的负 yaw 归一化为正向 screen rotation；作者已要求“空”保持自身旋转方向。v2 因此降为历史证据，以下才是当前可供评审的版本。

| 验收项 | 当前 v3 本地证据 |
| --- | --- |
| 共同运动约束 | 真实 source-match 是 `baseSpeed=-0.32`，且该符号直接写入 `rotation.y`。实体“空”从真实 live yaw / 非零速度继续**负 yaw**加速，在笔画内部解体；蓝粒子与蓝色缺口环保持同一方向。`φ(t)=θ(t)-θ(2.0)` 是常量相位偏移，绝不在末段反向。见 [v3 motion contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/review/bridge-motion-source-direction-contact-sheet.jpg) 与 [bridge proxy](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/bridge-proxy-source-direction/coscroll-source-direction-blue-particles-v3.mp4)。 |
| 三版同等完成度线性样片 | [A — Source Order v3](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/A-source-order-source-direction-v3.mp4)、[B — Ring First v3](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/B-ring-first-source-direction-v3.mp4)、[C — Hybrid v3](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/C-hybrid-source-direction-v3.mp4)。三版均为 `691` 个视觉帧 / `23.033333s`，使用同一 `2.5s + 2.0s` CoScroll / bridge 基线与同一 ArtBreeze 候选窗。 |
| 低保真 scroll-scrub | [A scrub v3](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/scrub/A-source-order-source-direction-v3-scrub-demo.mp4)、[B scrub v3](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/scrub/B-ring-first-source-direction-v3-scrub-demo.mp4)、[C scrub v3](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/scrub/C-hybrid-source-direction-v3-scrub-demo.mp4)：都显示同一 `0.000 → 0.369 → 0.152 → 1.000` 的前进、撤回、恢复，不接 production ScrollTrigger。 |
| 可跨机器复核媒体身份 | [v3 source-direction manifest](evidence/cp0.2-v3-source-direction-bridge-manifest.json)。大型媒体仍由 `.gitignore` 排除。 |
| 比较结论与待作者决定 | [v3 comparison](cp0.2-bridge-variants-v3.md#5-v3-比较仍需作者判断的内容)。没有任何执行者观察可替代作者针对确切样片的 GO。 |

### 历史记录：cp02-v2（已被 source-direction correction 取代）

v2 的实体、粒子和蓝环被设为正向 screen rotation，以求贴合 ArtBreeze 的量测方向。这覆盖了 CoScroll `baseSpeed=-0.32` 的实际符号，故不得再作为当前候选。媒体和 [v2 manifest](evidence/cp0.2-v2-continuous-blue-bridge-manifest.json) 仅保留以复核该错误及其替换关系。

### 历史记录：cp02-v1（已 NO-GO）

| 验收项 | CP0.2 本地证据 |
| --- | --- |
| 三版同等完成度线性样片 | [A — Source Order](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/A-source-order-linear.mp4)、[B — Ring First](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/B-ring-first-linear.mp4)、[C — Hybrid](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/C-hybrid-linear.mp4)。三版均为 691 帧的同一 `2.5s + 2.0s + 18.533333s` review 范围。 |
| 同一真实 CoScroll source end | [live capture metadata](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/coscroll-live-end/capture.json)、[live endpoint proxy](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/coscroll-live-end/coscroll-live-end-2.5s.mp4)、[offline bridge constraints](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/bridge-proxy/bridge-proxy.json)。离线 bridge 不是正式粒子实现。 |
| 真实影片接管边界 | B/C 均从 `[n=355,n=556)` 进入真实影片，严格区别于仅作 coherent 候选的 `n=354`；A 保持 `[n=0,n=556)` source order。 |
| 低保真 scrub | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/A-source-order-scrub-demo.mp4)、[B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/B-ring-first-scrub-demo.mp4)、[C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/scrub/C-hybrid-scrub-demo.mp4)；[native scroll interaction trace](evidence/cp0.2-scrub-interaction-trace.json) 验证 `0→15→30→45→30→23→60` 的前进、撤回、再前进帧映射。没有 production ScrollTrigger。 |
| 比较表（中心、尺寸、方向、gap 相位、亮度、声音、节奏、情绪） | [CP0.2 comparison](cp0.2-bridge-variants.md#4-连续性与读法比较)；[contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/review/CP02-bridge-variants-contact-sheet.jpg)。 |
| 领先视觉版的三种声音入点 | 暂定视觉领先 A 的 [source sound](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-1-artbreeze-original.mp4)、[silent-until-dilemma](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-2-silent-until-dilemma.mp4)、[review-only residue](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-3-residue-then-artbreeze.mp4)。详见 [声音比较](cp0.2-bridge-variants.md#5-暂定领先视觉方案的声音对比)。 |
| 可跨机器复核媒体身份 | [CP0.2 media manifest](evidence/cp0.2-bridge-variants-manifest.json)。本地大型媒体继续由 `.gitignore` 排除；manifest、滚动 trace 和评审说明不被忽略。 |

历史 v1 的执行者观察（**不是作者选择，且已被 v1 NO-GO 覆盖**）：B 的环交棒最直接，A 的“等待 → 白场 → 困境”因果最完整，C 最清楚暴露 persistent DOM ring 容易被读为 spinner。A 的旧声音 1/2/3 对比不能自动迁移为 v2 声音结论；不得把此记录理解为 CP0.3 GO。

当前完整媒体索引、source-order/重排说明、连续性参数和待作者回答的问题在 [CP0.2 v3 bridge variants](cp0.2-bridge-variants-v3.md)；[v2 bridge variants](cp0.2-bridge-variants-v2.md) 与 [v1 bridge variants](cp0.2-bridge-variants.md) 均只保留为历史记录。

## CP0.3 — Editorial GO

状态：`NOT OPEN`

须先完成同等完成度的 CP0.2 样片。作者对一个确切样片版本的 GO 才能打开本 checkpoint；修改建议、混合意见或 NO-GO 都不算通过。

## CP0.4 — Editorial Freeze

状态：`LOCKED — CP0.3 required`

尚未冻结镜头顺序、PTS、声音、文字时机、补充素材、DOM / 视频职责或 freeze hash。任何后续实现不得把本 CP0.1 的测量结果误写为已批准剪辑决定。
