# Post-CoScroll Stage 0 Checkpoints

状态：`CP0.1 — PASS / CP0.2 — PASS (TECH) / CP0.3 — PASS (AUTHOR) / CP0.4 — PASS (AUTHOR + TECH)`
本轮范围：CP0.1 的 Asset Truth、CP0.2 v9 的公平 A/B/C 比较、作者对确切 B v9 的 GO 与 CP0.4 editorial freeze 均已完成。Stage 0 至此结束；Stage 1、Stage 2 仍未获授权。

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

状态：`PASS — TECH evidence complete，2026-07-24`

作者在 CP0.1 PASS 后明确要求继续。CP0.2 只验证三版是否可公平比较；它不要求作者先选版。作者选择与声音主观确认属于 CP0.3，不能再作为 CP0.2 的循环门禁。

### 历史受控基线：cp02-v4 real-yaw blue bridge

v1 已因“停住后才粒子化 / 粒子过早暖化”被作者否决。v2 错误把真实 CoScroll 的负 yaw 归一化为正向 screen rotation。v3 虽恢复负 yaw 符号，却把 captured glyph 平面旋转。作者要求实体“空”沿真实 `rotation.y` 姿态解体；v4 建立了后来 v8/v9 均复用的真实 yaw 基线。

| 验收项 | 历史 v4 本地证据 |
| --- | --- |
| 共同运动约束 | 真实 source-match 是 `baseSpeed=-0.32`，并直接写入 `rotation.y`。实体“空”在 bridge 第 `0…27` 帧使用真实 live capture `frame-014 → frame-043` 的 yaw pose 解体；不使用平面 `Image.rotate` 或二维旋转矩阵。蓝粒子与蓝色缺口环继续保持负 yaw 动势；`φ(t)=θ(t)-θ(2.0)` 仅固定终点相位。见 [v4 motion contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/review/bridge-motion-real-yaw-contact-sheet.jpg) 与 [bridge proxy](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/bridge-real-yaw/coscroll-real-yaw-blue-particles-v4.mp4)。 |
| 三版同等完成度线性样片 | [A — Source Order v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/A-source-order-real-yaw-v4.mp4)、[B — Ring First v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/B-ring-first-real-yaw-v4.mp4)、[C — Hybrid v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/C-hybrid-real-yaw-v4.mp4)。三版均为 `691` 个视觉帧 / `23.033333s`，使用同一 `2.5s + 2.0s` CoScroll / bridge 基线与同一 ArtBreeze 候选窗。 |
| 低保真 scroll-scrub | [A scrub v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/A-source-order-real-yaw-v4-scrub-demo.mp4)、[B scrub v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/B-ring-first-real-yaw-v4-scrub-demo.mp4)、[C scrub v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/C-hybrid-real-yaw-v4-scrub-demo.mp4)：都显示同一 `0.000 → 0.369 → 0.152 → 1.000` 的前进、撤回、恢复，不接 production ScrollTrigger。 |
| 可跨机器复核媒体身份 | [v4 real-yaw manifest](evidence/cp0.2-v4-real-yaw-bridge-manifest.json)。大型媒体仍由 `.gitignore` 排除。 |
| 比较结论与待作者决定 | [v4 comparison](cp0.2-bridge-variants-v4.md#5-作者评审入口)。没有任何执行者观察可替代作者针对确切样片的 GO。 |

### 历史精确 B 复核对象：cp02-v8 complete-original-order

作者选择了**保留原始 B 顺序**，而不是把 v7 缺失的等待者段默认为删除。`cp02-v8` 因此不是新 B 定义：它只完成既有 `B-ring-first-real-yaw-v4` 的实际顺序，并修复 v7 的三项可复核缺口。

| 验收项 | v8 证据 / 结论 |
| --- | --- |
| 完整 B 顺序 | [B v8 linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/B-ring-first-v8-complete-n355-phase-aligned-faded-source-audio.mp4)：网页 bridge `[0,109)` → ArtBreeze `[n=355,n=556)` / `PTS=[1,065,000,1,668,000)` → ArtBreeze `[n=0,n=355)` / `PTS=[0,1,065,000)`；`665` 帧 / `22.166667s`。等待者、LOADING、白场和首段回到样片，未被删除。 |
| 网页 → 影片交棒 | [30fps boundary proof](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/web-to-n355-boundary-30fps-v8.mp4)、[boundary sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/B-ring-first-v8-complete-boundaries-contact-sheet.png)。解码终片中网页 `n=108` 与影片 `n=109 / source n=355` 的中心差 `0.06px`、半径差 `0.15px`、gap 中心 `155° → 154°`；ROI 中位 RGB 差 `[4,5,3]`。 |
| 原 B 源端回跳 | [endpoint → n0 proof](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/n556-to-n0-boundary-30fps-v8.mp4)。这里的 `n=556` 是半开 endpoint PTS；最后包含帧仍是 `n=555`，随后明确落到 `n=0`。 |
| 声音切口 | 两个剪点均采用 `12ms` review fade。解码 PCM 的相邻样本跳变分别为 web→`n=355` `[0.00001127,0.00003319]`、endpoint→`n=0` `[0.00017822,0.00040887]`；它们是内容保留的 AAC review transcode，不是原 AAC packets。 |
| 可跨机器复核 | [v8 durable manifest](evidence/cp0.2-v8-b-ring-first-complete-manifest.json)、[boundary measurements](evidence/cp0.2-v8-b-ring-first-complete-boundary-measurements.json)。大型媒体与本地 checksum index 继续由 `.gitignore` 排除。 |

#### v8 对抗复核后的 CP0.2 阻断项

1. **QR 叙事决定：** `n=0…2` 是 ArtBreeze / QR 卡、`n=3` 是黑帧；v8 把它们置于“推石头”文本之后、等待段之前。作者必须选择删除、后移到真正片尾，或明确接受“结束后重启”的读法。
2. **全帧亮度决定：** FFmpeg 对解码终片的 `n=108 → n=109` 测得 `YAVG=30.2625 → 177.852`、`YDIF=154.31`。环 ROI 的几何/颜色连续不消除暗场→白场硬切；是否保留该白闪由作者决定。
3. **受控比较恢复：** v8 只升级 B；A/C 仍为 v4、且 v8 未提供三版 scrub。因此必须在上述两项决定后，以同一网页 bridge、格式、声音基线重制 A/C 和 A/B/C scrub，才能继续 CP0.2。
4. **声音主观确认：** `12ms` fade 已消除样本级 click，仍须由作者戴耳机听 `n=555 → n=0` 的音乐/情绪回跳，选择保留原声、延迟入声或 CoScroll 残响。

**v8 现为历史 B 复核对象。** 它不构成 Editorial GO，也不冻结声音、路由或任何 production media contract。

### 当前受控评审：cp02-v9 parity / QR deferred / exposure

作者随后选择了上述两项推荐：QR / title slate 后移至真实体验片尾，暗场→白场改为极短曝光退场。`cp02-v9` 以**同一** v8 browser-captured real-yaw / opaque-cutout / pale-jade-particles / blue-ring / warm-ring 前缀、`960×540 / 30fps`、静默网页前缀和 `12ms` review audio fade 基线，重新制作 A、B、C 和每版 scrub。

| 验收项 | v9 证据 / 结论 |
| --- | --- |
| QR 不再插入首段 | 三版均排除 `n=0…3`；首段逻辑 source 从 `n=4` / `PTS=12,000` 开始。QR / title slate 被记录为真正体验片尾的后续素材，不以“结束后重启”读法出现在本轮。 |
| A / B / C 同基线线性样片 | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/A-source-order-v9-qr-deferred-exposure.mp4)、[B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4)、[C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/C-hybrid-v9-qr-deferred-exposure.mp4)。A/C 各 `664` 帧 / `22.133333s`，B `667` 帧 / `22.233333s`；只因 B 的第二个四帧重排过渡和三帧静默 pocket 多出 `0.1s`。 |
| 同基线 scrub | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/A-source-order-v9-qr-deferred-exposure-scrub.mp4)、[B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/B-ring-first-v9-qr-deferred-exposure-scrub.mp4)、[C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/C-hybrid-v9-qr-deferred-exposure-scrub.mp4)。三版均为 `900` 帧 / `30s`，共享 `0.000 → 0.369 → 0.152 → 1.000` 前进、撤回、恢复 trace；不接 production ScrollTrigger。 |
| B 曝光交棒 | [30fps exposure boundary](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/B-web-to-n355-exposure-boundary-v9.jpg)。解码全帧 `YAVG` 依次为 `30.5777 → 67.6324 → 104.667 → 141.724 → 178.628`，每步 `YDIF≈38.6–38.9`，替代 v8 单帧 `154.31` 的白场跳变。 |
| B 回到等待 | [n555 → n4 boundary](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/B-n555-to-n4-qr-deferred-boundary-v9.jpg)：`n=555` 后经四帧暗化落到 `n=4` LOADING，不回到 QR。两个 source 声音段使用 `12ms` fade，中间 `0.1s` 静默 pocket；作者已将其接受为 deliberate restart。 |
| C 的 DOM ring 职责 | [C stand-in evidence](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/C-dom-ring-takeover-v9.jpg)。它是明确的 local composited stand-in，用于测试“等待中的 persistent ring 会读成 spinner”的风险；不是正式 DOM ring 授权。 |
| 可跨机器复核 | [v9 durable manifest](evidence/cp0.2-v9-parity-qr-deferred-exposure-manifest.json)、[boundary measurements](evidence/cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json)、[root checksum index](evidence/cp0.2-v9-parity-qr-deferred-exposure-checksums.sha256)。 |

**CP0.2 PASS — TECH，2026-07-24。** v9 已恢复同基线 A/B/C、每版 scrub，并由 [v9 统一比较表](cp0.2-v9-parity-comparison.md) 集中覆盖中心、尺寸、方向、相位、明暗、声音、节奏与情绪含义；它满足计划的 TECH pass 条件。它当时不选择 A / B / C；后续作者在 CP0.3 选择 B，并由 CP0.4 freeze 固定其结果。

### 历史记录：cp02-v3（已被 real-yaw correction 取代）

v3 正确保留了负 yaw 符号，但错误把 captured glyph 当作平面图像旋转；它不再是当前候选。媒体和 [v3 manifest](evidence/cp0.2-v3-source-direction-bridge-manifest.json) 仅保留以复核该错误与 v4 替换关系。

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

当前完整媒体索引、source-order/重排说明、连续性参数和待作者回答的问题在 [CP0.2 v9 parity comparison](cp0.2-v9-parity-comparison.md)；v4、v3、v2 与 v1 均只保留为历史记录。

## CP0.3 — Editorial GO

状态：`PASS — AUTHOR，2026-07-25`

作者先对 [B-ring-first-v9 scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/B-ring-first-v9-qr-deferred-exposure-scrub.mp4)（SHA-256 `3168c035eefcceada6bd8bc099f9192871ab6305e42f39244e03aabcbfb1cabb`）确认：**“B 用这个更自然一些。”**，再确认：**“可以，继续吧”**。该授权将 B 视觉选择及其 selected linear review-audio treatment 固定为 [B-ring-first-v9 linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4)（SHA-256 `803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e`）。

作者选择 B 的含义是：持续旋转的“空”经粒子 / 开口环先接到影片真实圆环与“推石头”，再回到 LOADING / 等待，读作循环而非普通 seek。C 的 persistent DOM ring 因 spinner 风险没有进入冻结版；不补拍新镜头，QR/title slate 继续后移。`105.986ms` 的声音 restart pocket 已随“继续”接受为有意循环，不制作 audio-only v10；可复算技术参数见 [audio audit method](evidence/cp0.2-v9-b-audio-audit-method.md)。

## CP0.4 — Editorial Freeze

状态：`PASS — AUTHOR + TECH，2026-07-25`

[冻结清单](evidence/cp0.4-b-ring-first-v9-editorial-freeze.json)（freeze hash `d906937cc0b885b12fc942f91ce50e9af919878142cead5c0b36d8bd648140a1`）锁定 B 的镜头顺序、每段半开 PTS、首尾 raw-frame MD5、文字时机、声音处理、补充素材决定、DOM / 影片职责边界及连续性测量。[checksum index](evidence/cp0.4-b-ring-first-v9-editorial-freeze-checksums.sha256) 将小型冻结记录与本地忽略的媒体身份共同绑定。

冻结版保留母版 letterbox；网页 bridge 使用真实负 `rotation.y` yaw 的不透明“空”与低饱和玉粒子，影片圆环从 exact `n=355` 起唯一接管。此为 editorial freeze，**不是** production media/render/viewport contract。任何冻结项变更均须把 CP0.4 标为 `REOPENED` 并产出新的 Stage 0 review artifact。该冻结提交本身不进入 Stage 1 或 Stage 2；作者之后以“继续·1”单独授权了下列 Unit 1 工作。

## CP1.1 — Local Media Contract

状态：`PASS — TECH，2026-07-25`

Unit 1 已在隔离分支建立 committed source spec、共享 manifest facade、server-only local resolver、toolchain/preparation scripts、production isolation 与 E2E 合同，并用全部现有真实母版生成完整 local-preview catalog；没有进入 Stage 2 route、ScrollTrigger 或正式 CoScroll terminal。

| 验收项 | 当前结果 |
| --- | --- |
| CP0.4 绑定 | source spec 固定 freeze SHA `d906937…40a1`、B v9 linear SHA `803219…b135e`、`[n=355,n=556) → [n=4,n=355)`、四帧回跳、`0.1s` silence 与 `12ms` source-audio fade。加入 Dulwich 后 source-spec SHA 为 `0abfd288738e0197ccea9ec6808d3a23064e177c7a4d72e287cc4a3599b0ebbd`。 |
| PTS / frame truth | AeScape 的 scrub/showcase 共用 `PTS=1,482,000` 半开边界；宇宙片段为 `[6,057,000,6,681,000)`，最后包含 `n=2226` 眼睛，`n=2229 / PTS=6,687,000` 首个泳池帧作为排除 sentinel。 |
| Dulwich 总成片 | 使用完整 `dulwich-homepage-video-2026.mp4`：SHA `a197358…c17be`，`1280×720`、CFR 30、503 帧、`[0,257536)`；片头直接起画，片尾字标有意解构到暖白，不裁切。 |
| manifest / resolver | 生成 15 个 item：13 个 ready、Li / UGCFlow 2 个 pending；真实 resolver 返回 `ready` 且零诊断。asset key、bytes、SHA、source/output frame MD5、duration、frame rate、faststart 与预算均 fail closed；manifest 不含绝对路径。 |
| production isolation | 正常 `next build` 通过；`MIRALITH_POST_COSCROLL_MEDIA_MODE=local-preview next build` 在 next config 阶段拒绝。`public/media/post-coscroll/` 残留也由同一 production gate 拒绝。 |
| 全量转码 | 13 个 ready item 的 poster 与 desktop/mobile（frame-hold 除外）均在真实母版上通过。视频使用按预算计算的 two-pass ABR、H.264、CFR 30、faststart；Sadine 的 BT.709 full-range 母版做数值范围转换后统一为 `yuv420p/tv`。catalog 为 `101,211,814B`，低于 `160,000,000B` 上限。 |
| 自动验证 | `13/13` Unit 1 E2E 合同通过；site typecheck、lint、正常 production build、两种 production isolation 反例、toolchain check 与真实 manifest resolver 均通过。identity 见 [CP1.1 status evidence](evidence/cp1.1-local-media-contract-status.json)。 |

CP1.1 的 source / derivative / resolver / isolation contract 已关闭。Dulwich 与其余母版位于不同目录，因此 prepare 新增显式 `--source-file dulwich=…` 覆盖；该绝对路径只存在于本地命令参数，绝不进入 source spec 或 preview manifest。Li / UGCFlow 按计划保留 `pending`，不会伪造时间码、视频或 URL。

本 checkpoint 不声称 Stage 2 route 已存在或完成页内播放；Unit 2 必须先建立 known / preview route shell，届时再用此已验证 manifest 做实际路由播放复核。production publication、远端 Range/cache 验证与 deploy manifest 仍属于 Unit 9。

## CP1.2 — Chapter Access Graph

状态：`IN REVIEW — foundation repair 与 Unit 2D rebase candidate 已完成技术验证；CP1.2 尚待独立复核，Unit 3 继续关闭`

### Unit 2.0 — Transition Foundation

状态：`PASS — TECH，2026-07-26`

本项只冻结现有 01–03 public rail 的 transition foundation，作为后续 known / preview / published access graph 的可验证基线；它不新增 chapter access resolver、不创建 04–07 route shell、不启用 CoScroll terminal，也不打开 CP1.2 的完成门禁。

| 项目 | 已冻结事实 |
| --- | --- |
| 代码候选身份 | 基线 `ec3cb9aaeea5cc60de17e07caefc60789d40f46a`；精确 staged binary patch SHA-256 `b97ece4548698f4fd4869d133b23bf2c2294637dd1c8ac25b9c1fdc4b06464d0`（202,538 bytes / 29 paths）。独立 foundation commit 为 `f64287b02400caf7638d82be3016419cf7596635`。 |
| 目标分支集成 | 在文档基线 `b228ae0818d2fa6c03880d5a4ac61ad5d710400d` 上以等效 cherry-pick 提交 `7e60b8591baa1af0954c6f55992270718f3b93f6` 集成；其代码 tree 与获批 patch 一致。 |
| 审查范围补充：CoScroll API closure | 除原候选中的 `types.ts`、`CoScrollStandaloneDemo.tsx`、`CoScrollSceneContent.tsx`、`CoScrollSilkBackground.tsx`、`CoScrollTextBillboard.tsx`、`CoScrollJadeAnchor.tsx` 外，明确审查并纳入 [`preloadCoScrollAssets.ts`](../../packages/coscroll-scene/src/preloadCoScrollAssets.ts) 与 [`index.ts`](../../packages/coscroll-scene/src/index.ts)。前者提供 transition target preload 所需的 package API；后者仅公开该 API。两者不包含 residue、粒子、terminal、材质或 rotation 调参。 |
| RadioGaga 边界 | 仅纳入 opening asset preload 的 `preloadRadioGagaAssets.ts` 及其单一 `index.ts` export；不纳入 `preloadRadioGagaFinaleAssets`、`loadFinale` 或 finale-ready 语义。 |
| 禁止项复核 | 候选 patch 不含 `CoScrollAnchorResidue`、`particleization`、`reviewAutoParticleization`、`preloadRadioGagaFinaleAssets`、`loadFinale`、`resolveLandingVisualPolicy`、`ReliefLiteValidationHarness`、`MIRALITH_POST_COSCROLL_MEDIA_MODE` 或 `/artbreeze` 路由实现。 |
| 已验证 | clean sparse candidate 上 site、CoScroll 与 RadioGaga typecheck、site lint、`git diff --check` 均通过；desktop transition/navigation suite 为 `33 passed / 3 expected skipped`。该测试结果只证明 foundation，不替代后续 local-preview route-shell 实播验证。 |

### Unit 2A — Canonical registry and pure access contract

状态：`PASS — INTEGRATED`

Unit 2A 以 `b08ad1f` 建立七章 canonical registry 与纯 access resolver，并由 `26a7067` 恢复 published 派生视图的显式 `readonly` 公共契约。该阶段仅声明 `ResolvedChapterTransitionEndpoint`；不改变 `ChapterTransitionSnapshot` 的运行时结构，也不接入 Provider、preview session、history 或 04–07 route shell。

### Unit 2B — Preview session and build scope

状态：`PASS — INTEGRATED，2026-07-29`

Unit 2B 已以提交 [`13557fa`](../../commit/13557fa1022d245df3761c9da1d7a5c50ffab801) 集成到目标分支。获批的精确 binary patch SHA-256 为 `fb6f94388b65f62c331c3b41ff5c0578c0c019aabb316e0f9f32075f3d5a4d68`；其 parent 为 `5db2041fe65b4f28b707e9f138e4e9fd16479de9`。完整身份、范围和可复现验证记录见 [Unit 2B integration evidence](evidence/cp1.2-unit2b-preview-session-integration.json) 与其 [checksum](evidence/cp1.2-unit2b-preview-session-integration-checksums.sha256)。

| 验证 | 已记录结果 |
| --- | --- |
| patch / source integrity | 精确 patch SHA、反向补丁校验与 `git diff --check` 均通过。 |
| 静态与 Node contracts | site typecheck、lint 通过；`miraLithChapters` 与 preview-scope Node contracts 共 `8 passed`。 |
| preview lifecycle | focused preview E2E 为 `7 passed`（门槛为至少 6 条），包括 pathname commit 后 marker 写入、back/forward、伪造/失配 scope 与 transition 中 storage 篡改后的 fail-closed。 |
| desktop transition + navigation | `40 passed / 3 expected skipped`，退出码 `0`。 |

该提交只加入 build-scoped preview session、history marker 与 scope validation；未接入 endpoint/coordinator，未启用 CoScroll terminal，未创建 `/artbreeze` 或其他 04–07 route shell，也未实现真实 `03 → 04` 转场。根工作区中用户未暂存的 `apps/site/next.config.ts` 不构成此阶段或后续 Unit 2C 的基线。

### Unit 2C — Coordinator access integration

状态：`PASS — INTEGRATED，2026-08-06`

Unit 2C 的原始获批候选 `38ceff87eaad2681d9aa4ea3a79865801fa6f1f3` 已在隔离 worktree 从当前目标基线 `96d1422b373aa2c23d2d08cd25985e122bb6c378` 重新 cherry-pick 为 `905692ac2008f3d44f6d8ace5b7b7d242dadc7c1`。基线相关的新的 LuBirth、RadioGaga、CoScroll 改动未被混入候选；只有 `globals.css` 的 resolver 可见性选择器发生自动的非冲突合并。精确范围、patch identity 与验收记录见 [Unit 2C integration evidence](evidence/cp1.2-unit2c-coordinator-integration.json) 及其 [checksum](evidence/cp1.2-unit2c-coordinator-integration-checksums.sha256)。

| 验证 | 已记录结果 |
| --- | --- |
| scope / source integrity | 相对 `96d1422` 的 9 文件 patch SHA-256 为 `bed2dfe19b4d8517a7d2129b1c448949e40207b28d7e49d73afb473f727587a8`；`git diff --check` 与反向 patch check 均通过。 |
| 静态检查 | site、CoScroll、RadioGaga typecheck 和 site lint 全部通过。 |
| Unit 2C 访问契约 | 5 条 focused desktop E2E 全部通过：preview rail、armed RadioGaga rail 可见性、preview-history fail-closed、preview warmup、public warmup 拒绝。 |
| 01–03 目标基线例外 | `96d1422` 自身的完整 desktop transition/navigation suite 不是绿色基线。关键的 RadioGaga `waiting-ready` 用例在 base 与 rebase candidate 上各连续 3 次均复现；其余失败属于当前 LuBirth/RadioGaga/CoScroll visual/readiness 面，未由本 Unit 修复或掩盖。完整命令与失败名见 evidence；因此 CP1.2 继续保持 `IN PROGRESS`，不得把本项当作 CP1.2 PASS。 |

本 Unit 仅将 canonical resolver 接入 Provider、endpoint snapshot、terminal gate、target preloader 和 navigation；它保持 `data-published` 的章节固有语义，并以 resolver 派生的 `data-visible-in-navigation` 控制 armed-terminal 下的可见性。它没有创建 04–07 route shell、没有实现 `03 → 04` destination readiness、没有启用 CoScroll terminal、没有加入 ScrollTrigger、Canvas 或任何 Stage 2 视觉转场。

CP1.2 仅会在 access matrix、history、production isolation 与独立 local-preview 实播验证均完成后才可标记 `PASS`；本次 Unit 2B 集成不打开 Unit 3。

### Foundation repair and Unit 2D rebase candidate

状态：`IN REVIEW — TECH COMPLETE / NOT INTEGRATED，2026-08-08`

此前 CP1.2 的 production shared suite 不能 waiver：RadioGaga package 与站点解析出了两份 R3F/Drei peer instance，`RadioGagaSceneContent` 的 `useThree()` 因此落在另一份 Canvas context 外，连带触发错误 fallback、提前 warmup 与 readiness 假象。独立 foundation commit [`6b3f35b`](../../commit/6b3f35bc4a1844794ae084753ec0e3aa90e56459) 将 root 与 RadioGaga 的 `@types/react` 锁定到 `19.2.17`，令 Fiber、Drei、React、React DOM 均解析到同一路径；其精确 patch SHA-256 为 `3f78de4e1206d28041d772dcff57eea14e26c01effc735cee5eaaeefd748e725`。

原 Unit 2D route-shell 代码从 `309c201` 重新应用到该 foundation，先形成 implementation [`1e16cfe`](../../commit/1e16cfeea11d25b4608240f135707cae2af66114)，再以 forced poster-503 回归形成 fallback test commit [`fcb3529`](../../commit/fcb352990ffd36c41df377c8a19e958e9fe450f4)。精确链为 `6b3f35b → 1e16cfe → fcb3529`：`1e16cfe` 的实际 parent 是 `6b3f35b`，`fcb3529` 的实际 parent 是 `1e16cfe`。候选保留 04–07 稳定 route shell、poster/fallback destination gate、显式本地播放和 production/local-preview runner 的边界；forced poster-503 回归证明活跃 `03 → 04` 交棒在 poster 失败时会经 `fallback-ready` 解除 veil，且可继续导航到 05。候选相对 foundation 的 patch SHA-256 为 `87506bd442cc7e42bce0aaefec21dd4c666435d5f7b9f089cd00e373ce1da892`；相对 `db64a2b` 的合并 patch SHA-256 为 `834f857cfa64dd55e27aec0701e9765f650373257fa239db921530f419bd64ca`。

| 验证层 | 结果 |
| --- | --- |
| final-HEAD 静态 / Node | typecheck、lint、`git diff --check` 与 8 条 Node contracts 通过。 |
| production isolation | 在无 `public/media/post-coscroll/` 的等 tree worktree 运行 shared suite：`60 passed / 3 expected skipped`，退出码 `0`。公开 rail 仍限 01–03，preview/history/input 的 fail-closed 覆盖保持有效。 |
| scope 串行复核 | cancelled → forged marker → stored scope 的最小相关前序链以 `--repeat-each=3` 运行 `9 passed`；未通过放宽 timeout 或 URL 断言规避。 |
| local-preview 实播 | 忽略的真实 catalog 已从冻结素材重建（13 ready / 2 pending，manifest SHA `0eb47bf…cc2f`）；独立 dev runner 为 `6 passed`，包括真实 ArtBreeze MP4 的显式播放和 poster 503 fallback。 |

完整身份、命令、媒体 hash、scope 串行结论和 root-relative checksum 命令见 [CP1.2 status evidence](evidence/cp1.2-chapter-access-graph-status.json) 与 [checksum index](evidence/cp1.2-chapter-access-graph-checksums.sha256)。在独立复核与作者确认前，**不得**将 CP1.2 标为 `PASS`，不得打开 Unit 3，也不得实现 CoScroll terminal、正式 `03 → 04` 视觉接力、ScrollTrigger、粒子、CDN 或 production media manifest。
