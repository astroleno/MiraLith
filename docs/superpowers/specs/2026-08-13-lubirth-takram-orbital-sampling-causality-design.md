# LuBirth Takram Orbital Sampling Causality A/B Design

**Status:** Approved; ready for implementation

**Date:** 2026-08-13

**Scope:** Query-only Takram parity route; stock `h120 / coverage 0.55 / vertical 1 / optical 1`

**Amends:** `2026-08-12-lubirth-takram-orbital-lookdev-tuning-design.md`

## 1. Decision

Run one minimal two-point causal A/B before any further orbital lookdev stage:

```text
control:   perspectiveStepScale = 1.01
treatment: perspectiveStepScale = 1.0001
```

Everything else remains frozen. This experiment asks whether the native Takram perspective step inherited from a near-ground camera causes the current orbital camera to skip the unscaled thin cloud layers.

This is a diagnostic experiment, not a new lookdev funnel and not a production-parameter promotion. The existing Stage C–F sequence remains locked. No result from this A/B may be merged into the homepage without a separate design amendment.

## 2. Corrected hypothesis

The prior design froze step parameters because every active cloud shell remained within Takram's `200 km` maximum ray length. That condition is necessary but insufficient. Takram computes the initial primary step as:

```text
initialStep = minStepSize + (perspectiveStepScale - 1) * rayNearFar.x
```

The current opening camera is approximately `3,578 km` above the Earth radius. With `minStepSize=50 m`, the current `1.01` value produces an initial step of approximately `35.8 km` in the near-nadir region and can exceed `70 km` for limb rays. The explicit stock R/G/B layer thicknesses are only `0.65 / 1.2 / 0.5 km`.

At `1.0001`, the corresponding estimate is approximately `0.41 km` near nadir and `0.81 km` near the limb. This places primary sampling in the same order of magnitude as the layer thickness without changing layer geometry, density, weather, lighting, camera, temporal resolve, or composition.

The hypothesis is:

> If primary ray steps are skipping the thin stock layers, changing only `perspectiveStepScale` from `1.01` to `1.0001` will increase native cloud-hit/sample populations and restore structured pre-temporal cloud signal. The exact-stage evidence will then show whether that signal survives temporal resolve and final composition.

The existing visible `S=80/120/160` evidence supports a sampling-domain mismatch but does not prove this single-factor hypothesis because similarity scaling changed several physical and sampling fields at once.

## 3. Frozen contract

Both arms use:

```text
input               stock
view                opening
preset              h120
coverage            0.55
verticalScale       1
opticalDepthScale   1
qualityPreset       high
nativeFrame         32
progress            0.00 / 0.06 / 0.12 / 0.18
viewport            1440 × 960 physical/CSS pixels
DPR                 1
browser              headed System Chrome on the current reference machine
```

The two arms may differ only in:

```text
clouds.perspectiveStepScale
query identity derived from that value
composer/runtime generations caused by the required remount
outputs and measurements causally downstream of that value
```

The experiment must prove that all other requested and runtime-readback fields are identical after removing those enumerated differences. A mismatch blocks the experiment as `ORBITAL_SAMPLING_SETUP_BLOCKED` rather than producing a causal result.

The query parameter is an exact enum, not a free-form number:

```text
orbitalStepScale=control   -> 1.01
orbitalStepScale=treatment -> 1.0001
```

Missing `orbitalStepScale` preserves the existing `1.01` behavior. The parameter is valid only with the complete orbital lookdev query and may not combine with legacy `cloudScale`.

## 4. Implementation boundaries

The implementation reuses the existing public `CloudsEffect.clouds.perspectiveStepScale` runtime field, runtime drift gate, full-composer remount identity, exact temporal frame lock, native sample-count instrumentation, and stage-readback path.

It must not:

- patch Takram GLSL or change the step formula;
- change `minStepSize`, `maxStepSize`, iteration counts, or ray limits;
- change any layer altitude, thickness, density, coverage, weather repeat, shape/detail repeat, turbulence, light, BSM, temporal, AerialPerspective, HDR, exposure, or output field;
- add adaptive per-ray stepping;
- run the old Stage C–F funnel;
- treat a larger sample count alone as visual success.

The sampling experiment should remain isolated from the already-published Stage 0/A/B evidence. It receives a separate evidence root:

```text
docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-sampling-causality/
```

## 5. Required evidence

For each arm and each of the four opening progress values, capture the following at the same native frame contract:

1. `cloud-raw` PNG;
2. `cloud-raw-off` PNG as the exact raw-output control used to isolate cloud signal;
3. `sample-count-debug` PNG and lossless native sample-count buffer;
4. `stage-readback` final PNG;
5. lossless pre-temporal cloud-current buffer;
6. lossless resolved-history buffer;
7. lossless final-output buffer.

Repeat both arms at `progress=0.06` to establish the same-route noise floor. A non-deterministic repeat invalidates paired claims until the difference is quantified and incorporated into the comparison.

Every capture records:

- clean commit and browser/GPU identity;
- full requested contract and runtime readback;
- `cameraHeightMeters` and the estimated near-nadir/limb initial-step range;
- frame, cloud, resolve, shadow, jitter, STBN, and history-epoch identities;
- complete layer and render-target fingerprints;
- all screenshot and binary artifact SHA-256 hashes.

Contact sheets must place control and treatment side by side for each progress, with separate sheets for cloud raw, sample count, and final output. Binary buffers remain authoritative for numerical metrics.

## 6. Analysis and causal outcomes

The analysis reports paired control/treatment values at every progress for:

- native hit-pixel count;
- primary sample mean, p50, and p95 over native hit pixels;
- pre-temporal signal-pixel fraction, alpha, and signal luma;
- resolved-history signal-pixel fraction, alpha, and signal luma;
- resolved/pre-temporal retention;
- paired control/treatment final-output difference and full-frame difference;
- connected cloud-signal area and fragmentation diagnostics, without allowing either to create a visual pass by itself.

The experiment produces exactly one of these outcomes:

### `ORBITAL_SAMPLING_CAUSALITY_CONFIRMED`

Across all four progress values, the treatment produces a repeat-noise-exceeding increase in native hit/sample evidence and structured pre-temporal cloud signal, and the signal remains observable in resolved history and final output. This confirms the sampling-domain root cause for the current no-cloud result. It authorizes a separate production-step design; it does not directly promote `1.0001`.

### `ORBITAL_SAMPLING_CAUSALITY_PARTIAL_DOWNSTREAM_BLOCKED`

The treatment consistently restores native hit/sample evidence and structured pre-temporal signal, but the signal is lost or reduced to an unreviewable result in resolved history or final composition. Sampling is a confirmed upstream contributor; the next experiment must isolate the first downstream stage that loses the signal.

### `ORBITAL_SAMPLING_CAUSALITY_NOT_SUPPORTED`

The treatment does not produce a consistent repeat-noise-exceeding recovery in native hit/sample evidence and pre-temporal signal. The single-factor step hypothesis is rejected for this frozen candidate. No further step sweep is authorized by this result.

### `ORBITAL_SAMPLING_SETUP_BLOCKED`

Any query, drift, remount, frame-lock, readback, fingerprint, reference, finite-output, hash, or repeat-noise prerequisite fails. This is an invalid experiment rather than evidence for or against the hypothesis.

Visual review remains mandatory. A sample-count increase without coherent cloud-raw structure cannot be labeled `CONFIRMED`; it is reported as a measured sampling change under `NOT_SUPPORTED` unless structured pre-temporal signal also recovers.

## 7. Architecture and data flow

The implementation adds one small sampling-contract module responsible for parsing the two enum values, resolving the numeric value, estimating the documented step range, and classifying the paired result. The existing orbital lookdev contract accepts the resolved value and remains the single source applied to runtime.

```text
query enum
  -> sampling resolver
  -> orbital lookdev contract
  -> lookdev identity/remount
  -> CloudsEffect public runtime field
  -> drift/readback/fingerprint gates
  -> exact-frame diagnostics
  -> paired evidence analyzer
  -> one terminal causal outcome
```

The E2E publisher orchestrates captures and writes evidence atomically. Numerical buffer decoding and paired classification live in pure modules with unit tests; Playwright should only drive the browser, verify runtime invariants, and collect artifacts.

## 8. Test strategy

Implementation follows red-green TDD:

1. parser/resolver tests reject arbitrary numeric step values and preserve the existing default;
2. contract tests prove only `perspectiveStepScale` differs between control and treatment;
3. identity/runtime tests prove the change forces a complete remount and drift blocks an incorrect readback;
4. evidence tests cover all four causal outcomes, repeat-noise handling, and exact paired-field normalization;
5. a non-capture System Chrome test proves both routes reach native frame 32 and publish sample/stage readbacks;
6. the formal capture runs only from a tracked-clean implementation commit and publishes atomically;
7. all package typechecks and the complete orbital unit/System Chrome regression set must remain green.

## 9. Handoff rule

The experiment ends after publishing its terminal causal outcome. If it confirms or partially confirms sampling causality, the next design may derive an orbital step policy and then revisit vertical/optical lookdev with a healthy same-camera baseline. If it does not support the hypothesis, investigation returns to the first stage with missing signal; it does not resume the old coverage funnel or infer a weather-source failure.
