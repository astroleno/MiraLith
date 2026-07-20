# First-Sequence Editorial Decision

状态：`LOCKED — CP0.1 PASS / CP0.2 NOT STARTED`
当前版本：`0.4`
CP0.4 freeze hash：`未生成`

CP0.1 Asset Truth 已由作者于 2026-07-20 通过；没有产生、选择或审阅 A/B/C 样片。因此本文件不包含候选版本、作者 GO 或任何冻结项。

## 当前可审阅输入

- [CP0.1 shot map](first-sequence-shot-map.md)
- [CP0.1 checkpoint ledger](CHECKPOINTS.md)
- [durable CP0.1 evidence snapshot](evidence/README.md)
- 本地证据根目录：`/Users/aitoshuu/Documents/GitHub/MiraLith/apps/site/.generated/post-coscroll-editorial/`

CP0.1 PASS 只代表素材事实可作为下一阶段输入。它不等于 CP0.2 授权，也不等于 Editorial GO；CP0.2 当前仍为 `NOT STARTED`。

CP0.1 已确认：桌面保留 letterbox、字符从实时 yaw / speed 解体、`n=354` 为 coherent-ring 候选、`[n=355,n=363)` 为技术交棒窗。详见 checkpoint ledger。

## CP0.3 GO 记录

状态：`NOT OPEN`

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
