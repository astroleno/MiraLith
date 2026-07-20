# First-Sequence Editorial Decision

状态：`CP0.2 IN REVIEW / CP0.3 NOT OPEN`
当前版本：`0.5`
CP0.4 freeze hash：`未生成`

CP0.1 Asset Truth 已由作者于 2026-07-20 通过；作者随后明确要求继续，现已生成 A/B/C 本地样片并进入作者评审。尚未有作者对一个确切版本的 GO，因此本文件仍不包含冻结项。

## 当前可审阅输入

- [CP0.1 shot map](first-sequence-shot-map.md)
- [CP0.1 checkpoint ledger](CHECKPOINTS.md)
- [durable CP0.1 evidence snapshot](evidence/README.md)
- [CP0.2 variants comparison](cp0.2-bridge-variants.md)
- [CP0.2 media identity manifest](evidence/cp0.2-bridge-variants-manifest.json)
- [CP0.2 native scroll trace](evidence/cp0.2-scrub-interaction-trace.json)
- 本地证据根目录：`/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v1/`

CP0.1 PASS 只代表素材事实可作为下一阶段输入。作者的后续明确继续指示已经打开 CP0.2 review；它仍然**不等于 Editorial GO**。

CP0.1 已确认：桌面保留 letterbox、字符从实时 yaw / speed 解体、`n=354` 为 coherent-ring 候选、`[n=355,n=363)` 为技术交棒窗。详见 checkpoint ledger。

## CP0.2 已交付候选（待作者评审）

| 视觉版本 | 线性样片 | 当前声音 | 备注 |
| --- | --- | --- | --- |
| `A-source-order-v1` | [A-source-order-linear.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/A-source-order-linear.mp4) | [audio 1](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-1-artbreeze-original.mp4)、[audio 2](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-2-silent-until-dilemma.mp4)、[audio 3](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/audio/A-source-order-audio-3-residue-then-artbreeze.mp4) | 仅作为声音比较的暂定领先视觉版；不是选择。 |
| `B-ring-first-v1` | [B-ring-first-linear.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/B-ring-first-linear.mp4) | 线性样片内的 source-content audio | 真实影片从稳定窗 `n=355` 直接接管，之后为测试目的回到候选窗前段。 |
| `C-hybrid-v1` | [C-hybrid-linear.mp4](../../apps/site/.generated/post-coscroll-editorial/cp02-v1/linear/C-hybrid-linear.mp4) | 线性样片内静默至等待者 | persistent DOM ring 只是一层本地 review stand-in，不是正式 DOM 实现。 |

对应 scrub review movies 与真实 native-scroll trace 在 [CP0.2 比较文档](cp0.2-bridge-variants.md#3-低保真-scroll-scrub-证据)。

## CP0.3 GO 记录

状态：`NOT OPEN — 等待作者针对确切样片给出 GO`

只有在 CP0.2 生成并复核了具体版本后，才填写以下字段：

| 字段 | 值 |
| --- | --- |
| 作者 | `—` |
| 确切视觉样片文件名 + SHA-256 | `—` |
| 确切声音样片文件名 + SHA-256 | `—` |
| GO 时间 | `—` |
| 作者对“重复、等待与推石头”的说明 | `—` |
| 对 spinner / brand-loading / 转场炫技风险的确认 | `—` |
| 是否需要补镜头 / 新场景 | `—` |

修改意见、混合建议或 NO-GO 必须先转化成新的本地样片并重新评审，不能直接写成 GO。

## CP0.4 占位

状态：`LOCKED — CP0.3 required`

作者对一个确切样片版本给出 GO 后，才允许写入最终镜头顺序、各段 `[startPTS, endPTSExclusive)`、首尾 raw-frame hash、声音、文字时机、补充素材、DOM / 影片职责边界、连续性参数、确认记录和 freeze hash。后续若改变任一冻结项，CP0.4 必须标记为 `REOPENED`。
