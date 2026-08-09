# V3 opening-only morphology and stage-isolation checkpoint

This is the production-facing Task 2O gate for LuBirth. It evaluates only opening progress `0.00 / 0.06 / 0.12 / 0.18`; the `2.5 / 50 / 200 km` cameras remain diagnostic-only and cannot participate in promotion, kill, or LOD decisions.

The clean-HEAD capture was generated at commit `14a9d05b810540cb1efa189fbb60c142f2cdb55f` with Google Chrome `151.0.7922.109`, a `1440×960 / DPR 1` viewport, and the Apple M4 ANGLE Metal renderer. It preserves V3 weather, `coverage=0.55`, and the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path.

The matrix contains:

- shape wavelengths `220 / 260 / 300 km` and detail wavelengths `30 / 40 km`;
- six source diagnostics per candidate/progress: `full`, `cloud-raw`, `cloud-raw-off`, `bsm-off`, `aerial-final`, and `sample-count-debug`;
- 144 source PNGs, 24 derived cloud-only masks, 24 compressed native sample-count buffers, and seven contact sheets;
- matched cloud-on/off populations for raw and final output, with BSM and sample statistics evaluated only inside the derived cloud mask.

The sample-count evidence comes directly from the native `360×240` half-float pre-temporal cloud target. A capture-only shader correction changes the upstream debug `sampleMedia` parameter from `out` to `inout`, because `out` discards the primary count accumulated by `marchClouds`. This does not change normal rendering or the frozen renderer preset.

## Visual result

No candidate passes the orbital visual gate:

- the V3 macro footprint and four-frame continuity are visible;
- cloud-ground separation or limb elevation is absent;
- transparency layering and lit/backlit volume response remain unreadable;
- local BSM self-shadowing is weak and inconsistent;
- salt-and-pepper fragmentation remains visible, especially on the dark side.

`base/core/top` remains a diagnostic observation at this orbital distance, not a hard gate.

All six shape wavelengths reach their screen-space target. Only the three `40 km` detail candidates reach the `3–10 px` detail target at every progress; all `30 km` detail candidates remain `subpixel-risk`. Therefore the evidence rules out an undersized main shape and rejects the tested `40 km` detail candidates visually, but it does not claim that every detail scale passed.

## Stage-isolation result

The paired populations do not support a single density-representation verdict:

- the cloud-only mask covers `6.69–7.83%` of the frame, and raw cloud-on/off MAE is strong at `0.4452–0.4587`;
- the raw mask is highly fragmented: single-pixel fragments are `12.21–15.57%`, small fragments `21.76–27.36%`, and edge density `81.70–83.43%`;
- inside the same mask, native primary sampling is active but uneven: mean `6.21–7.00`, median `2`, p95 `29–35`; shape/detail medians are both `1`;
- final cloud-on/off MAE is only `0.0342–0.0470`; its screen-space difference is `7.58–10.49%` of the matched raw difference;
- mask-local full/BSM-off MAE ranges from `0` to `0.0172`, so BSM does not yet produce a stable readable response.

This implicates both pre-temporal morphology/sampling and later signal attenuation. The evidence does not yet distinguish density/profile, optical integration, temporal resolve, and AerialPerspective composition well enough to authorize a representation rewrite.

## Authoritative checkpoint

```text
OPENING_MORPHOLOGY_VISUAL_FAIL
STAGE_ISOLATION_MIXED_FAILURE
ROOT_CAUSE_NOT_YET_ISOLATED
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

The next amendment must freeze one `40 km` detail candidate and separately read native density/profile, pre-temporal radiance, temporal history, and final cloud-on/off output. It may run diagnostic-only sample-budget A/B to test causality, but it may not tune morphology, redesign V3 density, start Task 3–6, or run Task 0P until one stage-specific cause is demonstrated.

## Files

- `candidate-matrix.json`: environment, full adapter/runtime contract, 144 source hashes, 24 mask hashes, 24 native sample artifacts, projection audits, and mask-local metrics.
- `visual-review.json`: orbital visual decisions and stage-isolation interpretation.
- `checkpoint.json`: authoritative locks and next-action boundary.
- `*-contact-sheet.png`: seven source/derived review atlases.
- `captures/`: 192 source and derived artifacts.

Reproduce with:

```bash
MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome \
  --grep "opening-only morphology matrix"
```
