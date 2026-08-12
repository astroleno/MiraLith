# LuBirth Takram Orbital Production Sampling and Lookdev Successor Design

**Status:** Draft for review

**Date:** 2026-08-13

**Scope:** Query-only Takram stock-cloud orbital opening; production sampling-policy selection followed by a fresh bounded lookdev

**Supersedes for future execution:** Any continuation of `2026-08-12-lubirth-takram-orbital-lookdev-tuning-design.md`; its Stage A/B evidence remains historical and its Stage C–F sequence remains permanently locked

**Consumes:**

- `2026-08-12-lubirth-takram-orbital-lookdev-tuning-design.md`
- `2026-08-13-lubirth-takram-orbital-sampling-causality-design.md`
- `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-sampling-causality/OUTCOME.md`

## 1. Decision

The next work is a successor funnel, not a continuation of the old Stage C–F sequence.

The old lookdev evaluated morphology and coverage while the inherited orbital `perspectiveStepScale=1.01` policy produced only isolated primary hits. The causal A/B subsequently showed that changing only the step scale to `1.0001` restores a structured cloud signal in the frozen `h120 / coverage 0.55 / vertical 1 / optical 1` setup. Therefore the old Stage A/B images are valid evidence of what happened under `1.01`, but they are not a healthy baseline from which vertical or optical lookdev may continue.

The successor work proceeds in this order:

```text
causal evidence lock
  -> bounded public step-policy selection
  -> primary sampling / BSM stage / shadow-length direction / total-cost diagnostics
  -> healthy stock baseline
  -> fresh morphology / coverage / vertical / optical lookdev
  -> final stock evidence and cost
  -> V3 adapter compatibility
  -> separate homepage promotion amendment
```

The first implementation path stays on Takram's existing public `perspectiveStepScale` uniform. A shader patch that separates primary and shadow-length stepping is a gated fallback, not the default. This keeps the migration narrow while still refusing to promote the diagnostic `1.0001` value without quality and cost evidence.

## 2. Evidence already established

The following facts are inputs to this design and are not re-litigated by another broad root-cause sweep:

1. The frozen control and treatment differed only in `perspectiveStepScale`, expected query identity, and remount/allocation identity.
2. Control `1.01` produced approximately `191–239` native hit pixels and `0.56–0.72%` pre-temporal signal.
3. Treatment `1.0001` produced approximately `25,305–28,392` native hit pixels and `29.29–32.86%` pre-temporal signal.
4. The treatment signal survived temporal resolve and remained visible in final output at all four opening progress values.
5. Both arms reproduced byte-identical progress-`0.06` cloud-raw and final-output captures.
6. The initial-step ranges are estimates based on camera height and a documented `2x camera-height` limb proxy. They are not measured per-pixel `rayNear` distributions.
7. The treatment is not a production look: it remains dark, rust-coloured, and visually close to the surface.
8. `perspectiveStepScale` controls both primary step growth and Takram's shadow-length step growth. It does not configure the separate Beer shadow-map pass.
9. Primary sampling, BSM submission cost, shadow-length directional cost, and total GPU cost have not yet been separated sufficiently for production selection. Primary execution time is not a separately submitted GPU stage and must not be reported as an absolute primary-only timing.

The causal conclusion remains scoped to the stock opening camera and frozen experiment. It does not establish a general near-ground, in-cloud, or arbitrary-orbit policy.

## 3. Rejected and retained approaches

### 3.1 Selected: bounded public scalar first, shader fallback only on failure

Test a small exact enum around the confirmed point using the existing public uniform. Select a stock-opening production value only if it passes signal, temporal, visual, and GPU gates. This is the smallest change consistent with the evidence and preserves upstream Takram rendering.

If no public value simultaneously passes quality and cost, stop and authorize one focused shader-policy design. Do not compensate with unrelated density, exposure, weather, or layer changes.

### 3.2 Rejected as the first move: immediate shader decoupling

Adding separate primary and shadow-length scale uniforms would improve control, but it would expand the patch surface across Takram shader source, runtime uniforms, package patch artifacts, fingerprints, and public typings before proving that the existing public control is insufficient.

This remains the fallback when the public-scalar funnel produces a specific conflict:

- healthy primary sampling but a repeatable full-versus-light-shafts-off budget crossing or quality conflict;
- acceptable quality only at a value that exceeds the GPU budget; or
- no fixed public scalar remains stable across all four opening progress values.

### 3.3 Rejected: promote `1.0001` directly

`1.0001` is the confirmed causal treatment and the centre of the production screen. It is not automatically the winner because:

- its total GPU cost is unpublished;
- it changes shadow-length stepping as well as primary stepping;
- a coarser value may preserve the signal at lower cost;
- a finer value may improve continuity but fail iteration reach or cost;
- the current final image is not production-ready.

## 4. Scope boundaries

This design must:

- reuse `/lubirth-takram-parity-spike` as a query-only route;
- keep `input=stock`, `view=opening`, native frame `32`, DPR `1`, and `1440x960` physical/CSS pixels;
- test progress `0.00 / 0.06 / 0.12 / 0.18`;
- reuse the existing stock assets, official R/G/B/A layer contract, camera path, Earth radius, atmosphere, HDR/output transform, temporal resolve, AerialPerspective ordering, and BSM implementation;
- reuse the existing remount, drift, fingerprint, readback, sample-count, lossless-stage, atomic-publisher, and hash gates;
- use exact enums rather than free-form query numbers;
- derive quantitative decisions from captured metrics rather than hand-entered booleans;
- preserve the old evidence roots and checkpoints unchanged.

This design must not:

- change the homepage or production `EarthMoonScene`;
- treat `1.0001` as a pre-approved production default;
- resume the old Stage C–F checkpoints;
- tune morphology, coverage, layer thickness, optical depth, lighting, exposure, or weather while selecting the step policy;
- add adaptive per-pixel stepping, binary refinement, a new raymarcher, a new weather asset, cloud cards, or an impostor;
- claim near-ground or arbitrary-camera support;
- infer exact stage time by subtracting unrelated GPU populations;
- patch Takram GLSL unless the public-policy terminal outcome explicitly authorizes the fallback.

## 5. Production step-policy contract

Add a production-screen resolver separate from the completed causal resolver:

```ts
type TakramOrbitalProductionStepCandidate =
  | "control"
  | "fine"
  | "confirmed"
  | "coarse";
```

The exact values are:

| Candidate | `perspectiveStepScale` | Estimated near-nadir initial step | Estimated `2x-height` limb bound | Role |
| --- | ---: | ---: | ---: | --- |
| `control` | `1.01` | `35.83 km` | `71.62 km` | Negative control only |
| `fine` | `1.00005` | `0.229 km` | `0.408 km` | Finer/high-cost reference |
| `confirmed` | `1.0001` | `0.408 km` | `0.766 km` | Causally confirmed centre point |
| `coarse` | `1.0002` | `0.766 km` | `1.481 km` | Coarser/performance candidate |

The estimates use the recorded opening camera height of approximately `3,578.43 km`, `minStepSize=50 m`, and:

```text
estimatedInitialStep = minStepSize
  + (perspectiveStepScale - 1) * rayNearProxy
```

They explain the bounded candidate selection but never substitute for captured sample and image evidence. `fine` is not assumed to be superior: slower geometric growth can consume the iteration budget before traversing the available ray interval. `coarse` is not assumed to be adequate merely because it is cheaper.

The query contract is exact:

```text
orbitalProductionStep=control
orbitalProductionStep=fine
orbitalProductionStep=confirmed
orbitalProductionStep=coarse
```

It is valid only with the complete orbital lookdev query. It may not combine with legacy `cloudScale` or the diagnostic `orbitalStepScale` causal A/B enum. Missing `orbitalProductionStep` preserves existing behaviour until a later homepage-promotion amendment.

The resolved step value enters the existing orbital lookdev contract, mount identity, runtime readback, drift signature, and renderer fingerprint. No free-form numeric fallback is permitted.

## 6. Diagnostic separation without an initial shader patch

The installed Takram shader uses `perspectiveStepScale` in two places:

1. the primary camera-ray march, including the initial distance-dependent step and later geometric growth;
2. the optional shadow-length march used for atmospheric light shafts.

The BSM pass has its own step fields and does not consume this uniform. The production screen therefore uses three exact feature states:

| Feature state | Primary march | BSM | Shadow-length march | Purpose |
| --- | --- | --- | --- | --- |
| `native` | On | Native | On | Authoritative visual and total-cost state |
| `light-shafts-off` | On | Native | Off | Primary + BSM state without shadow-length work |
| `bsm-off` | On | Unit-transmittance layer control | On | Existing BSM visual-influence control |

Stage 2 models rendering feature state and captured output as orthogonal exact enums:

```text
featureState = native | light-shafts-off | bsm-off
output       = full | cloud-raw | cloud-raw-off | sample-count-debug | stage-readback | aerial-final
```

`cloud-raw/cloud-raw-off` isolates the raw cloud signal, `sample-count-debug` instruments native primary hits/counts, `stage-readback` publishes lossless stages plus final output, and `aerial-final` is the existing cloud-off final baseline. The route may serialize feature/output pairs into one combined exact diagnostic enum, but it must reject unsupported combinations and free-form values. GPU timing is valid only for `output=full`. Primary-signal invariants compare `sample-count-debug` and lossless `stage-readback` outputs across feature states. `aerial-final` is valid only with `featureState=native`.

`light-shafts-off` is a capture-only exact enum that sets Takram's existing public `lightShafts` feature to `false`. It must restore the immutable high-preset value on remount and may never leak into a normal stock route.

The `bsm-off` feature state continues to keep Takram's supported BSM allocation path intact while making the official cloud layers non-shadowing. It demonstrates BSM visual influence but does not equal zero BSM submission cost.

Cross-route GPU deltas are directional attribution evidence only. Production viability is decided from the unmodified `full` route's directly measured total population.

GPU timing uses two mutually exclusive modes. No frame may contain a total query and a stage query at the same time:

1. `total-only-time-elapsed` opens one query around the existing full submission interval and records separate no-op and copy-only baselines;
2. `stage-only-sequential-time-elapsed` opens and closes five sequential, non-nested queries around the existing submissions:
   - `bsm-current`: `ShadowPass.currentPass.render`;
   - `bsm-resolve`: `ShadowPass.resolvePass.render`;
   - `cloud-current`: `CloudsPass.currentPass.render`, including primary, secondary, and optional shadow-length shader work;
   - `cloud-resolve`: `CloudsPass.resolvePass.render`;
   - `final-effect`: the combined final `EffectPass` containing Clouds composition and AerialPerspective/final composition.

The stage-only population reports each raw stage sample, same-frame sums, and p95 values derived from same-frame populations. It must never add independent stage p95 values. BSM cost is reported as the p95 of each frame's `bsm-current + bsm-resolve` sum. `cloud-current` must retain that name because its single draw cannot provide an absolute primary-only timing.

The capture runtime may wrap the existing pass `render()` methods or add one instrumentation-only timer hook where a public reference is unavailable. The hook may not change GLSL, defines, uniforms, pass order, render targets, or output. Its source hash enters the renderer fingerprint, and enabled-versus-disabled captures must remain within the applicable same-route repeat floor.

## 7. Successor stage funnel

### Stage 0 — provenance, replay, and profiler readiness

Before new captures, verify:

- the causal evidence manifest contains exactly `93` matching artifact hashes and byte lengths;
- the causal clean commit, browser/GPU identity, frozen contract, and final outcome are readable;
- the current implementation reproduces the causal resolver and exact step values;
- the current route still passes query/runtime/fingerprint/camera parity;
- System Chrome exposes usable `EXT_disjoint_timer_query_webgl2` total-only and stage-only profilers;
- an `8`-warmup / `8`-sample smoke run completes independently for both modes without a nested-query error, missing stage, duplicate stage, incomplete same-frame stage set, or permanent disjoint epoch.

The smoke run is a capability gate, not a cost verdict. Failure produces:

```text
ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED
```

No new candidate images are interpreted while provenance, route identity, or timer capability is invalid.

### Stage 1 — bounded public step-policy screen

Capture the four exact candidates at every opening progress while freezing:

```text
input               stock
view                opening
preset              h120
coverage            0.55
verticalScale       1
opticalDepthScale   1
qualityPreset       high
nativeFrame         32
lightShafts          true
BSM                  native
temporal             native
```

Repeat the complete capture set for every candidate, including control, at every progress. The control is retained as a negative control and cannot win. Per-progress repeat evidence is required; noise measured at one progress is never applied to another progress.

For every base capture, publish:

- cloud-raw and cloud-raw-off PNGs;
- sample-count-debug PNG and lossless native sample-count buffer;
- lossless pre-temporal, resolved-history, and final-output buffers;
- stage-readback final PNG;
- complete requested/runtime/fingerprint/camera identity;
- recorded camera height and clearly labelled step estimates;
- artifact hashes and byte lengths.

Quantitative sampling health is computed directly from `metrics.json`. All compared buffers must have equal dimensions, channels, precision, and origin; a mismatch is setup-blocked evidence.

The normative metric definitions are:

- `cloudMask[pixel] = 1` when the maximum absolute RGB-channel difference between the 8-bit `cloud-raw` and `cloud-raw-off` pixels is strictly greater than `8`; alpha is ignored;
- connected components use four-neighbour adjacency; `smallFragmentFraction` is the number of mask pixels belonging to components of size `<=3`, divided by total cloud-mask pixels;
- a native hit is a native sample-count texel whose decoded alpha is `>=0.5`;
- `nativeHitPixelFraction = nativeHitPixelCount / (nativeWidth * nativeHeight)` using the sample-count render-target dimensions, not the full-resolution cloud mask;
- `nativeHitMaskMismatch(A,B) = count(hitA != hitB) / (nativeWidth * nativeHeight)` for equally sized native hit masks;
- primary/shape/detail counts are reconstructed by rounding normalized RGB values multiplied by `500 / 5 / 5` respectively;
- `primaryCapHitFraction = count(native-hit texels with primary >= runtime maxIterationCount) / nativeHitPixelCount`;
- a pre-temporal signal pixel has finite alpha strictly greater than `1/255`; `preTemporalSignalPixelFraction` uses the complete pre-temporal native pixel population as its denominator;
- `signalRetention = resolvedHistory.signalPixelFraction / preTemporal.signalPixelFraction` and `signalLumaRetention = resolvedHistory.signalMeanLuma / preTemporal.signalMeanLuma`; a zero denominator or non-finite quotient fails the candidate;
- `opacityMae(A,B)` is the arithmetic mean of `abs(A.alpha - B.alpha)` over every pixel in the two lossless pre-temporal buffers;
- for candidate `c` and progress `p`, `pairedChange(c,p) = opacityMae(c.base, control.base)` and `repeatNoiseFloor(c,p) = max(opacityMae(c.base,c.repeat), opacityMae(control.base,control.repeat))` from the same progress;
- `pairedChange` passes only when it is strictly greater than its same-progress repeat floor.

For the frozen `h120 / 0.55 / 1 / 1` screen, a non-control candidate passes an individual progress only when:

```text
finite pixel fraction for every lossless stage = 1
native hit pixel fraction                     >= 0.20
pre-temporal signal pixel fraction            >= 0.20
small-fragment fraction                       <= 0.10
resolved/pre-temporal signal retention        within [0.90, 1.10]
resolved/pre-temporal signal-luma retention   within [0.80, 1.20]
pairedChange                                  > same-progress repeatNoiseFloor
primary cap-hit fraction                       <= 0.01
sample-count structural invariants             pass
```

The sample-count structural invariants require positive native dimensions, the audited source/encoding/precision, finite reconstructed counts, `primary >= shape >= detail >= 0` for every native hit, `nonZeroPrimaryPixelFraction=1`, and `runtime maxIterationCount=500`. The cap-hit rule is separate: reaching `500` is structurally valid but indicates iteration-budget saturation. A candidate with more than `1%` saturated native-hit texels fails even if all other signal metrics pass.

These absolute floors are valid only for the frozen sampling-policy screen. They are anchored below the confirmed treatment's observed `29.29–32.86%` signal while remaining far above the control's sub-`1%` result. They are not reused to judge later coverage or morphology candidates.

A step candidate is sampling-healthy only when all four progresses pass the quantitative gate and visual review confirms that cloud-raw contains a coherent density field rather than debug colour or isolated fragments. Aesthetic defects such as dark colour, ground proximity, or unfinished lighting are recorded but do not fail Stage 1.

### Stage 2 — feature isolation and GPU policy selection

Only sampling-healthy candidates enter Stage 2. At all four progress values, capture `full`, `cloud-raw`, `cloud-raw-off`, `sample-count-debug`, and lossless `stage-readback` under both `native` and `light-shafts-off` feature states. Under `bsm-off`, capture `full`, `sample-count-debug`, and lossless `stage-readback`. Retain the existing `aerial-final` cloud-off control. GPU populations run only for native/full and light-shafts-off/full.

Primary-signal invariants:

- for each candidate/progress, the Stage 1 base-versus-repeat `nativeHitMaskMismatch` and `opacityMae` are the only applicable primary-signal noise floors;
- `full` versus `light-shafts-off`, and `full` versus `bsm-off`, must each have native-hit-mask mismatch and pre-temporal opacity MAE less than or equal to those same-candidate, same-progress floors;
- lighting variants may change radiance but may not create or remove primary cloud density;
- any variant change must force a complete composer remount and fresh cloud/shadow/resolve allocation epoch.

For each sampling-healthy candidate and progress, run four independent populations:

```text
full total-only:              120 warmup + 120 valid non-disjoint frames
light-shafts-off total-only:  120 warmup + 120 valid non-disjoint frames
full stage-only:              120 warmup + 120 valid complete stage frames
light-shafts-off stage-only:  120 warmup + 120 valid complete stage frames
```

Both total-only populations record separate no-op and copy-only baselines. Both stage-only populations record the five raw sequential stage queries and one empty-query baseline per sampled frame; the baseline is preserved but not subtracted from individual samples. A disjoint event invalidates every pending result and every completed result from that epoch. Sampling continues until the population contains `120` valid frames from retained epochs.

The evidence reports:

- direct `full` and `light-shafts-off` total p95 values;
- direct BSM current, BSM resolve, and same-frame combined BSM p95 values;
- direct cloud-current, cloud-resolve, and final-effect p95 values;
- same-frame stage-sum p95 values;
- directional full-versus-light-shafts-off comparisons for total and cloud-current.

The last comparison is not an exact shadow-length duration: the variants are separate populations, and the cloud-current draw also contains primary and secondary work. It may establish that shadow-length coupling crosses the budget boundary, but it may not be published as a subtracted absolute stage time. `bsm-off` is never used to estimate BSM cost because it preserves the BSM submissions.

The stage-only same-frame sum is diagnostic and is not substituted for the total-only measurement: sequential query boundaries omit or perturb work outside the five wrapped submissions. Only the directly measured native/full total-only population drives the `3 ms` and `4 ms` classifications.

The authoritative candidate cost is the maximum directly measured `full` total-only p95 across the four progresses:

- `p95 <= 3 ms`: production-budget eligible;
- `3 ms < p95 <= 4 ms`: query-only lookdev viable but not homepage-promotion eligible;
- `p95 > 4 ms`: over budget.

Any native/full versus light-shafts-off/full comparison that would authorize `NEEDS_DECOUPLING` must be repeated with a second independent `120 + 120` total-only population for both feature states at every progress participating in the threshold crossing. The decoupling condition must reproduce in the confirmation populations; otherwise stop with `ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED` and record the non-reproducible classification boundary.

Select one public step policy using this order:

1. passes Stage 1 at every progress;
2. has valid native/full and light-shafts-off/full total-only and stage-only populations at every progress;
3. remains at or below `4 ms` at every progress;
4. prefer a candidate at or below `3 ms` at every progress;
5. lowest maximum full-route p95;
6. coarsest `perspectiveStepScale` on an exact maximum-p95 tie;
7. `confirmed` wins any remaining exact tie because it already has causal evidence.

The winner becomes the one `ORBITAL_PUBLIC_STEP_POLICY_WINNER`. It is a query-only stock-opening baseline, not a homepage default.

### Stage 2 fallback boundary

If no healthy candidate has `full` p95 `<=4 ms` at every progress, but at least one healthy candidate has `light-shafts-off` p95 `<=4 ms` at every progress and exceeds `4 ms` in `full` at one or more matching progresses, stop with:

```text
ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING
```

This is a directional budget-crossing result, not an absolute shadow-length timing. Together with unchanged primary hit masks and pre-temporal opacity, it authorizes a separate focused design for distinct primary and shadow-length controls. It does not authorize density, exposure, weather, or quality-preset compensation.

If every healthy candidate exceeds `4 ms` in `full` and no candidate satisfies that light-shafts-off budget-crossing rule, stop with:

```text
ORBITAL_PUBLIC_STEP_POLICY_OVER_BUDGET
```

This result does not authorize shadow-length decoupling because the captured evidence has not shown that removing the coupled work would recover the budget.

If no non-control candidate remains sampling-healthy, stop with:

```text
ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL
```

If timer data is unsupported or invalid after the capability gate, stop with:

```text
ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED
```

No terminal failure is silently converted into a provisional production winner.

### Stage 3 — healthy stock baseline lock

For the public step-policy winner, publish one immutable baseline contract containing:

- exact query enum and resolved numeric value;
- full official layer and render configuration;
- all four progress identities and lossless stage summaries;
- full/light-shafts-off/BSM-off visual comparisons;
- complete GPU populations and classification;
- one machine-derived metric decision;
- one human visual review limited to coherence and observability;
- the explicit statement that the image is a sampling baseline, not finished lookdev.

The state is:

```text
ORBITAL_HEALTHY_STOCK_BASELINE_READY
```

This state alone unlocks the new lookdev. The old Stage B checkpoint never unlocks the successor stages.

### Stage 4A — fresh morphology selection

With the selected step policy frozen, recapture:

```text
h40  / coverage 0.3 / vertical 1 / optical 1
h80  / coverage 0.3 / vertical 1 / optical 1
h120 / coverage 0.3 / vertical 1 / optical 1
```

All four progress values are required. The old Stage A contact sheets may be displayed only as historical `1.01` controls; they cannot supply a current decision.

Stage 4A uses a morphology-only gate. Every lossless stage must be finite, identity/remount/hash checks must pass, `nativeHitPixelCount > 0`, and `preTemporalSignalPixelFraction > 0` at every progress. Human review scores only:

```text
macro coherence
opening identity stability
artifact freedom
```

Each dimension is scored `0–2`; every dimension must be at least `1` at every progress and no hard artifact may be present. Hard artifacts are non-finite output, confirmed cube-face seam/wrap discontinuity, unstable identity, or loss of captured signal. Cloud/ground separation, depth layering, and lighting/BSM read are recorded as observations but are not Stage 4A pass conditions.

`TOPOLOGY_UNOBSERVABLE` is no longer an automatic coverage-stage pass: with a healthy sampling baseline, insufficient visible opacity at native coverage must be accompanied by coherent lossless cloud-raw/pre-temporal structure to enter Stage 4B. A candidate containing only isolated fragments may not enter.

If no morphology candidate enters Stage 4B, stop with:

```text
ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL
```

### Stage 4B — coverage selection

For each surviving morphology candidate, capture:

```text
coverage = 0.3 / 0.4 / 0.45 / 0.55
vertical = 1
optical  = 1
```

Stage 4B uses a coverage-only gate. Setup, finite-output, identity, seam, and signal-presence gates remain mandatory. Human review scores only:

```text
macro coherence
coverage usability
opening identity stability
artifact freedom
```

`coverage usability` asks whether occupied and clear regions are both readable without a near-empty result or a planet-wide binary sheet. Every dimension must score at least `1` at every progress. Cloud/ground separation, depth layering, and lighting/BSM read cannot fail a Stage 4B candidate because vertical and optical controls remain frozen.

Retain at most one passing coverage per morphology and at most two overall survivors. Rank already-passing candidates by aggregate Stage 4B score, then aggregate artifact freedom, macro coherence, smallest absolute coverage departure from `0.3`, and smallest `H`. Use newly captured evidence only.

If no coverage candidate survives, stop with:

```text
ORBITAL_LOOKDEV_V2_COVERAGE_FAIL
```

### Stage 4C — vertical separation

For every Stage 4B survivor, capture:

```text
verticalScale = 1 / 2 / 4
opticalDepthScale = 1
```

Keep the original layer-altitude, height/density, extinction, and atmosphere-top invariants. Stage 4C scores:

```text
macro coherence
cloud/ground separation
depth layering
opening identity stability
artifact freedom
```

Every dimension must score at least `1` at every progress. Lighting/BSM read is recorded but is not a Stage 4C pass condition. Select one overall passing candidate by aggregate score, then depth layering, cloud/ground separation, artifact freedom, smallest vertical departure from `1`, smallest coverage departure from `0.3`, and smallest `H`.

If no vertical candidate passes, stop with:

```text
ORBITAL_LOOKDEV_V2_VERTICAL_FAIL
```

### Stage 4D — optical finish

For the Stage 4C winner, capture:

```text
opticalDepthScale = 0.75 / 1 / 1.5
```

Stage 4D applies the final six-dimension visual gate:

```text
macro coherence
cloud/ground separation
depth layering
lighting/BSM read
opening identity stability
artifact freedom
```

Every dimension must score at least `1` at every progress. Rank already-passing candidates by aggregate score, then lighting/BSM read, depth layering, artifact freedom, smallest optical departure from `1`, smallest vertical departure from `1`, smallest coverage departure from `0.3`, and smallest `H`.

Select one exact value. Do not average candidates or introduce lighting/exposure compensation.

If no optical candidate passes, stop with:

```text
ORBITAL_LOOKDEV_V2_OPTICAL_FAIL
```

A Stage 4D pass produces:

```text
ORBITAL_STOCK_LOOKDEV_V2_WINNER
```

## 8. Visual acceptance for the V2 winner

The V2 winner must pass all four opening progress values at native frame `32`. It must show:

- a small number of coherent cloud systems at orbital scale;
- soft opacity layering rather than a surface-coloured mask;
- visible separation from land/ocean and readable elevation near the limb;
- stable sun-facing highlights and shaded interiors through the native lighting/BSM path;
- consistent identity across opening progress;
- no salt-and-pepper breakup, planar ribbon, cube-face seam, isolated analytic blob, or atmosphere-sized tower;
- no non-finite stage values or temporal disappearance.

The frozen NASA comparison board and Takram upstream image from the old plan retain their current hashes and remain reference inputs. Metrics assist review but cannot independently produce a visual pass.

The final Stage 4D visual-review schema contains only judgments that cannot be derived from buffers:

```text
macro coherence
cloud/ground separation
depth layering
lighting/BSM read
opening identity stability
artifact freedom
```

Reviewer identity, clean commit, candidate ID, viewport/DPR, frame, and reference hashes remain mandatory. Quantitative facts such as repeat noise, native-hit increase, signal fraction, retention, finite output, and GPU classification are generated from evidence and are not manually entered.

## 9. Final stock evidence and cost

The V2 winner receives fresh captures for:

- full final output;
- cloud raw and cloud raw off;
- sample-count debug and lossless native sample counts;
- pre-temporal cloud current;
- resolved history;
- BSM off;
- light shafts off;
- AerialPerspective/cloud-off final;
- all four opening progress values;
- same-route repeat at progress `0.06`.

GPU profiling repeats the authoritative `120 + 120` population for the final winner at every progress. Lookdev can change sample occupancy and early termination, so the Stage 2 policy cost does not substitute for final-winner cost.

Final classifications are:

- visual pass and maximum p95 `<= 3 ms`: `ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE`;
- visual pass and maximum p95 `> 3 ms` but `<= 4 ms`: `ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY`;
- visual pass and maximum p95 `> 4 ms`: `ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET`;
- invalid timer population: `ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED`.

Only `PRODUCTION_ELIGIBLE` may enter a homepage-promotion amendment.

## 10. V3 weather-adapter compatibility

V3 testing begins only after a stock V2 winner exists. Apply the exact stock winner's renderer, layer, sampling, and lookdev contract to the V3 texture adapter. Stock and V3 may differ only in the already enumerated adapter fields:

- texture identity and hash;
- mapping mode;
- repeat and offset;
- wrap and channel transform required to interpret the texture.

Do not reintroduce the prior V3 semantic-layer tuple, change turbulence to compensate for adapter repeat, or reopen step-policy selection.

The outcomes remain:

- `V3_WEATHER_ADAPTER_PASS`;
- `V3_WEATHER_ADAPTER_FAIL`.

A V3 failure does not invalidate the stock renderer or winner.

V3 compatibility is mandatory whenever Stage 4D produces `ORBITAL_STOCK_LOOKDEV_V2_WINNER`, irrespective of whether final stock timing later classifies it as `PRODUCTION_ELIGIBLE`, `QUERY_ONLY`, `OVER_BUDGET`, or `PERF_BLOCKED`. It is skipped only when the funnel terminates before a stock V2 visual winner exists.

## 11. Evidence architecture

Use separate immutable evidence roots:

```text
docs/lubirth-planetary-cloud-evidence/2026-08-13/
  takram-orbital-production-step-policy/
  takram-orbital-lookdev-v2/
```

The production-step root contains:

```text
manifest.json
metrics.json
metric-decision.json
visual-review.json
checkpoint.json
OUTCOME.md
captures/
raw/
gpu/
```

The lookdev-v2 root uses stage subdirectories plus a final winner directory. Every publisher write remains atomic and requires a tracked-clean implementation commit.

Decision flow:

```text
captured buffers and telemetry
  -> deterministic metric extractor
  -> metric-decision.json
  -> bounded human visual-review.json
  -> pure outcome resolver
  -> checkpoint.json + OUTCOME.md
```

The pure resolver consumes raw numeric summaries and the narrow visual review. It must not accept hand-authored booleans named `nativeSamplingIncreased`, `preTemporalSignalRecovered`, `repeatNoiseExceeded`, or equivalent quantitative claims.

## 12. Runtime identity and failure handling

The production candidate enum, `featureState`, and `output` enter `lookdevBaseKey`. A candidate, feature-state, or output change must therefore change `lookdevMountKey`, remount the complete composer subtree, and allocate new cloud current/history, shadow current/history, and resolve history resources before the frame-32 convergence count begins.

`runtimeEvidenceEpoch` continues to carry actual shader/build identity, matrices, render-target generations, runtime readback, and the mount key. Persistent drift retains the existing one-remount-then-block behaviour.

Failure rules:

- query, drift, remount, frame, reference, hash, readback, finite-output, or repeat failure is setup-blocked evidence;
- a sampling-health failure is not a lookdev failure;
- a GPU failure is not silently treated as a visual failure;
- unsupported timing blocks production selection but does not erase completed visual evidence;
- a visual failure does not authorize shader stepping changes unless Stage 2 identified the sampling policy as the cause;
- no failed stage authorizes homepage work.

## 13. Implementation boundaries

The initial public-policy path is expected to extend these existing responsibilities rather than create a second rendering stack:

- `TakramOrbitalSamplingCausality.ts`: retain the completed two-arm historical resolver unchanged;
- new production-step policy module: exact candidate parsing, values, estimate helpers, and outcome types;
- `TakramOrbitalLookdevContract.ts`: consume the resolved production candidate and publish it in the immutable contract;
- `TakramOrbitalLookdevIdentity.ts`: include candidate, feature state, and output diagnostic in pre-mount identity;
- `TakramOrbitalLookdevRuntime.ts`: apply and audit the exact runtime value and capture-only light-shafts state;
- `TakramStockParityPipeline.tsx`: expose the narrow query/diagnostic path and reuse existing remount, readback, and profiler controls;
- `TakramOrbitalLookdevEvidence.ts`: add machine-derived production-policy and V2 checkpoint transitions;
- `TakramOrbitalGpuProfiler.ts`: preserve total-only measurement as the production authority and implement independent sequential stage-only populations with complete same-frame stage sets;
- existing E2E publishers: reuse capture and hashing helpers while writing to new evidence roots.

The initial path must not change `@takram/three-clouds` shader source or package patch artifacts.

If and only if Stage 2 produces `ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING`, the follow-up design may specify a patched Takram API such as separate primary and shadow-length scale controls. That work requires a new shader/build fingerprint, patch hash, compatibility default preserving `1.01`, and dedicated source/build/type audits.

## 14. Test strategy

### Unit tests

- exact parsing and rejection of arbitrary production-step values;
- exact four candidate scales and documented step estimates;
- the historical causal resolver remains unchanged;
- production-step and diagnostic changes alter mount identity;
- missing production query preserves existing behaviour;
- runtime drift detects the wrong step or light-shafts state;
- metric extraction derives every quantitative gate from numeric evidence;
- each Stage 1 threshold boundary has pass/fail coverage;
- all public-policy and V2 terminal outcomes are reachable through the pure resolver;
- GPU winner ranking uses maximum p95 across all four progresses;
- values between `3` and `4 ms` remain query-only;
- unsupported/disjoint timer populations cannot produce a winner;
- full and light-shafts-off total/stage populations remain separate and non-nested;
- BSM combined p95 is derived from same-frame current-plus-resolve sums;
- Stage 4A/4B cannot fail on deferred separation, depth, or lighting dimensions;
- every Stage 4D visual winner, including production-eligible, query-only, over-budget, and performance-blocked stock outcomes, requires a V3 terminal result;
- old Stage B checkpoint cannot unlock successor stages.

### System Chrome verification

- all four exact candidate routes reach native frame `32`;
- candidate changes remount the complete composer and reset all histories;
- `full`, `light-shafts-off`, and `bsm-off` preserve the primary hit mask within repeat noise;
- diagnostic teardown restores native high-preset features;
- total-only and stage-only queries remain mutually exclusive, non-nested, and complete valid populations;
- formal capture writes atomically only from a tracked-clean commit;
- rejected stages cannot invoke lookdev-v2 or homepage work.

### Regression verification

- complete orbital unit suite;
- relevant System Chrome suites;
- `@miralith/lubirth-hero` typecheck;
- `@miralith/site` typecheck;
- production build;
- targeted lint for touched files;
- evidence hash/length verification after every formal publication.

## 15. Completion boundary

This successor design is complete only when it produces one of:

1. `ORBITAL_STOCK_LOOKDEV_V2_PRODUCTION_ELIGIBLE`, plus a terminal `V3_WEATHER_ADAPTER_PASS/FAIL` result and complete evidence;
2. `ORBITAL_STOCK_LOOKDEV_V2_QUERY_ONLY`, plus a terminal `V3_WEATHER_ADAPTER_PASS/FAIL` result and complete evidence, preserving a valid stock visual winner while explicitly blocking homepage promotion;
3. one explicit terminal sampling-policy failure:
   - `ORBITAL_PRODUCTION_SAMPLING_SETUP_BLOCKED`;
   - `ORBITAL_PUBLIC_STEP_POLICY_NEEDS_DECOUPLING`;
   - `ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL`;
   - `ORBITAL_PUBLIC_STEP_POLICY_OVER_BUDGET`;
   - `ORBITAL_PUBLIC_STEP_POLICY_PERF_BLOCKED`;
4. one explicit terminal lookdev/performance failure:
   - `ORBITAL_LOOKDEV_V2_MORPHOLOGY_FAIL`;
   - `ORBITAL_LOOKDEV_V2_COVERAGE_FAIL`;
   - `ORBITAL_LOOKDEV_V2_VERTICAL_FAIL`;
   - `ORBITAL_LOOKDEV_V2_OPTICAL_FAIL`;
   - `ORBITAL_STOCK_LOOKDEV_V2_OVER_BUDGET`, plus a terminal `V3_WEATHER_ADAPTER_PASS/FAIL` result and complete evidence;
   - `ORBITAL_STOCK_LOOKDEV_V2_PERF_BLOCKED`, plus a terminal `V3_WEATHER_ADAPTER_PASS/FAIL` result and complete evidence;

No outcome in this design directly changes the homepage. Production integration, camera-cut history behaviour, and final rollout remain a separate amendment after a `PRODUCTION_ELIGIBLE` stock winner exists.
