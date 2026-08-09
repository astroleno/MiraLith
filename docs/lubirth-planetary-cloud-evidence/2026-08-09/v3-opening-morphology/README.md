# V3 opening-only morphology and stage-isolation checkpoint

This is the production-facing Task 2O gate for LuBirth. It evaluates only opening progress `0.00 / 0.06 / 0.12 / 0.18`; the `2.5 / 50 / 200 km` cameras remain diagnostic-only and cannot participate in promotion, kill, or LOD decisions.

The clean-HEAD capture was generated at commit `14a9d05b810540cb1efa189fbb60c142f2cdb55f` with Google Chrome `151.0.7922.109`, a `1440×960 / DPR 1` viewport, and the Apple M4 ANGLE Metal renderer. It preserves V3 weather, `coverage=0.55`, and the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path.

The visual matrix contains:

- shape wavelengths `220 / 260 / 300 km` and detail wavelengths `30 / 40 km`;
- six source diagnostics per candidate/progress: `full`, `cloud-raw`, `cloud-raw-off`, `bsm-off`, `aerial-final`, and `sample-count-debug`;
- 144 source PNGs, 24 derived cloud-only masks, 24 compressed native sample-count buffers, and seven contact sheets;
- independent cloud-on/off captures for raw and final output. These source frames remain valid for visual review, but the original stage-difference statistics are not a matched temporal population.

The historical sample-count buffer comes directly from the native `360×240` half-float pre-temporal cloud target. Its RGB counts are intact, but its population was selected by a post-temporal mask with a `25%` cell-coverage threshold. Recalculation showed that this choice is highly sensitive: the central candidate at progress `0.06` moves from primary `p50=2` at `25%` coverage to `p50=25` at `100%`. Therefore the old `p50=2` is not an authoritative cloud-hit statistic and cannot implicate sampling.

Commit `2839f2b` repairs the capture protocol without changing the renderer preset: it adds a native hit alpha channel, weighted `25/50/75/100%` sensitivity tables, exact Takram frame-32 captures with frame/jitter/history metadata, repeat noise-floor capture, and capture-only evidence writes. The formal matrix in this directory predates that repair and has not been relabeled as new evidence.

## Visual result

No candidate passes the orbital visual gate:

- the V3 macro footprint and four-frame continuity are visible;
- cloud-ground separation or limb elevation is absent;
- transparency layering and lit/backlit volume response remain unreadable;
- local BSM self-shadowing is weak and inconsistent;
- salt-and-pepper fragmentation remains visible, especially on the dark side.

`base/core/top` remains a diagnostic observation at this orbital distance, not a hard gate.

All six shape wavelengths reach their screen-space target. Only the three `40 km` detail candidates reach the `3–10 px` detail target at every progress; all `30 km` detail candidates remain `subpixel-risk`. Therefore the evidence rules out an undersized main shape and rejects the tested `40 km` detail candidates visually, but it does not claim that every detail scale passed.

## Historical stage observations and validity limit

The old independent populations show, but do not causally classify:

- the cloud-only mask covers `6.69–7.83%` of the frame, and raw cloud-on/off MAE is strong at `0.4452–0.4587`;
- the raw mask is highly fragmented: single-pixel fragments are `12.21–15.57%`, small fragments `21.76–27.36%`, and edge density `81.70–83.43%`;
- RGB sample counts are non-zero, but their mask-selected median and distribution are threshold-sensitive and are not valid sampling gates;
- the independently captured final cloud-on/off MAE is `0.0342–0.0470`, or `7.58–10.49%` of the independently captured raw screen difference;
- mask-local full/BSM-off MAE ranges from `0` to `0.0172`, so BSM does not yet produce a stable readable response.

The `7.58–10.49%` ratio records screen-space attenuation only. Because the old diagnostic pages were not locked to the same Takram temporal frame and no healthy same-camera control defines a normal ratio, it cannot be labeled a later-stage fault. The evidence does not distinguish density/profile, ray sampling, optical integration, temporal resolve, and AerialPerspective composition well enough to authorize a representation rewrite or a sample-budget increase.

## Authoritative checkpoint

```text
OPENING_MORPHOLOGY_VISUAL_FAIL
STAGE_ISOLATION_INCONCLUSIVE_WITH_ATTENUATION_OBSERVED
SAMPLING_CAUSALITY_UNVERIFIED
ROOT_CAUSE_NOT_YET_ISOLATED
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

The next amendment freezes `opening-shape-260-detail-40`, captures every population at the exact same local frame/jitter phase, records repeat variance, and uses the native hit channel plus the full mask-sensitivity table. It must separately persist native density/profile, pre-temporal radiance, temporal history, AerialPerspective input, and final cloud-on/off output. A sample-budget A/B remains unauthorized until the corrected native-hit population shows a sampling deficit. Without a same-camera healthy control, final/raw remains an attenuation observation rather than a fault threshold.

## Files

- `candidate-matrix.json`: historical schema-3 environment, adapter/runtime contract, 144 source hashes, 24 mask hashes, 24 RGB sample artifacts, projection audits, and the now-limited stage metrics.
- `visual-review.json`: orbital visual decisions plus explicit validity limits for the historical stage interpretation.
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
