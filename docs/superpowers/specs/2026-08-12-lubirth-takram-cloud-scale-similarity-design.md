# LuBirth Takram Cloud Scale Similarity Design

**Status:** Approved architecture; implementation not started

**Date:** 2026-08-12

**Scope:** Query-only Takram parity route and evidence tooling

**Supersedes:** The active `260 km / 40 km` morphology search and the proposed sample-budget A/B

## 1. Decision

LuBirth will test a single public-parameter cloud scale, `S`, instead of independently tuning Takram shape, detail, vertical profile, density, and sampling fields. The initial candidates are `S=80`, `S=120`, and `S=160`.

The implementation is named `PUBLIC_PARAMETER_SIMILARITY`. It preserves Takram's native `CloudsEffect → temporal resolve → AerialPerspectiveEffect` architecture and applies one immutable resolver output to both stock and V3 candidates. It does not add a replacement raymarcher or a general cloud-coordinate transform.

The similarity is **surface-anchored**:

- each official layer's base altitude remains fixed;
- intrinsic cloud lengths and sampling distances scale by `S`;
- layer density and extinction rejection thresholds scale by `1/S`;
- dimensionless fields and iteration counts remain fixed.

This is an intentional presentation-domain transform, not a claim of physical similarity to terrestrial clouds.

## 2. Why the previous candidate is retired

Takram's official shape and detail repeats are approximately:

- shape: `0.0003 m⁻¹`, wavelength `3.333 km`;
- detail: `0.006 m⁻¹`, wavelength `0.167 km`;
- hierarchy: `20:1`.

The previous central candidate used `260 km / 40 km`, changing the hierarchy to `6.5:1`. Its layer heights, turbulence displacement, step lengths, ray limits, density, and extinction thresholds were not derived from the same scale. It is valid historical evidence but is not a scaled Takram control and must not participate in the new checkpoint.

The new candidates preserve the official hierarchy:

| `S` | Shape wavelength | Detail wavelength | Hierarchy |
| ---: | ---: | ---: | ---: |
| 80 | `266.667 km` | `13.333 km` | `20:1` |
| 120 | `400 km` | `20 km` | `20:1` |
| 160 | `533.333 km` | `26.667 km` | `20:1` |

## 3. Single source of truth

One pure resolver owns the entire scaled contract:

```ts
resolveTakramCloudScaleContract({
  scale: 80 | 120 | 160,
  coverageMode: "parity" | "presentation"
})
```

Its immutable result contains:

- `schemaVersion` and classification `PUBLIC_PARAMETER_SIMILARITY`;
- the requested scale and resolved coverage;
- the complete explicit official R/G/B/A layer array;
- resolved shape, detail, turbulence, Clouds, and Shadow values;
- fixed-value assertions and similarity invariants;
- whether a mip-distance patch is active, initially `false`.

The resolver must derive values from project-owned frozen copies of Takram `0.7.6` high-quality defaults. Runtime code must not duplicate `S=80/120/160` numeric presets.

Applying `qualityPreset="high"` and applying the scale contract have a strict order: construct/reset the native high preset first, then apply the resolver result. Every input, scale, coverage, resource-generation, or renderer change reapplies and reads back the complete contract.

## 4. Explicit official layer parity

Stock and V3 parity must consume the **same explicit official layer array**. Both use `disableDefaultLayers=true`; neither may rely on Takram's implicit defaults.

The project-owned unscaled source is Takram `CloudLayers.DEFAULT` expanded to all four complete entries:

| Channel | Altitude | Height | Density | Shape | Detail | Weather exponent | Shape bias | Coverage width | Shadow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| R | `750 m` | `650 m` | `0.2` | `1` | `1` | `1` | `0.35` | `0.6` | on |
| G | `1,000 m` | `1,200 m` | `0.2` | `1` | `1` | `1` | `0.35` | `0.6` | on |
| B | `7,500 m` | `500 m` | `0.003` | `0.4` | `0` | `1` | `0.35` | `0.5` | off |
| A | `0 m` | `0 m` | `0.2` | `1` | `1` | `1` | `0.35` | `0.6` | off |

All four use the official default density profile `(0, 0, 0.75, 0.25)`. A remains an explicitly empty official layer after scaling because its height is zero. V3's A weather channel does not create an additional parity cloud layer.

The resolver keeps altitude and all dimensionless layer fields fixed, sets `height × S`, and sets `densityScale ÷ S`. Consequently:

```text
scaledHeight × scaledDensityScale
= officialHeight × officialDensityScale
```

Stock and V3 may differ only in adapter-owned weather fields:

- weather texture identity and hash;
- global/local mapping mode;
- weather repeat and offset;
- texture-domain wrapping required by the source.

They must share layers, coverage, shape/detail/turbulence assets, light, camera, renderer parameters, temporal settings, BSM settings, AerialPerspective settings, exposure, and output transform within each comparison population.

## 5. Public-parameter scaling contract

The frozen Takram `0.7.6` high preset is the unscaled source. The resolver applies the following rules.

### 5.1 Divide by `S`

| Field | Official value |
| --- | ---: |
| `shapeRepeat` | `0.0003` |
| `shapeDetailRepeat` | `0.006` |
| each layer `densityScale` | explicit layer value |
| Clouds `minExtinction` | `1e-5` |
| Shadow `minExtinction` | `1e-5` |

`minExtinction` scales with density because the shader compares it with scaled participating-media extinction. Clouds and Shadow must use the same rule.

### 5.2 Multiply by `S`

| Field | Official value |
| --- | ---: |
| each layer `height` | explicit layer value |
| `turbulenceDisplacement` | `350 m` |
| Clouds `minStepSize` | `50 m` |
| Clouds `maxStepSize` | `1,000 m` |
| Clouds `maxRayDistance` | `200,000 m` |
| Clouds `minSecondaryStepSize` | `100 m` |
| Clouds `minShadowLengthStepSize` | `50 m` |
| Clouds `maxShadowLengthRayDistance` | `200,000 m` |
| Shadow `minStepSize` | `100 m` |
| Shadow `maxStepSize` | `1,000 m` |

### 5.3 Keep fixed

- layer altitude, channel, density profile, shape/detail amounts, weather exponent, shape-altering bias, coverage filter width, and shadow flag;
- Clouds and Shadow `minDensity`, because it tests rough weather before density scaling;
- Clouds and Shadow iteration counts;
- `perspectiveStepScale`, `secondaryStepScale`, and all transmittance thresholds;
- BSM cascade count, map size, filter radius, and iteration counts;
- phase, scattering, absorption, powder, sky/ground light, multi-scattering, haze, temporal, resolution, and render-target format fields;
- Earth, camera, scene depth, cloud depth, atmosphere radii, exposure, and final output transform.

Arbitrary scales are not accepted. An invalid or missing scale in a scale route returns a typed error; it must never fall back to the historical `260/40 km` candidate.

## 6. Atmosphere-domain limitation

The active Takram atmosphere has bottom radius `6,360 km` and default top radius `6,420 km`, approximately `60 km` of atmosphere. Surface-anchored scaling produces these cloud tops:

| `S` | R top | G top | B top |
| ---: | ---: | ---: | ---: |
| 80 | `52.75 km` | `97 km` | `47.5 km` |
| 120 | `78.75 km` | `145 km` | `67.5 km` |
| 160 | `104.75 km` | `193 km` | `87.5 km` |

Some scaled layers therefore extend beyond atmosphere top. This is explicitly accepted as an artistic orbital-presentation domain.

Stock and V3 remain comparable because they use the same scaled layers and atmosphere. The experiment must **not** claim official physical AerialPerspective parity, terrestrial cloud realism, or atmospheric energy conservation. A visual pass means the two inputs are comparable inside this presentation contract, not that the scaled cloud/atmosphere system is physically equivalent to Takram's unscaled Earth control.

## 7. Candidate funnel and coverage

The funnel prevents weather and coverage from hiding a failed scale control.

### Stage A — stock scale control

Run stock weather at coverage `0.3` for `S=80/120/160` on opening progress `0.00/0.06/0.12/0.18`. This stage asks only whether a readable enlarged Takram morphology exists in the product camera.

- If no stock scale passes, stop before V3.
- A stock failure does not classify V3.
- A scale entering a projected-pixel target is not a visual pass by itself.

### Stage B — parity coverage

For stock-passing scales only, run stock and V3 at coverage `0.3`. The renderer contract is identical except for the enumerated weather-adapter fields.

- Stock pass + V3 fail: `V3_WEATHER_ADAPTER_PARITY_FAIL`.
- Both pass: the scale becomes presentation-eligible.

### Stage C — presentation coverage

For presentation-eligible scales, run both stock and V3 at coverage `0.55`. Stock is retained as the same-coverage healthy control; V3 is not compared with stock `0.3`.

- Coverage `0.3` pass + `0.55` fail: `PRESENTATION_COVERAGE_FAIL`.
- A presentation winner still does not unlock Task 0P or the original Task 0–8 without the existing formal evidence checkpoint.

The initial visual funnel uses minimal deterministic source screenshots. It does not regenerate the full exact-frame/stage/GPU matrix for rejected candidates.

## 8. Public-parameter similarity and mip limitation

Takram's primary cloud march contains a hard-coded distance contribution:

```glsl
rayDistance * 1e-5
```

The public API does not expose this coefficient. Therefore the initial resolver is classified `PUBLIC_PARAMETER_SIMILARITY`, not mathematical full similarity.

The first run must keep upstream shader behavior unchanged. A mip patch is authorized only if:

1. all three stock `S` candidates fail the visual control;
2. a native mip diagnostic demonstrates premature mip escalation within the cloud-hit population as `S` grows;
3. the diagnostic is captured with the same camera, light, weather, coverage, frame, and resolver contract.

The only permitted follow-up patch introduces `mipDistanceScale`, replaces the one primary-march `1e-5` coefficient, and resolves it as:

```text
officialMipDistanceScale / S
```

It may not change shape, detail, layer, light, temporal, BSM, or sampling fields. The patch must have a distinct package/patch hash, renderer fingerprint, history epoch, unit test, and stock-only A/B evidence. Existing `mipLevelScale` usage elsewhere is not silently repurposed.

Failure of the unpatched candidates can classify the public-parameter implementation, but cannot by itself reject the broader cloud-scale direction. The allowed states are:

- `PUBLIC_PARAMETER_SIMILARITY_STOCK_PASS`;
- `PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_MIP_UNPROVEN`;
- `MIP_DISTANCE_PATCH_AUTHORIZED`;
- `PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_AFTER_MIP_CORRECTION`.

## 9. Runtime identity, history, and telemetry

Every capture publishes the requested and read-back values for:

- resolver schema/classification, scale, coverage mode, and resolved coverage;
- all four complete layer entries;
- every scaled Clouds/Shadow field and every required fixed field;
- adapter weather identity/mapping/repeat/offset;
- atmosphere bottom/top radii and the list of layers exceeding atmosphere top;
- package version, patch hash, asset hashes, renderer fingerprint, and mip-patch state.

The renderer fingerprint must include `turbulenceDisplacement`, both `minExtinction` values, the complete layer array, all scaled step/ray fields, scale, coverage, and mip-patch state. It must be built from runtime readback rather than expected constants.

The temporal history epoch includes scale, coverage mode/value, weather adapter identity, complete runtime renderer hash, resource generations, diagnostic, camera/view, and input. Changing any of them resets cloud, resolve, and shadow frames before capture.

Stock/V3 parity compares normalized fingerprints after removing only the explicitly adapter-owned weather fields. Any other difference is `RENDERER_CONTRACT_DRIFT`, not a visual result.

## 10. Visual and evidence gates

The product gate remains opening-only at progress `0.00/0.06/0.12/0.18`. Near views are diagnostic-only.

A candidate must show across all four frames:

- coherent macro cloud masses;
- readable cloud/ground separation or limb elevation;
- soft opacity layering rather than a surface-colored mask;
- lit/backlit response and visible local BSM modulation;
- stable motion identity across opening progress;
- no prominent salt-and-pepper fragmentation.

`base/core/top` remains diagnostic at orbital distance. Automated metrics, non-zero signal, or projected wavelength cannot replace visual review.

After a visual candidate exists, reuse the existing exact-frame tooling to capture:

- full/cloud-raw/cloud-off/BSM-off pairs;
- native hit/sample count;
- pre-temporal, resolved-history/AerialPerspective-input, and final output buffers;
- exact frame/jitter/STBN/history metadata and repeat noise floor;
- full artifact hashes and runtime contract.

Only after that revalidation may a separate amendment consider Task 0P GPU populations. The previous sample-budget A/B is paused and cannot run in parallel with scale selection.

## 11. Route and compatibility boundary

The query route adds typed scale and coverage-mode fields that are valid for `view=opening` with stock or V3 input. It rejects:

- unknown scales;
- scale without an explicit coverage mode;
- simultaneous `cloudScale` and legacy `morphologyCandidate`;
- scaled control-view requests;
- any scale route whose runtime readback fails the resolver invariants.

Historical morphology candidate IDs remain available only to reproduce existing evidence. They are labeled `legacy-evidence-only`, excluded from candidate generation, and cannot satisfy or alter the new checkpoint.

No homepage, `EarthMoonScene`, production composer, fallback policy, or original Task 0–8 code is changed by this spike.

## 12. Test strategy

Implementation must use test-first development.

### Unit contracts

- `S=80/120/160` preserve the official shape/detail `20:1` hierarchy.
- Every layer preserves `height × densityScale`; every altitude and dimensionless field remains exact.
- A is explicit and empty for stock and V3.
- `turbulenceDisplacement` and every enumerated length field scale by `S`.
- Clouds/Shadow `minExtinction × S` equal the official threshold.
- Clouds/Shadow `minDensity`, iteration counts, `secondaryStepScale`, and BSM filter radius remain official.
- Coverage mode resolves only to `0.3` or `0.55`.
- Stock/V3 explicit layer arrays are deeply equal and `disableDefaultLayers=true`.
- Changing any non-adapter field breaks normalized parity.
- Invalid or conflicting route fields fail without fallback.
- Scale/coverage/adapter/runtime changes alter the history epoch.
- Atmosphere-overflow telemetry identifies the correct layers at every S.

### Browser contracts

- Runtime readback equals the resolver result for both inputs.
- Stock/V3 normalized renderer fingerprints match at the same S and coverage.
- Scale and coverage switches reset to the exact first history frame.
- Minimal Stage A screenshots are generated from one clean commit and fixed System Chrome environment.
- Formal exact-frame evidence is generated only after a visual-pass candidate exists.

### Negative mip gate

No mip patch may exist in the initial implementation. If later authorized, tests must prove that only the primary-march coefficient changes and that disabling the patch restores byte-identical upstream shader source.

## 13. Implementation boundaries

The subsequent implementation plan should introduce focused modules rather than enlarge the parity pipeline further:

- a project-owned official defaults/layers module;
- a pure cloud-scale resolver and invariant checker;
- a small runtime applicator/readback adapter;
- route/telemetry/fingerprint extensions;
- scale-specific unit and browser tests;
- a new evidence directory separate from historical morphology artifacts.

The plan must keep Task 3–6, Task 0P, and the original Task 0–8 locked until the scale funnel produces and formally revalidates a V3 presentation winner.
