# LuBirth Nasa-lite rendering architecture

Status: implemented as an isolated query-only spike on 2026-07-15. Technical validation is in progress; visual acceptance is still pending, and it is not the production homepage default.

## Decision

LuBirth will keep the current single-shell cloud renderer as the far-view and low-end fallback, while an isolated `nasa-lite` path validates a bounded volumetric model derived from the local `NasaEarthRoute` mathematics.

The spike is activated only with:

```text
cloud=nasa-lite&atmosphereMode=directional-lite
```

Production promotion requires a separate visual and performance decision.

## Rendering budgets

The budget is selected from projected Earth radius divided by the shorter viewport edge. A `0.05` hysteresis band prevents repeated switching while the opening camera moves.

| Band | Projected radius / short edge | Desktop cloud | Mobile cloud | Atmosphere |
| --- | ---: | ---: | ---: | ---: |
| near | `>= 0.65` | 4 view-density samples + 1 total light sample | 2 + 1 | 4 / 2 view samples |
| middle | `0.25 .. 0.65` | 2 + 1 | 1 view-density sample | 2 / 1 view samples |
| far | `< 0.25` | 1 view-density sample | 1 view-density sample | 1 analytic sample |

`4 + 1` means at most five packed-field texture reads per cloud pixel at a stable LOD. The light lookup is shared by the view-march result; it is not nested inside every density step. During the bounded `4 → 2` or `2 → 4` crossfade, both view integrals run and share one light lookup, so the declared transient peak is seven packed-field reads for `0.42s`. Telemetry reports the active view, light, total, and stable read counts; the transient peak is part of the physical-GPU promotion gate.

## Cloud model

- Keep one cloud shell and one active packed density field.
- R stores column coverage, GB stores tangent normal, and A stores column height/thickness.
- Near and middle views intersect a bounded shell and accumulate vertical density with Beer-Lambert transmittance.
- A simplified Henyey-Greenstein phase term, a single sun-path lookup, and height-dependent extinction provide forward scattering, silver edge, lit tops, and interior attenuation.
- All 1/2/4 budgets use the same bounded density integrator. Budget transitions crossfade for `0.42s`; there is no separate 1-step surface shader. A target change during a blend is queued until the visible blend completes, preserving the current mixed frame instead of snapping to an endpoint.
- The front half of a tangent shell segment is integrated once, preventing a back-half duplicate from reading as a second rim.
- Analytic erosion/detail is derived from offset spherical UV plus shell height, so internal structure travels with the packed cloud field and is frequency-limited by sample budget.
- Each view sample evaluates analytic detail once and reuses that value for density and lighting, avoiding the former duplicate trigonometric-noise ALU.
- Ground shadow and cloud volume share one texture source and the existing shared cloud time/offset.
- The production shader must use premultiplied/normal alpha composition; the additive blending used by the local NASA study is not copied.

## Atmosphere model

- Replace the uniform 64x64 radial sprite in the spike with a sun-directional atmosphere shell.
- Integrate simplified Rayleigh and Mie density only through the atmosphere segment visible to the current pixel.
- The cloud and atmosphere radii share exported policy constants: cloud top is `1.012R`, the visible atmosphere envelope is `1.014R`, and density falloff keeps the original `0.01R` optical thickness.
- A transparent `1.020R` support mesh lets the fragment shader soften the analytic atmosphere tangent instead of exposing a hard mesh cutoff. Query-only Nasa-lite enables MSAA and uses `1.0` DPR; the standard production homepage remains at `0.85` DPR.
- Near/middle/far use 4/2/1 view samples on desktop and 2/1/1 on mobile.
- The old analytic halo remains available to the production fallback but is disabled when `directional-lite` is active.

## Assets and residency

- Lossless PNG remains the packed-field source of truth.
- The spike uses a 2K lossless packed field on desktop and the existing 1K field on mobile.
- Production promotion requires a UASTC KTX2 derivative whose decoded coverage, normal angle, and thickness errors pass generation-time thresholds. UASTC is not treated as byte-exact.
- The loader must use `KTX2Loader.detectSupport(renderer)`, ship the Basis transcoder, provide a PNG fallback, and explicitly dispose replaced textures.
- Desktop dynamically selects 4/2/1 cloud budgets from projected radius with hysteresis during the opening. Transitions are continuous and the latest mid-transition request is queued; they are not a once-per-session choice.
- A future surface path starts from 2K and upgrades once to a 4K desktop texture after first meaningful paint. Mobile remains 2K.
- Moon target is 1K desktop / 512 mobile; the saved transfer and GPU budget belongs to Earth and clouds.

The isolated spike may use PNG/WebP derivatives while the KTX2 pipeline is evaluated. That temporary resource path blocks production promotion but does not block optical-model validation.

The implemented spike currently resolves assets as follows:

| Device class | Earth day | Packed cloud field | Moon |
| --- | ---: | ---: | ---: |
| desktop | 4K WebP | 2K lossless PNG | 1K WebP |
| mobile | 2K existing asset | 1K lossless PNG | 512 WebP |

Only one packed cloud texture is created per device session. The ground-shadow shader and cloud shell use the same texture UUID and the same cloud-offset time source.

## Module boundaries

- `landingNasaLitePolicy.ts`: pure near/middle/far and desktop/mobile budget resolver.
- `LandingNasaLiteCloud.tsx`: single-shell density integration and cloud telemetry.
- `LandingDirectionalAtmosphere.tsx`: directional Rayleigh/Mie shell.
- `landingVisualPolicy.ts`: owns the final policy merge, including query/debug overrides. Both the Canvas raster configuration and `LuBirthSceneSlot` consume this resolver, so a future default-policy promotion cannot silently lose Nasa-lite MSAA or DPR.
- `useLandingTexture.ts` / a later texture-store adapter: final KTX2 loading and residency ownership.
- `LandingCloudLayer.tsx`: existing far/fallback implementation; it is not expanded with the new ray marcher.
- `EarthMoonScene.tsx`: selects the isolated cloud and atmosphere implementations without changing the production policy.

Shared cloud/atmosphere mathematics belongs in `packages/lubirth-hero`; package code must not import the app-level `NasaEarthRoute` component.

## Telemetry and acceptance

The spike exposes, for tests and manual review:

- projected-radius ratio and active band;
- requested, pending, previous, and active cloud LODs plus atmosphere sample count;
- steady and transition-time packed-field read counts, including the seven-read `4 ↔ 2` peak;
- active cloud texture source, UUID, and shell count;
- renderer texture count and estimated active texture bytes;
- GPU timer samples when `EXT_disjoint_timer_query_webgl2` is available;
- dropped-frame ratio in the performance test.

Promotion gates:

1. At 1x, near-view cloud cores must show broad internal transmission and vertical density, not only an embossed edge.
2. Backlit clouds must retain controlled forward scattering without a white ribbon, gray second shell, or black ridge.
3. The atmosphere must visibly follow the sun direction and must not read as a uniform electric-blue circle.
4. Near/middle/far motion must not reload the cloud texture or visibly pop at budget boundaries.
5. Desktop and mobile budgets must match 4/2/1 and 2/1/1 respectively.
6. TypeScript, lint, production build, shader compilation, console health, and critical visual tests must pass.
7. GPU timings are measured with timer queries where supported. rAF p95 remains only a dropped-frame smoke signal.
8. A representative physical mobile-device run is required before final production promotion.

## Spike result

The isolated renderer now implements:

- one cloud shell with 4/2/1 desktop and 2/1/1 mobile budgets;
- Beer-Lambert view transmittance, one shared sun-path lookup, packed tangent normals, and simplified HG scattering;
- a `1.003 .. 1.012` bounded shell whose column-mass extinction preserves dense cores while avoiding the former oversized white horizon ridge;
- a shared `1.014R` atmosphere envelope above that cloud top, with a separate 1% optical falloff so geometric containment does not inflate the visible haze;
- sample-budget-aware top lighting and extinction, so the 1-step far view remains a quiet atmospheric layer instead of becoming flat white paint;
- a single density model across all budgets, with a short premultiplied crossfade instead of a 2-to-1 shader-model switch;
- soft, density-derived silhouette coverage with derivative anti-aliasing; solar-offset light data no longer controls geometric occupancy;
- cloud-relative analytic erosion based on spherical UV, shared offset, height, and active LOD frequency;
- a sun-directional Rayleigh/Mie shell constrained to a 1% visual atmosphere band; low-energy coverage is softened instead of hard-discarded;
- an analytic atmosphere edge rendered on a transparent support shell, plus policy-driven Nasa-lite MSAA and `1.0` DPR without changing the standard homepage `0.85` DPR;
- 4K/2K/1K desktop spike assets and 2K/1K/512 mobile assets;
- Nasa-lite-scoped low-phase earthshine; the nearly full birth Moon keeps its direct-light calibration while a dark phase remains faintly readable;
- optional `EXT_disjoint_timer_query_webgl2` telemetry, texture residency telemetry, and focused budget/residency plus pixel-continuity tests.

The targeted test covers policy hysteresis, stable desktop 4/2/1 states, stable mobile 2/1/1 states, single-shell invariants, shared texture UUID, ground shadow, texture-memory estimate, console health, and no-reallocation checks. The reference matrix now uses the real birth time and location for near/middle/far plus a fixed 12-hour backlight sample. Pixel guards isolate cloud-on from cloud-off in the Earth body and along a deterministic cloud-bearing horizon, require non-empty daylight and backlit cloud rays, constrain fragmentation and ridge brightness, verify the birth Moon plus the expected illuminated-limb/dark-core/opposite-limb ordering of a low phase, check the diagnostic directional-atmosphere ratio, measure the maximum per-frame difference during 2-to-1 crossfade, and exercise a queued 4-to-2-to-4 reversal while recording its seven-read peak. The mobile project additionally decodes the full `2402×1082` device-pixel PNG, checks the Earth-horizon flat-run and adjacent-edge error, and repeats backlit cloud plus low-phase spatial assertions. Desktop and Pixel 7 landscape evidence is captured as lossless PNG.

Headless Chromium exposes software WebGL in the current environment, so its rAF result is recorded only as liveness and not used as a GPU promotion claim. The timer-query extension was unavailable in that run. Moving the Nasa-lite Canvas from `0.85` to `1.0` DPR raises its pixel count by about 38%; a physical mobile GPU run must validate that cost. The real birth-sun matrix and Moon separation are now calibrated and guarded, but near-view clouds still need product-level visual acceptance for broad cloud-core transmission and vertical depth. KTX2 residency and physical mobile GPU timing come after that visual gate and remain required before the query-only path can become the homepage default.
