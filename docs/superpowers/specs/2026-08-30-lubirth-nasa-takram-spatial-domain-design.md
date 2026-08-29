# LuBirth NASA–Takram Spatial-Domain Visual Remediation Design

**Status:** Proposed for implementation planning

**Date:** 2026-08-30

**Scope:** LuBirth planetary-cloud production look, spatial-domain decoupling, causal evidence, and gated promotion

**Supersedes:** The visual-remediation portion of the closed orbital production sampling/lookdev experiment; it does not alter that experiment's evidence or terminal result

**Consumes:** The confirmed `perspectiveStepScale=1.0001` sampling baseline, existing Takram cloud runtime, and the frozen NASA-lite derived weather asset

## 1. Decision

The selected architecture is a three-domain cloud model:

1. **NASA macro weather domain** controls where clouds and clear air occur at approximately 500–2000 km organization scales.
2. **Takram meso volume domain** controls connected cloud bodies, thickness, and separation from the surface at 40/80/160 km shape wavelengths.
3. **Takram micro finish domain** controls edge erosion, local density variation, lighting, and self-shadow at 4/8/16 km detail wavelengths.

The production target is:

> NASA-like large-scale weather organization and restrained atmosphere, combined with clearly readable Takram local volume, illumination, and self-shadow.

The previous orbital production experiment restored trustworthy sampling signals and completed its evidence system, but it did **not** deliver this visual target. Its Stage 1 result remains `ORBITAL_PUBLIC_STEP_POLICY_QUALITY_FAIL`: all non-control candidates showed a regular checker/dot fragmentation pattern. Passing implementation tests, sampling metrics, or an evidence resolver is not equivalent to visual completion.

This design authorizes a new visual-remediation experiment. It does not authorize continuing the old Stage 2/4 sequence, rewriting the shader, or promoting anything to the homepage before the new final-stock gate passes.

## 2. Established evidence and failure diagnosis

The following are treated as established inputs rather than reopened questions:

- `perspectiveStepScale=1.0001` is the healthy production sampling baseline and remains fixed throughout morphology and lookdev work.
- The former `h120` label did not mean a 120 km unified cloud scale. It resolved to approximately 400 km shape wavelength, 20 km detail wavelength, and 0.833 local-weather repeat.
- `presentationScale` therefore couples unrelated spatial domains and cannot remain the experimental control surface.
- Current runtime plumbing can already apply weather repeat, shape repeat, detail repeat, and vertical scale independently. The primary change is to replace the coupled contract and add causal evidence around those independent controls.
- The previous fine/confirmed machine sampling candidates were structurally healthy, yet visually failed. Connected-component metrics alone are insufficient because the repeated dot lattice can appear as many locally valid cloud pixels.
- Full-resolution no-temporal output is useful evidence but cannot, by itself, prove that temporal resolve caused or did not cause the grid. Attribution requires pre-temporal output, frame-1 resolve, and frame-2→32 history evolution.

The known build-provenance weakness is also in scope: the old fingerprint covered only five Next manifests and did not cryptographically bind the complete served build file set to `productionArtifactCommit`.

## 3. Approaches considered

### 3.1 Selected: independent NASA weather plus Takram volume and finish

This route directly represents the desired image hierarchy. It preserves the proven Takram renderer and existing NASA-derived asset while making each spatial domain independently testable.

### 3.2 Rejected for this phase: continue tuning Takram repeat only

This is a smaller code change, but it does not supply the required planetary weather organization. It is likely to continue producing statistically uniform cloud islands even if local volume improves.

### 3.3 Deferred: weather/shader rewrite

A rewrite may eventually offer a higher ceiling, but the current public parameters and asset path have not yet been shown incapable of meeting the target. It would also combine morphology, sampling, mapping, and lighting changes into an untraceable intervention.

The new experiment may terminate with a specific shader-remediation recommendation, but it may not silently cross that boundary.

## 4. Scope and immutable evidence

The old evidence root and its terminal outcome are immutable:

```text
docs/lubirth-planetary-cloud-evidence/2026-08-13/
  takram-orbital-production-step-policy/
```

All new formal evidence is published under:

```text
docs/lubirth-planetary-cloud-evidence/2026-08-30/
  takram-nasa-spatial-domain/
```

No file in the old root may be rewritten, relabeled, or reused as a formal artifact in the new run. A new run ID, build identity, capture identity, manifest, reviewer submission, resolver decision, checkpoint, and outcome are required.

The experiment uses:

- System Chrome
- 1440×960 viewport
- DPR 1
- progress `0`, `0.06`, `0.12`, `0.18`
- fresh-mount base/repeat pairs
- fixed `perspectiveStepScale=1.0001`
- no homepage wiring or promotion before final-stock acceptance

Coverage is stage-specific: D1 reproduces the old failure at `0.55`; D2–D4 use `0.3`. This exception must be represented in the typed case contract and in every artifact identity.

## 5. Three-domain contract

### 5.1 Macro weather domain

The typed weather bundle is one of:

```ts
type WeatherDomain = "stock-local-control" | "nasa-global-v1"
```

`nasa-global-v1` freezes:

- runtime asset: `/assets/lubirth/takram-parity/v3/weather.png`
- asset SHA-256: `ff2b7715cc59a4031a7eb6ff7e77ce52a730996c9dfe9d529dfa25aa01481a9b`
- dimensions: 2048×1024 RGBA
- `globalWeatherMapping=true`
- weather repeat `[1, 1]`
- weather offset `[-0.045, 0.018]`
- the existing spherical direction/orientation mapping, recorded and hashed in the contract

Only this weather-domain bundle may differ between D2 control and NASA arms. Both arms use the same new explicit Takram layer array, layer hash, `disableDefaultLayers` value, sampling, coverage, optical parameters, view, progress, and build.

The experiment reuses the frozen weather asset and spherical mapping only. It does not inherit the complete V3 adapter, V3 layer remapping, or unrelated V3 policy.

### 5.2 Meso shape domain

Shape is expressed as a physical wavelength rather than a presentation preset:

```ts
type ShapeWavelengthKm = 40 | 80 | 160
shapeRepeat = 1 / (shapeWavelengthKm * 1_000)
```

The values correspond to repeats `0.000025`, `0.0000125`, and `0.00000625`. They govern the Takram 3D shape field only and do not modify weather or detail mapping.

### 5.3 Vertical volume domain

```ts
type VerticalScale = 2 | 4 | 8
```

Vertical scale is restored before finish tuning. `v1` is not a prerequisite candidate because the existing output has not demonstrated readable volume there. The full D3 shape×vertical factorial must run; `v4` is not assumed to win.

Density/extinction compensation required to preserve optical mass is explicitly recorded as a derived value. It may not alter weather or horizontal wavelengths.

### 5.4 Micro detail domain

```ts
type DetailWavelengthKm = "off" | 4 | 8 | 16
detailRepeat = detailWavelengthKm === "off"
  ? 0
  : 1 / (detailWavelengthKm * 1_000)
```

The `off` arm is a causal control. Detail changes may not alter the macro cloud mask enough to disguise a morphology failure.

### 5.5 Explicit layer ownership

The new spatial-domain contract owns one explicit Takram layer array. When a custom layer array is present, `disableDefaultLayers` must be `true`; any other state is a setup-invalid artifact.

The layer array is serialized canonically and SHA-256 hashed. A candidate cannot be compared or replayed unless its stored layer hash matches the resolved runtime layer hash.

### 5.6 Retired control surface

`presentationScale` is not an experimental dimension in the new pipeline. Compatibility code may continue to parse the legacy field for old evidence, but new cases are resolved from `WeatherDomain`, `ShapeWavelengthKm`, `VerticalScale`, and `DetailWavelengthKm` independently. No new preset may infer one domain from another.

## 6. D0 — complete build identity

D0 binds each formal run to the complete set of files served from `.next`, not merely a small list of manifests.

The build manifest generator must:

1. enumerate regular files below the served production build root in stable POSIX lexical order;
2. exclude mutable runtime material that is not served as build input, such as logs, locks, traces, temporary files, and the evidence output itself;
3. record relative path, byte length, and SHA-256 for every included file;
4. compute `buildTreeSha256` from the canonical JSON entry array;
5. bind `buildTreeSha256`, `productionArtifactCommit`, build command, Node version, package-manager version, and resolved public asset hashes into a signed-by-content run identity;
6. verify the complete tree before each formal capture and again before publication.

Any missing, additional, changed, or unreadable included file resolves to `NASA_TAKRAM_BUILD_IDENTITY_INVALID`. An artifact captured against one tree cannot be published under another tree identity.

## 7. Common evidence and structural gates

Each capture identity includes at least:

- run ID and stage
- build identity and production commit
- case ID and full resolved spatial-domain contract
- progress and fresh-mount repetition
- frame index and temporal mode
- view, viewport, DPR, browser identity, and GPU renderer
- source bundle and resolved layer hashes
- expected output buffer inventory

Each formal visual case emits lossless raw buffers appropriate to its stage, derived metrics JSON, review images, and capture metadata. Manifest publication is atomic: artifacts are generated in staging, independently hashed and length-checked, then renamed into the formal root only after resolver acceptance of structural integrity.

Common invalid conditions include:

- non-finite or structurally invalid sample counts
- `detail > shape`, `shape > primary`, or `primary > 500`
- missing expected buffer or unexpected formal-root file
- asset, layer, build, orientation, or capture identity mismatch
- custom layers with `disableDefaultLayers !== true`
- wrong stage coverage or mutable sampling policy
- base/repeat mount reuse
- manifest hash or byte-length mismatch

Sampling structure remains valid under:

```text
0 <= detail <= shape <= primary <= 500
```

There is no global `nativeHitFraction >= 0.2` gate because healthy NASA weather intentionally contains large clear-air regions. Signal gates are conditioned on weather-defined cloudy regions and paired with explicit clear-region preservation.

## 8. Periodic grid metric

The checker/dot failure requires a dedicated `periodicGridZ` metric computed from the lossless cloud alpha field, not from a tone-mapped contact sheet.

For each progress and repetition:

1. select the planet/cloud region of interest from the deterministic planet mask;
2. use lossless cloud alpha and remove its low-frequency trend with a fixed Gaussian low-pass whose sigma is one eighth of the smaller ROI dimension;
3. apply a Hann window and compute the 2D power spectrum of the residual;
4. exclude DC, spatial wavelengths below 4 pixels, and wavelengths above one quarter of the smaller ROI dimension;
5. convert remaining power to log power;
6. find a symmetric peak pair on each of two approximately orthogonal axes, allowing ±10° from orthogonality and ±10% wavelength disagreement within each symmetric pair;
7. compute the robust z-score of the weaker axis peak as `(peak - median) / (1.4826 * MAD)` over the eligible spectral annulus;
8. report that weaker-axis score as `periodicGridZ`, together with dominant wavelengths and angles.

If no valid symmetric near-orthogonal pair exists, `periodicGridZ=0`. A valid morphology candidate requires `periodicGridZ <= 6` at all four progress values in both fresh mounts. A non-finite value or degenerate MAD is evidence-invalid unless the eligible spectrum is exactly constant, in which case the score is zero.

This metric is a machine alarm, not a substitute for human review. Human reviewers still reject any visible regular lattice, checkerboard, dot matrix, or evenly separated repeated fragments.

## 9. D1 — temporal causal localization

### 9.1 Matrix

D1 reproduces the failed `h120` spatial baseline at coverage `0.55` with all other old visual parameters frozen. It captures:

- temporal upscale enabled at accumulated frames `1`, `2`, `4`, `8`, `16`, `32`;
- pre-temporal/current-frame cloud buffer at each required frame;
- frame-1 resolved output, which has no prior accumulated history;
- frame-2→32 resolved/history outputs;
- temporal upscale disabled at full resolution as an auxiliary comparison.

The old resolved/final failure reference is copied only by hash/reference into the new diagnostic report; it is not republished as a new formal capture.

### 9.2 Metrics

For every progress, D1 records:

- `preTemporalPeriodicGridZ`
- `frame1ResolvePeriodicGridZ`
- `historyPeriodicGridZ[2,4,8,16,32]`
- full-resolution no-temporal `periodicGridZ`
- alpha-mask IoU and mean absolute alpha delta between comparable outputs
- history convergence deltas for alpha and luminance
- sample-count structural metrics

A stage has a grid when either `periodicGridZ > 6` or human review marks visible regular grid/fragments. Human evidence takes precedence when machine detection misses a visible failure.

### 9.3 Attribution rules

`NASA_TAKRAM_TEMPORAL_PATH_BLOCKED` requires all of the following:

- pre-temporal outputs are grid-free at every progress and both mounts;
- frame-1 resolved output or later history first introduces the grid;
- the grid persists or strengthens through frame 32;
- full-resolution no-temporal is grid-free as supporting evidence;
- sampling and evidence structure are valid.

The decision records whether the first failing point is `frame-1-resolve` or `history-accumulation`.

`NASA_TAKRAM_SPATIAL_REMEDIATION_READY` requires the grid to be present in pre-temporal output at any progress in both mounts, or to remain present in full-resolution no-temporal while pre-temporal evidence is consistent. This excludes temporal resolve as the sole cause and authorizes D2/D3.

`NASA_TAKRAM_TEMPORAL_CAUSALITY_INCONCLUSIVE` applies when buffers disagree across mounts, the failure appears at inconsistent pipeline points, required comparisons are not geometrically comparable, or no causal rule above is satisfied. It blocks parameter tuning until the diagnostic contract is repaired or expanded.

Full-resolution no-temporal output never independently selects an outcome.

## 10. D2 — macro weather proof

### 10.1 Matrix

D2 runs only after `NASA_TAKRAM_SPATIAL_REMEDIATION_READY` and compares:

| Arm | Weather | Shape | Detail | Vertical | Coverage | Optical |
|---|---|---:|---:|---:|---:|---:|
| control | `stock-local-control` | 80 km | 8 km | 4 | 0.3 | 1 |
| NASA | `nasa-global-v1` | 80 km | 8 km | 4 | 0.3 | 1 |

Only the weather-domain bundle differs. A mismatch in layer hash, `disableDefaultLayers`, sampling, view, progress, coverage, optical settings, or non-weather asset identity invalidates the comparison.

### 10.2 Machine gates

The NASA arm must satisfy at every progress and both mounts:

- weather-to-cloud macro Spearman correlation `>= 0.50` after both fields are downsampled to the fixed macro analysis grid;
- clear-region cloud leakage `<= 0.05` in the weather-defined clearest quintile;
- clear-region preservation `>= 0.90` relative to the NASA weather mask;
- weather response magnitude greater than `max(0.01, 3 × repeatNoiseFloor)` when compared with the control arm;
- `periodicGridZ <= 6`;
- largest connected cloudy-region fraction `>= 0.25` within weather-defined cloudy regions;
- small-fragment cloudy-area fraction `<= 0.08`;
- no common structural invalid condition.

`repeatNoiseFloor` is measured from fresh-mount base/repeat pairs, not assumed.

### 10.3 Human gate

Reviewers score each progress independently and must confirm:

- recognizable cloud bands, fronts, swirls, or coherent large systems;
- meaningful large clear-air areas rather than uniform coverage;
- no obvious equirectangular seam or spherical orientation error;
- no regular checker/dot fragmentation;
- overall macro organization is materially more planetary and restrained than the stock-local control.

The NASA arm passes only if all four progress views pass all items. D2 outcomes are `NASA_TAKRAM_MACRO_WEATHER_PASS`, `NASA_TAKRAM_MACRO_WEATHER_MACHINE_FAIL`, `NASA_TAKRAM_MACRO_WEATHER_QUALITY_FAIL`, or a higher-priority structural outcome.

## 11. D3 — connected meso volume

### 11.1 Matrix

D3 uses `nasa-global-v1`, detail 8 km, coverage 0.3, optical 1, and the full factorial:

```text
shape:    40, 80, 160 km
vertical: 2, 4, 8
```

All nine cases are captured. No early visual favorite may remove a cell from the matrix.

### 11.2 Machine gates

Each case must retain the D2 macro weather gates and satisfy:

- `periodicGridZ <= 6` at every progress and mount;
- small-fragment cloudy-area fraction `<= 0.08`;
- single-pixel fragment fraction `<= 0.02`;
- edge-dominated cloudy-area fraction `<= 0.65`;
- cloudy-mask IoU against the accepted D2 NASA mask `>= 0.80`, preventing shape/vertical tuning from replacing the macro weather organization;
- deterministic limb-thickness proxy increases monotonically from v2→v4→v8 for each shape wavelength, with a minimum v2→v8 response above `3 × repeatNoiseFloor`;
- no cloud/ground intersection regression in the fixed limb inspection band;
- healthy sample-count structure.

### 11.3 Human gate and ranking

Reviewers score 1–5 for:

- connected cloud bodies rather than isolated islands;
- readable vertical thickness and separation from the surface;
- natural large-to-medium hierarchy;
- absence of grid, tiling, banding, or inflated blanket-cloud appearance.

`isolatedFragments=true`, `surfaceIntersection=true`, or `regularGrid=true` is an immediate case failure regardless of numeric score. A survivor needs every dimension `>= 3`, mean `>= 3.5`, and no boolean failure at all progress values. At most two survivors advance, ranked by human mean, then lower `periodicGridZ`, then lower small-fragment fraction.

D3 may produce `NASA_TAKRAM_MESO_VOLUME_PASS`, `NASA_TAKRAM_MESO_VOLUME_MACHINE_FAIL`, or `NASA_TAKRAM_MESO_VOLUME_QUALITY_FAIL`.

## 12. D4 — micro detail selection

For each of at most two D3 survivors, D4 captures detail `off`, 4 km, 8 km, and 16 km with all other fields frozen.

A detail candidate must:

- preserve cloudy-mask IoU `>= 0.90` against its detail-off control;
- create an internal alpha-structure response greater than `max(0.01, 3 × repeatNoiseFloor)` in weather-cloudy regions;
- retain all D3 morphology and grid gates;
- avoid increasing small-fragment cloudy area by more than `0.03` absolute over detail-off;
- avoid macro leakage or seam regression.

Human review requires natural edge erosion and readable local density variation without sand, stipple, boiling, repeated cells, or destruction of the accepted meso bodies. A case needs all four progress views to pass. One morphology contract advances, producing `NASA_TAKRAM_MICRO_DETAIL_PASS` or the corresponding machine/quality failure.

## 13. D5 — finish and lighting

D5 changes one family at a time on the single accepted morphology:

1. coverage `0.3`, `0.4`, `0.45`, `0.55` with optical 1;
2. optical `0.75`, `1`, `1.5` at the selected coverage;
3. selected native lighting versus BSM off;
4. selected native lighting versus light shafts off.

Coverage is selected first and frozen before optical evaluation. Optical is then frozen before lighting ablations. Exposure, tone mapping, and unrelated atmosphere parameters remain fixed.

Coverage/optical candidates must preserve accepted macro organization, grid and fragmentation gates. Lighting ablations must use density-identical captures: sample-count distributions and cloud alpha masks must remain within the repeat noise envelope. If turning BSM or shafts off changes density/morphology beyond that envelope, the comparison is invalid rather than evidence of lighting quality.

Human finish rubric, scored 1–5 at every progress, requires:

- restrained NASA-like planetary atmosphere;
- clearly readable lit face and backlit/shadowed face;
- local volume thickness rather than flat texture;
- visible but natural self-shadow contribution;
- useful edge erosion without speckle;
- no excessive darkness, red cast, surface sticking, grid, seam, or blanket coverage.

Every item must score `>= 3`, the mean must be `>= 4`, and native must materially outperform the relevant BSM-off comparison in self-shadow/volume without creating a machine regression. The stage resolves to `NASA_TAKRAM_FINISH_PASS`, `NASA_TAKRAM_FINISH_MACHINE_FAIL`, or `NASA_TAKRAM_FINISH_QUALITY_FAIL`.

## 14. D6 — production closure

D6 is authorized only by `NASA_TAKRAM_FINISH_PASS`.

It runs, in order:

1. GPU submission/timing classification on the accepted contract;
2. final-stock replay from a clean build using the exact stored contract and complete D0 build identity;
3. V3 compatibility replay that verifies the frozen weather asset and mapping without inheriting unrelated V3 layer policy;
4. homepage promotion proposal, not automatic homepage mutation.

The final-stock replay must reproduce all common structural gates, macro weather metrics, morphology metrics, periodic-grid metrics, and human rubric. GPU success cannot override visual failure. A V3 mismatch blocks V3 compatibility but does not silently alter the accepted Takram contract.

The success outcome is `NASA_TAKRAM_PRODUCTION_VISUAL_PASS`. Any terminal result before this outcome is an informative experiment closure, not delivery of the requested visual.

## 15. Resolver model

Resolver precedence is fixed:

```text
setup/build identity
  → sampling/evidence structure
  → stage-specific machine gates
  → human visual gates
  → survivor ranking
  → next-stage authorization
```

Human boolean defects such as regular grid, isolated fragments, surface intersection, seam, or incoherent macro weather take precedence over otherwise passing aggregate scores.

The outcome registry includes:

- `NASA_TAKRAM_BUILD_IDENTITY_INVALID`
- `NASA_TAKRAM_EVIDENCE_INVALID`
- `NASA_TAKRAM_SAMPLING_INVALID`
- `NASA_TAKRAM_TEMPORAL_CAUSALITY_INCONCLUSIVE`
- `NASA_TAKRAM_TEMPORAL_PATH_BLOCKED`
- `NASA_TAKRAM_SPATIAL_REMEDIATION_READY`
- D2/D3/D4/D5 machine and quality fail outcomes
- D2/D3/D4/D5 pass outcomes
- `NASA_TAKRAM_GPU_BLOCKED`
- `NASA_TAKRAM_FINAL_STOCK_REPLAY_FAIL`
- `NASA_TAKRAM_V3_COMPATIBILITY_FAIL`
- `NASA_TAKRAM_PRODUCTION_VISUAL_PASS`

Every terminal outcome writes a decision JSON, checkpoint JSON, manifest, and `OUTCOME.md`. Unauthorized later-stage directories must not exist, and closure tests verify that absence.

## 16. Evidence topology

```text
takram-nasa-spatial-domain/
  build/
  stage-d1-temporal/
    raw/
    metrics/
    contact-sheets/
    review/
  stage-d2-weather/
  stage-d3-volume/
  stage-d4-detail/
  stage-d5-finish/
  stage-d6-gpu/
  final-stock/
  v3-compatibility/
  decisions/
  checkpoints/
  manifest.json
  OUTCOME.md
```

Stage directories are created only when authorized. Diagnostic staging directories remain outside the formal root and cannot be mistaken for published evidence.

## 17. Component design

Implementation planning should preserve focused ownership:

- `TakramOrbitalSpatialDomainContract.ts` — typed independent weather/shape/detail/vertical contract, canonical serialization, hashes, and legacy compatibility boundary.
- `TakramOrbitalPeriodicGridMetrics.ts` — deterministic spectral grid analysis and metric schema.
- `TakramOrbitalTemporalCausalityMetrics.ts` — frame-stage comparisons and D1 attribution inputs.
- `TakramOrbitalSpatialDomainMetrics.ts` — D2–D5 macro, morphology, mask-preservation, thickness, and finish metrics.
- `TakramOrbitalSpatialDomainPolicy.ts` — outcome registry, precedence, gates, ranking, and stage authorization.
- `TakramProductionBuildIdentity.ts` — complete served-build manifest and commit binding.
- `TakramOrbitalSpatialDomainEvidence.ts` — run/case identities, artifact inventory, atomic publication, and replay validation.

Existing cloud runtime code should receive the independently resolved repeats, vertical scale, weather bundle, and explicit layers. It should not learn experiment-stage policy. Existing V3 adapter code remains separate and is used only by the explicit compatibility replay.

Browser harnesses expose deterministic capture controls and buffers; Node-side analyzers and resolvers own publication decisions. No browser page may self-declare a formal pass.

## 18. Verification strategy

Unit tests must include:

- exact wavelength-to-repeat resolution and independence between all domains;
- rejection of custom layers with `disableDefaultLayers=false`;
- stable contract/layer/weather/build hashes;
- complete build-tree additions, deletions, content changes, and excluded mutable files;
- cumulative sample counts with shape/detail values above 5 as valid;
- synthetic grid spectra at multiple angles/wavelengths, non-grid clouds, constant fields, and degenerate spectra;
- D1 attribution for pre-temporal, frame-1 resolve, history-only, auxiliary no-temporal disagreement, and inconclusive cases;
- D2 arm-identity mismatch rejection;
- D2 weather response and clear-region gates;
- D3 full-matrix authorization, thickness monotonicity, and survivor ranking;
- D4 detail-off response and mask-preservation gates;
- D5 sequential freezing and density-identical lighting ablations;
- resolver precedence and absence of unauthorized stage directories;
- manifest tamper and replay mismatch detection.

Formal browser validation includes deterministic buffer inventory checks, fresh-mount repeatability, all four progress values, all required temporal frames, and final-stock replay. Visual review uses lossless raw contact sheets with identical display transforms within each comparison.

Production verification includes both package typechecks, targeted lint, production build, focused unit suites, closure tests, browser captures, build-tree verification, manifest verification, and clean tracked worktree checks.

## 19. Completion boundary

The architecture is implemented only when the independent spatial-domain contract, metrics, evidence path, and resolver exist and verify correctly.

The **visual goal** is delivered only when a final-stock candidate receives `NASA_TAKRAM_PRODUCTION_VISUAL_PASS` and its evidence demonstrates all of the following together:

- NASA-like bands/fronts/swirls and large clear-air organization;
- connected Takram cloud bodies with visible thickness and surface separation;
- natural micro erosion and density variation;
- readable lit face, back face, and BSM self-shadow;
- no checker/dot lattice, repeated fragments, seam, or masked failure;
- reproducibility against a complete commit-bound build identity.

A temporal-blocked, machine-failed, or quality-failed terminal outcome can correctly close the experiment, but it must be reported as “visual target not delivered.” Code completion, green tests, and valid evidence never upgrade that statement.

## 20. Explicit non-goals

- No further public step-scale sweep.
- No coverage, optical, exposure, or lighting change may hide the grid before D1 attribution and D2/D3 morphology acceptance.
- No shader rewrite, density-field replacement, or new weather generator in this phase.
- No mutation of old formal evidence.
- No automatic homepage promotion.
- No claim that a coherent density signal alone proves acceptable visual quality.
