# V3 morphology scale checkpoint

This evidence set is the first execution of the 2026-08-09 scale and morphology plan. It uses the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path, the fixed V3 weather column, `coverage=0.55`, and a 1440×960 DPR 1 headed System Chrome run.

The baseline route is reproducible across four query-only review views and six diagnostics. The corrected review cameras keep the target, rather than the camera radial, at the frozen V3 spherical UV `[0.076494140625, 0.73053515625]`. Every near camera is solved backwards along the requested spherical arc, preserves the requested ECEF target altitude, and projects that same audited target to the centre of its viewport. The opening audit point remains on-screen.

The audit no longer compresses the local tangent plane into an RMS scalar. For the `40 km / 1.667 km` baseline, east/north shape pixels are `42.67 / 577.58` at near-oblique, `50.32 / 250.27` at aerial-oblique, `18.06 / 72.65` at near-orbit, and `2.85 / 4.67` at opening. East/north detail pixels are respectively `1.78 / 24.07`, `2.10 / 10.43`, `0.75 / 3.03`, and `0.12 / 0.19`. The three-near-view shape repeat interval is `[0.0003008209, 0.0000282150]` and the detail interval is `[0.0014439402, 0.0001504800]`; both are empty.

Task 2 replays the ten previous RMS-derived candidate IDs for continuity, but none is axis-eligible across the three near views. The corrected dual-axis generator produces no eligible near candidate; it only finds two opening-only combinations. Each replay records paired raw/raw-off and full/cloud-off populations plus an immutable temporal frame captured at `nativeFrameCount=1`. Connected area is diagnostic only: a value near `1.0` is not treated as proof that internal billow is absent. Internal luma deviation, multi-scale variation, gradient energy and local peak density are recorded for later visual review, but do not auto-authorize a winner.

The checkpoint is therefore computed as `HORIZONTAL_MORPHOLOGY_SCALE_FAIL`. This is a presentation-scale result, not a new ECEF failure and not a Takram performance conclusion.

Task 3–6 and Task 0P remain locked. A scalar near/aerial LOD cannot fix the within-view east/north mismatch by itself. The next amendment must explicitly revise the view-space acceptance contract or authorize an anisotropic ENU morphology representation; it must not hide the failure with vertical, temporal, lighting or performance tuning.

Files:

- `baseline.json`: 4 views × 6 diagnostics, same-commit telemetry.
- `scale-audit.json`: corrected on-screen repeat-to-metre and metre-to-pixel audit.
- `candidate-matrix.json`: ten legacy replay candidates, dual-axis eligibility, independent image metrics, screenshot hashes, common intervals and computed checkpoint.
- `checkpoint.json`: unlock state and stop reason.
- `captures/`: all six candidate populations (`full`, `cloud-raw`, `cloud-raw-off`, exact `history-reset-first`, `aerial-final`, `sample-count-debug`) plus baseline diagnostics.

Reproduce the full evidence suite with:

```bash
MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --workers=1
```
