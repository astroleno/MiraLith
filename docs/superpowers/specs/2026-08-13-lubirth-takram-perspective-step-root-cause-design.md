# LuBirth Takram Perspective-Step Root-Cause Diagnostic Design

**Status:** IN REVIEW — implementation and capture closed

**Date:** 2026-08-13

**Scope:** Query-only Takram parity route and capture-only instrumentation

**Prerequisite evidence:** `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev/`

## 1. Decision

The bounded orbital lookdev remains stopped after Stage B. Stage C–F, V3 compatibility, GPU promotion, and production parameter changes remain unauthorized.

The next permitted work is a separate two-stage root-cause diagnostic:

1. **Uniform causal sweep:** vary the existing native `perspectiveStepScale` while measuring the actual primary-ray entry distance, initial step, first jittered sample distance, native sample count, and the complete raw-to-final signal chain.
2. **Mechanism isolation:** only if the first stage restores raw cloud signal, use capture-only shader instrumentation to separate initial primary stepping, subsequent primary stepping, and shadow-length stepping.

The uniform sweep may establish that perspective stepping has a causal effect. It cannot by itself establish that the first sample alone crosses the thin cloud layer because the upstream uniform is reused at four sites:

```text
initial primary step
inside-layer / empty-space primary step growth
post-hit primary step growth
shadow-length step growth
```

No result from this diagnostic is a production value. A visual or performance promotion requires a later design and checkpoint.

## 2. Existing evidence and hypothesis

Stage B produced finite, stable output but no reviewable cloud mass across all 12 orbital morphology/coverage candidates. At `progress=0.06`, the largest coverage changes affected only about `0.023–0.025%` of RGBA channels. The frozen result is:

```text
BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED
```

The installed Takram `0.7.6` primary march computes:

```glsl
float stepSize = minStepSize +
  (perspectiveStepScale - 1.0) * rayNearFar.x;
float rayDistance = stepSize * jitter * 2.0;
```

The current orbital contract keeps `minStepSize=50 m`, `perspectiveStepScale=1.01`, and native thin layers whose principal R/G tops are about `1.4/2.2 km`. The opening camera is approximately `3.51–3.84 Mm` above the relevant entry surface, so the native first step is on the order of `35–39 km`. This makes primary stepping the strongest current root-cause candidate, but not yet a proven cause.

The earlier visible `S=120` scale-similarity result is only a health control. It simultaneously thickens layers and changes other physical lengths, so it cannot prove that stepping is the cause. It remains useful because it demonstrates that the same route, assets, renderer, and output chain can expose non-zero stock cloud signal.

## 3. Frozen experiment identities

### 3.1 Thin-layer causal target

The full sweep uses the strongest bounded Stage B presentation attempt:

```text
input=stock
view=opening
orbitalPreset=h120
orbitalCoverage=0.55
verticalScale=1
opticalDepthScale=1
```

`h120` supplies the largest bounded horizontal morphology and `0.55` the highest tested coverage while retaining the same native thin layer, density, min/max step sizes, iteration limit, BSM, temporal resolve, and atmosphere composition as Stage B. Selecting it maximizes the chance of observing signal without changing the suspected sampling mechanism.

The sweep is captured at the authoritative opening progress values:

```text
0.00 / 0.06 / 0.12 / 0.18
```

Any causal conclusion initially applies only to this target. After a sweep winner exists, the same winning step configuration must be confirmed on `h40` and `h80` at all four progress values before the result may be described as a Stage-B-wide mechanism.

### 3.2 Healthy positive control

Every capture batch includes the existing signal-bearing control:

```text
input=stock
view=opening
cloudScale=120
cloudCoverage=parity
stockWeather=similarity
```

The control keeps its frozen native `perspectiveStepScale=1.01`; it is not part of the step sweep. It is captured at the same progress, viewport, native frame, STBN slice, diagnostics, and repeat count as the thin-layer target.

If this control does not reproduce finite non-zero raw signal and native samples, the batch is `DIAGNOSTIC_SETUP_BLOCKED`. Failure of the positive control may not be reported as evidence against the stepping hypothesis.

### 3.3 Negative and native controls

For the thin-layer target, every batch also preserves:

- native `perspectiveStepScale=1.01`;
- `cloud-raw-off` at the same immutable query identity;
- instrumentation-disabled/native-shader identity capture;
- two independent clean document mounts at the same frame/STBN identity.

Instrumentation-disabled output must remain within the existing same-route repeat noise floor. An instrumentation patch that changes disabled output invalidates the batch.

## 4. Uniform causal sweep

### 4.1 Candidate values

The ordered sweep is:

| `perspectiveStepScale` | Approximate unjittered initial step at `rayNearFar.x=3.51–3.84 Mm` | Role |
| ---: | ---: | --- |
| `1.01` | `35.15–38.45 km` | Native baseline |
| `1.001` | `3.56–3.89 km` | Coarse over-layer control |
| `1.00027` | `1.00–1.09 km` | Upper edge of target band |
| `1.00024` | `0.89–0.97 km` | Target band |
| `1.00018` | `0.68–0.74 km` | Target band |
| `1.00012` | `0.47–0.51 km` | Lower edge of target band |
| `1.00010` | `0.40–0.43 km` | Below-band control |
| `1.00005` | `0.23–0.24 km` | Fine-step control |

These are planning estimates only. The evidence must use measured per-pixel `rayNearFar.x`; camera height is not an acceptable substitute.

The actual unjittered and first-sample distances are:

```text
initialStep = minStepSize + (perspectiveStepScale - 1) * rayNearFar.x
firstSampleDistance = initialStep * jitter * 2
```

The setup gate requires the measured distribution to prove that at least two candidates place the median unjittered initial step within `0.5–1.0 km`. If the real ray population does not satisfy that requirement, candidate selection is invalid and must be redesigned before capture proceeds.

### 4.2 Capture-only route contract

The parity query adds a strict diagnostic tuple that is unavailable outside `view=opening`, stock input, and an explicit orbital or positive-control identity:

```text
stepDiagnostic=uniform
perspectiveStepScale=<one frozen candidate>
```

Unknown values, partial tuples, production routes, V3 input, and combinations with morphology legacy fixtures fail closed. The positive control accepts `stepDiagnostic=measure` only and never accepts a step override.

The override is applied after the native high preset and orbital resolver, read back from the actual material uniform, included in the history/mount identity, and removed on unmount. It must not enter the product resolver or homepage.

## 5. Required measurements

### 5.1 Ray-entry and initial-step readback

A project-owned capture-only instrumentation module snapshots these values for every shell-intersecting pixel:

```text
rayNearFar.x
rayNearFar.y
maxRayDistance
minStepSize
perspectiveStepScale
initialStep
jitter
firstSampleDistance
```

The module writes a dedicated native-current diagnostic encoding; it does not infer distances from screenshots. The persisted manifest records the encoding scale, precision, origin, dimensions, valid mask, source shader hash, instrumented shader hash, and decoded distributions:

```text
min / p05 / p25 / p50 / p75 / p95 / max / mean
```

Distributions are calculated over valid shell-intersecting pixels and separately over pixels that later produce at least one rough-weather sample. The evidence stores the raw readback buffer so another implementation can recompute every percentile.

### 5.2 Native sample-count readback

Use the existing repaired native sample-count path, preserving primary/shape/detail counts and the hit mask. Persist:

```text
valid pixel count
non-zero primary-sample pixel fraction
primary sample mean / p50 / p75 / p95 / max
shape and detail sample summaries
hit-mask fraction
iteration-cap pixel fraction
```

The primary count is the native count accumulated by `marchClouds`; a screenshot colour decoded after composition is not acceptable.

### 5.3 Signal-chain readback

Every sweep level, progress, and clean-mount repeat must include:

1. `cloud-raw` plus paired `cloud-raw-off`;
2. native `sample-count-debug` readback;
3. native pre-temporal current target;
4. native resolved-history target;
5. final output after AerialPerspective and output transfer.

For each signal stage, persist finite/non-finite count, mean and peak luma/alpha where meaningful, non-zero pixel fraction, and paired cloud-on minus cloud-off mean/peak absolute difference. The raw binary buffers, exact-frame PNGs, and decoded metric JSON remain linked by SHA-256.

`cloud-raw` is the causal gate. A final-output change without raw recovery does not pass the stepping hypothesis.

### 5.4 Frame and repeat identity

Every capture uses:

```text
1440 × 960 CSS and physical pixels
DPR 1
native cloud/resolve/shadow frame 32
the same temporal jitter index
the same STBN slice
two independent clean document mounts
```

The manifest records complete requested/readback contracts, camera/projection/Earth matrices, history epoch, mount/runtime identity, all six cloud/shadow allocation generations, shader/build/package/patch hashes, and capture hashes. A mismatch blocks the batch instead of becoming measurement noise.

## 6. Uniform-sweep decision rules

For each scalar metric, repeat noise is the maximum absolute difference between the two clean native-control repeats at the same progress. Define:

```text
epsilon(metric) = max(repeatNoise(metric), numericQuantizationFloor(metric))
```

The ordered target-band sequence is:

```text
1.00027 → 1.00024 → 1.00018 → 1.00012
```

As initial step decreases, all of the following must be non-decreasing within `epsilon` in both independent repeats:

- non-zero primary-sample pixel fraction;
- primary sample mean;
- `cloud-raw` non-zero pixel fraction;
- `cloud-raw` versus `cloud-raw-off` mean absolute difference.

Both endpoint changes must exceed `3 × epsilon`: one for a native sample-count metric and one for a `cloud-raw` metric. Raw recovery additionally requires:

```text
cloudRawOnOffMeanAbs > max(5 × repeatNoise, numericQuantizationFloor)
nonZeroCloudRawPixelFraction >= 0.001
```

The positive `S=120` control must independently meet the same finite/non-zero signal floor. The target does not have to match the positive control's magnitude; the control proves only that the capture pipeline is healthy.

The uniform sweep produces exactly one of:

| Result | Meaning | Next action |
| --- | --- | --- |
| `DIAGNOSTIC_SETUP_BLOCKED` | Identity, positive control, precision, or target-band coverage failed | Repair evidence setup only |
| `PERSPECTIVE_STEPPING_CAUSAL_MECHANISM_UNRESOLVED` | Sample count and raw signal recover monotonically | Open mechanism isolation only |
| `PERSPECTIVE_STEPPING_HYPOTHESIS_REJECTED` | Valid population has no repeatable monotonic native-count/raw recovery | Stop; do not tune step values |
| `PERSPECTIVE_STEPPING_PROGRESS_LOCALIZED` | Recovery exists at only part of the opening path | Preserve per-progress result; do not generalize |

Pre-temporal, history, and final measurements locate later loss but cannot rescue a failed raw gate. Stage C–F remain closed for every uniform-sweep outcome.

## 7. Mechanism isolation

Mechanism isolation is authorized only after a committed uniform-sweep result of `PERSPECTIVE_STEPPING_CAUSAL_MECHANISM_UNRESOLVED`.

### 7.1 Split capture-only controls

The diagnostic shader replaces the overloaded uniform with three capture-only values:

```text
initialPrimaryStepScale
subsequentPrimaryStepScale
shadowLengthStepScale
```

They map only to:

```text
initialPrimaryStepScale
  -> minStepSize + (scale - 1) * rayNearFar.x

subsequentPrimaryStepScale
  -> inside-layer, empty-weather, and post-hit primary step growth

shadowLengthStepScale
  -> marchShadowLength step growth
```

The chosen small value is the largest uniform-sweep value that passed all raw/count monotonic gates. Selecting the largest passing value avoids silently choosing the most expensive fine-step setting.

### 7.2 Isolation matrix

At every opening progress and both clean repeats, capture:

| Case | Initial primary | Subsequent primary | Shadow length |
| --- | ---: | ---: | ---: |
| `native` | `1.01` | `1.01` | `1.01` |
| `initial-only` | winner | `1.01` | `1.01` |
| `subsequent-only` | `1.01` | winner | `1.01` |
| `primary-both` | winner | winner | `1.01` |
| `all-small` | winner | winner | winner |

Every case receives the same ray geometry, native sample-count, cloud-raw, pre-temporal, resolved-history, and final-output evidence as the uniform sweep.

### 7.3 Mechanism conclusions

| Result | Required evidence |
| --- | --- |
| `INITIAL_PRIMARY_OVERSTEP_SUPPORTED` | `initial-only` independently restores monotonic native samples and raw signal while `subsequent-only` does not |
| `SUBSEQUENT_PRIMARY_STEPPING_CAUSAL` | `subsequent-only` restores raw signal without a small initial step |
| `COUPLED_PRIMARY_STEPPING_CAUSAL` | Neither single factor passes, but `primary-both` does |
| `SHADOW_LENGTH_DOWNSTREAM_CONFOUNDER` | `primary-both` and `all-small` have equivalent raw signal, but later lighting/final stages materially differ beyond repeat noise |
| `PERSPECTIVE_STEP_CAUSAL_MECHANISM_UNRESOLVED` | Valid results do not match a stable pattern across repeats/progress |

`INITIAL_PRIMARY_OVERSTEP_SUPPORTED` is evidence for the first-sample mechanism, not proof that it is the only rendering defect. BSM, AerialPerspective, and temporal resolve remain separate downstream gates.

Before any Stage-B-wide wording, the selected mechanism case is repeated for `h40` and `h80`. A failed confirmation is reported as morphology-preset-localized evidence.

## 8. Instrumentation boundary

All shader work is project-owned, capture-only, and installed at runtime by exact audited string replacements. The instrumentation must:

- refuse installation if an expected source fragment is missing or occurs more than once;
- store and hash both the original and instrumented shader;
- restore the original source and remove all diagnostic uniforms on cleanup;
- key-remount the complete Clouds/AerialPerspective composer when a diagnostic tuple changes;
- prove disabled output remains inside the same-route repeat noise floor;
- never edit `node_modules`, the pnpm patch, product defaults, or homepage code;
- never run outside the explicit parity diagnostic route.

The runtime fingerprint must include the three split scales and instrumentation hash. A request/readback mismatch is `DIAGNOSTIC_SETUP_BLOCKED`.

## 9. Cost and iteration-limit boundary

No GPU timing or production-acceptability judgment occurs before raw recovery.

After a mechanism case restores raw signal, a diagnostic-only cost audit may record:

- actual primary iteration distribution and the fraction reaching the `500` iteration cap;
- cloud-current GPU time using the existing valid/disjoint timer protocol;
- full native cloud/resolve/AerialPerspective cost;
- native baseline and positive-control cost at the same frame and viewport.

This audit answers whether the recovered diagnostic is computationally plausible. It does not authorize a production step scale, raise the iteration limit, or promote the renderer.

## 10. Evidence layout

The implementation publishes atomically under:

```text
docs/lubirth-planetary-cloud-evidence/2026-08-13/
  takram-perspective-step-root-cause/
    checkpoint.json
    manifest.json
    checksums.sha256
    uniform-sweep/
      raw/
      captures/
      measurements.json
      contact-sheets/
    mechanism-isolation/
      raw/
      captures/
      measurements.json
      contact-sheets/
    cost/
      profile.json
```

`mechanism-isolation/` and `cost/` are absent until their preceding gates authorize them. The checksum index uses repository-root-relative paths and verifies from the repository root.

## 11. Stop rules

- Do not reopen orbital Stage C–F.
- Do not change coverage, vertical thickness, optical depth, weather, mip, lighting, BSM, temporal, atmosphere, exposure, or output transform during the sweep.
- Do not claim that a uniform sweep proves first-step overrun.
- Do not claim that visible `S=120` proves the thin-layer mechanism.
- Do not evaluate performance before raw signal recovery.
- Do not edit or promote production parameters from diagnostic evidence.
- Stop on invalid control, identity drift, non-finite readback, missing raw buffers, frame/STBN mismatch, or failed independent repeat.

## 12. Acceptance criteria

The design is ready for implementation planning only when review confirms:

- the sweep covers the measured `0.5–1.0 km` target region rather than relying on camera-height estimates;
- actual per-pixel `rayNearFar.x`, initial step, and jittered first-sample distributions are durable evidence;
- every level includes raw, native sample-count, pre-temporal, resolved-history, and final evidence;
- fixed frame/STBN identity is repeated on a clean mount;
- `S=120` remains a healthy positive control rather than causal proof;
- monotonic sample-count and raw-signal gates precede mechanism claims;
- initial, subsequent, and shadow-length stepping have separate owners in the isolation stage;
- no result automatically opens Stage C–F or production promotion.
