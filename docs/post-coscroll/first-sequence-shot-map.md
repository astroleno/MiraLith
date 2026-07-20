# Stage 0 — CoScroll → ArtBreeze 首段镜头图（CP0.1）

状态：`CP0.1 — PASS`
版本：`0.4`
范围：本文件仅记录真实母版、当前 CoScroll 源末态与以后粒子交棒所需的约束。没有制作 A/B/C 样片，没有实现路由、Canvas 残影、ScrollTrigger、正式粒子系统或 production media contract。

## 0. 证据边界

本轮只使用以下两端的真实来源：

- ArtBreeze 母版：`/Users/aitoshuu/Downloads/portfolio/artbreeze-full.MP4`
- 当前本地 CoScroll 页面：`http://localhost:3011/coscroll`，source-match 状态、可见锚字为“空”。

`apps/site/.generated/post-coscroll-editorial/` 下若已有旧的 `linear/`、`scrub/`、`audio/` 等 A/B/C 代理，它们早于本次 CP0.1 证据集，**不构成本文件、CHECKPOINTS 或任何 Editorial GO 的证据**。本轮新增证据只在 `probe/`、`source-slices/`、`contact-sheets/`、`ring-frames/` 与 `coscroll-source/`。

未来转场的目标仅作为约束记录，尚未实现：

> “空”继续旋转并加速 → 产生粒子残留 → 字符本体从边缘和笔画内部粒子化/解体 → 粒子保留旋转动势并重组为 loading 圆环 → 圆环的中心、半径、缺口、方向和相位贴合真实影片圆环 → 网页粒子圆环交给影片圆环。

这不是“字符淡出”，也不是把未来 terminal 效果伪装成当前页面。

### 作者确认的 CP0.1 约束（2026-07-20）

- 桌面正式显示保留母版上下 letterbox。
- “空”从用户当下的实时 yaw / speed 直接解体；静态 mask 仅作为 reference fixture。
- `n=354` 是首个 coherent-ring 候选；实际技术交棒窗是 `[n=355, n=363)`。

这只通过 Asset Truth；不构成 CP0.2 授权、A/B/C 样片选择或 Editorial GO。

## 1. ArtBreeze 母版事实

| 项 | 实测值 |
| --- | --- |
| 绝对路径 | `/Users/aitoshuu/Downloads/portfolio/artbreeze-full.MP4` |
| SHA-256 | `0ab8f26484ad1fe0814df44ba849581c22b948e6d7f1c2d7f2d1c89adab6396d` |
| 容器 / 文件大小 | QuickTime / MOV；`79,951,624` bytes |
| 视频 | HEVC Main，`1920×1080`，`yuv420p`，CFR `30/1`，`3297` 帧 |
| 视频色彩信号 | `color_range=tv`（limited）、`color_space=bt709`、`color_transfer=bt709`、`color_primaries=bt709` |
| 视频 duration / source time base | `109.900000s` / `9,891,000` ticks；`1/90000`；每帧 `3,000` PTS |
| 音频 | AAC LC，stereo，`44100Hz`，约 `188,743bps` |
| 音频 duration / source time base | `109.923265s` / `4,847,616` ticks；`1/44100` |
| CP0.1 检查窗 | `[0, 1,668,000)`；即 `n=0…555`，`00:00.000–00:18.533333`；`n=556` 是排除的下一场首帧 |

所有视频范围都采用半开区间 `[startPTS, endPTSExclusive)`。frame hash 是 FFmpeg 对母版解码为 raw `yuv420p` 后的 `framemd5`，不是代理文件或 PNG 的 hash。可随仓库持久化的完整表在：[artbreeze-0000-1853.framemd5](evidence/artbreeze-0000-1853.framemd5)；本地生成副本在：[generated framemd5](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853.framemd5)。

原始 FFprobe 结果的持久化快照在：[artbreeze-full.ffprobe.json](evidence/artbreeze-full.ffprobe.json)；whole-file SHA-256 与记录边界在：[artbreeze-full.identity.json](evidence/artbreeze-full.identity.json)。本地生成副本仍在 [probe/](../../apps/site/.generated/post-coscroll-editorial/probe/)。

### 编码 raster 与可见画幅（active picture）

`1920×1080` 是编码 raster，不等于实际内容画幅。在代表帧 `n=359` 上，观察到的有效画面是 `x=[0,1920)`、`y=[135,945)`，即 `1920×810`；上、下各有约 `135px` 的近黑 letterbox。它是像素层观察结果，不是容器声明的 clean-aperture metadata。

- [active-aperture evidence](evidence/artbreeze-active-aperture.json) 记录了边界检测与两种显示几何。
- 若桌面保留母版 letterbox，圆环保持 coded-raster 的 `114.38px` 外径、中心 `(949.67, 556.25)`。
- 若把 `1920×810` active picture 等比放大填满 `1920×1080` 并居中裁切，圆环约为 `152.51px` 外径、中心约 `(946.23, 561.67)`；这会同时裁切左右内容。
- **作者已确认桌面保留 letterbox。** crop-to-fill 保留在本文件仅作为未选替代几何，不能在后续实现中静默切换。

## 2. 全窗逐帧检查与 source-order review clips

产物：

- [全窗 contact sheet（每 5 帧）](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/artbreeze-0000-1853-contact-sheet.jpg)
- [关键帧序列](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/artbreeze-0000-1853-keyframe-sequence.jpg)
- [opening 逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-opening-n000-n024.jpg)
- [等待者切换与白闪逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-cut-flash-n185-n269.jpg)
- [loader / 圆环 / 字幕首现逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-ring-n290-n384.jpg)
- [逐字字幕逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-text-n370-n489.jpg)
- [文字与白→黑逐帧表](../../apps/site/.generated/post-coscroll-editorial/contact-sheets/detail-fade-n475-n555.jpg)
- [28 条 source-order review clips 的 manifest（持久化快照）](evidence/artbreeze-0000-1853-source-slice-manifest.json)
- [本地 review-clip manifest](../../apps/site/.generated/post-coscroll-editorial/source-slices/artbreeze-0000-1853-source-slice-manifest.json)

每条 review clip 都从母版以它的源 PTS 半开范围 trim、保留源顺序，再编码为 H.264 视频与约 `192kbps` AAC review proxy。验证结果：28/28 均可播放，所有 clip 的 frame count 与 manifest 边界一致。这里确认的是**母版音频内容与时间范围被保留**，不是原 AAC packet 的 bit-identical 保留；review clips 不能作为声音母版。

### 声音读法

音频轨自身从 `PTS=0` 起存在，但 `silencedetect=-50dB` 的实测静默区是 `[0, 6,144)` audio PTS，即 `[00:00.000, 00:00.139320)`；首次非静默样本落在视频帧 `n=4` 的时间范围内。此后到本检查窗末尾没有第二段 `-50dB` 静默。

本轮没有把波形误写成旁白/对白语义；所有 review clips 保留母版音频内容的重编码版本，供作者以耳朵审阅。表中“连续源声”是可验证的信号事实，不代表新增或猜测的音乐设计。波形和频谱证据为：[waveform](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853-waveform.png)、[spectrogram](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853-spectrogram.png)、[逐帧音量/图像指标](../../apps/site/.generated/post-coscroll-editorial/probe/artbreeze-0000-1853-frame-metrics.json)。

| Clip | 真实 source 范围（半开） | 首帧 MD5 → 最后包含帧 MD5 | 画面 / 文字事实 | 声音事实 |
| --- | --- | --- | --- | --- |
| [ab-000](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-000-qr-slate-n000-n002.mp4) | `[0, 9,000)`；`n=0…2`；`00:00.000–00:00.100` | `5da524f92c59ef3127f1f30280ea1ae7` → `6bb01d5036f510ba041a2ad8b0962fc7` | 艺息 ArtBreeze / QR slate。 | 静默。 |
| [ab-001](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-001-blank-black-n003-n003.mp4) | `[9,000, 12,000)`；`n=3`；`00:00.100–00:00.133333` | `eaf553873c0c969730d55da54275df68` → `eaf553873c0c969730d55da54275df68` | QR slate 后的单帧纯黑；真实硬切。 | 静默。 |
| [ab-002](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-002-loading-fade-n004-n115.mp4) | `[12,000, 348,000)`；`n=4…115`；`00:00.133333–00:03.866667` | `575222c1865ec8a9d036b416d1306f6f` → `ef0e510bf6fd291d1dd32b084f39f6df` | `LOADING` 在 `n=4` 首次可见，亮度先升后退；不是另一个硬切。 | 首次非静默样本在本 clip 内 `audio PTS=6,144` / `00:00.139320`，之后为连续源声。 |
| [ab-003](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-003-waiter-front-reveal-n116-n204.mp4) | `[348,000, 615,000)`；`n=116…204`；`00:03.866667–00:06.833333` | `f8ce8c553bc71a3e416eee9f4134a755` → `e5a53eef208dc3cb93b76c47abaf5817` | 正面等待者从黑里持续显形，冷蓝屏光；不是切到背面。 | 连续源声。 |
| [ab-004](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-004-waiter-rear-n205-n262.mp4) | `[615,000, 789,000)`；`n=205…262`；`00:06.833333–00:08.766667` | `bd57eb7a68a458605dbeefb77e85a17a` → `94a6cda7ed2744f1aabfdb5aa2df62b3` | `n=205` 真实硬切：背面人物面对显示器继续等待。 | 连续源声。 |
| [ab-005](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-005-white-flash-ui-n263-n297.mp4) | `[789,000, 894,000)`；`n=263…297`；`00:08.766667–00:09.933333` | `14ab50cac08ddf86e4935c0a47397666` → `f754350e0cbffcdccb36272a190f541d` | `n=263` 是真实白闪 / 白底 UI card 首帧，**不是圆环**。 | 白闪所在 1/30s 分析 bin RMS `−12.19dBFS`、peak `−2.79dBFS`。 |
| [ab-006](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-006-neutral-loader-n298-n336.mp4) | `[894,000, 1,011,000)`；`n=298…336`；`00:09.933333–00:11.233333` | `78454c3dc68dcdfd9606b45309d42d96` → `d0920714568bc10fca278a4478986f0a` | UI card 清空；`n=298` 首个中性/灰色 circular loader。它仍有普通 spinner 语义。 | 连续源声；`n=299` 出现高峰 bin（RMS `−5.73dBFS`）。 |
| [ab-007](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-007-orange-ring-formation-n337-n353.mp4) | `[1,011,000, 1,062,000)`；`n=337…353`；`00:11.233333–00:11.800000` | `9f754065405ba6462c4ef249ad3f2859` → `a61917a43e1d1a85a8d4f91c3f3f0f9f` | `n=337` 首个橙色弧；它移动、扩张并组织成开口圆环。 | 连续源声；`n=343` 的分析 bin RMS `−6.97dBFS`。 |
| [ab-008](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-008-orange-ring-stable-n354-n365.mp4) | `[1,062,000, 1,098,000)`；`n=354…365`；`00:11.800000–00:12.200000` | `63c8775a4e1ed3f714bb9adf48bd5484` → `979ea270f0f7a12af286f66ce9003e2e` | `n=354` 首个可辨认的 coherent open ring；`n=355…362` 是稳定交棒窗。 | 连续源声。 |
| [ab-009](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-009-orange-ring-exit-n366-n372.mp4) | `[1,098,000, 1,119,000)`；`n=366…372`；`00:12.200000–00:12.433333` | `a552093bd90bf3d207084aa78f0afa1d` → `02003ba601607ddfb5ef68bf44156c68` | 开口圆环缩回 / 消失；`n=373` 起已无橙色像素。 | 连续源声。 |
| [ab-010](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-010-white-beat-n373-n376.mp4) | `[1,119,000, 1,131,000)`；`n=373…376`；`00:12.433333–00:12.566667` | `bb34130994b602a9cab68af6a773bd06` → `bb34130994b602a9cab68af6a773bd06` | 圆环已退、字幕未起的白场停顿。 | 连续源声。 |
| [ab-011](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-011-text-01-wo-n377-n383.mp4) | `[1,131,000, 1,152,000)`；`n=377…383`；`00:12.566667–00:12.800000` | `d8b2728764619dd55a536ec3647cfc99` → `131e1383dc541b9aacb6447001c68820` | 首字 **“我”**。 | 连续源声。 |
| [ab-012](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-012-text-02-women-n384-n387.mp4) | `[1,152,000, 1,164,000)`；`n=384…387`；`00:12.800000–00:12.933333` | `c0b6a0f1cb636fb787bbb61405dc47b6` → `6c4cba46f8259db5ddd2bca8a2f068c8` | 文本变为 **“我们”**。 | 连续源声。 |
| [ab-013](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-013-text-03-womenmei-n388-n397.mp4) | `[1,164,000, 1,194,000)`；`n=388…397`；`00:12.933333–00:13.266667` | `7b78b340f9e525944b5b3056d7163839` → `6a36d1dd28a2047736e9d43150fb1fad` | 文本变为 **“我们每”**。 | 连续源声；`n=388` bin peak 约 `0.03dBFS`。 |
| [ab-014](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-014-text-04-womentian-n398-n399.mp4) | `[1,194,000, 1,200,000)`；`n=398…399`；`00:13.266667–00:13.333333` | `7970e0523452a307b668b09cf2ede89b` → `05eb382ac416bedd9f6dbaf19f2f3124` | 文本变为 **“我们每天”**。 | 连续源声。 |
| [ab-015](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-015-text-05-womentiandou-n400-n404.mp4) | `[1,200,000, 1,215,000)`；`n=400…404`；`00:13.333333–00:13.500000` | `aa27ea4787282c9ae4800eea46321f21` → `a4f40117f3046f2bd7c7fc8a7b3fa90d` | 文本变为 **“我们每天都”**。 | 连续源声。 |
| [ab-016](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-016-text-06-womentiandouzai-n405-n406.mp4) | `[1,215,000, 1,221,000)`；`n=405…406`；`00:13.500000–00:13.566667` | `5c768e0df93afee518a62d47f06fdec7` → `0bda316642b5cb33c1f8f709c3bf3944` | 文本变为 **“我们每天都在”**。 | 连续源声。 |
| [ab-017](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-017-text-07-womentiandouzaitui-n407-n418.mp4) | `[1,221,000, 1,257,000)`；`n=407…418`；`00:13.566667–00:13.966667` | `5603ee5fdafebb4309d724d210ffcafa` → `e856d840ec078f6ea3b1e71a7bb500ac` | 文本变为 **“我们每天都在推”**。 | 连续源声。 |
| [ab-018](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-018-text-08-womentiandouzaitui-zhe-n419-n419.mp4) | `[1,257,000, 1,260,000)`；`n=419`；`00:13.966667–00:14.000000` | `55aaaf2c956999d840a6233b1e8afd6d` → `55aaaf2c956999d840a6233b1e8afd6d` | 文本变为 **“我们每天都在推着”**。 | 连续源声。 |
| [ab-019](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-019-text-09-womentiandouzaitui-zhe-yi-n420-n423.mp4) | `[1,260,000, 1,272,000)`；`n=420…423`；`00:14.000000–00:14.133333` | `da11e98e02d984a996ad4720d926e0eb` → `be4d122ae736a91e9c343ffd5fa41f0e` | 文本变为 **“我们每天都在推着一”**。 | 连续源声。 |
| [ab-020](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-020-text-10-line-one-complete-n424-n430.mp4) | `[1,272,000, 1,293,000)`；`n=424…430`；`00:14.133333–00:14.366667` | `2750441f7d57610f5e3a26dd53118526` → `ba435fd63423edd681f8db57493936ba` | 第一行完成：**“我们每天都在推着一块”**。 | 连续源声。 |
| [ab-021](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-021-text-11-line-two-kan-n431-n432.mp4) | `[1,293,000, 1,299,000)`；`n=431…432`；`00:14.366667–00:14.433333` | `f8ee42266da05b251018b9fe4217d07b` → `d69c3809cc38aa3df0db2ab77a3dd43b` | 第二行首字 **“看”**。 | 连续源声。 |
| [ab-022](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-022-text-12-line-two-bu-n433-n433.mp4) | `[1,299,000, 1,302,000)`；`n=433`；`00:14.433333–00:14.466667` | `79758cb8eb69a0e6af77766a5bf191cc` → `79758cb8eb69a0e6af77766a5bf191cc` | 文本变为 **“看不”**。 | 连续源声。 |
| [ab-023](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-023-text-13-line-two-jian-n434-n437.mp4) | `[1,302,000, 1,314,000)`；`n=434…437`；`00:14.466667–00:14.600000` | `e1fb1190e45abd187e7d13078fa0e468` → `863cdc2a6352b22348d2dbcf64477551` | 文本变为 **“看不见”**。 | 连续源声。 |
| [ab-024](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-024-text-14-line-two-de-n438-n444.mp4) | `[1,314,000, 1,335,000)`；`n=438…444`；`00:14.600000–00:14.833333` | `60e49d58e52300300fc77315800f2f0a` → `1f0c204ee2c080dad29f370b52a173b9` | 文本变为 **“看不见的”**。 | 连续源声。 |
| [ab-025](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-025-text-15-line-two-shi-n445-n447.mp4) | `[1,335,000, 1,344,000)`；`n=445…447`；`00:14.833333–00:14.933333` | `d9e4d0f51453ca04d599357fe0713a8d` → `d9e4d0f51453ca04d599357fe0713a8d` | 文本变为 **“看不见的石”**。 | 连续源声。 |
| [ab-026](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-026-text-16-sentence-complete-n448-n480.mp4) | `[1,344,000, 1,443,000)`；`n=448…480`；`00:14.933333–00:16.033333` | `7b3fdeeaede25a9f141144f5dac68e83` → `3b2fc0e3b5d825bc38c6856a80a84b5f` | 完整文本：**“我们每天都在推着一块 / 看不见的石头”**。 | 连续源声。 |
| [ab-027](../../apps/site/.generated/post-coscroll-editorial/source-slices/ab-027-sentence-black-fade-n481-n555.mp4) | `[1,443,000, 1,668,000)`；`n=481…555`；`00:16.033333–00:18.533333` | `7720e581b8880a3716e1e0219c952dca` → `49301f8b7a26c5f371c0673252cbb59f` | 完整文本保持，白底从 `n=481` 起连续向黑场退；`n=556` 的下一场硬切不在本窗。 | 连续源声。 |

## 3. ArtBreeze loading 圆环：影片目标约束

圆环的持久化分析文件：[artbreeze-ring-constraints.json](evidence/artbreeze-ring-constraints.json)；本地几何提取在：[generated ring constraints](../../apps/site/.generated/post-coscroll-editorial/ring-frames/artbreeze-ring-constraints.json)。所有坐标均相对母版 **coded raster** `1920×1080`；角度是屏幕坐标：向右 `0°`，正方向为顺时针。有效画幅与 fill/crop 几何另见上述 [active-aperture evidence](evidence/artbreeze-active-aperture.json)。

| 状态 | 实际 source 帧 | 实测 / 解释 |
| --- | --- | --- |
| 首个中性 circular loader | `n=298`；PTS `894,000`；`00:09.933333` | 灰色小型 loader，属于 source 事实，但不应被直接等同为“西西弗斯圆环”。 |
| 首个橙色可见弧 | `n=337`；PTS `1,011,000`；`00:11.233333` | [first-visible.png](../../apps/site/.generated/post-coscroll-editorial/ring-frames/first-visible.png)。拟合中心 `(945.32, 549.62)`，中心线半径 `46.71px`，估计线宽 `8.06px`；弧还不完整。 |
| 首个 coherent open ring | `n=354`；PTS `1,062,000`；`00:11.800000` | 作者确认的 coherent-ring 候选。[first-complete.png](../../apps/site/.generated/post-coscroll-editorial/ring-frames/first-complete.png)；中心 `(949.77, 555.71)`，中心线半径 `53.09px`，外径 `114.01px`，线宽 `8.17px`；gap `146°`，gap center `109°`。 |
| 最稳定 / 技术交棒窗 | `[n=355, n=363)`；PTS `[1,065,000, 1,089,000)`；`00:11.833333–00:12.100000` | 作者确认的 CP0.1 技术交棒窗。拟合中心约 `±0.3px`、半径约 `±0.1px`。代表帧为 `n=359`：[stable-target.png](../../apps/site/.generated/post-coscroll-editorial/ring-frames/stable-target.png)。 |
| 代表帧目标相位 | `n=359`；PTS `1,077,000`；`00:11.966667` | 中心 `(949.67, 556.25)`；中心线半径 `53.30px`；外径 `114.38px`；内径 `98.30px`；线宽 `8.04px`；gap `80°`，gap center `222°`。 |
| 方向 / 角速度 | `n=355…362` | gap phase 从 `154.5°` 到 `247.0°`，实测平均约 `+396.4°/s`（`1.101 rev/s`），即屏幕坐标**顺时针**。逐帧 gap 形状本身在变，故这是接管窗的测量值，不是不可变 logo 参数。 |
| 最后橙色弧 / 文字首现 | `n=372` / `n=377` | `n=373` 起橙色弧消失；**“我”** 在 `n=377`、PTS `1,131,000`、`00:12.566667` 准确出现。 |

颜色与背景：

- 母版视频标记为 `yuv420p`、limited range (`tv`)、BT.709 matrix / transfer / primaries。RGB hex 因解码路径而变，不能把任一未注明管线的值写成绝对 source fact。
- 历史 `#E77D33` / `(231,125,51)` 是 OpenCV `VideoCapture` 的测量结果，现仅保留为**非 canonical OpenCV measurement**，不能作为 production color token。
- CP0.1 的 canonical 分析方法改为 FFmpeg 显式 `scale=in_range=tv:out_range=pc:in_color_matrix=bt709:out_color_matrix=bt709,format=rgb24`。同一 `n=359` 与 `2,591` 个环 mask 像素的 median 为 `(243,131,47)` / **`#F3832F`**。证据与输出帧在：[ring color provenance](evidence/ring-color-provenance.json) 和 [stable-target-ffmpeg-bt709.png](../../apps/site/.generated/post-coscroll-editorial/ring-frames/stable-target-ffmpeg-bt709.png)。
- `#F3832F` 是 CP0.1 分析基准，**仍不是 production presentation-color freeze**；CP0.4 前须按真实播放/色彩管理管线选择并记录 FFmpeg contract 或目标浏览器截图。
- 同帧白底也必须按相同解码管线衡量；本轮只把它归为近白背景，而不把已有 `(253,253,252)` 的 OpenCV 值冻结为 CSS 色值。
- 这是暖橙色 UI 弧，不是黑底自发光圆环。饱和颜色不适合伪装成黑体色温数值。
- 遮罩文件分别为 [first-visible mask](../../apps/site/.generated/post-coscroll-editorial/ring-frames/first-visible-orange-mask.png)、[first-complete mask](../../apps/site/.generated/post-coscroll-editorial/ring-frames/first-complete-orange-mask.png)、[stable-target mask](../../apps/site/.generated/post-coscroll-editorial/ring-frames/stable-target-orange-mask.png)。

## 4. CoScroll 当前真实源末态：字符“空”

捕获来自当前运行的 `/coscroll`，不是未来 terminal。页面 excerpt 时长 `48s`；`“空”` cue 的逻辑范围是 `[24, 48]`。当前公开交互在精确 `48.0s` 会通过 `wrapTime()` 回到 `0.0s`，所以浏览器里不能把精确 `sceneProgress=1` 当作稳定公开截帧。本轮以 `data-coscroll-progress="0.9994"` 靠近它，画面真实可见锚字为 **“空”**。

| 参考 | 事实 |
| --- | --- |
| [source-end-live.png](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-live.png) | 当前真实 WebGL source-match 末态近似截帧；没有 DOM fallback、没有未来 terminal。 |
| [source-end-mask.png](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-mask.png) | 单一瞬时 yaw 的**参考 matte / fixture**。它由 3D 字符亮部提取，经过 `7px` opening 去掉覆盖其上的细小经文，而非把经文也当粒子源；除非后续明确冻结到同一 canonical pose，否则不得直接作为 production 粒子源。 |
| [idle rotation sequence](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-live-sequence.jpg) | 相同 `progress=0.9994` 下 `0–1,500ms` 的当前空闲旋转参考。 |
| [source-end-fallback.png](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/source-end-fallback.png) | **code-instantiated DOM fallback reference，不是 runtime failure。** 在一次性本地 tab 中使用现有 `VisualCanvasFallback` 的实际 markup/CSS 渲染，真实 fallback 字符为 **“心”**，不是“空”。不得拿它伪装为 source terminal。 |
| [source-end-measurements.json](evidence/coscroll-source-end-measurements.json) | 截帧空间、颜色、mask、source 路由、rotation 与 matte 姿态限制的可机读持久化记录；本地生成副本在 [coscroll-source/](../../apps/site/.generated/post-coscroll-editorial/coscroll-source/)。 |

### 空间、颜色与 source 代码约束

| 项 | 真实约束 |
| --- | --- |
| Capture raster | `1912×1080`（名义 browser viewport 为 `1920×1080`；截图宽度扣除了页面滚动条）。后续与影片对齐时应使用归一化坐标，而不是直接混用两个 raster。 |
| “空” matte bbox | `(x=887, y=365, w=150, h=365)`；中心 `(961.5, 547.0)`；归一化中心 `(0.502877, 0.506481)`；mask `25,491` 像素。这是本截帧 yaw 的参考轮廓，不是任何实时 yaw 都可直接复用的生产采样源。 |
| 冷玉颜色 / 亮度 | matte median RGB `(176, 197, 213)` / `#B0C5D5`；median luma `193.2`。背景采样：上左 `(10,11,15)`，中心外侧 `(29,38,47)`，右下 `(11,12,14)`，即深蓝黑丝绸场。 |
| 源模型 / 相机 | 真实 source asset 为 `/assets/coscroll/source-models/001_空.obj`；桌面 source-match anchor position `[0, -0.07, 0]`，scale `3.696`；camera `z=12`、FOV `42`。 |
| 材质来源 | source material 的 inner color `#2D6D8B`、inner emissive `#0F2B38`、emissive intensity `12`、外层白色 transmission。屏幕测得色值才是本阶段连续性基线。 |
| 当前旋转 | 真实实现为负 Y yaw；空闲 `−0.32 rad/s`（约 `−18.33°/s`）。当前 source wheel 路径只会增加负向量级，正常交互 target 范围 `−0.32…−1.97 rad/s`；组件 hard cap `−2.2 rad/s`。不会反向。 |
| 未来采样边界 | 作者已确认从用户实时 yaw / speed 解体。未来实现必须实时投影 / 采样该 3D glyph；CP0.1 的静态 mask 仅用于测量与测试 fixture，不能替代实时源。 |
| 重要限制 | 现有 source 没有“到 terminal 后自动不断加速”的实现，也没有粒子残影、笔画解体、DOM ring 或 CoScroll 可继承正式音轨。不能把这些未来目标写成既有画面。 |

## 5. 两端不匹配与以后粒子桥必须解决的问题

以下是**源文件事实与工程约束**，不是已决定剪辑方案。

| 维度 | CoScroll 当前源 | ArtBreeze 影片 stable target | 粒子桥必须解决的事 |
| --- | --- | --- | --- |
| 中心 | 归一化 `(50.288%, 50.648%)`；换算到 `1920×1080` 约 `(965.5, 547.0)` | `(949.67, 556.25)`；`(49.462%, 51.505%)` | 需要约 `−15.8px` x、`+9.3px` y 的归一化迁移；不能在一帧里跳位。 |
| 外形 / 尺寸 | 高而窄的“空” matte，约 `150×365px` | 近圆形 open ring，外径约 `114px`、线宽约 `8px` | 不能仅缩放字符：笔画/边缘必须变成粒子，再重排为圆周与明确 gap。 |
| 运动 | 3D 负 Y yaw，空闲 `−0.32rad/s`，滚动时同方向加速 | 屏幕坐标顺时针 open arc，稳定窗约 `+396.4°/s` | 在释放形体时保留角动势，并把 3D yaw 解释为 2D 圆周相位；不能凭空反向。 |
| gap / phase | 字符无 gap，无法直接映射 | 代表接管帧 `n=359`：gap `80°`、gap center `222°` | 粒子重组完成时要进入这个 phase，而不是只画一个泛用 spinner。 |
| 明暗 / 色温 | 深蓝黑 + 冷玉 `#B0C5D5` | 母版 letterbox 内的近白 + 暖橙；CP0.1 analytic RGB 为 `#F3832F`，OpenCV `#E77D33` 仅作历史测量 | 需要分阶段处理白场和暖色收束，并在生产冻结前按目标色彩管理管线复测；直切会同时产生色温、亮度与语义跳变。 |
| 有效画幅 | 无对应 | coded raster `1920×1080`，观察到 active picture `1920×810`、`y=[135,945)` | 桌面已确认保留 letterbox：圆环维持约 `114px`。crop-to-fill 会变为约 `153px`，不能作为默认替代。 |
| 文字 / 人物 | 经文围绕 3D 锚字；当前无正式 terminal | 等待者在此前，圆环后消失，`n=377` 起逐字写出“推石头” | 作者仍需决定是否保留等待/白场及入点；CP0.1 不代替作答。 |
| DOM fallback | 实际 fallback 字符是“心” | 无对应 | fallback 不能被当作“空”的粒子源，也不能作为最终桥接画面。 |
| 声音 | 没有当前 CoScroll 可继承正式音轨 | AAC 源声从 `00:00.139320` 起已存在 | 后续需要另行决定静默、残响或母版入声；本阶段不产生合成残响。 |

## 6. 仍未决定的事项

1. 等待者、白闪 / UI card、灰色 loader、橙色环和“推石头”文字如何排序；这属于尚未授权的 CP0.2，不能由本 PASS 推断。
2. 粒子化桥的时长、密度、残影层数与运动曲线，以及是否需要补镜头或新场景。
3. 声音何时进入，以及是否允许制作明确标注的 CoScroll 残响素材；请以人耳审听 `ab-002 / ab-005 / ab-008 / ab-011`，不要把码流验证替代听感判断。
4. 作者是否认为“周而复始地推石头”的含义成立；该判断属于 CP0.3，不属于 Asset Truth PASS。

## 7. 本轮明确未做

- 未实现正式 CoScroll terminal、Canvas 残影、字符粒子系统、DOM ring、路由或 `/artbreeze` 页面。
- 未实现 ScrollTrigger、scroll-scrub、production media manifest、CDN 或任何 Stage 1 / Stage 2 工作。
- 未产生 A/B/C 样片，未给出 Editorial GO，未写 CP0.4 freeze。
