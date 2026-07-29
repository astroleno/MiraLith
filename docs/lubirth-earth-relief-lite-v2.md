# LuBirth Earth Relief Lite V2

Status: query-only visual calibration. The production home policy remains `shell-lite` + `surface-glow` until the desktop and real-device gates below pass.

## Route

Use the independent review path:

```text
/?cloud=relief-lite&atmosphereMode=limb-lite&postEffect=off
```

`nasa-lite` remains frozen as an A/B reference. Relief Lite V2 does not reuse its raymarch loop, dynamic 4/2/1 model switching, cross-faded integrals, or runtime trigonometric density noise.
It also owns separate Relief Lite asset manifests and mobile-viewport policy;
the current files may be shared physically, but future `nasa-lite` asset or
budget changes cannot silently change the V2 path.

## Shared lighting frame

`landingPlanetLighting.ts` owns the visual semantics shared by the surface, clouds, and atmosphere:

- one mutable world-space sun direction;
- one shared cloud offset;
- consistent day, night, deep-night, and twilight masks;
- one stable equirectangular tangent basis without a latitude threshold seam.

The Earth surface, relief cloud, atmosphere, and moon receive the same scene solar direction. No V2 layer computes a replacement sun vector.

## Layer ordering

| Layer | Radius scale | Notes |
|---|---:|---|
| Earth surface | `1.0000R` | day surface, true lights-only night map, low Earthshine |
| Relief cloud bottom | `1.0003R` | displaced single shell |
| Relief cloud top | `1.0035R` | packed A-channel maximum height |
| Visible atmosphere | `1.0140R` | analytic inner/outer lobe boundary |
| Atmosphere support geometry | `1.0180R` | raster support only |

The cloud top must remain strictly below the visible atmosphere radius. Tests treat this as an invariant.

## Surface

`LandingEarthSurfaceLiteV2` uses:

- `dayMap` only for daylight and low night-side Earthshine;
- `earth-lights-only-2k.webp`, encoded as lossless WebP so decoded black pixels stay black, only under the shared deep-night mask;
- a separate narrow twilight tint;
- a cloud shadow sample using the same packed field and cloud offset as the cloud shell;
- a directional, disk-interior Fresnel haze plus narrow Kármán needle, kept
  separate from the space-side atmosphere mesh so both contributions can be
  isolated in pixel tests.

The lights-only source is generated with:

```bash
pnpm --filter @miralith/lubirth-hero generate:earth-lights-only
```

The generator rejects channel drift after decoding, a non-black source background, a
lit-pixel ratio above `24%`, or a transfer size above `360 KB`.

## Relief cloud

`LandingReliefCloud` is one shell and one packed texture:

- vertex stage: one A-channel height read displaces the actual horizon;
- mobile fragment: a fixed `3`-step shallow density integration;
- desktop fragment: the same model at `4` fixed steps;
- each fragment pass composites front-to-back transmittance; an opaque near
  sample suppresses samples behind it instead of averaging a base and
  parallax field;
- R drives coverage, GB drives tangent-space normal, A drives thickness and height;
- R is derived from thresholded coverage, while A/GB preserve the unsaturated
  source luminance and signed fine/middle/body band-pass structure. This keeps
  cloud towers and cavities inside bright cores instead of deriving every
  channel from the same blurred coverage plateau;
- GB gradients use soft saturation and bounded p90/p99/strong-normal
  distributions. The fragment shader consumes that normal once through the
  sun-facing term; height contrast is deliberately weaker and is not applied
  again as a second directional emboss;
- alpha uses Beer–Lambert extinction and premultiplied normal blending;
- low-angle viewing increases optical path length;
- no hard discard, additive cloud blend, second shell, dynamic LOD, or analytic sine noise.

Mobile and desktop use the same visual model. Both now load the same 2K packed
field as UASTC KTX2 with mipmaps and Zstd supercompression. The lossless PNG is
the generation source of truth and runtime fallback; `KTX2Loader` is bound to
the active renderer, detects GPU support, and uses a locally shipped Basis
transcoder. The compressed texture is shared by the Earth shadow and cloud
shell cache entry rather than uploaded twice.

For device profiling, append `reliefLiteGpuTimer=on`. When
`EXT_disjoint_timer_query_webgl2` is available, cloud and atmosphere telemetry
report their own draw-call `p50`/`p95`; unsupported browsers report that
capability explicitly instead of treating rAF cadence as GPU time.

## Analytic atmosphere

`LandingLimbAtmosphere` performs zero texture reads and zero integration loops. Analytic ray/sphere intersections provide path length, and two height lobes produce:

- a narrow blue-white inner arc;
- a very thin, softer blue outer falloff gated to the day side;
- a narrow red-dominant warm twilight contribution;
- a separately budgeted, extremely weak deep-night airglow instead of giving
  the outer blue lobe any fixed all-night energy.

The lobe already contains the intended bloom impression, so the query route keeps post effects off.

## Verification gates

- Day-side city-light contribution is at most `1%` of the same night-side region.
- The same day/night/twilight masks drive near, middle, and far frames.
- Cloud body structure changes away from the silhouette, not only within a narrow horizon strip.
- Packed generation rejects both flat cloud cores and unbounded high-frequency
  relief before writing either LOD, including mean, p90, p99, and the share of
  core normals above `0.65`.
- Fixed cloud offsets `0 / 0.25 / 0.5 / 0.75` must all retain visible body
  contribution while staying under local-gradient, highlight-clipping, and
  extreme-gradient ceilings. The pixel comparison builds a cloud mask from
  cloud-on versus cloud-off, then compares the fixed front-to-back integral
  against a single-sample diagnostic across every masked pixel.
- A-channel displacement measurably changes the horizon.
- The disk-interior Fresnel and boundary needle must remain independently
  measurable when the outer atmosphere and clouds are disabled.
- Cloud top is below the atmosphere, with no white second shell or black cloud ridge.
- Mobile runs at DPR `1.0` with MSAA, the 2K UASTC field, and exactly three
  cloud fragment reads.
- Desktop uses the same 2K UASTC field and exactly four cloud fragment reads.
- The analytic atmosphere reports zero texture reads and zero loop iterations.
- The night-side atmosphere has absolute mean/p90/p99 contribution ceilings;
  the twilight sample band must also retain a visible-pixel share, red p90,
  and red-dominant chroma. The day-side outer band has a small non-zero floor
  so mobile rendering does not collapse to a single hard line.
- The independent star background remains visible.
- Final promotion still requires 30-second landscape runs on iPhone Safari and Pixel Chrome without dropped-frame bursts or WebGL context loss.

## Physical-device run

Build and serve the production site on the local network, then open the validation
route from a phone on the same network:

```bash
pnpm --filter @miralith/site build
pnpm --filter @miralith/site start --hostname 0.0.0.0
```

Use the machine's LAN address instead of `LAN-IP`. Do not add a fixed `progress`
parameter: the harness must sweep the full near-to-far composition during the
30-second run.

```text
http://LAN-IP:3000/?cloud=relief-lite&atmosphereMode=limb-lite&postEffect=off&profile=nasa&quality=medium&copy=hidden&reliefLiteValidation=on&validationSeconds=30&physicalDevice=1&deviceLabel=iPhone-15-Pro
```

```text
http://LAN-IP:3000/?cloud=relief-lite&atmosphereMode=limb-lite&postEffect=off&profile=nasa&quality=medium&copy=hidden&reliefLiteValidation=on&validationSeconds=30&physicalDevice=1&deviceLabel=Pixel-9-Pro
```

Keep the browser visible and the phone in landscape until the panel finishes.
`physicalDevice=1` is an explicit operator attestation, not device detection.
The report refuses promotion evidence when `navigator.webdriver` is active, when
the browser is not iPhone Safari or Android Chrome, or when the label does not
identify an iPhone/Pixel respectively. It also embeds the Git revision and
refuses promotion evidence from an unknown or dirty build.

Download or copy the JSON after the panel shows `PROMOTABLE DEVICE EVIDENCE`.
Promotion requires one report from each target with:

- report schema `version: 2`, with the active Earth V2 surface, true lights-only
  map, shared cloud-shadow offset, independent 2K star background, exact
  `relief-lite + limb-lite + postEffect off` policy, and no active legacy
  Nasa-lite cloud;
- matching Earth/cloud/atmosphere sun directions;
- `verdict.promotableDeviceEvidence: true`;
- a known clean `build.revision`;
- `contextLosses: 0`, `visibilityInterruptions: 0`, MSAA enabled, effective DPR
  at least `0.99`, and landscape raster;
- at least 45 sampled frames per second, frame p95 at most `25 ms`, no more than
  `1%` frames over `34 ms`, no burst longer than two such frames, and no more than
  `0.5%` frames over `50 ms`; a single frame over `100 ms` or more than `1%`
  estimated dropped 60 Hz frames also fails;
- full commanded and renderer-observed near/far sweep coverage;
- one cloud shell, three mobile cloud fragment reads, and zero atmosphere
  texture reads/loops;
- cloud and atmosphere GPU p95 at most `6 ms` when timer queries are supported.

Desktop and automated browser runs may produce `LOCAL PASS`, but can never
satisfy the physical-device promotion gate. Store both physical-device JSON
reports with the visual review evidence before changing the default policy.

The KTX2 path is implemented, but the PNG fallback and old renderers remain
until this query route passes visual and real-device review.
