# Post-CoScroll Stage 0 Checkpoints

状态：`CP0.1 — PASS / CP0.2 — IN REVIEW`
本轮范围：CP0.1 的 Asset Truth 已通过；作者随后明确要求继续，现已完成 CP0.2 v9 的 A/B/C 本地评审媒体与 scrub。历史声音比较不自动迁移为 v9 结论。尚未进入 CP0.3、CP0.4、Stage 1 或 Stage 2。

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

### 历史受控基线：cp02-v4 real-yaw blue bridge

v1 已因“停住后才粒子化 / 粒子过早暖化”被作者否决。v2 错误把真实 CoScroll 的负 yaw 归一化为正向 screen rotation。v3 虽恢复负 yaw 符号，却把 captured glyph 平面旋转。作者要求实体“空”沿真实 `rotation.y` 姿态解体；v4 建立了后来 v8/v9 均复用的真实 yaw 基线。

| 验收项 | 当前 v4 本地证据 |
| --- | --- |
| 共同运动约束 | 真实 source-match 是 `baseSpeed=-0.32`，并直接写入 `rotation.y`。实体“空”在 bridge 第 `0…27` 帧使用真实 live capture `frame-014 → frame-043` 的 yaw pose 解体；不使用平面 `Image.rotate` 或二维旋转矩阵。蓝粒子与蓝色缺口环继续保持负 yaw 动势；`φ(t)=θ(t)-θ(2.0)` 仅固定终点相位。见 [v4 motion contact sheet](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/review/bridge-motion-real-yaw-contact-sheet.jpg) 与 [bridge proxy](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/bridge-real-yaw/coscroll-real-yaw-blue-particles-v4.mp4)。 |
| 三版同等完成度线性样片 | [A — Source Order v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/A-source-order-real-yaw-v4.mp4)、[B — Ring First v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/B-ring-first-real-yaw-v4.mp4)、[C — Hybrid v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/C-hybrid-real-yaw-v4.mp4)。三版均为 `691` 个视觉帧 / `23.033333s`，使用同一 `2.5s + 2.0s` CoScroll / bridge 基线与同一 ArtBreeze 候选窗。 |
| 低保真 scroll-scrub | [A scrub v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/A-source-order-real-yaw-v4-scrub-demo.mp4)、[B scrub v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/B-ring-first-real-yaw-v4-scrub-demo.mp4)、[C scrub v4](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/scrub/C-hybrid-real-yaw-v4-scrub-demo.mp4)：都显示同一 `0.000 → 0.369 → 0.152 → 1.000` 的前进、撤回、恢复，不接 production ScrollTrigger。 |
| 可跨机器复核媒体身份 | [v4 real-yaw manifest](evidence/cp0.2-v4-real-yaw-bridge-manifest.json)。大型媒体仍由 `.gitignore` 排除。 |
| 比较结论与待作者决定 | [v4 comparison](cp0.2-bridge-variants-v4.md#5-作者评审入口)。没有任何执行者观察可替代作者针对确切样片的 GO。 |

### 当前精确 B 复核对象：cp02-v8 complete-original-order

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
| B 回到等待 | [n555 → n4 boundary](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/B-n555-to-n4-qr-deferred-boundary-v9.jpg)：`n=555` 后经四帧暗化落到 `n=4` LOADING，不回到 QR。两个 source 声音段使用 `12ms` fade，中间 `0.1s` 静默 pocket；仍需作者戴耳机作主观判断。 |
| C 的 DOM ring 职责 | [C stand-in evidence](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/contact-sheets/C-dom-ring-takeover-v9.jpg)。它是明确的 local composited stand-in，用于测试“等待中的 persistent ring 会读成 spinner”的风险；不是正式 DOM ring 授权。 |
| 可跨机器复核 | [v9 durable manifest](evidence/cp0.2-v9-parity-qr-deferred-exposure-manifest.json)、[boundary measurements](evidence/cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json)、[root checksum index](evidence/cp0.2-v9-parity-qr-deferred-exposure-checksums.sha256)。 |

**状态仍为：`CP0.2 — IN REVIEW`，`CP0.3 — NOT OPEN`。** v9 恢复公平比较，但作者尚未在 A / B / C 中选择确切样片，且未完成 B 的主观声音确认；因此不能自行标记 CP0.2 PASS 或记录 Editorial GO。

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

当前完整媒体索引、source-order/重排说明、连续性参数和待作者回答的问题在 [CP0.2 v4 bridge variants](cp0.2-bridge-variants-v4.md)；v3、v2 与 v1 均只保留为历史记录。

## CP0.3 — Editorial GO

状态：`NOT OPEN`

须先完成同等完成度的 CP0.2 样片。作者对一个确切样片版本的 GO 才能打开本 checkpoint；修改建议、混合意见或 NO-GO 都不算通过。

## CP0.4 — Editorial Freeze

状态：`LOCKED — CP0.3 required`

尚未冻结镜头顺序、PTS、声音、文字时机、补充素材、DOM / 视频职责或 freeze hash。任何后续实现不得把本 CP0.1 的测量结果误写为已批准剪辑决定。
