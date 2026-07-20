# Post-CoScroll Stage 0 Checkpoints

状态：`CP0.1 — PASS`
本轮范围：只建立 Asset Truth。没有授权、制作或复用 CP0.2 的 A/B/C 样片，也没有进入 CP0.3、CP0.4、Stage 1 或 Stage 2。

## CP0.1 — Asset Truth

状态：`PASS — 作者确认于 2026-07-20`
以下是已获作者确认的真实素材与当前 source 状态证据。此 PASS 仅覆盖 Asset Truth。

### 作者 PASS 记录

作者确认：**“保留黑边、实时 yaw、接受 n354。CP0.1：PASS。”**
范围说明：此 PASS 不代表 CP0.2 授权，也不是 Editorial GO；CP0.2 保持 `NOT STARTED`。

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

作者确认的是“asset truth 可作为下一阶段输入”，不是 Editorial GO。**CP0.2 继续为 `NOT STARTED`，尚未获得授权。**

版本控制交接：CP0.1 结论提交时必须纳入 `docs/post-coscroll/evidence/`；`apps/site/.generated/post-coscroll-editorial/` 继续只作本地媒体证据。

## CP0.2 — Bridge Variants

状态：`NOT STARTED — 未获授权`

CP0.1 PASS 不构成 CP0.2 授权。本次没有生成 A/B/C 线性样片、scroll-scrub 演示或声音比较。输出根目录中若保留任何更早的 `linear/`、`scrub/`、`audio/` 代理，它们不属于本 checkpoint，不能作为 CP0.2 或 CP0.3 证据。

## CP0.3 — Editorial GO

状态：`NOT OPEN`

须先完成同等完成度的 CP0.2 样片。作者对一个确切样片版本的 GO 才能打开本 checkpoint；修改建议、混合意见或 NO-GO 都不算通过。

## CP0.4 — Editorial Freeze

状态：`LOCKED — CP0.3 required`

尚未冻结镜头顺序、PTS、声音、文字时机、补充素材、DOM / 视频职责或 freeze hash。任何后续实现不得把本 CP0.1 的测量结果误写为已批准剪辑决定。
