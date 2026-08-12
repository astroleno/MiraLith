# LuBirth Takram Orbital Lookdev Parameter Tuning Design

**Status:** Awaiting written-spec review

**Date:** 2026-08-12

**Scope:** Query-only Takram parity route; stock-first orbital opening lookdev

**Supersedes:** Further work on `PUBLIC_PARAMETER_SIMILARITY`, the rejected mip hypothesis, and uniform `S=80/120/160` scaling

## 1. Decision

LuBirth will keep the native `@takram/three-clouds` renderer and tune it specifically for the existing space-only opening camera. The next spike is a parameter lookdev exercise, not a renderer rewrite, planet rescale, near-ground cloud system, or shader-coordinate experiment.

The central correction is to stop treating cloud scale as one isotropic value. Orbital imagery needs large horizontal weather structures while retaining plausible vertical cloud thickness. The new contract therefore separates:

- horizontal shape/detail wavelength;
- horizontal stock-weather domain;
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

> Takram's native vertical and optical system can produce the target orbital volume if only the horizontal weather and noise wavelengths are enlarged, followed by small bounded adjustments to coverage, vertical thickness, and optical depth.

This hypothesis is falsifiable. If the frozen stock-weather funnel produces no visual winner, the checkpoint is `ORBITAL_PARAMETER_TUNING_FAIL`; the next proposal must change the weather source rather than continue expanding the parameter matrix.

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

### 4.1 Horizontal preset

The horizontal preset changes only shape/detail repeat and the stock-weather repeat:

| Preset | Horizontal scale `H` | `shapeRepeat` | Shape wavelength | `shapeDetailRepeat` | Detail wavelength | `localWeatherRepeat` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `native` | 1 | `0.0003` | `3.333 km` | `0.006` | `0.167 km` | `[100,100]` |
| `h40` | 40 | `0.0000075` | `133.333 km` | `0.00015` | `6.667 km` | `[2.5,2.5]` |
| `h80` | 80 | `0.00000375` | `266.667 km` | `0.000075` | `13.333 km` | `[1.25,1.25]` |
| `h120` | 120 | `0.0000025` | `400 km` | `0.00005` | `20 km` | `[0.8333333333333334,0.8333333333333334]` |

For every preset:

```text
shapeRepeat = officialShapeRepeat / H
shapeDetailRepeat = officialShapeDetailRepeat / H
localWeatherRepeat = [100 / H, 100 / H]
shape/detail hierarchy = 20:1
```

Layer altitude, layer height, density, turbulence displacement, ray distances, step sizes, extinction thresholds, iteration counts, mip behaviour, BSM settings, temporal settings, and all light parameters stay native during horizontal selection.

### 4.2 Coverage

Coverage is a separate scalar, never baked into a horizontal preset:

- `0.4` is the stock native control and Stage A comparison value;
- `0.3`, `0.45`, and `0.55` are the bounded Stage B lookdev values.

Coverage changes must reset cloud, shadow, and resolve history.

### 4.3 Vertical thickness

Vertical tuning is permitted only after horizontal morphology passes. For every non-empty layer:

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

Optical depth is tuned only after one horizontal/coverage/vertical candidate passes morphology:

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
coverage=0.4
verticalScale=1
opticalDepthScale=1
```

This confirms that the new contract reproduces the current unscaled stock opening before any lookdev comparison.

### Stage A — horizontal-only selection

Capture exactly three stock candidates at all four opening progress values:

```text
h40 / coverage 0.4 / vertical 1 / optical 1
h80 / coverage 0.4 / vertical 1 / optical 1
h120 / coverage 0.4 / vertical 1 / optical 1
```

No other field may differ. Select at most two candidates that show coherent orbital cloud masses without reading as a surface stain.

If none passes, stop with:

```text
ORBITAL_PARAMETER_TUNING_FAIL
WEATHER_SOURCE_AMENDMENT_REQUIRED
```

Do not proceed to coverage, vertical, optical, V3, stage readback, or GPU timing.

### Stage B — coverage selection

For each Stage A survivor, capture `coverage=0.3/0.45/0.55` while keeping horizontal preset, vertical scale `1`, and optical depth `1` fixed. Select exactly one coverage per horizontal preset.

Keep at most two survivors. If none passes, stop with `ORBITAL_COVERAGE_LOOKDEV_FAIL`.

### Stage C — vertical separation

For each Stage B survivor, capture `verticalScale=1/2/4` with optical depth invariant and all horizontal/coverage fields frozen. This stage asks only whether the cloud deck gains readable limb elevation and soft internal layering.

Keep one overall winner. If macro morphology passes but all three vertical values remain flat, stop with `ORBITAL_VERTICAL_PROFILE_FAIL`.

### Stage D — optical-depth finish

For the single Stage C winner, capture `opticalDepthScale=0.75/1/1.5`. Select the value with readable bright tops, non-crushed shaded cores, and stable cloud/ground separation across all four frames.

The result is the sole `ORBITAL_LOOKDEV_WINNER`. Do not average parameters between candidates after review.

### Stage E — V3 weather swap

Only after a stock winner exists, apply the exact same Takram renderer contract to V3. Stock and V3 may differ only in enumerated weather-adapter fields.

- Stock pass + V3 pass: `V3_ORBITAL_WEATHER_PASS`.
- Stock pass + V3 fail: `V3_WEATHER_INPUT_FAIL`; retain the Takram stock winner and treat a new global weather source as a separate asset task.

V3 failure must not invalidate the Takram renderer or restart parameter tuning.

### Stage F — formal evidence and cost

Only the visual winner receives exact-frame cloud-on/off, BSM-off, cloud-raw, pre-temporal, history, AerialPerspective input, and final composite captures.

GPU timing must cover BSM generation, cloud raymarch, temporal resolve, AerialPerspective, and final composite:

- `p95 ≤ 4 ms`: `SPIKE_VIABLE`;
- `p95 ≤ 3 ms`: eligible for a later production-promotion amendment;
- `p95 > 4 ms`: `ORBITAL_LOOKDEV_OVER_BUDGET`.

This plan does not promote the winner into the homepage.

## 6. Visual acceptance

The authoritative output is a fixed-size contact sheet containing progress `0.00/0.06/0.12/0.18` plus cloud-off controls. Automated measurements are diagnostics only.

Every winning frame must show:

- a small number of coherent cloud systems at orbital scale;
- soft opacity layering instead of a binary or surface-coloured mask;
- visible separation from land/ocean and readable elevation near the limb;
- stable sun-facing highlights and shaded interiors from the native Takram lighting/BSM path;
- consistent identity across opening progress;
- no salt-and-pepper breakup, planar ribbon, isolated analytic blob, or atmosphere-sized tower.

The review compares the candidate with the committed NASA reference board and Takram upstream control. Non-zero signal, projected wavelength, sample count, or connected-component area cannot independently produce a pass.

## 7. Runtime identity and error handling

The route adds explicit `orbitalPreset`, `orbitalCoverage`, `verticalScale`, and `opticalDepthScale` fields. It rejects:

- unknown values;
- orbital lookdev outside `view=opening`;
- orbital lookdev with a legacy `cloudScale` or `morphologyCandidate`;
- stock-weather similarity mode combined with orbital lookdev;
- runtime readback that differs from the pure resolver.

Historical stock/V3 routes remain replayable. Stage authorization is enforced by the evidence runner and checkpoint manifest, not by disabling existing query combinations globally; the runner must refuse an orbital V3 capture until its Stage D input names the committed stock winner.

The renderer fingerprint and temporal history epoch include all four new parameters, the complete layer array, weather adapter identity, camera/Earth transform, runtime shader identity, resources, and existing render configuration. Any change resets cloud, shadow, and resolve history before frame counting begins.

## 8. Test and evidence strategy

### Unit tests

- exact horizontal repeat values and `20:1` hierarchy;
- native vertical/ray/step/light values during Stage A;
- `height × densityScale` invariant during vertical tuning;
- correct extinction scaling for vertical and optical-depth changes;
- all active cloud tops remain below atmosphere top;
- invalid combinations fail without legacy fallback;
- every lookdev parameter changes the history epoch;
- runtime fingerprint/readback includes every tuned field.

### Browser verification

- native control reproduces the existing unscaled opening fingerprint;
- sequential changes to preset, coverage, vertical scale, and optical depth each restart at native frame 1;
- one deterministic System Chrome capture generates the bounded funnel contact sheets;
- rejected stages cannot invoke later capture or GPU tasks.

### Evidence manifest

Record the clean commit, query, requested contract, runtime readback, renderer fingerprint, history epoch, package/shader/patch hashes, screenshot hashes, reviewer decision, and exact stop/unlock state. Raw diagnostic populations are generated only for the final winner.

## 9. Completion boundary

This design is complete when the query-only funnel produces either:

1. one stock `ORBITAL_LOOKDEV_WINNER`, its V3 classification, and formal cost evidence; or
2. a deterministic early failure proving that the existing stock weather cannot reach the target through the bounded parameter contract.

The second result is useful: it ends repeated Takram parameter sweeps and authorizes a separate global-weather-asset design without blaming the renderer.
