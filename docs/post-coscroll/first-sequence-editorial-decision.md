# First-Sequence Editorial Decision

状态：`CP0.1 PASS / CP0.2 PASS (TECH) / CP0.3 PASS (AUTHOR) / CP0.4 PASS (AUTHOR + TECH)`
当前版本：`2.0`
CP0.4 freeze hash：`d906937cc0b885b12fc942f91ce50e9af919878142cead5c0b36d8bd648140a1`

CP0.1 Asset Truth 已由作者于 2026-07-20 通过；作者随后明确要求继续。`cp02-v1` 被否决为“停住后才粒子化 / 过早暖化”；`cp02-v2` 错误反转 source yaw；`cp02-v3` 又把真实 yaw flattened 为平面转字。`cp02-v8` 只升级了 B，因而不能作为 GO 输入。`cp02-v9` 已按作者决定补回同基线 A/B/C 与 scrub，并以 TECH 证据通过 CP0.2；作者最终选择 B，CP0.3 与 CP0.4 已冻结到本文件链接的确切 B v9 线性样片。

## 当前可审阅输入

- [CP0.1 shot map](first-sequence-shot-map.md)
- [CP0.1 checkpoint ledger](CHECKPOINTS.md)
- [durable CP0.1 evidence snapshot](evidence/README.md)
- [historical CP0.2 v4 real-yaw baseline](cp0.2-bridge-variants-v4.md)
- [current CP0.2 v9 parity comparison](cp0.2-v9-parity-comparison.md)
- [historical CP0.2 v4 media identity manifest](evidence/cp0.2-v4-real-yaw-bridge-manifest.json)
- [CP0.2 v8 exact B identity manifest](evidence/cp0.2-v8-b-ring-first-complete-manifest.json)
- [CP0.2 v8 boundary measurements](evidence/cp0.2-v8-b-ring-first-complete-boundary-measurements.json)
- [CP0.2 v9 A/B/C parity manifest](evidence/cp0.2-v9-parity-qr-deferred-exposure-manifest.json)
- [CP0.2 v9 exposure and reorder measurements](evidence/cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json)
- [CP0.2 v9 B audio audit reproduction method](evidence/cp0.2-v9-b-audio-audit-method.md)
- [CP0.4 B v9 editorial freeze](evidence/cp0.4-b-ring-first-v9-editorial-freeze.json)
- [CP0.4 B v9 checksum index](evidence/cp0.4-b-ring-first-v9-editorial-freeze-checksums.sha256)
- [historical v3 variants / real-yaw correction](cp0.2-bridge-variants-v3.md)
- [historical v3 media identity manifest](evidence/cp0.2-v3-source-direction-bridge-manifest.json)
- [historical v2 variants / source-direction correction](cp0.2-bridge-variants-v2.md)
- [historical v2 media identity manifest](evidence/cp0.2-v2-continuous-blue-bridge-manifest.json)
- [historical v1 variants comparison / NO-GO](cp0.2-bridge-variants.md)
- [historical v1 media identity manifest](evidence/cp0.2-bridge-variants-manifest.json)
- 本地历史 v4 证据根目录：`/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v4/`
- 本地 v8 B 证据根目录：`/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/`
- 本地 v9 A/B/C 证据根目录：`/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/`

CP0.1 PASS 只代表素材事实可作为下一阶段输入。`CP0.2 PASS (TECH)` 只代表 A/B/C 已在同一完成度下可公平比较；作者之后对 B 的明确选择与“可以，继续吧”才构成下列 CP0.3 GO 与 CP0.4 freeze。

CP0.1 已确认：桌面保留 letterbox、字符从实时 yaw / speed 解体、`n=354` 为 coherent-ring 候选、`[n=355,n=363)` 为技术交棒窗。详见 checkpoint ledger。

## CP0.2 已通过的技术比较；B 已由作者冻结

共同 bridge 已按作者反馈改为：实体“空”保持真实 source 的**负 `rotation.y` yaw**并加速，在真实 capture pose 中从笔画内剥落；它不再被当成平面字旋转。粒子与其形成的缺口环保持相同方向与冷玉蓝，最后才交给真实 ArtBreeze 环。桥段相位只使用常量 offset，不为贴合影片而翻转。它不是生产实现，也不能替代未来的 live yaw / speed 采样。

### v9 同基线比较（历史技术输入）

作者已明确：`n=0…2` 的 QR / title slate 与 `n=3` 黑帧后移至真正体验片尾，本轮首段从 `n=4` 开始；B 的暗场→白场接力用四帧曝光退场，而不是单帧硬切。三版都使用同一 `109` 帧 browser-captured review bridge、`960×540 / 30fps` 格式、静默网页前缀和 `12ms` source-audio fade 基线；每版都配有 `900` 帧 / `30s` 的同一 scrub trace。

| 视觉版本 | 线性样片 | scrub | 当前声音 / 剪辑含义 |
| --- | --- | --- | --- |
| `A-source-order-v9` | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/A-source-order-v9-qr-deferred-exposure.mp4) — SHA `8584eb473c95ef1160ad3a381584ccab9830646c663f34d92f90b0dd0a8e1987` | [A scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/A-source-order-v9-qr-deferred-exposure-scrub.mp4) | ring 暗化进入 `n=4` LOADING，随后按等待 → 白场 → 困境的 source order；不含 QR。 |
| `B-ring-first-v9` | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4) — SHA `803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e` | [B scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/B-ring-first-v9-qr-deferred-exposure-scrub.mp4) | 四帧曝光交给 `n=355` 圆环与“推石头”，再经暗化回 `n=4` 等待段；两个 source audio 段各有 `12ms` fade，中间 `0.1s` 静默 pocket。 |
| `C-hybrid-v9` | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/C-hybrid-v9-qr-deferred-exposure.mp4) — SHA `06324b6bc62656c6914b5ac534105415e44cc084d842028ec44232e1895da14f` | [C scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/C-hybrid-v9-qr-deferred-exposure-scrub.mp4) | local DOM-ring stand-in 穿过等待段，`n=337…354` 淡出并让真实环接手；它刻意保留 spinner 风险以供比较。 |

v9 的 B 全帧亮度为 `30.5777 → 67.6324 → 104.667 → 141.724 → 178.628`，不再是 v8 的单帧 `30.2625 → 177.852` 硬切。详见 [v9 boundary evidence](evidence/cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json)。

计划要求的当前统一比较表（中心、尺寸、方向、相位、明暗、声音、节奏、情绪）见 [CP0.2 v9 parity comparison](cp0.2-v9-parity-comparison.md)。它以 TECH 身份通过 CP0.2，不选择版本。

### 历史 v4 基线与 v8 B 修复

| 视觉版本 | 线性样片 | 历史声音 | 备注 |
| --- | --- | --- | --- |
| `A-source-order-real-yaw-v4` | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/A-source-order-real-yaw-v4.mp4) | bridge 后的 source-content AAC review transcode | 保留 LOADING → 等待 → 白场 → 困境的 source order。 |
| `B-ring-first-real-yaw-v4` | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/B-ring-first-real-yaw-v4.mp4) | 从真实 `n=355` 起的 source-content AAC review transcode | 真实稳定环直接接管，之后才回到前段等待素材。 |
| `C-hybrid-real-yaw-v4` | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v4/linear/C-hybrid-real-yaw-v4.mp4) | bridge 后的 source-content AAC review transcode | DOM ring 仅是 local review stand-in；它是否该存在仍待作者判断。 |

对应 v4 scrub review movies、真实 yaw motion contact sheet 和比较在 [CP0.2 v4 比较文档](cp0.2-bridge-variants-v4.md)。v3 已因平面转字错误降为历史记录；v2 / v1 也均不可作为视觉或声音选择。

### v8 精确 B 复核对象（不是 GO 输入）

`cp02-v8 / B-ring-first / complete-original-order` 的确切线性文件为 [B-ring-first-v8-complete-n355-phase-aligned-faded-source-audio.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v8-b-ring-first-complete/B-ring-first-v8-complete-n355-phase-aligned-faded-source-audio.mp4)，SHA-256 为 `37ed1628a20e0d0d3aad60bdbd87add859adaa3d3c03798962643dc319a63ca0`。它使用 `109` 帧网页 bridge，随后为影片 `[n=355,n=556)` → `[n=0,n=355)`，共 `665` 帧 / `22.166667s`；两个 review 音频剪点均为 `12ms` fade。

它**不能**被当成当前 A/B/C 的胜出版本：A/C 仍是 v4 的 `4.5s / 1920×1080` 旧 bridge，v8 是 `3.633333s / 960×540` 新 bridge，且 v8 尚无对应 scrub。任何 CP0.3 GO 都会错误地把制作基线差异当成剪辑选择。

这两项 v8 阻断已由作者决定并在 v9 实施：QR 后移、四帧曝光。v8 仍作为历史复核对象保留，不应作为当前 A/B/C 选择或 GO 文件。

## CP0.3 GO 记录

状态：`PASS — AUTHOR，2026-07-25`

| 字段 | 值 |
| --- | --- |
| 作者 | MiraLith 作者（2026-07-25） |
| 确切视觉样片文件名 + SHA-256 | [B-ring-first-v9 linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/linear/B-ring-first-v9-qr-deferred-exposure.mp4)；`803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e` |
| 确切声音样片文件名 + SHA-256 | 同一 B linear 的 AAC review audio（source-content transcode，不是原 AAC packets）；同一 SHA。 |
| 视觉评审证据 | [B-ring-first-v9 scrub](../../apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/scrub/B-ring-first-v9-qr-deferred-exposure-scrub.mp4)；`3168c035eefcceada6bd8bc099f9192871ab6305e42f39244e03aabcbfb1cabb`。 |
| 作者 GO | 先确认：**“B 用这个更自然一些。”**；随后确认：**“可以，继续吧”**。后一句授权将已选 B 进入确切线性 B v9 的 Stage 0 freeze。 |
| “重复、等待与推石头”的读法 | B 先把持续旋转、粒子重组而来的网页环交给影片的真实环和“推石头”文字，再返回 LOADING / 等待者；因此读作环的重复与等待，而不是从等待画面普通 seek 到影片。 |
| spinner / brand-loading / 转场炫技风险 | 选择 B，未选择 C 的 persistent DOM ring；冻结版中没有 DOM ring，真实影片环从 `n=355` 起单独接管。网页 bridge 仅为粒子交棒代理，不冒充现存 terminal。 |
| 声音 | 接受 `n=555 → n=4` 的 `105.986ms` deliberate restart pocket；不要求 audio-only v10。技术审计与复现方法见 [audio audit](evidence/cp0.2-v9-b-audio-audit-method.md)。 |
| 补镜头 / 新场景 | 不需要；QR/title slate `n=0…2` 与 `n=3` 黑帧继续后移到真正体验结尾。 |

## CP0.4 Editorial Freeze

状态：`PASS — AUTHOR + TECH，2026-07-25`

权威冻结记录为 [cp0.4-b-ring-first-v9-editorial-freeze.json](evidence/cp0.4-b-ring-first-v9-editorial-freeze.json)，freeze hash 为 `d906937cc0b885b12fc942f91ce50e9af919878142cead5c0b36d8bd648140a1`；媒体与证据身份见 [checksum index](evidence/cp0.4-b-ring-first-v9-editorial-freeze-checksums.sha256)。该 JSON 是另一个实现者填写 media source spec 时的唯一冻结输入。

| 冻结项 | 确切决定 |
| --- | --- |
| 镜头顺序 / source PTS / frame hash | `web[0,109)` → 四帧曝光 → ArtBreeze `[n=355,n=556)` / `[1,065,000,1,668,000)`（`9fb23e4d… → 49301f8b…`）→ 四帧暗化 → ArtBreeze `[n=4,n=355)` / `[12,000,1,065,000)`（`575222c1… → 63c8775a…`）。完整半开范围和 MD5 在 freeze JSON。 |
| 文字 | “我”从 `n=377 / PTS=1,131,000` 起，逐字到完整句；所有输出帧映射与 source 半开 PTS 固定在 freeze JSON 的 `textTiming`。 |
| 声音 | 网页前缀静默；`n=355` source audio 12ms fade-in、末端 12ms fade-out；`105.986ms` restart pocket；`n=4` source audio 12ms fade-in。 |
| DOM / 视频职责 | B 不使用 DOM ring。网页仅让不透明“空”的实时负 Y yaw 以低饱和玉粒子 / 开口环交棒；真实影片环自 `n=355` 起唯一接管。fallback “心”不得作为源。 |
| 连续性 | 保留母版 letterbox；960×540 review fixture 的中心差 `0.06px`、半径差 `0.15px`、gap `155° → 154°`；四帧 YAVG 与颜色测量均冻结为 editorial evidence，而不是 production viewport/color contract。 |
| 补充素材 | 无；QR/title slate 和黑帧不在首段，仍后移至真实体验结束。 |

任何 selected-media SHA、镜头顺序、半开 PTS、frame hash、文字时机、声音、DOM / 影片职责、连续性参数或补充素材决定的修改，均必须把 CP0.4 标记为 `REOPENED` 并先产出新的 Stage 0 评审样片。此 freeze 结束 Stage 0，**不授权** Stage 1、Stage 2、正式 CoScroll terminal、路由、ScrollTrigger、Canvas 残影、CDN 或 production media contract。
