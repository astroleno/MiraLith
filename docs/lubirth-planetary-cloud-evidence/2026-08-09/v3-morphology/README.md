# V3 morphology scale checkpoint

This evidence set is the first execution of the 2026-08-09 scale and morphology plan. It uses the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path, the fixed V3 weather column, `coverage=0.55`, and a 1440×960 DPR 1 headed System Chrome run.

The baseline route is reproducible across four query-only review views and six diagnostics. The scale audit then projects a 1 km ECEF tangent segment through the live camera matrices. It shows that the frozen `40 km` shape and `1.667 km` detail are below the visual floor in every view, with detail remaining subpixel.

Task 2 replays two repeat pairs generated from the measured near-orbit projection across all four views. The candidate matrix contains the per-view projected pixels and the generated physical-range matrix. Only near-orbit has any candidate inside its declared physical range; near-oblique, aerial-oblique and opening-orbit have none. Therefore no common near-view candidate exists, and the plan stops at `HORIZONTAL_MORPHOLOGY_SCALE_FAIL`.

Task 3–6 and Task 0P remain locked. The next change must amend the camera/physical-scale contract or replace this morphology plan; it must not hide the failure with vertical, temporal, lighting or performance tuning.

Files:

- `baseline.json`: 4 views × 6 diagnostics, same-commit telemetry.
- `scale-audit.json`: repeat-to-metre and metre-to-pixel audit.
- `candidate-matrix.json`: horizontal candidate replay and generated physical-range matrix.
- `checkpoint.json`: unlock state and stop reason.
- `captures/`: full/raw/sample-count baseline and candidate screenshots.

