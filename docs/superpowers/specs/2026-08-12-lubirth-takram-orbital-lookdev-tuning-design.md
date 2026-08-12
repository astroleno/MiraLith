# LuBirth Takram Orbital Lookdev Parameter Tuning Design

**Status:** Revised after document review; awaiting written-spec approval

**Date:** 2026-08-12

**Scope:** Query-only Takram parity route; stock-first orbital opening lookdev

**Supersedes:** Further work on `PUBLIC_PARAMETER_SIMILARITY`, the rejected mip hypothesis, and uniform `S=80/120/160` scaling

## 1. Decision

LuBirth will keep the native `@takram/three-clouds` renderer and tune it specifically for the existing space-only opening camera. The next spike is a parameter lookdev exercise, not a renderer rewrite, planet rescale, near-ground cloud system, or shader-coordinate experiment.

The central correction is to stop treating every cloud-domain length as one similarity scale. Orbital imagery needs large apparent weather structures while retaining plausible vertical cloud thickness. The new contract therefore separates:

- ECEF-space 3D shape/detail wavelength;
- 2D stock-weather and effective turbulence domain;
- coverage;
- vertical layer thickness;
- optical depth.

Takram continues to own raymarching, Beer shadow maps, temporal resolve, and AerialPerspective composition.

## 2. Working hypothesis

The failed similarity run does not reject Takram. It rejects the tested coupling:

```text
horizontal wavelength × S
vertical thickness × S
ray/step distances × S
density ÷ S
```

At `S=80/120/160`, the R/G/B layers became tens to hundreds of kilometres thick, while the product camera remained an orbital camera looking for a thin atmospheric cloud deck. That coupling can produce surface-like slabs even when weather and density signals are present.

The next experiment tests a narrower hypothesis:

> Takram's native vertical and optical system can produce the target orbital volume if the 3D noise wavelengths and 2D weather/turbulence domain are enlarged while the cloud shell stays thin, followed by small bounded adjustments to coverage, vertical thickness, and optical depth.

`shapeRepeat` and `shapeDetailRepeat` are ECEF `vec3` values and the public runtime applies them with `setScalar()`. The preset therefore scales X/Y/Z noise coordinates equally; it is not a strict local-horizontal transform. Because the density profile remains confined to a thin spherical layer, the intended presentation effect is predominantly larger horizontal morphology. A true tangent-space horizontal transform would require shader-coordinate work and remains outside this spike.

This hypothesis is falsifiable. If the frozen stock-weather funnel produces no visual winner, the checkpoint is `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED`. That result rejects only this bounded public-parameter funnel; it does not by itself prove that Takram, the stock weather source, mip selection, or the vertical representation is the root cause.

## 3. Scope boundaries

This spike must:

- use the existing `/lubirth-takram-parity-spike` query-only route;
- use `view=opening` and the authoritative opening progress values `0.00/0.06/0.12/0.18`;
- start with the committed Takram stock weather and shared shape/detail/turbulence/STBN assets;
- preserve the native `CloudsEffect → temporal resolve → AerialPerspectiveEffect` order;
- preserve the existing Earth radius, camera path, scene-depth bridge, HDR/output transform, BSM implementation, temporal implementation, and render-target formats;
- publish requested values, runtime readback, renderer fingerprint, and history epoch for every candidate.

This spike must not:

- change the homepage or production `EarthMoonScene`;
- shrink the planet;
- multiply all physical lengths by one scale;
- claim that the ECEF `vec3` repeats implement tangent-space horizontal scaling;
- modify `rayDistance * 1e-5` or add another mip patch;
- add a custom raymarcher, shell renderer, impostor, cloud card, or new weather asset;
- tune near-ground, in-cloud, or fly-through cameras;
- run Task 0P or production promotion before a visual winner exists.

## 4. Single parameter contract

Add one pure resolver:

```ts
resolveTakramOrbitalLookdevContract({
  preset: "native" | "h40" | "h80" | "h120",
  coverage: 0.3 | 0.4 | 0.45 | 0.55,
  verticalScale: 1 | 2 | 4,
  opticalDepthScale: 0.75 | 1 | 1.5
})
```

The result is immutable and has classification `TAKRAM_ORBITAL_PARAMETER_LOOKDEV`. It contains every value changed by the lookdev contract, the complete explicit R/G/B/A layer array, and the fields that must remain at the Takram `0.7.6` high preset.

The legacy `resolveTakramCloudScaleContract()` remains available only for historical evidence replay. Orbital lookdev and legacy `cloudScale` may not be active in the same route request.

### 4.1 Orbital morphology preset

The orbital morphology preset changes the isotropic ECEF shape/detail repeats and the stock-weather repeat. The native `turbulenceRepeat=[20,20]` stays fixed, but Takram samples turbulence with `uv * localWeatherRepeat * turbulenceRepeat`; effective turbulence frequency therefore changes with the weather repeat and must be treated as an explicit part of the preset rather than an accidental constant.

| Preset | Presentation scale `H` | ECEF `shapeRepeat` XYZ | Shape wavelength | ECEF detail repeat XYZ | Detail wavelength | `localWeatherRepeat` | Effective turbulence UV repeat |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `native` | 1 | `0.0003` | `3.333 km` | `0.006` | `0.167 km` | `[100,100]` | `[2000,2000]` |
| `h40` | 40 | `0.0000075` | `133.333 km` | `0.00015` | `6.667 km` | `[2.5,2.5]` | `[50,50]` |
| `h80` | 80 | `0.00000375` | `266.667 km` | `0.000075` | `13.333 km` | `[1.25,1.25]` | `[25,25]` |
| `h120` | 120 | `0.0000025` | `400 km` | `0.00005` | `20 km` | `[0.8333333333333334,0.8333333333333334]` | `[16.666666666666668,16.666666666666668]` |

For every preset:

```text
shapeRepeat = officialShapeRepeat / H
shapeDetailRepeat = officialShapeDetailRepeat / H
localWeatherRepeat = [100 / H, 100 / H]
shape/detail hierarchy = 20:1
effectiveTurbulenceRepeat = localWeatherRepeat * nativeTurbulenceRepeat
```

Layer altitude, layer height, density, `turbulenceRepeat`, turbulence displacement, ray distances, step sizes, extinction thresholds, iteration counts, mip behaviour, BSM settings, temporal settings, and all light parameters stay native during morphology selection. Telemetry and runtime readback record `localWeatherRepeat`, `turbulenceRepeat`, and their effective product.

Every non-native preset also receives a cube-face seam/UV diagnostic at the same camera and native frame. A visible face boundary, wrap discontinuity, or non-finite UV is a candidate artifact, not evidence that the stock weather source failed.

### 4.2 Coverage

Coverage is a separate scalar, never baked into a morphology preset:

- `0.3` is Takram's native default, the stock opening control, and the Stage A comparison value;
- `0.4`, `0.45`, and `0.55` are the additional bounded Stage B lookdev values.

Coverage changes must reset cloud, shadow, and resolve history.

### 4.3 Vertical thickness

Vertical tuning is permitted only after morphology/coverage selection passes. For every non-empty layer:

```text
height = officialHeight * verticalScale
densityScale = officialDensityScale / verticalScale
minExtinction = officialMinExtinction / verticalScale
```

Layer base altitudes remain unchanged. `verticalScale=1/2/4` keeps all active cloud tops below the approximately `60 km` atmosphere top:

| Vertical scale | R top | G top | B top |
| ---: | ---: | ---: | ---: |
| 1 | `1.4 km` | `2.2 km` | `8.0 km` |
| 2 | `2.05 km` | `3.4 km` | `8.5 km` |
| 4 | `3.35 km` | `5.8 km` | `9.5 km` |

Cloud and Shadow `minExtinction` use the same scale. Step sizes and ray distances remain native because the maximum shell remains well inside the existing `200 km` ray limit.

### 4.4 Optical depth

Optical depth is tuned only after one morphology/coverage/vertical candidate passes:

```text
densityScale *= opticalDepthScale
Clouds.minExtinction *= opticalDepthScale
Shadow.minExtinction *= opticalDepthScale
```

The bounded values are `0.75/1/1.5`. No phase, powder, anisotropy, sky-light, ground-bounce, exposure, or tone-mapping tuning is allowed in this plan. Keeping lighting native ensures the first winner is caused by morphology and opacity rather than a compensating colour grade.

## 5. Candidate funnel

### Stage 0 — native orbital control

Capture stock weather with:

```text
preset=native
coverage=0.3
verticalScale=1
opticalDepthScale=1
```

This confirms that the new contract reproduces the current unscaled stock opening, which currently omits the coverage prop and therefore receives Takram's native `0.3`. The runtime layer array and normalized renderer fingerprint must match exactly; the frame-32 image difference must remain at or below the same-route repeat noise floor measured in the same clean run. `coverage=0.4` is not a native opening baseline.

Stage 0 also proves reference hashes, full composer remount, runtime readback, coordinates, HDR/output, and native frame lock. Failure of any setup contract is `ORBITAL_LOOKDEV_SETUP_BLOCKED`, not a candidate visual result; Stage A cannot begin until Stage 0 passes.

### Stage A — morphology-domain selection

Capture exactly three stock candidates at all four opening progress values:

```text
h40 / coverage 0.3 / vertical 1 / optical 1
h80 / coverage 0.3 / vertical 1 / optical 1
h120 / coverage 0.3 / vertical 1 / optical 1
```

No other field may differ. Stage A judges only whether macro topology is usable enough to continue. Each candidate receives one of:

- `TOPOLOGY_PASS`: coherent orbital-scale regions are clearly present;
- `TOPOLOGY_AMBIGUOUS`: regions are coherent and non-fragmented, but coverage or opacity may be causing a surface-stain read;
- `TOPOLOGY_UNOBSERVABLE`: coverage `0.3` does not expose enough signal to judge topology;
- `HARD_ARTIFACT_FAIL`: non-finite output, confirmed cube-face seam/wrap discontinuity, or unstable identity that invalidates the capture.

`TOPOLOGY_PASS`, `TOPOLOGY_AMBIGUOUS`, and `TOPOLOGY_UNOBSERVABLE` all enter Stage B. Stage A does not cap survivors; all three presets may enter the bounded coverage matrix. Salt-and-pepper morphology is recorded as a Stage B visual defect rather than used to infer a source failure at one coverage.

If all three receive `HARD_ARTIFACT_FAIL`, stop with:

```text
BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED
```

Do not proceed to coverage, vertical, optical, V3, stage readback, or GPU timing. The outcome does not authorize a weather replacement without a separate root-cause design.

### Stage B — coverage selection

For each Stage A survivor, capture `coverage=0.3/0.4/0.45/0.55` while keeping morphology preset, vertical scale `1`, and optical depth `1` fixed. The set deliberately retains the native Stage A baseline. Select exactly one coverage per morphology preset.

Keep at most two survivors using the fixed scoring and tie-break rules in Section 6. If none passes, stop with `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED`; coverage exhaustion alone does not prove a weather-source failure.

### Stage C — vertical separation

For each Stage B survivor, capture `verticalScale=1/2/4` with optical depth invariant and all morphology/coverage fields frozen. This stage asks only whether the cloud deck gains readable limb elevation and soft internal layering.

Keep one overall winner. If macro morphology passes but all three vertical values remain flat, stop with `ORBITAL_VERTICAL_PROFILE_FAIL`.

### Stage D — optical-depth finish

For the single Stage C winner, capture `opticalDepthScale=0.75/1/1.5`. Select the value with readable bright tops, non-crushed shaded cores, and stable cloud/ground separation across all four frames.

The result is the sole `ORBITAL_LOOKDEV_WINNER`. Do not average parameters between candidates after review.

### Stage E — V3 weather swap

Only after a stock winner exists, apply the exact same Takram renderer contract and the stock winner's complete explicit official R/G/B/A layer array to the V3 texture. Set `disableDefaultLayers=true` for both inputs. Stock and V3 may differ only in these enumerated weather-adapter fields:

- texture identity and hash;
- global/local mapping mode;
- repeat and offset;
- S/T wrap and channel transform required to interpret the texture.

The existing `TAKRAM_PARITY_V3_LAYERS` 8–60 km semantic layer tuple is not used in Stage E. Stage E is a weather-texture compatibility test, not a test of the prior V3 semantic-layer representation. Reintroducing those semantic layers requires a separate experiment because doing so would destroy the same-renderer/same-layer comparison.

- Stock pass + V3 pass: `V3_ORBITAL_WEATHER_PASS`.
- Stock pass + V3 fail: `V3_WEATHER_INPUT_FAIL`; retain the Takram stock winner and treat a new global weather source as a separate asset task.

V3 failure must not invalidate the Takram renderer or restart parameter tuning.

### Stage F — formal evidence and cost

Only the visual winner receives exact-frame cloud-on/off, BSM-off, cloud-raw, pre-temporal, history, AerialPerspective input, and final composite captures.

GPU timing runs on the production build in headed System Chrome on the Apple M4 reference machine at `1440×960` CSS/physical pixels and DPR `1`. It begins only after the renderer, assets, coordinates, HDR/output, visibility, and full history-reset gates are ready, then uses `120` warmup frames and collects `120` valid non-disjoint samples.

The profiler exposes these native intervals where the installed runtime permits them:

- BSM current;
- BSM temporal resolve;
- cloud current/raymarch;
- cloud temporal resolve;
- combined final `EffectPass`, containing the native cloud effect blend and AerialPerspective/final composite.

If public runtime boundaries are insufficient, Stage F may add one instrumentation-only timer-hook patch after the visual winner is frozen. The patch may expose begin/end callbacks around existing submissions but may not change GLSL, defines, uniforms, pass order, render targets, or visual output. Its file SHA-256 and installed-build hash enter the renderer fingerprint, and enabled-versus-disabled frame output must stay within the same-route repeat noise floor.

The gate uses a total-only interval covering the actual submitted GPU work from BSM current through the end of the combined final `EffectPass`. If timestamp queries are available, stage boundaries and end-minus-start total share the same frame. With sequential `TIME_ELAPSED` queries, total-only and stage-only are separate populations because nested queries are forbidden. Any derived per-frame total must sum same-frame raw stage samples before percentile calculation; adding stage p95 values is invalid. Preserve raw samples, no-op/copy-only baselines, invalid reasons, timestamp bits, and measurement mode. A disjoint polling epoch invalidates every pending frame in that epoch and sampling continues until `120` valid samples exist.

The thresholds remain:

- `p95 ≤ 4 ms`: `SPIKE_VIABLE`;
- `p95 ≤ 3 ms`: eligible for a later production-promotion amendment;
- `p95 > 4 ms`: `ORBITAL_LOOKDEV_OVER_BUDGET`.

This plan does not promote the winner into the homepage.

## 6. Visual acceptance

The authoritative output is a `1440×960`-pixel, DPR-1 System Chrome capture at native frame `32`, assembled into a fixed-size contact sheet containing progress `0.00/0.06/0.12/0.18` plus cloud-off controls. Automated measurements are diagnostics only.

The frozen reference inputs are:

| Reference | Path | Pixel size | SHA-256 |
| --- | --- | ---: | --- |
| NASA comparison board | `screenshots/current-vs-nasa-20260501/comparison-current-day-aurora.png` | `2880×540` | `d1bf3d7478969acf7910ccb0688554a8074650df60f528ca91b84d91a04120eb` |
| Takram upstream control | `docs/lubirth-planetary-cloud-evidence/2026-08-05/takram-parity/reference/upstream-tokyo.jpg` | `1920×1080` | `843ea3876bf9fc24a3c4ee9ddc17c61c0e453ad3baa4a5562a3563b4af24c4a5` |

The evidence runner verifies both hashes before capture. A missing or changed reference makes visual evidence invalid rather than silently accepting a replacement.

Every winning frame must show:

- a small number of coherent cloud systems at orbital scale;
- soft opacity layering instead of a binary or surface-coloured mask;
- visible separation from land/ocean and readable elevation near the limb;
- stable sun-facing highlights and shaded interiors from the native Takram lighting/BSM path;
- consistent identity across opening progress;
- no salt-and-pepper breakup, planar ribbon, isolated analytic blob, or atmosphere-sized tower.

The review compares the candidate with both frozen references. Non-zero signal, projected wavelength, sample count, or connected-component area cannot independently produce a pass.

Each manual review writes schema `takram-orbital-lookdev-visual-review/v1` with reviewer identity, clean commit, candidate ID, native frame, viewport/DPR, reference hashes, per-frame hard flags, and six integer scores from `0` (fail) to `2` (clear pass): macro coherence, cloud/ground separation, depth layering, lighting/BSM read, temporal identity, and artifact freedom. Any hard flag rejects the candidate regardless of total.

When Stage B has more than two passing candidates, rank by:

1. highest six-score total;
2. highest artifact-freedom score;
3. highest depth-layering score;
4. smallest absolute coverage departure from native `0.3`;
5. smallest `H`.

Stage C/D use the same first three rules, then prefer the smallest vertical/optical departure from `1`, followed by the smallest `H`. The evidence records the full ordering. Parameters are never averaged after selection.

## 7. Runtime identity and error handling

The route adds explicit `orbitalPreset`, `orbitalCoverage`, `verticalScale`, and `opticalDepthScale` fields. It rejects:

- unknown values;
- orbital lookdev outside `view=opening`;
- orbital lookdev with a legacy `cloudScale` or `morphologyCandidate`;
- stock-weather similarity mode combined with orbital lookdev;
- runtime readback that differs from the pure resolver.

Historical stock/V3 routes remain replayable. Stage authorization is enforced by the evidence runner and checkpoint manifest, not by disabling existing query combinations globally; the runner must refuse an orbital V3 capture until its Stage D input names the committed stock winner.

The renderer fingerprint and `lookdevIdentity` include all four new parameters, the complete layer array, weather adapter identity, normalized progress/view/diagnostic, camera/Earth transform contract, runtime shader identity, resources, and existing render configuration.

Changing identity must `key`-remount the complete `<EffectComposer><Clouds/><AerialPerspective/></EffectComposer>` subtree. Toggling only `clouds.temporalUpscale` is not a valid reset because it rebuilds CloudsPass history but leaves ShadowPass history intact. Capture readiness must prove that cloud current/resolve/history and shadow current/resolve/history allocation generations all changed, and that cloud, resolve, and shadow frame metadata begin from the same new epoch before the 32-frame convergence count starts. Resource load, resize, context restore, visibility loss, or runtime drift discards the current epoch and remounts/rewarms it.

This remount policy is for deterministic fixed-query lookdev captures. A continuously animated production camera requires a separate camera-cut/history-invalidation contract.

## 8. Test and evidence strategy

### Unit tests

- exact ECEF repeat values and `20:1` hierarchy;
- exact effective turbulence-domain values and cube-face seam diagnostic classification;
- native vertical/ray/step/light values during Stage A;
- `height × densityScale` invariant during vertical tuning;
- correct extinction scaling for vertical and optical-depth changes;
- all active cloud tops remain below atmosphere top;
- invalid combinations fail without legacy fallback;
- every lookdev parameter changes the history epoch;
- identity remount changes all cloud and shadow render-target allocation generations;
- runtime fingerprint/readback includes every tuned field.

### Browser verification

- native `coverage=0.3` control reproduces the existing unscaled opening fingerprint;
- sequential changes to preset, coverage, vertical scale, optical depth, progress, resource generation, resize, visibility, and context restoration each remount the composer subtree and restart cloud/shadow history in one epoch;
- one deterministic System Chrome capture generates the bounded funnel contact sheets;
- rejected stages cannot invoke later capture or GPU tasks.

### Evidence manifest

Record the clean commit, query, requested contract, runtime readback, renderer fingerprint, history epoch, package/shader/patch hashes, screenshot hashes, reviewer decision, and exact stop/unlock state. Raw diagnostic populations are generated only for the final winner.

Setup failures, missing references, runtime drift, incomplete history reset, unsupported timer queries, and invalid/disjoint populations remain explicit evidence states. They may block the affected stage but may not be converted into a visual or performance failure.

## 9. Completion boundary

This design is complete when the query-only funnel produces either:

1. one stock `ORBITAL_LOOKDEV_WINNER`, its V3 weather-texture classification, and formal cost evidence; or
2. `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED`, proving only that this bounded parameter contract did not reach the target.

The second result ends repeated unbounded parameter sweeps. It does not automatically authorize or blame a replacement weather asset, renderer, mip patch, or semantic-layer design; any next direction must cite the captured failure stage in a separate amendment.
