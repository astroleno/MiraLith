# LuBirth 行星体积云 Task -1 / Task -1R 证据

最终 checkpoint：MICROBENCH_OVER_BUDGET。Task -1R 已证明 V3 可以只充当宏观天气输入、通过受限 representation 的视觉门；但最低固定工作量的 visual-pass case 32/2 在 headed System Chrome 的 121 个有效 GPU 样本中 total p95 为 **36.255915 ms**，远高于 4 ms 预算。本轮没有安装 Takram、没有修改默认首页，也没有开始 Task 0–8。

原 Task -1 的 EARLY_KILL 已追溯更正为 EARLY_REPRESENTATION_FAIL。它准确描述的是旧的 disposable 表示（固定 52 km to-sun 路径 + 直接径向挤出 V3 R）失败，**不能**解释为 Takram-first 或 V3 被技术否决。

## 保留且仍然通过的合同

- 原始 V3 earth-cloud-field-nasa-lite-2k.png 以线性数据纹理读取；没有 Takram 或远程 cloud asset 请求。
- 球壳固定为 8 km base + 52 km thickness，固定步数组合为 24/6、32/2、48/6。
- world-to-ECEF bridge 使用一般二次式，保留非单位 ECEF camera-ray 参数；identity / enlarged / reduced 与 direct world-sphere oracle 一致。
- GPU depth probe 在非 1.0 的 reduced Earth（平移、旋转、统一缩放）下验证 front 全遮挡、middle 部分截断、behind 无额外截断。CPU probe 的 inside-inner 分支也已改为推进 cloudEnter，与 GPU 一致。
- opaque / cloud accumulation / resolve / composite 都是线性 RGBA16F；Depth24 用于 opaque depth；实际 RGBA16F readback 的 0.25/1/4/16 ladder 与 0.18 linear gray 单次 sRGB gamma probe 都通过。

## Task -1R 表示与视觉门

Task -1R 保留 V3 的现有通道布局：R 仅是宏观 weather / coverage，G/B/A 保持 cloud-top、morphology、concavity 控制。shader 内的确定性、无缝 ECEF 3D base-shape 只将 coverage remap 成 cloudlet occupancy；垂直 profile 负责 base/core/top。没有新增宏观 weather 图、remote asset、detail erosion、turbulence、temporal、adaptive 或 BSM。

太阳 secondary ray 现在求从当前 sample 沿 sun direction 到 outer shell / cloud-base 的真实正向球壳区间，并在进入 cloud base 时停止，不再对每个 sample 固定走 52 km。最低限度的 HG phase、sky fill 与守恒式单散射累积仅用于此 query-only gate。

人工检查三组四帧 opening contact sheet：云层不再是连续填满地平线的亮白球壳，V3 覆盖形成可区分 cloudlet、厚度和 clear-air 区域；24/6、32/2、48/6 均通过此**受限的 representation gate**。这不是 production art sign-off，只是授权正式成本采样的最小视觉证明。详见 visual-review.json。

## 正式 GPU 窗口与结论

32/2 是 visual-pass cases 中固定 primarySteps × lightSteps 最低的组合（64，对比 24/6=144、48/6=288），因此是足够严格的早期成本候选。disjoint epoch / resize / context-restore / visibility correctness review 后的正式运行在 weather ready frame 5、warmup start frame 6、sampling start frame 126 才开始收样，并取得 121 个有效、非 disjoint 样本：

| 指标 | p50 (ms) | p95 (ms) |
| --- | ---: | ---: |
| density + light raymarch | 9.448083 | 10.912416 |
| resolve | 9.664125 | 11.887083 |
| cloud composite | 10.495125 | 13.586124 |
| total | 29.568915 | 36.255915 |

invalidFrames=0，但 total p95 比预算高约 9.1 倍。此前的 37.579247 ms lifecycle-safe 窗口已被这次完整 visibility-safe 重跑取代；更早的 35.377499 ms disjoint-epoch / resize-safe 窗口、36.146749 ms readiness-gated 窗口与 32.961416 ms 窗口同样不再作为正式证据。因此结论是这个 disposable representation 在当前 RT / compositor 账本下成本超标；它不是对 Takram-first、V3 数据或未来有不同成本架构的生产实现的否决。Task 0–8 继续被当前计划的 checkpoint 阻断。

## Correctness review 后的测量边界

- warmup 只在 V3 纹理就绪、coordinate/HDR/gamma gate 通过且当前完整帧已渲染后开始；telemetry 保存 ready / warmup / sampling frame。
- 停止条件是至少 120 个**有效** GPU frames。disjoint 或非有限值会计入 invalid 数，但会继续补采，不能消耗有效样本配额。
- 每个 polling epoch 只读取一次 `GPU_DISJOINT_EXT`；若为 true，则作废该 epoch 的全部 pending frames，不读取其单项 result，随后继续补采。每次新 measurement window 都先清除历史 disjoint 状态。
- RT 尺寸变更或 readiness 丢失会清空 pending query / 既有统计，并从新 ready frame 重新执行 120-frame warmup。`webglcontextrestored` 会重建 RT、timer profiler 和 HDR/gamma gate 后走同一流程；headed System Chrome 的 resize 与 context-restored 生命周期测试已通过。
- `document.visibilityState` 变为 hidden 时立即停止正式采样并同步清空 pending query / 当前样本；重新 visible 后必须从新的完整 ready frame 再次 warmup。telemetry 保存 `pageVisible`、`visibilityResetCount` 与 `lastVisibilityResetFrame`；headed System Chrome 的 hidden→visible 生命周期测试已通过。
- HG 使用 camera-to-sample 与 sample-to-sun 的正向散射余弦。三个 opening contact sheet 已在该修正后重抓并重新人工复核。
- 本结果仍没有 no-op、copy-only 或 combined-total timer-query 校准，也不保存逐帧 raw timings；因此它是当前 harness 的超预算观测，不可解释为经校准的阶段归因，更不可外推为 Takram-first 成本结论。新增计时校准需要独立 plan amendment。

## 运行环境与复现

- 视觉证据：production build + Playwright desktop Chromium，1440×960 CSS px、DPR 1、resolutionScale=0.5、无 bloom / atmosphere / veil / blur / temporal / adaptive。
- 正式性能证据：headed System Chrome、Apple M4 ANGLE Metal renderer、1440×960 CSS px、DPR 1、resolutionScale=0.5。浏览器的 Desktop Chrome device context 会报告 Windows UA；实际 renderer / vendor 已原样记录在 task-1r-system-chrome-gpu.json。
- V3 SHA-256：39c70e34b99ecf550f557327a1b97dcc0d2cae9f3be03242911c067622bb0a1c。

    pnpm exec playwright test -c playwright.unit.config.ts \
      lubirthPlanetaryCloudMicrobenchMath.spec.ts

    MIRALITH_CLOUD_MICROBENCH_CAPTURE=1 pnpm exec playwright test \
      tests/e2e/lubirth-planetary-cloud-microbench.spec.ts --project=desktop

    # 完整复现 manifest 声明的 headed System Chrome 8/8，并重写正式 GPU artifact。
    MIRALITH_CLOUD_MICROBENCH_PERF_EVIDENCE=1 pnpm exec playwright test \
      -c playwright.lubirth-cloud-microbench-system-chrome.config.ts \
      --project=desktop-system-chrome

    # 可选：只回归四项 lifecycle/formal 测试；这不是 manifest 的完整 8/8 复现命令。
    MIRALITH_CLOUD_MICROBENCH_PERF_EVIDENCE=1 pnpm exec playwright test \
      -c playwright.lubirth-cloud-microbench-system-chrome.config.ts \
      --project=desktop-system-chrome \
      --grep "GPU timing restarts|GPU timing discards|Task -1R System Chrome GPU window"

    pnpm --filter @miralith/lubirth-hero typecheck
    pnpm --filter @miralith/site typecheck
    pnpm --filter @miralith/site build
    git diff --check

## 证据索引

- manifest.json：固定配置、RT 账本、shader / scope 合同、资产 hash 与最终验证。
- visual-review.json：原 Task -1 的追溯分类与 Task -1R 按 case 的人工视觉门记录。
- checkpoint.json：计划强制 checkpoint 和超预算原因。
- task-1r-system-chrome-gpu.json：正式 GPU 120+ 样本窗口及分 stage 统计。
- screenshots/{24-6,32-2,48-6}-task-1r-opening-contact-sheet.png：Task -1R 四帧 opening contact sheet。
- screenshots/*-task-1r-progress-0.12-{cloud,earth,density}.png：隔离 debug buffer。
- screenshots/task-1r-depth-probe-{front,middle,behind}.png：GPU depth-clamp probe。
