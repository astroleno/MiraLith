# LuBirth 行星体积云 Task -1 证据

结论：`EARLY_KILL`。本轮只完成计划允许的 Task -1；没有安装 Takram、没有修改默认首页，也没有开始 Task 0–8。

## 已验证的合同

- 原始 V3 `earth-cloud-field-nasa-lite-2k.png` 以线性数据纹理读取；没有 Takram 或远程 cloud asset 请求。
- 球壳固定为 `8 km` base + `52 km` thickness，固定步数组合为 `24/6`、`32/2`、`48/6`。
- world-to-ECEF bridge 使用一般二次式，保留非单位 ECEF camera-ray 参数；identity / enlarged / reduced 与 direct world-sphere oracle 一致。
- GPU depth probe 在非 1.0 的 reduced Earth（平移、旋转、统一缩放）下验证 front 全遮挡、middle 部分截断、behind 无额外截断。
- opaque / cloud accumulation / resolve / composite 都是线性 RGBA16F；Depth24 用于 opaque depth；实际 RGBA16F readback 的 `0.25/1/4/16` ladder 与 `0.18` linear gray 单次 sRGB gamma probe 都通过。

`opening-matrix-samples.json` 保存三个 step case、四个 opening progress 的相机矩阵和 Earth matrix。默认 `enlarged` 场景直接复用 `mapOpeningProgress()` 的 opening 相机、Earth transform 和 home-lite 光向量，但不挂载 production render owner。

## 视觉判定

所有三组固定步数均未通过裸画面门槛。四帧 contact sheet 可见在实际 opening 近地平线镜头中出现连续的高亮白边/壳边，缺少可辨的云底、云核、云顶层次；这命中计划明确禁止的“整圈白边/双层球”风险。详见 `visual-review.json` 和 `screenshots/*-opening-contact-sheet.png`。

因此没有启动 120 warmup + 120 valid GPU sample 窗口，也没有产生 p50/p95；这不是性能失败或 Takram 不可行的结论，只是本计划不授权跨过 Task -1。

## 运行环境与复现

- Apple M4，macOS 15.6.1；System Chrome 150.0.7871.189 已安装。
- 视觉证据：production build + Playwright `desktop` project，1440×960 CSS px、DPR 1、`resolutionScale=0.5`、无 bloom / atmosphere / veil / blur / temporal / adaptive。该 capture 使用 Playwright Chromium；因为视觉门已失败，未启动要求 headed System Chrome 的正式 GPU 性能窗口。
- V3 SHA-256：`39c70e34b99ecf550f557327a1b97dcc0d2cae9f3be03242911c067622bb0a1c`。

```bash
pnpm exec playwright test -c playwright.unit.config.ts \
  lubirthPlanetaryCloudMicrobenchMath.spec.ts

MIRALITH_CLOUD_MICROBENCH_CAPTURE=1 pnpm exec playwright test \
  tests/e2e/lubirth-planetary-cloud-microbench.spec.ts --project=desktop

pnpm --filter @miralith/lubirth-hero typecheck
pnpm --filter @miralith/site typecheck
pnpm --filter @miralith/site build
git diff --check
```

## 证据索引

- `manifest.json`：固定配置、RT 账本、shader define、资产 hash 与验证结果。
- `visual-review.json`：按 case 的人工视觉门记录。
- `checkpoint.json`：计划强制 checkpoint。
- `screenshots/24-6-opening-contact-sheet.png`、`32-2-opening-contact-sheet.png`、`48-6-opening-contact-sheet.png`：四帧 opening contact sheet。
- `screenshots/24-6-progress-0.12-{cloud,earth,density}.png`：隔离 debug buffer。
- `screenshots/depth-probe-{front,middle,behind}.png`：GPU depth-clamp probe。
