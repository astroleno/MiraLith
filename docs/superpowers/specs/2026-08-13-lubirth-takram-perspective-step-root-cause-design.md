# LuBirth Takram Perspective-Step Root-Cause and Successor Architecture Design

**Status:** IN REVIEW — implementation and capture closed

**Date:** 2026-08-13

**Scope:** Architecture-only successor gate from root-cause isolation through bounded lookdev, V3 compatibility, and homepage-promotion readiness

**Prerequisite evidence:**

- `docs/lubirth-planetary-cloud-evidence/2026-08-12/takram-orbital-lookdev/`
- `docs/lubirth-planetary-cloud-evidence/2026-08-13/takram-orbital-sampling-causality/`

**Review lineage:** this unified candidate is based on
`f589d677b0523004016bd819e298ee88f38a755d`, which contains the qualified
evidence commit `8dc86740024db2f48cd58a0ecd0a3c9739686285` and the four-file terminal
status amendment `40b1270914fdcdb4085ea4e6c8b1fc49d8ae4682`. The historical two-arm
contract (`4bf52a9`) and runtime wiring (`52cc556`) are ancestors of the evidence
lineage, but they are not part of the authorized successor implementation scope
and cannot satisfy this design's eight-level sweep or three-owner policy. The
separate production-sampling draft on this lineage is retained as a historical
design record and is superseded for authorization by this document.

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

### 1.1 Successor authorization sequence

This design replaces the old one-way Stage A–F funnel with six explicit gates.
Only Stage 1 is the root-cause diagnostic specified in detail by Sections 3–8;
Stages 2–5 are frozen downstream contracts that require their own implementation
plan after this design passes review. Passing an earlier stage authorizes planning
for the next stage, not production use.

#### Stage 0 — evidence governance and scope

Stage 0 is a document/evidence gate and performs no new rendering:

- the old orbital lookdev is `TERMINATED AFTER STAGE B` with
  `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED`;
- the two-arm sampling experiment is `CLOSED` with
  `ORBITAL_SAMPLING_CAUSALITY_CONFIRMED` for stock
  `h120 / coverage 0.55 / vertical 1 / optical 1` only;
- commit `0976f7df6f4293d709412b7ab3cc62fb5a547a41` published the
  causal evidence and `8dc86740024db2f48cd58a0ecd0a3c9739686285`
  qualified its scope;
- commit `40b1270914fdcdb4085ea4e6c8b1fc49d8ae4682` closed both the old
  lookdev and the two-arm implementation/design records on the same evidence
  lineage;
- the result revokes the old Stage A/B captures as authorization evidence
  because their healthy-sampling assumption is false;
- revocation is not a claim that h40, h80, or every coverage independently
  reproduced the h120 mechanism.

Stage 0 passes only when both superseded designs and implementation plans record
their terminal state and evidence identity. It cannot produce a Stage-B-wide
mechanism statement or a production sampling baseline.

#### Stage 1 — three-owner mechanism isolation

Stage 1 consists of the uniform sweep and mechanism isolation in Sections 4–7.
The overloaded Takram value must be separated into three independently owned
capture-only controls before any production API is designed:

```text
initialPrimaryStepScale
subsequentPrimaryStepScale
shadowLengthStepScale
```

The original `1.0001` treatment remains an historical treatment/control and one
possible measured sweep point. It is not a default, a production candidate by
inheritance, or permission to expose a two-owner `primary/shadow` API. Stage 1
must select candidates through the Section 6 thresholds, attribute the effect
through the Section 7 five-case isolation matrix, and record actual primary loop,
termination, and shadow evidence.

After one mechanism case passes for h120, repeat the winning three-owner case for
h40 and h80 at `progress=0.00/0.06/0.12/0.18`, both clean repeats, using the same
candidate-level recovery rules. Until both presets pass, the only permitted
wording is `h120-local sampling causality`; a failed confirmation is preserved as
`morphology-preset-localized`, and Stage-B-wide wording remains prohibited.

#### Stage 2 — healthy-sampling stability validation

The initial Stage-2 invocation validates each Stage-1 policy candidate at
`coverage=0.55 / verticalScale=1 / opticalDepthScale=1` on h40, h80, and h120.
A Stage-4 feedback invocation substitutes the exact proposed
morphology/coverage/vertical/optical tuple and holds it fixed while sampling
policies vary. In either invocation, a candidate is `TEMPORALLY_HEALTHY` only
when both rails pass:

1. **Exact-frame rail.** Capture both clean repeats at
   `progress=0.00/0.06/0.12/0.18`, native frame 32, fixed STBN/jitter identity,
   with the complete ray geometry, primary/shape/detail sample counts,
   loop/termination, BSM current/history, cloud current/history, and final-output
   buffers. Apply the complete Section 6.1 causal gate plus the absolute-health
   table below.
2. **Continuous traversal rail.** For every policy/preset/tuple, run four clean
   traversals: policy repeats A/B and an all-`1.01` native-reference A/B. Each
   traversal owns one document and one composer/history epoch. Hold `progress=0`
   for 32 warm-up frames, then advance the authoritative
   `OPENING_TIMELINE_DURATION=7.2 s` from `progress=0` through `1` in 432 equal
   60 Hz intervals (433 endpoint-inclusive rendered frames). Do not remount,
   reset/reallocate cloud or shadow history, reseed STBN, seek independently, or
   skip a timeline frame. The four documents use distinct `documentRunId` and
   mount/runtime identities but the same viewport, progress schedule, camera,
   first STBN slice, and jitter schedule; numeric allocation generations remain
   document-local and are not compared across documents.

The traversal manifest stores every progress value and camera/projection/Earth
matrix, all cloud/shadow frame counters and allocation generations, and per-frame
raw/current/history/final/BSM metrics. At each frame, the native-reference A
shell-intersection mask is the fixed population for the native-reference B and
both policy repeats; dimension/origin/projection mismatch is setup-blocked. Any
mount, history epoch, allocation, resource, viewport, visibility, or context
generation change during a traversal is `CONTINUOUS_TRAVERSAL_SETUP_BLOCKED`.

The four exact progress frames still apply the complete Section 6.1 causal
recovery gate. Intermediate frames use a separate absolute-health contract and
do not pretend to inherit the four-progress aggregation rule. Every exact or
traversal policy frame passes absolute health only when both policy repeats
independently satisfy:

```text
finite pixel fraction for every lossless stage = 1
sample-count structural invariants             pass
primaryMarchTexelCount                         > 0 when the shell mask is non-empty
iterationCapPixelFraction                      <= 0.01
nonZeroCloudRawPixelFraction                   >= 0.001
resolved/pre-temporal signal retention         within [0.90, 1.10]
resolved/pre-temporal signal-luma retention    within [0.80, 1.20]
```

All denominators use that frame's fixed shell mask, and every metric retains the
Section 5 encoding, lattice, uncertainty, and recomputation rules. For
diagnosis, compute per-frame `countEffect` and `rawEffect` against the matched
native-reference repeat using Section 6.1. A `CAUSAL_SIGNAL_COLLAPSE` occurs when
either signed effect is below its negative epsilon in both repeat pairs for
three consecutive frames. Intermediate frames are never required to satisfy the
Stage-1 `three-of-four including 0.06` eligibility rule.

Automated traversal analysis derives, from raw buffers rather than review input:

- non-finite, sample/iteration-cap, and signal-drop events;
- every absolute-health field above plus paired native-reference count/raw
  effects and `CAUSAL_SIGNAL_COLLAPSE` runs;
- cloud-current to resolved-history retention and residual masks;
- resolved signal outside the one-pixel-dilated union of current masks as a
  ghosting population;
- per-frame second differences of cloud-current, resolved-history, final-output,
  BSM-current, and BSM-history luma as popping/shimmer populations;
- repeat differences for every scalar trajectory and flagged frame.

For each trajectory, derive the bounded noise envelope from the two complete
clean traversals using the larger of numeric quantization floor and per-frame
repeat difference. A hard automated instability is any non-finite/setup event,
any exact-anchor Section 6.1 failure, any intermediate absolute-health failure,
any `CAUSAL_SIGNAL_COLLAPSE`, a ghosting population above its declared envelope
for three consecutive frames, or a popping/shimmer
second-difference excursion above `median + 8 × MAD` and above `3 ×` its repeat
envelope in both traversals. The implementation plan must persist the exact
pixel populations and recomputation inputs; it may not replace these rules with
a screenshot-only judgment.

Human review receives the full-speed traversal, half-speed traversal, and flagged
frame strips and may submit only visual scores, hard visual flags
(`popping/ghosting/BSM-shimmer`), and notes. Both automated rails and the visual
hard-flag review must pass before the candidate may be called time-stable.

#### Stage 3 — production sampling-policy selection and cost

The initial Stage-3 invocation may compare only Stage-2 `TEMPORALLY_HEALTHY`
three-owner policies at `vertical=1 / optical=1`. A Stage-4 feedback invocation
may compare only policies that passed both Stage-2 rails for that exact proposed
vertical/optical tuple. Stage 3 freezes the existing production-cost protocol
rather than using an informal GPU check:

```text
hardware: Apple M4 reference machine
browser: headed System Chrome, production build
viewport: 1440 × 960 CSS and physical pixels, DPR 1
warmup: 120 frames after every policy/morphology mount reaches readiness
population: 120 valid non-disjoint GPU samples
total interval: BSM current through the end of the combined final EffectPass
```

Timestamp queries use same-frame stage boundaries and total. Sequential
`TIME_ELAPSED` mode uses separate total-only and stage-only populations because
nested queries are forbidden. Derived totals sum same-frame raw stage samples
before percentile calculation; stage p95 values are never added. Persist raw
samples, no-op/copy baselines, invalid/disjoint reasons, timestamp bits, query
mode, BSM current/resolve, cloud current/resolve, and total intervals.

The initial cost matrix contains all `3 presets × 4 progress` cells for every
policy. A Stage-4 feedback matrix contains the exact proposed combined tuple at
all four progress values. Every cell independently receives `120` warm-up frames
and `120` valid non-disjoint samples for total-only and stage-only modes. One
missing, invalid, or cross-environment cell makes the policy cost
`SAMPLING_POLICY_COST_BLOCKED`; no preset or progress may borrow another cell's
population.

For policy `q`, derive the three ranking values from cell p95 values:

```text
policyWorstTotalP95(q) = max(cell.fullTotalP95)
policyWorstCloudP95(q) = max(cell.cloudCurrentP95)
policyWorstBSMP95(q)   = max(cell.bsmCurrentPlusResolveSameFrameP95)
```

The maximum is taken independently for each metric, so the three worst cells do
not have to share a preset/progress identity. Persist both the aggregate and its
source cell. Averages, medians across cells, or a single representative preset
cannot drive budget classification.

The deterministic thresholds and selection are:

- `policyWorstTotalP95 > 4 ms`: `SAMPLING_POLICY_OVER_BUDGET`;
- `policyWorstTotalP95` in `(3 ms, 4 ms]`: `SAMPLING_POLICY_SPIKE_VIABLE`, but not eligible for
  production promotion;
- `policyWorstTotalP95 <= 3 ms`: `SAMPLING_POLICY_PRODUCTION_ELIGIBLE`;
- if no policy is production-eligible, Stage 3 has no production winner;
- otherwise sort production-eligible policies by `policyWorstTotalP95`,
  `policyWorstCloudP95`, `policyWorstBSMP95`, then numerically coarser initial
  scale, coarser subsequent scale, coarser shadow scale, and finally canonical
  policy ID. The first entry is the unique Stage-3 winner.

GPU timing cannot compensate for a Stage-2 failure, and appearance cannot break
a cost tie outside this ordering. Stage 3 freezes the winning tuple and its
actual shader ownership; only then may a production API/patch design be proposed.

#### Stage 4 — fresh bounded lookdev with mandatory feedback

Stage 4 starts only from a Stage-3 production-eligible sampling policy. It does
not inherit a morphology or coverage winner: old Stage A/B was captured with an
unhealthy policy and remains historical evidence only. The fresh sequence is:

| Substage | Frozen input | Candidate domain | Human dimensions added at this substage |
| --- | --- | --- | --- |
| `4A morphology` | coverage `0.3`, vertical `1`, optical `1` | `h40 / h80 / h120` | macro coherence, opening identity stability, artifact freedom |
| `4B coverage` | each passing 4A morphology, vertical `1`, optical `1` | `0.3 / 0.4 / 0.45 / 0.55` | coverage usability |
| `4C vertical` | passing morphology/coverage, optical `1` | `1 / 2 / 4` | cloud/ground separation, depth layering |
| `4D optical` | passing morphology/coverage/vertical | `0.75 / 1 / 1.5` | lighting/BSM read |

At every substage, all four exact progress values are captured from new evidence;
no old contact sheet or score may rank a candidate. Machine setup, finite-output,
identity, seam, fixed-mask signal, sample-count, and termination gates run before
human review. Human dimensions are scored `0/1/2`; every applicable dimension
must be at least `1` at every progress and no enumerated hard artifact may be
present. Review input contains scores, flags, and notes only.

Passing candidates are ordered independently within each substage:

```text
4A: aggregate score, artifact freedom, macro coherence, smaller H, canonical ID
4B: aggregate score, coverage usability, artifact freedom,
    abs(coverage-0.3), smaller H, canonical ID
4C: aggregate score, depth layering, cloud/ground separation, artifact freedom,
    abs(vertical-1), abs(coverage-0.3), smaller H, canonical ID
4D: aggregate score, lighting/BSM read, depth layering, artifact freedom,
    abs(optical-1), abs(vertical-1), abs(coverage-0.3), smaller H, canonical ID
```

Every comparison is descending except the explicitly named absolute departures,
`H`, and canonical ID, which are ascending. Exact ties therefore remain total.

Each substage uses the same authorization state machine:

1. machine and visual gates produce a deterministic ordered list of passing
   provisional candidates using the substage ordering above;
2. in that order, each provisional candidate reruns the complete Stage-2
   exact-frame and continuous rails for its exact combined tuple;
3. policies that pass Stage 2 enter the complete four-progress Stage-3 feedback
   cost matrix for that tuple; the first production-eligible combined tuple is
   the only substage winner and unlocks the next substage;
4. a stability or cost failure rejects the combined tuple, not the visual
   observation. The resolver tries the next ordered provisional candidate and,
   where Stage-1 policy candidates remain, may reselect a sampling policy for the
   same geometry through Stage 2 then Stage 3;
5. if no combined tuple survives, emit the exact terminal
   `STAGE4A_MORPHOLOGY_NO_HEALTHY_TUPLE`,
   `STAGE4B_COVERAGE_NO_HEALTHY_TUPLE`,
   `STAGE4C_VERTICAL_NO_HEALTHY_TUPLE`, or
   `STAGE4D_OPTICAL_NO_HEALTHY_TUPLE` and stop. A failed substage cannot be
   skipped or relabelled as a later-stage failure.

This feedback is mandatory after morphology and coverage as well as vertical and
optical changes: all four can change primary occupancy, early termination, BSM,
temporal history, or GPU cost. The final 4D pass emits
`LOOKDEV_BASELINE_FROZEN` and freezes one joint tuple of morphology, coverage,
vertical, optical, initial-primary, subsequent-primary, and shadow-length policy
plus exact-frame, traversal, and worst-cell cost evidence. It is a query-only
baseline and does not authorize V3 substitution or homepage deployment.

#### Stage 5 — V3 compatibility and homepage-promotion readiness

Stage 5A applies the exact `LOOKDEV_BASELINE_FROZEN` renderer/layer/sampling/
lookdev tuple to the V3 weather adapter. Stock and V3 may differ only in texture
identity/hash, mapping mode, repeat/offset, wrapping, and documented channel
transform. For each input and `progress=0.00/0.06/0.12/0.18`, two fresh mounts
capture native frames `1/2/4/8/16/32`, frame-32 full/cloud-raw/cloud-raw-off,
sample/termination buffers, pre-temporal, resolved-history, BSM-off, and final
output. Query, runtime, camera, output, viewport, allocation, and artifact hashes
must otherwise match.

The stock arm is a replay control. A missing capture, identity mismatch,
non-reproducible repeat, or stock replay failure emits
`V3_WEATHER_ADAPTER_SETUP_BLOCKED`. V3 passes its machine gate only when every
progress satisfies:

```text
finite lossless stages                           = 1
cloud and pre-temporal signal pixel fractions   >= 0.002
largest connected cloud component fraction      >= 0.25
single-pixel / <=3-pixel fragment fractions     <= 0.02 / 0.08
edge density / clear-air leakage                 <= 0.65 / 0.05
first-frame to converged luma delta              <= 0.08
signal / signal-luma retention                   [0.90,1.10] / [0.80,1.20]
primaryMarchTexelCount                           > 0
iterationCapPixelFraction                        <= 0.01
sample-count structural invariants               pass
```

The V3 human gate uses the complete convergence strips and scores macro
coherence, coverage usability, cloud/ground separation, depth layering,
lighting/BSM read, artifact freedom, and sequence-level identity stability.
Every score must be at least `1` and no hard artifact may be flagged. The pure
resolver emits exactly one of `V3_WEATHER_ADAPTER_PASS`,
`V3_WEATHER_ADAPTER_FAIL`, or `V3_WEATHER_ADAPTER_SETUP_BLOCKED`; no parameter is
retuned after observing V3.

Stage 5B is a default-off production-route candidate, never an implicit homepage
change. With `MIRALITH_LUBIRTH_ORBITAL_V2` enabled in an isolated production
build, it must reproduce the frozen query-route lossless buffers byte-for-byte at
the four exact frames and keep the full-traversal metric trajectories within the
Stage-2 repeat envelopes. It must also prove:

- destination readiness never reveals a partial old/new cloud composition;
- forced texture, shader-install, context, and readiness failures select the
  currently shipped fallback before reveal and leave navigation operable;
- back/forward, refresh, reduced motion, and direct entry do not reuse stale
  cloud or BSM history;
- the default-off flag and an external kill switch restore the currently shipped
  path on the next navigation/reload without mutating an active history epoch;
- production build, asset, renderer, policy, and evidence hashes match the
  reviewed candidate.

Only `LOOKDEV_BASELINE_FROZEN` with Stage-4 worst-cell total p95 `<=3 ms`,
`V3_WEATHER_ADAPTER_PASS`, production-route parity, fallback/rollback tests, and
a clean evidence resolver may emit `HOMEPAGE_PROMOTION_READY_FOR_AUTHOR_GO`.
That state opens a separate author checkpoint and deployment amendment; it does
not itself enable the flag. Any Stage-5 failure preserves the query-only
`LOOKDEV_BASELINE_FROZEN` result and emits a scoped blocked/fail outcome. There is
no route from an earlier stage directly to homepage promotion.

#### Single quantitative resolver

Every quantitative boolean, per-progress classification, stage outcome, and
terminal outcome is generated from raw metrics by versioned pure resolvers.
`review.json` may contain only human visual scores, hard visual flags, notes, and
artifact identities. One final pure resolver validates both inputs and emits the
sole stage decision; hand-entered copies of numeric booleans are rejected. Golden
tests must change source metrics across every threshold and prove that the
derived boolean and terminal result change without editing review input.

The downstream implementation plan must include pure resolver/state-machine
tests for every `Stage 0 → 1 → 2 → 3 → 4A → 4B → 4C → 4D → 5A → 5B`
advance and every scoped terminal. Required boundary cases include: h40 below
`3 ms` while h120 exceeds `4 ms`; the same policy crossing a threshold at only
one progress; one invalid cost cell; a middle traversal frame below every
absolute signal floor; three consecutive negative causal effects; each 4A–4D
provisional winner failing feedback before the next candidate succeeds; V3 stock
replay failure; V3 metric and visual failure; production parity failure;
fallback failure; and an attempted direct promotion from every pre-5B state.

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

For each progress, the first native-control repeat produces one immutable geometric shell-intersection mask from `rayNearFar.x/y`. The source mask is the `360 × 240` native-current grid with origin at the bottom-left. The second native repeat and every step candidate must reproduce the same source mask byte-for-byte; otherwise the batch is `DIAGNOSTIC_SETUP_BLOCKED`. This fixed source mask, or its deterministic full-resolution projection below, is the primary denominator for every cross-candidate count and signal metric at that progress.

The `360 × 240` mask is used directly for native-current, pre-temporal, ray, sample-count, and loop/termination buffers. Resolved-history and final-output buffers use a frozen `1440 × 960` projection, also with bottom-left origin. Projection is exact nearest-cell replication with scale factor `4`:

```text
for each source pixel (sx, sy):
  target x = 4*sx ... 4*sx+3
  target y = 4*sy ... 4*sy+3
  projectedMask[target x, target y] = sourceMask[sx, sy]
```

No bilinear filtering, area threshold, half-pixel offset, dilation, erosion, edge clipping, or coordinate-origin flip is permitted. Both target dimensions must equal the corresponding source dimension multiplied by the same positive integer scale; for this experiment that scale must be exactly `4`. Any size, origin, or scale mismatch is `DIAGNOSTIC_SETUP_BLOCKED` rather than an invitation to resample differently.

The manifest persists the source and target dimensions, bottom-left origins, scale factor, source-mask and projected-mask SHA-256 values, both mask files, and both true-pixel counts. For this `4 × 4` replication, `projectedTruePixelCount` must equal `sourceTruePixelCount × 16`. Distributions are calculated over the fixed mask appropriate to the buffer resolution. Candidate-specific pixels that later produce a rough-weather sample or media hit are reported only as auxiliary conditional populations; they may not become the denominator of a causal comparison. The stored masks and raw readback buffers must let another implementation reproduce every included pixel and percentile without interpreting texture sampling conventions.

Metrics over the projected mask are explicitly fixed-population comparisons. They are not claims of exact per-pixel full-resolution shell coverage at the planetary limb.

### 5.2 Native sample-count readback

Use the existing repaired native sample-count path to preserve primary/shape/detail counts and the hit mask. Add a separate capture-only loop/termination probe because `sampleCount.x` increments only after the layer-interval skip and therefore is not the primary-loop iteration count.

The loop probe records:

```text
loopIterationCount
terminationReason = no-intersection | max-ray-distance | min-transmittance | iteration-cap
iterationCapReached
```

`loopIterationCount` increments once on every entered `for` iteration, including iterations that skip an inactive layer interval. `iterationCapReached=true` only when the loop completes all `maxIterationCount` iterations without taking a break. A primary sample count of `500` is neither required nor sufficient for this flag.

Persist over the fixed geometric mask:

```text
valid pixel count
non-zero primary-sample pixel fraction
primary sample mean / p50 / p75 / p95 / max
shape and detail sample summaries
hit-mask fraction
iteration-cap pixel fraction
```

The primary count is the native rough-weather count accumulated by `marchClouds`; loop count and termination are the new independent probe. A screenshot colour decoded after composition is not acceptable. The raw buffer must permit independent recomputation of the cap fraction and termination histogram.

### 5.3 Signal-chain readback

Every sweep level, progress, and clean-mount repeat must include:

1. `cloud-raw` plus paired `cloud-raw-off`;
2. native `sample-count-debug` readback;
3. `step-loop-readback` for ray geometry, loop count, and termination;
4. `stage-readback` with native pre-temporal, resolved-history, and final output;
5. paired `stage-readback-off` with cloud contribution disabled at the native-current source.

`stage-readback-off` is a separate strict diagnostic mode. It preserves the same composer, camera, atmosphere, render targets, history-reset path, and frame schedule, but clears the cloud current target before temporal resolve on every frame of its clean mount. At native frame 32 it reads the cleared pre-temporal current target, the independently converged off-side history target, and the final AerialPerspective/output result. It must not reuse a prior on-side history target or infer off-side values from `cloud-raw-off` screenshots.

For each signal stage, persist finite/non-finite count, mean and peak luma/alpha where meaningful, non-zero pixel fraction, and paired cloud-on minus cloud-off mean/peak absolute difference over the fixed geometric mask at that buffer's resolution. `cloud-raw` pairs with `cloud-raw-off`; every `stage-readback` buffer pairs with the corresponding `stage-readback-off` buffer. The raw binary buffers, exact-frame PNGs, source/projected masks, and decoded metric JSON remain linked by SHA-256.

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

Each mount receives a stable `repeatId=A|B` and a unique persisted `documentRunId`. An on/off pair is valid only when its repeat ID, progress, viewport, camera/projection/Earth matrices, native cloud/resolve/shadow frame, jitter index, STBN slice, source shader hash, renderer fingerprint excluding the declared diagnostic mode, and logical resource roles match. On-side and off-side begin from separate clean documents, must have distinct `documentRunId` and mount/runtime identities, and use separate history epochs.

An allocation generation is a document-local diagnostic label. The six cloud/shadow allocation generations must be present and internally consistent within each document, but their numeric values are never compared for equality or inequality across documents. Two clean documents may legitimately restart module state and report the same generation numbers; matching numbers do not invalidate their independence. Pair validity comes from distinct document and mount/runtime identities plus the matching logical resource-role contract, not from cross-document allocation-number uniqueness.

The manifest records complete requested/readback contracts, camera/projection/Earth matrices, `documentRunId`, history epoch, mount/runtime identity, all six document-local cloud/shadow allocation generations, shader/build/package/patch hashes, and capture hashes. A same-document identity mismatch, or reuse of a document/mount/runtime identity across the on/off pair, blocks the pair instead of becoming measurement noise.

## 6. Uniform-sweep decision rules

For each source metric `M` over the frozen geometric mask, `repeatNoise(M, progress)` is the absolute difference between the two clean native-control repeats at that progress. For every exact scalar comparison expression `E` derived from `M`, define:

```text
epsilon(E) = max(repeatNoise(sourceMetric(E), progress), numericQuantizationFloor(E))
```

The rest of this document names the complete expression passed as `E`; an implementation may not silently use the floor of only one operand.

Two native repeats provide only the bounded same-frame noise estimate used by this experiment; they do not estimate stochastic tail risk. Conclusions therefore remain scoped to this fixed-frame, fixed-STBN matrix even when an effect clears the thresholds below.

### 6.0 Numeric quantization contract

`numericQuantizationFloor` is calculated for the exact scalar expression being compared, not assigned once per framebuffer format. All metric implementations decode finite source values to IEEE-754 binary64, traverse the frozen mask in bottom-left row-major order (`y`, then `x`, then channel), use Neumaier compensated summation, and perform no intermediate decimal rounding. Persisted JSON stores the binary64 result with 17 significant decimal digits plus every floor input. Thresholds use the unrounded binary64 values: `>` is strict, equality does not pass, and `<=` includes equality.

Every scalar expression carries a typed numeric descriptor:

```text
exactLattice(E)       = smallest positive exact grid spacing, or 0
lossyUncertainty(E)   = conservative absolute encoding uncertainty, or 0
numericQuantizationFloor(E) = max(exactLattice(E), lossyUncertainty(E))
```

These two components are propagated separately. An exact lattice spacing is not an uncertainty and must never be added merely because an expression has two operands. For lossy stored samples, define the conservative per-channel uncertainty `u`:

```text
UNORM(b):    u = 0.5 / (2^b - 1)
scaled UNORM(b, scale):
             u = 0.5 * abs(scale) / (2^b - 1)
binary16:    u = 0.5 * max(abs(x - prev16(x)), abs(next16(x) - x))
binary32:    u = 0.5 * max(abs(x - prev32(x)), abs(next32(x) - x))
binary64:    u = 0.5 * max(abs(x - prev64(x)), abs(next64(x) - x))
```

`prev`/`next` mean the adjacent finite value of that exact format. At signed zero, use the minimum positive subnormal distance; at the largest finite magnitude, use the sole finite-neighbour distance. Non-finite values fail setup before a floor is computed. UNORM endpoints retain the same conservative half-step. Exact integer counters are not treated as lossy: their integer sum must remain below `2^53`, otherwise setup is blocked.

For a decoded per-pixel linear scalar `s = constant + sum(weight[c] * channel[c])`, including luma, propagate `u(s) = sum(abs(weight[c]) * u(channel[c]))`. Diagnostic luma is frozen as `0.2126 R + 0.7152 G + 0.0722 B` in the stored buffer's declared colour domain; no implicit transfer conversion is allowed.

Exact discrete values carry a reduced rational lattice descriptor. If `E = integerNumerator / d`, then `exactLattice(E)=1/d`. For `A-B` with exact denominators `dA` and `dB`, reduce the result lattice as:

```text
exactLattice(A - B) = gcd(dA, dB) / (dA * dB)
                    = 1 / lcm(dA, dB)
```

Consequently, two integer means or pixel fractions over the same fixed population `N` have a difference lattice of `1/N`, not `2/N`. A population mismatch is already a setup failure and may not be hidden by the general denominator rule.

For a fixed population of `N > 0` pixels, propagate the two descriptor components as follows:

```text
expression                              exactLattice       lossyUncertainty
exact integer sum/count                 1                  0
mean of exact integer per-pixel counts  1 / N              0
pixel fraction                          1 / N              0
mean of lossy scalar s                  0                  sum(u(s_i)) / N
peak/max of lossy scalar s              0                  max(u(s_i))
mean(abs(on_i - off_i))                  0                  sum(u(on_i) + u(off_i)) / N
signed difference A - B                 reduced lattice    U(A) + U(B)
```

The last rule composes the descriptor, not the already combined floor. Thus candidate-minus-native and adjacent-candidate monotonic tests over exact count means retain a `1/N` lattice, while lossy uncertainties from two operands add. The absolute cloud on/off gate uses the uncertainty of its paired mean-absolute observation; shadow `all-small - primary-both` adds the two lossy uncertainties and independently reduces any exact lattice. Integer and fraction numerators are accumulated exactly before division. An implementation may not substitute `Number.EPSILON`, a hard-coded UNORM8 constant, add two exact same-denominator lattice spacings, or use the smallest floor among mixed encodings.

The manifest persists, for every decision metric, its source encoding and bit depth, scale, fixed-mask `N`, aggregation kind, channel weights, reduced exact denominator/lattice, local-ULP summary where applicable, lossy uncertainty, composed floor, repeat noise, and final `epsilon`. Recomputing these fields from raw buffer bits is a setup gate.

The ordered target-band sequence is:

```text
1.00027 → 1.00024 → 1.00018 → 1.00012
```

As initial step decreases, these frozen-mask metrics form the monotonic trend audit:

- non-zero primary-sample pixel fraction;
- primary sample mean;
- `cloud-raw` non-zero pixel fraction;
- `cloud-raw` versus `cloud-raw-off` mean absolute difference.

Monotonicity is supportive evidence, not a prerequisite for candidate-level recovery and not a rejection rule. A sequence is monotonic only when every adjacent signed difference is non-negative within `epsilon(adjacentCandidate - previousCandidate)` in both independent repeats and both endpoint signed differences exceed their corresponding `3 × epsilon(endpointCandidate - endpointBaseline)`: one for primary sample mean and one for `cloud-raw` on/off mean absolute difference.

### 6.1 Candidate-level recovery

Every non-native candidate is evaluated independently against `1.01` at each progress and repeat. Define the two signed causal effects:

```text
countEffect = primarySampleMean(candidate) - primarySampleMean(native)
rawEffect = cloudRawOnOffMeanAbs(candidate) - cloudRawOnOffMeanAbs(native)
pairedRawObservation = cloudRawOnOffMeanAbs(candidate)
```

A candidate passes one progress only when both repeats independently satisfy all of:

```text
countEffect > 3 × epsilon(countEffect)
rawEffect > 3 × epsilon(rawEffect)
pairedRawObservation > max(
  5 × repeatNoise(sourceMetric(pairedRawObservation), progress),
  numericQuantizationFloor(pairedRawObservation)
)
nonZeroCloudRawPixelFraction >= 0.001
```

The paired observation is the candidate's complete `mean(abs(cloudRawOn - cloudRawOff))` expression. The fraction line is evaluated from an exact integer numerator and its `1/N` fraction floor.

Loop/termination evidence remains a validity gate rather than a recovery-effect threshold. `iterationCapPixelFraction` must be finite, lie in `[0,1]`, and be independently recomputable as `iteration-cap pixels / fixed-mask pixels` from the termination buffer. A value of exactly `0` is valid: the termination histogram may contain no `iteration-cap` entry, which is interpreted as a zero count, not missing evidence. A non-zero fraction requires the same non-zero histogram count; neither zero nor non-zero cap incidence changes candidate eligibility by itself.

Both repeats must reach the same pass/fail classification. For either `countEffect` or `rawEffect`, first define:

```text
effectEpsilon = max(epsilon(effectA), epsilon(effectB))
zeroEquivalent = abs(effectA) <= effectEpsilon
              && abs(effectB) <= effectEpsilon
bothNonZero = abs(effectA) > effectEpsilon
           && abs(effectB) > effectEpsilon
repeatConsistencyTolerance(effect) = max(
  3 × effectEpsilon,
  0.25 × min(abs(effectA), abs(effectB))
)
repeatEffectConsistent = zeroEquivalent
                      || (
                           bothNonZero
                           && sign(effectA) == sign(effectB)
                           && sign(effectA) != 0
                           && abs(effectA - effectB) <= repeatConsistencyTolerance(effect)
                         )
```

Apply this independently to `countEffect` and `rawEffect`. Opposite signs inside the common zero-equivalent interval are consistent zero evidence. Outside that interval, a sign mismatch, a zero/non-zero mismatch, or excess distance makes that progress `REPEAT_INCONSISTENT`. A candidate is **isolation-eligible** only when it passes at least three of four progress values, includes `progress=0.06`, has no `REPEAT_INCONSISTENT` progress, and neither `countEffect < -epsilon(countEffect)` nor `rawEffect < -epsilon(rawEffect)` at the remaining progress.

### 6.1.1 Positive-control setup gate

The `S=120` health control has no candidate-minus-native effect and therefore does not reuse `countEffect` or `rawEffect`. At every progress, calculate its own two-repeat noise:

```text
positiveRepeatNoise(M, p) = abs(M(S120, p, A) - M(S120, p, B))
positiveStableSignal(M, p) = min(M_A, M_B) > max(
  5 * positiveRepeatNoise(M, p),
  numericQuantizationFloor(M_A),
  numericQuantizationFloor(M_B)
)
```

Both repeats at every progress must independently provide finite readbacks and satisfy all of:

```text
positiveStableSignal(primarySampleMean, p)
positiveStableSignal(pairedRawObservation, p)
min(nonZeroPrimarySamplePixelFraction_A, nonZeroPrimarySamplePixelFraction_B) >= 0.001
min(nonZeroCloudRawPixelFraction_A, nonZeroCloudRawPixelFraction_B) >= 0.001
abs(fraction_A - fraction_B) <= max(1/N, 0.25 * min(fraction_A, fraction_B))
```

Apply the final fraction-consistency line independently to the primary-sample and cloud-raw non-zero fractions. Both repeats must also pass the complete ray/mask identity gate and loop/termination validity gate from Sections 5.1–5.2, including independently recomputable cap fraction where zero remains legal. `positiveRepeatNoise` comes only from the `S=120` A/B pair; thin-layer native noise may not be substituted. A single quantized raw pixel, a single sampled pixel, or repeat disagreement therefore cannot make the setup pass. Any failure returns `DIAGNOSTIC_SETUP_BLOCKED`. The thin-layer target does not have to match the control's magnitude; the control proves only that the capture pipeline is healthy.

If multiple candidates are isolation-eligible, choose the numerically largest `perspectiveStepScale`, which is the coarsest eligible step and therefore a unique deterministic winner. `1.01` is the baseline and cannot be selected. Record all candidate classifications; winner selection may not use final-output appearance or GPU time.

### 6.2 Uniform-sweep outcomes

The outcome resolver evaluates all seven non-native candidates, including `1.00010` and `1.00005`, using this precedence:

1. Any setup/control/identity failure returns `DIAGNOSTIC_SETUP_BLOCKED`.
2. If an isolation-eligible candidate exists, return fine-control recovery when every eligible candidate is `1.00010` or `1.00005`; otherwise return monotonic or non-monotonic support according to the target-band trend audit.
3. With no eligible candidate, any repeat inconsistency returns `PERSPECTIVE_STEPPING_MECHANISM_UNRESOLVED`.
4. With consistent repeats, any candidate passing only one or two progress values returns `PERSPECTIVE_STEPPING_PROGRESS_LOCALIZED`.
5. Only when no candidate exceeds both predeclared signed count/raw effect thresholds from the first two lines of Section 6.1 at any progress does the resolver return the weak bounded no-support result.
6. Every remaining valid pattern returns `PERSPECTIVE_STEPPING_MECHANISM_UNRESOLVED`. This catch-all includes candidates whose count/raw signed effects exceed their thresholds but whose absolute cloud-raw or non-zero-pixel floor fails, plus any other consistent pattern that is neither eligible, localized, nor bounded no-support.

The uniform sweep therefore produces exactly one of:

| Result | Meaning | Next action |
| --- | --- | --- |
| `DIAGNOSTIC_SETUP_BLOCKED` | Identity, positive control, precision, or target-band coverage failed | Repair evidence setup only |
| `PERSPECTIVE_STEPPING_CAUSAL_MONOTONIC` | An isolation-eligible candidate exists and the target-band trend audit is monotonic | Open mechanism isolation with the deterministic winner |
| `PERSPECTIVE_STEPPING_EFFECT_SUPPORTED_NONMONOTONIC` | An isolation-eligible candidate exists but the target-band trend is threshold-shaped or non-monotonic | Open mechanism isolation; do not claim a monotonic mechanism |
| `PERSPECTIVE_STEPPING_FINE_CONTROL_RECOVERY` | Only `1.00010` and/or `1.00005` is isolation-eligible | Open mechanism isolation, record that the planned `0.5–1.0 km` band was insufficient |
| `PERSPECTIVE_STEPPING_PROGRESS_LOCALIZED` | One or more candidates pass only one or two progress values | Preserve per-progress evidence; mechanism isolation remains closed |
| `PERSPECTIVE_STEPPING_NOT_SUPPORTED_BY_BOUNDED_SWEEP` | No non-native candidate exceeds the predeclared count/raw effect thresholds at any progress, and no repeat is inconsistent | Stop with a weak bounded result; do not reject stepping outside this matrix |
| `PERSPECTIVE_STEPPING_MECHANISM_UNRESOLVED` | Valid candidates show repeat inconsistency or effects that do not satisfy another outcome | Stop and preserve the unresolved pattern |

Pre-temporal, history, and final measurements locate later loss but cannot rescue a failed raw gate. Stage C–F remain closed for every uniform-sweep outcome.

## 7. Mechanism isolation

Mechanism isolation is authorized only after a committed uniform-sweep result of `PERSPECTIVE_STEPPING_CAUSAL_MONOTONIC`, `PERSPECTIVE_STEPPING_EFFECT_SUPPORTED_NONMONOTONIC`, or `PERSPECTIVE_STEPPING_FINE_CONTROL_RECOVERY` with one deterministic isolation winner.

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

The chosen small value is the deterministic isolation winner from Section 6.1. It passes the candidate-level count/raw/repeat/progress contract; it does not have to belong to a globally monotonic sequence. Selecting the largest eligible value avoids silently choosing the most expensive fine-step setting.

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

Mechanism isolation reports one primary-mechanism result and one independent shadow finding. Every primary case uses the complete Section 6.1 recovery/repeat/progress thresholds:

| Primary mechanism | Required evidence |
| --- | --- |
| `INITIAL_PRIMARY_OVERSTEP_SUPPORTED` | `initial-only` and `primary-both` are isolation-eligible; `subsequent-only` is not |
| `SUBSEQUENT_PRIMARY_STEPPING_CAUSAL` | `subsequent-only` and `primary-both` are isolation-eligible; `initial-only` is not |
| `INDEPENDENT_PRIMARY_FACTORS_CAUSAL` | `initial-only`, `subsequent-only`, and `primary-both` are all isolation-eligible |
| `COUPLED_PRIMARY_STEPPING_CAUSAL` | Neither single-factor case is isolation-eligible, but `primary-both` is |
| `PERSPECTIVE_STEP_CAUSAL_MECHANISM_UNRESOLVED` | Repeat consistency fails or the eligibility pattern matches none of the above |

The shadow comparison uses `primary-both` as its baseline. Define `rawShadowDelta = cloudRawOnOffMeanAbs(all-small) - cloudRawOnOffMeanAbs(primary-both)`. `rawEquivalent=true` only when `abs(rawShadowDelta) <= epsilon(rawShadowDelta)` at every progress in both repeats.

For each later-stage scalar metric `M`, progress `p`, and repeat `r`, define the signed shadow effect and its comparison floor:

```text
shadowEffect(M, p, r) = M(all-small, p, r) - M(primary-both, p, r)
shadowEpsilon(M, p) = max(
  repeatNoise(M, p),
  numericQuantizationFloor(shadowEffect(M, p, A)),
  numericQuantizationFloor(shadowEffect(M, p, B))
)
shadowRepeatTolerance(M, p) = max(
  3 * shadowEpsilon(M, p),
  0.25 * min(abs(shadowEffect(M, p, A)), abs(shadowEffect(M, p, B)))
)
```

Classify every later-stage metric/progress cell before resolving the shadow finding:

```text
ZERO_EQUIVALENT:
  abs(effectA) <= shadowEpsilon && abs(effectB) <= shadowEpsilon

CONSISTENT_SIGNIFICANT:
  abs(effectA) > 3 * shadowEpsilon
  && abs(effectB) > 3 * shadowEpsilon
  && sign(effectA) == sign(effectB)
  && sign(effectA) != 0
  && abs(effectA - effectB) <= shadowRepeatTolerance

AMBIGUOUS_OR_INCONSISTENT:
  every remaining cell
```

A later-stage shadow effect qualifies only when the same metric is `CONSISTENT_SIGNIFICANT` at at least three progress values including `0.06`. Threshold equality does not qualify.

The shadow resolver is total and uses this precedence:

1. If `rawEquivalent=false`, return `SHADOW_LENGTH_EFFECT_UNRESOLVED`.
2. If any metric/progress cell is `AMBIGUOUS_OR_INCONSISTENT`, return `SHADOW_LENGTH_EFFECT_UNRESOLVED`. This is a global veto: a qualifying final-output metric cannot hide an opposite-sign, excess-distance, zero/significant mismatch, or between-threshold pre-temporal/history cell.
3. If at least one later-stage metric qualifies at the required three progress values, return `SHADOW_LENGTH_DOWNSTREAM_CONFOUNDER`.
4. If every metric/progress cell is `ZERO_EQUIVALENT`, return `NO_DETECTABLE_SHADOW_LENGTH_EFFECT`.
5. Return `SHADOW_LENGTH_EFFECT_UNRESOLVED` for the remaining all-classified patterns, including a consistent effect localized to fewer than three progress values.

| Shadow finding | Required evidence |
| --- | --- |
| `SHADOW_LENGTH_DOWNSTREAM_CONFOUNDER` | Raw is equivalent, no metric/progress cell is ambiguous or inconsistent, and at least one later-stage metric meets the shadow-effect rule |
| `NO_DETECTABLE_SHADOW_LENGTH_EFFECT` | Raw is equivalent and every signed later-stage effect in both repeats has absolute magnitude at most its `shadowEpsilon` |
| `SHADOW_LENGTH_EFFECT_UNRESOLVED` | Raw is not equivalent; any winning or non-winning metric is ambiguous/inconsistent; or the downstream effect is localized to fewer than three progress values |

`INITIAL_PRIMARY_OVERSTEP_SUPPORTED` is evidence for the first-sample mechanism, not proof that it is the only rendering defect. BSM, AerialPerspective, and temporal resolve remain separate downstream gates.

Before any Stage-B-wide wording, the selected mechanism case is repeated for `h40` and `h80`. A failed confirmation is reported as morphology-preset-localized evidence.

## 8. Instrumentation boundary

All shader work is project-owned, capture-only, and installed at runtime by exact audited string replacements. The instrumentation must:

- refuse installation if an expected source fragment is missing or occurs more than once;
- store and hash both the original and instrumented shader;
- restore the original source and remove all diagnostic uniforms on cleanup;
- expose an independent primary-loop counter and explicit termination reason without substituting `sampleCount.x`;
- expose an executable `stage-readback-off` path whose current/history/final buffers begin from a clean off-side history epoch;
- key-remount the complete Clouds/AerialPerspective composer when a diagnostic tuple changes;
- prove disabled output remains inside the same-route repeat noise floor;
- never edit `node_modules`, the pnpm patch, product defaults, or homepage code;
- never run outside the explicit parity diagnostic route.

The runtime fingerprint must include the three split scales and instrumentation hash. A request/readback mismatch is `DIAGNOSTIC_SETUP_BLOCKED`.

Pure tests must cover exact single-site shader replacements, disabled-output parity, unknown/partial query tuples, V3 and product-route rejection, uniform/shader cleanup after unmount, iteration-cap versus early-termination encoding, zero iteration-cap fraction with no histogram entry, raw-buffer metric recomputation, and precision/quantization floors. Quantization golden tests must cover UNORM8 scalar means and paired differences, value-dependent binary16 ULPs including zero/subnormal and maximum-finite boundaries, exact integer count means, same-`N` count/fraction signed differences retaining a `1/N` lattice, general reduced rational difference lattices, mixed exact/lossy descriptors, strict threshold equality, and 17-digit persistence/recomputation. Identity tests must prove that two fresh documents with the same numeric allocation generations remain a valid independent pair when their `documentRunId` and mount/runtime identities differ. Mask tests must include a pixel-exact bottom-left-origin golden projection from `360 × 240` to `1440 × 960`, the `×16` population invariant, and fail-closed dimension/origin mismatches. The outcome resolver must cover monotonic recovery, non-monotonic recovery, fine-control-only recovery, one-progress recovery, repeat inconsistency, two opposite-sign sub-epsilon effects classified as consistent zero, no bounded effect, setup blocking, and the final unresolved catch-all where signed effects pass but the absolute or non-zero signal floor does not. Positive-control tests must cover one sampled/raw pixel, stable true signal, both non-zero fraction boundaries, termination validity, and repeat disagreement using `S=120` self-noise. Shadow tests must cover repeat-consistent positive and negative effects, opposite signs, excess repeat-distance, threshold equality, localized effects, no detectable effect, and a qualifying metric vetoed by another metric's opposite sign or excess tolerance.

## 9. Stage-1 diagnostic cost and iteration-limit boundary

No GPU timing or production-acceptability judgment occurs before raw recovery.

After a mechanism case restores raw signal, a diagnostic-only cost audit may record:

- actual primary iteration distribution and the fraction reaching the `500` iteration cap;
- cloud-current GPU time using the existing valid/disjoint timer protocol;
- full native cloud/resolve/AerialPerspective cost;
- native baseline and positive-control cost at the same frame and viewport.

This audit answers whether the recovered diagnostic is computationally plausible.
It does not authorize a production step scale, raise the iteration limit, or
promote the renderer. The later Stage-3 matrix is a separate authoritative
production-cost gate and cannot reuse these diagnostic populations.

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
  takram-sampling-stability/
    exact-frame/
    continuous-policy-a/
    continuous-policy-b/
    continuous-native-a/
    continuous-native-b/
    metrics.json
    OUTCOME.md
  takram-sampling-policy-cost/
    cell-populations/
    aggregates.json
    OUTCOME.md
  takram-orbital-lookdev-v2/
    morphology/
    coverage/
    vertical/
    optical/
    frozen-tuple.json
    OUTCOME.md
  takram-orbital-v3-compatibility/
    stock/
    v3/
    metrics.json
    visual-review.json
    OUTCOME.md
  takram-orbital-production-parity/
    exact-frame/
    continuous/
    fallback-rollback/
    OUTCOME.md
```

Each root contains its own `checkpoint.json`, `manifest.json`, and
`checksums.sha256`; the compact listing omits repeated names. A downstream root
is absent until the preceding committed outcome authorizes it.
`mechanism-isolation/` and diagnostic `cost/` are likewise absent until their
preceding Stage-1 gates authorize them. Every checksum index uses
repository-root-relative paths and verifies from the repository root.

## 11. Stop rules

- Do not reopen orbital Stage C–F.
- Do not treat Stage 0's revocation of the old authorization as h40/h80 or
  Stage-B-wide mechanism confirmation.
- Do not change coverage, vertical thickness, optical depth, weather, mip, lighting, BSM, temporal, atmosphere, exposure, or output transform during the sweep.
- Do not claim that a uniform sweep proves first-step overrun.
- Do not claim that visible `S=120` proves the thin-layer mechanism.
- Do not open Stage 2 until the three-owner mechanism result and both h40/h80
  confirmations are committed; do not open Stage 3 until both Stage-2 rails
  pass; do not open Stage 4 until Stage 3 selects one production-eligible
  policy; do not open Stage 5 until Stage 4 emits `LOOKDEV_BASELINE_FROZEN`.
- Do not retain a sampling winner after changing morphology, coverage, vertical,
  or optical values unless the combined tuple passes the complete Stage-2
  stability and Stage-3 worst-cell cost loop.
- Do not use the superseded public-scalar production draft as implementation
  authorization, and do not enable the homepage flag before
  `HOMEPAGE_PROMOTION_READY_FOR_AUTHOR_GO` receives the separate author GO.
- Do not copy numeric pass/fail booleans into human review input; derive them
  from raw evidence through the versioned quantitative and final resolvers.
- Do not evaluate performance before raw signal recovery.
- Do not edit or promote production parameters from diagnostic evidence.
- Stop on invalid control, identity drift, non-finite readback, missing raw buffers, frame/STBN mismatch, or failed independent repeat.

## 12. Acceptance criteria

The design is ready for implementation planning only when review confirms:

- the closed h120 A/B and terminated old lookdev documents carry their terminal
  outcomes, evidence identities, and non-generalization boundary;
- the exact review patch applies without conflict on the unified qualified
  evidence lineage, where historical causal runtime commits are ancestors but
  explicitly outside successor implementation scope;
- the sweep covers the measured `0.5–1.0 km` target region rather than relying on camera-height estimates;
- actual per-pixel `rayNearFar.x`, initial step, and jittered first-sample distributions are durable evidence;
- every level includes raw, native sample-count, independent loop/termination, pre-temporal, resolved-history, and final evidence;
- every signal stage has a clean-frame-aligned executable off-side capture;
- cross-candidate gates use one frozen source geometry mask and its exact `4 × 4` full-resolution projection rather than a treatment-conditioned hit population;
- mask origin, source/target dimensions, projection factor, population invariant, files, and hashes are durable evidence;
- fixed frame/STBN identity is repeated on a clean mount;
- on/off independence is proven by document and mount/runtime identity while allocation generations remain explicitly document-local;
- zero iteration-cap incidence is accepted when it is independently recomputable from the termination buffer;
- `S=120` passes quantified self-repeat sample/raw/fraction/termination gates and remains a health control rather than causal proof;
- candidate-level count/raw/repeat/progress gates select one deterministic isolation value;
- exact discrete lattices and lossy uncertainties are propagated separately, including the same-`N` `1/N` difference lattice;
- quantization floors are derived from the exact encoding, aggregation, and comparison expression with strict boundary rules;
- opposite-sign sub-epsilon effects are consistent zero while significant repeat disagreement remains fail-closed;
- both the uniform-sweep and shadow resolvers are total functions with explicit unresolved catch-alls;
- non-winning shadow metrics have an explicit ambiguity/inconsistency veto;
- non-monotonic or localized recovery cannot be mislabeled as hypothesis rejection;
- initial, subsequent, and shadow-length stepping have separate owners in the isolation stage;
- h40 and h80 confirmation is mandatory before Stage-B-wide wording;
- temporal health requires both the exact-frame matrix and the no-remount full
  7.2-second opening traversal, with computable intermediate absolute-health
  floors and matched native-reference diagnostics rather than an undefined
  inherited four-progress gate;
- production selection uses the frozen Apple M4/Chrome/1440×960/120+120 timing
  protocol, hard `4 ms` ceiling, `3 ms` promotion ceiling, and deterministic
  worst-cell aggregation and tie-breaking order across every authorized
  preset/progress cell;
- fresh morphology, coverage, vertical, and optical substages each feed their
  provisional winners through the complete stability and GPU gates, producing
  one jointly frozen combined tuple or an exact scoped terminal outcome;
- Stage 5 freezes V3 stock-replay/adapter compatibility, production-route parity,
  fallback/rollback, and the only route to
  `HOMEPAGE_PROMOTION_READY_FOR_AUTHOR_GO`;
- all quantitative booleans and terminal results come from raw metrics through
  one versioned final resolver, while human review supplies only visual judgment;
- no result automatically opens Stage C–F or production promotion.
