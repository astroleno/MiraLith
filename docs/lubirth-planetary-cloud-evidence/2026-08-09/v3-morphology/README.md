# V3 morphology scale checkpoint

This evidence set is the first execution of the 2026-08-09 scale and morphology plan. It uses the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path, the fixed V3 weather column, `coverage=0.55`, and a 1440×960 DPR 1 headed System Chrome run.

The baseline route is reproducible across four query-only review views and six diagnostics. The corrected review cameras now construct their targets with a spherical arc, preserve the requested ECEF target altitude, and project the audited target to the centre of every near viewport. The opening audit point remains on-screen at `[1175.56, 837.89]`.

The corrected baseline is not uniformly too small: its `40 km / 1.667 km` shape/detail project to `409.52 / 17.06 px` at near-oblique, `180.51 / 7.52 px` at aerial-oblique, `52.93 / 2.21 px` at near-orbit, and `3.87 / 0.16 px` at opening. A single repeat pair therefore cannot enter the frozen target bands at all three near views. The computed shape interval is `[0.0002132923, 0.0000827093]` and the detail interval is `[0.0010238031, 0.0004411164]`; both are empty.

Task 2 replays ten candidates generated from every corrected near-view physical-range solution. Each candidate is measured from paired raw/raw-off and full/cloud-off populations, plus first/converged temporal frames. None passes all three near views. Their cloud masks are dominated by one connected region (`largestConnectedAreaFraction` approximately `0.9997–1.0`), matching the visual result: a broad, nearly flat cloud/gray layer rather than bounded billow masses.

The checkpoint is therefore computed as `HORIZONTAL_MORPHOLOGY_SCALE_FAIL`. This is a presentation-scale result, not a new ECEF failure and not a Takram performance conclusion.

Task 3–6 and Task 0P remain locked. The next change must amend the camera/physical-scale contract or replace this morphology plan; it must not hide the failure with vertical, temporal, lighting or performance tuning.

Files:

- `baseline.json`: 4 views × 6 diagnostics, same-commit telemetry.
- `scale-audit.json`: corrected on-screen repeat-to-metre and metre-to-pixel audit.
- `candidate-matrix.json`: ten-candidate replay, independent image metrics, screenshot hashes, common intervals and computed checkpoint.
- `checkpoint.json`: unlock state and stop reason.
- `captures/`: full/raw/sample-count baseline and candidate screenshots; raw-off/aerial-off/first-frame populations are hashed and analyzed without redundant disk copies.
