# V3 opening-only morphology checkpoint

This evidence set is the production-facing Task 2O gate for LuBirth. It evaluates only the four opening timeline frames used by the current product contract (`0.00 / 0.06 / 0.12 / 0.18`). The `2.5 / 50 / 200 km` review cameras remain useful diagnostics, but they do not participate in promotion or kill decisions and do not authorize a near/orbital LOD.

The capture was generated at commit `b135e75cbf5238973ac27d23227081714d9d08a3` with Google Chrome `151.0.7922.109`, a `1440×960 / DPR 1` viewport, and the Apple M4 ANGLE Metal renderer. It uses the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path, V3 weather, `coverage=0.55`, and the frozen renderer fingerprint. The matrix contains:

- shape wavelengths `220 / 260 / 300 km`;
- detail wavelengths `30 / 40 km`;
- four opening progress values;
- `full / cloud-raw / bsm-off / sample-count-debug` diagnostics;
- 96 same-commit captures plus four contact sheets.

All recorded PNG hashes match `candidate-matrix.json`. The opening cameras remain orbital in every formal frame, with measured ECEF heights from `3,514.738 km` to `3,843.794 km`.

## Result

The scale hypothesis was tested successfully, but no visual winner emerged:

- shape wavelengths project to `20.814–29.182 px` and detail wavelengths to `2.838–3.891 px`; the old `40 km / 1.67 km` sub-pixel explanation is therefore no longer sufficient;
- every full frame still reads as a pale, surface-attached footprint with dark-side salt-and-pepper noise rather than a cloud volume;
- no candidate exposes readable base/core/top structure, vertical thickness, billow silhouette, or local self-shadowing;
- changing the smallest to the largest candidate changes `6.6–9.0%` of cloud-raw pixels, but only `1.6–1.8%` of full-frame pixels at the same threshold;
- full versus BSM-off normalized MAE is `0–0.001164`, with at most `1.41%` changed pixels and one exact-zero comparison. BSM therefore does not produce a stable, readable internal-shadow signal in this matrix.

The authoritative checkpoint is:

```text
OPENING_MORPHOLOGY_VISUAL_FAIL
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

This result rejects these six horizontal repeat candidates for the current opening gate. It does not reject Takram or V3 input compatibility, and it does not establish a performance conclusion. It also does not authorize more near-view tuning, anisotropic ENU, vertical/profile tuning, temporal cleanup, or GPU promotion. A new amendment is required before changing the representation or optical pipeline.

## Files

- `candidate-matrix.json`: runtime contract, environment, 96 capture hashes, projection audits, contact-sheet hashes, and the pre-review checkpoint.
- `visual-review.json`: manual production-frame review and quantitative deltas.
- `checkpoint.json`: authoritative stop and unlock state.
- `full-contact-sheet.png`: final native pipeline output.
- `cloud-raw-contact-sheet.png`: pre-atmosphere cloud diagnostic.
- `bsm-off-contact-sheet.png`: matched BSM-disabled final output.
- `sample-count-debug-contact-sheet.png`: native sample-count diagnostic.
- `captures/`: all 96 labeled source captures.

Reproduce the matrix with:

```bash
MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome \
  --grep "opening-only morphology matrix"
```
