# CP0.2 — v9 Parity Comparison

状态：`PASS — TECH evidence complete / CP0.3 — IN REVIEW (AUTHOR)`

评审集合：`cp02-v9 / A-B-C parity / QR deferred / four-frame exposure`

本表是 [Stage 0 计划](../plans/2026-07-19-001-feat-post-coscroll-cinematic-narrative-plan.md#stage-0--editorial-fit-before-implementation) 对“统一的中心 / 尺寸 / 方向 / 明暗 / 声音比较表”的当前版本。它证明三版可公平比较；**不选择胜出版本，不构成 Editorial GO，也不冻结 production 行为。**

## 共同受控基线

- A、B、C 都使用同一段 `web[0,109)` 的 browser-captured review bridge：真实 CoScroll **负 `rotation.y` yaw** 的实体“空”持续旋转并加速，opaque glyph cutout 从笔画内解体为低饱和冷玉粒子，形成蓝色开口环后短暂暖化。它不是 production terminal，也没有把字符停住、反转或压平到屏幕平面。
- 三版均为 `960×540 / 30fps` H.264 + AAC review media；网页前缀静默，ArtBreeze 内容经 `12ms` review fade 接入。三条 scrub 均为 `900` 帧 / `30s`，输入轨迹为 `0.000 → 0.369 → 0.152 → 1.000`。
- 本轮首段统一排除 `n=0…3`（QR / title slate 与黑帧），逻辑 source 从 `n=4 / PTS 12,000 / 00:00.133333` 开始。QR 后移到真正体验结尾，不在任何 v9 首段中间出现。
- 完整文件身份、source order、帧数和 SHA 见 [v9 manifest](evidence/cp0.2-v9-parity-qr-deferred-exposure-manifest.json)；边界亮度、source SSIM、C stand-in 限制和声音技术量测见 [v9 boundary snapshot](evidence/cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json)。

## 统一比较表

| 维度 | A — Source Order | B — Ring First | C — Hybrid | 公共证据 / 结论 |
| --- | --- | --- | --- | --- |
| 线性样片 / 时长 | `664` 帧 / `22.133333s` | `667` 帧 / `22.233333s` | `664` 帧 / `22.133333s` | B 多出的 `0.1s` 仅用于第二个四帧重排退场与静默 pocket；不是更长或更精致的桥段。SHA 与文件链接见 manifest。 |
| 剪辑顺序 | `web → 4 帧暗化 → n=4…555`；等待、白场、困境保留 source order。 | `web → 4 帧曝光 → n=355…555 → 4 帧暗化 → n=4…354`；先困境，后等待。 | `web → 4 帧暗化 → n=4…354 + local ring stand-in → n=355…555`。 | 三版均覆盖同一 ArtBreeze 首段材料和同一 CoScroll source end；差异只在排序与 C 的有意风险测试。 |
| 圆心 / 尺寸 | 初次落到 `n=4`，没有网页环→真实影片环的直接几何交棒。 | 直接交棒：网页末帧圆心 `(474.66, 277.83)`、centerline 半径 `26.48px`；`n=355` 为 `(474.69, 277.88)`、`26.63px`。 | 初次落到 `n=4`；local stand-in 仅作等待段阅读测试，真实环在 `n=355` 才接手，未被登记为 production 几何契约。 | B 的中心差 `0.06px`、半径差 `0.15px`，是在相同 `960×540` fixture 的直接对位；不得外推成跨 viewport contract。 |
| 方向 / 缺口相位 | “空”的实体 yaw 与粒子环保持 source 的负 `rotation.y` 动势；初次切入不要求与影片缺口相位相接。 | 同一实体 yaw 约束；屏幕环以顺时针约定从网页 gap `155°` 接到 `n=355` gap `154°`，差 `1°`。 | 同一实体 yaw 约束；stand-in 以影片实测顺时针约 `396.4°/s` 穿过等待段，并在 `n=337…354` 让出真实环。 | “空”的 3D yaw 符号没有为了贴合影片而反转。影片环的屏幕相位与 CoScroll 3D yaw 是不同坐标系的测量，不能混写成字符反向旋转。 |
| 全画面亮度 / 色温 | 由暗场四帧降到暗背景 `n=4`，没有暗场→白场曝闪。 | 网页暗场到 `n=355` 的全帧 YAVG：`30.5777 → 67.6324 → 104.667 → 141.724 → 178.628`；四步 YDIF 约 `38.6–38.9`。 | 同 A 先落暗场；stand-in 的暖环持续穿过等待镜头。 | B 用四帧曝光取代 v8 单帧 `154.31` YDIF；这仍是 review proxy 的编辑节奏，不是 production render contract。 |
| 声音 | 网页静默后，以 `12ms` fade 接入 `n=4` 的 source-content AAC review transcode。 | 网页静默后以 `12ms` fade 接入 `n=355`；`n=555 → n=4` 重排处含 `105.986ms` 静默 pocket。 | 同 A 的 source-order 音频基线；local stand-in 不额外制造声音。 | B 的技术审计在重排前后 `200ms` RMS 为 `-14.06 → -30.83 dBFS`，最大相邻样本跳变 `0.0134`（无 sample-click 证据）；这只能证明技术边界干净，不能代替戴耳机的主观判断。 |
| scrub 读法 | 前进先进入等待，回滚能撤出等待；最接近 source time。 | 前进先进入“推石头”的圆环，随后回到等待；回滚同样可撤回，不是普通 video seek。 | 前进时 persistent ring 穿过等待；回滚可验证其是否像同一物体，也暴露 spinner 风险。 | 三条均用相同 trace 和时长，已具备同完成度的 forward / reverse / resume 比较。 |
| 节奏 / 情绪假设 | “等待 → 白场 → 困境”：因果最顺，但开场没有立即把残留环接到困境。 | “困境 → 等待”：环的物体连续最强，读作周而复始地推石头的潜力最大；声音重启会决定其是有意循环还是突兀断章。 | “环始终在场”：保留连续物体感，却最容易读成 spinner / 品牌 loading。 | 这些是给作者的 editorial judgement，不是 TECH pass 的结论。 |

## 技术通过与下一门禁

`CP0.2` 的要求已经满足：三版均从同一 CoScroll 末态开始、使用同一格式 / 网页桥 / 声音基线 / scrub 轨迹，并有当前统一比较表与可复核 identity。故本 checkpoint 记为 **`PASS — TECH`**。

`CP0.3` 现为 **`IN REVIEW — AUTHOR`**。当前推荐审阅对象是 `B-ring-first-v9-qr-deferred-exposure.mp4`（SHA-256 `803219d86089d0141db1694c760897b300555dfb9e4991adfe7bb9753e4b135e`），但这不是执行者授予的 GO。作者仍需：

1. 针对一个精确样片文件和 SHA 明确给出 GO；
2. 说明它为何读作“重复、等待与推石头”，而不是 spinner、品牌 loading 或炫技转场；
3. 戴耳机确认 B 在 `10.433288–10.539274s` 的断章是否读作有意的循环重启。若不接受，只重做 audio-only v10，不改视觉即不视为 GO。

任何混合、修改意见或 NO-GO 都必须先落为新的本地样片并重新评审；`CP0.4` 继续锁定。
