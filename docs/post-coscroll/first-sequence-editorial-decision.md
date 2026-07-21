# First-Sequence Editorial Decision

状态：`CP0.2 IN REVIEW / CP0.3 NOT OPEN`
当前版本：`0.7`
CP0.4 freeze hash：`未生成`

CP0.1 Asset Truth 已由作者于 2026-07-20 通过；作者随后明确要求继续。第一轮 `cp02-v1` 已被作者 NO-GO，原因是“空”看起来在粒子化前停止了旋转、且粒子过早暖化。`cp02-v2` 虽修正这两点，却错误反转了真实 CoScroll source 的负 yaw；当前 `cp02-v3` 已据作者指示重做 A/B/C。尚未有作者对一个确切版本的 GO，因此本文件仍不包含冻结项。

## 当前可审阅输入

- [CP0.1 shot map](first-sequence-shot-map.md)
- [CP0.1 checkpoint ledger](CHECKPOINTS.md)
- [durable CP0.1 evidence snapshot](evidence/README.md)
- [current CP0.2 v3 variants comparison](cp0.2-bridge-variants-v3.md)
- [CP0.2 v3 media identity manifest](evidence/cp0.2-v3-source-direction-bridge-manifest.json)
- [historical v2 variants / source-direction correction](cp0.2-bridge-variants-v2.md)
- [historical v2 media identity manifest](evidence/cp0.2-v2-continuous-blue-bridge-manifest.json)
- [historical v1 variants comparison / NO-GO](cp0.2-bridge-variants.md)
- [historical v1 media identity manifest](evidence/cp0.2-bridge-variants-manifest.json)
- 本地 v3 证据根目录：`/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/cp02-v3/`

CP0.1 PASS 只代表素材事实可作为下一阶段输入。作者的后续明确继续指示已经打开 CP0.2 review；它仍然**不等于 Editorial GO**。

CP0.1 已确认：桌面保留 letterbox、字符从实时 yaw / speed 解体、`n=354` 为 coherent-ring 候选、`[n=355,n=363)` 为技术交棒窗。详见 checkpoint ledger。

## CP0.2 当前已交付候选（待作者评审）

共同 bridge 已按作者反馈改为：实体“空”保持真实 source 的**负 yaw**并加速，在笔画内旋转中剥落；粒子与其形成的缺口环保持相同方向与冷玉蓝，最后才交给真实 ArtBreeze 环。桥段相位只使用常量 offset，不再为贴合影片方向而翻转。它不是生产实现，也不能替代未来的 live yaw / speed 采样。

| 视觉版本 | 线性样片 | 当前声音 | 备注 |
| --- | --- | --- | --- |
| `A-source-order-source-direction-v3` | [A linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/A-source-order-source-direction-v3.mp4) | bridge 后的 source-content AAC review transcode | 保留 LOADING → 等待 → 白场 → 困境的 source order。 |
| `B-ring-first-source-direction-v3` | [B linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/B-ring-first-source-direction-v3.mp4) | 从真实 `n=355` 起的 source-content AAC review transcode | 真实稳定环直接接管，之后才回到前段等待素材。 |
| `C-hybrid-source-direction-v3` | [C linear](../../apps/site/.generated/post-coscroll-editorial/cp02-v3/linear/C-hybrid-source-direction-v3.mp4) | bridge 后的 source-content AAC review transcode | DOM ring 仅是 local review stand-in；它是否该存在仍待作者判断。 |

对应 v3 scrub review movies、连续运动 contact sheet 和比较在 [CP0.2 v3 比较文档](cp0.2-bridge-variants-v3.md)。v2 已因 source-direction correction 降为历史记录；v1 是明确 NO-GO。二者均不可作为视觉或声音选择。

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
