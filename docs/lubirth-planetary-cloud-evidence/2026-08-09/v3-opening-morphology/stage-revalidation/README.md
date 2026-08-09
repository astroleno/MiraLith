# V3 opening central-candidate stage revalidation

This evidence freezes `opening-shape-260-detail-40` and revalidates opening progress `0.00 / 0.06 / 0.12 / 0.18` at code commit `247bc9ac106bf1a232540a13e30a345a7339b3be`. The manifest SHA-256 is `eaf2e70df31af4ba30c2a863a608e7cb31f0d235b5da4535013bb3c9f8ae9ca2`.

Every source diagnostic is captured at native/cloud/resolve/shadow frame `32`, temporal jitter index `0`, and STBN slice `32`. The two repeated captures for `full`, `cloud-raw`, and `bsm-off` at progress `0.06` have exact pixel MAE `0`, so the reported A/B differences are above a measured zero noise floor for this deterministic route.

The capture contains 24 source PNGs, four cloud-only masks, four native sample-count buffers, 12 native stage buffers, six repeat PNGs, and seven contact sheets. All 57 manifest-referenced artifact hashes match.

## Corrected findings

- The final visual still fails the orbital gate. The footprint remains pale and flat near the limb, while the dark side retains severe salt-and-pepper fragmentation; no readable Takram-style volumetric morphology appears.
- The direct native hit channel selects `787–968` cloud-hit cells. Primary samples have mean `2.050–2.487`, `p50=2`, and `p95=3` at every progress. This is independent of the post-temporal mask mapping, so low native sampling is now a verified observation.
- The post-temporal mask mapping remains threshold-sensitive. Its unweighted and coverage-weighted primary `p50` stay at `2` for `25/50/75%` thresholds, but the `100%` threshold yields `15–25`. These mapped populations remain diagnostic and do not override the native-hit population.
- Pre-temporal signal-pixel fraction is `7.440–8.294%`, with signal mean luma `0.03110–0.03520`. Resolved-history signal-pixel fraction is `7.572–8.482%`, with signal mean luma `0.02155–0.02316`.
- Resolve retains `76.11–79.31%` of mean opacity and `65.78–69.29%` of signal-pixel luma. There is no temporal near-zero collapse in the sampled frames.
- Exact-phase final/raw screen-difference ratio is `9.28–10.83%`. No healthy same-camera control exists, so this remains an attenuation observation and is not a failure threshold for AerialPerspective, HDR, or output transform.
- Exact-phase `full` versus `bsm-off` 8-bit screen MAE is `0` at all four progresses. This establishes that no BSM response is visible in these outputs; it does not identify whether density, shadow generation, optical integration, or output quantization is responsible.

## Authoritative checkpoint

```text
OPENING_MORPHOLOGY_VISUAL_FAIL
EXACT_FRAME_STAGE_POPULATIONS_PASS
NATIVE_HIT_SAMPLE_COUNT_LOW
NO_TEMPORAL_NEAR_ZERO_COLLAPSE
FINAL_ATTENUATION_OBSERVED_NO_HEALTHY_CONTROL
BSM_VISIBLE_RESPONSE_ABSENT
SAMPLING_CAUSALITY_UNVERIFIED
ROOT_CAUSE_NOT_YET_ISOLATED
SAMPLE_BUDGET_CAUSAL_AB_AUTHORIZED_DIAGNOSTIC_ONLY
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

The next permitted experiment is a narrow sample-budget causal A/B on this central candidate, with weather, morphology, layer profile, light, BSM, temporal, resolution, exposure, and camera frozen. It must use the same exact-frame native/pre-temporal/resolved/final readbacks and may only answer whether additional primary samples remove fragmentation and improve optical signal. It cannot promote the higher budget, change the production preset, or unlock Task 3–6/0P by itself.

## Files and reproduction

- `manifest.json`: runtime contract, browser/GPU identity, exact temporal contract, hashes, metrics, native-stage summaries, and conservative checkpoint.
- `captures/`: source frames, cloud masks, native sample buffers, exact stage readbacks, and repeat captures.
- `*-contact-sheet.png`: seven review atlases.

```bash
MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome \
  --grep "central candidate exact-frame stage revalidation"
```
