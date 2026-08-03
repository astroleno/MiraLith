# LuBirth Reference Absorption Spike Evidence

## Scope

This evidence set evaluates two isolated, query-only LuBirth spikes:

- Packed Earth surface material (`earth-material-v1`)
- Relief-lite cloud scattering (`cloud-scattering-v1`)

Neither spike changes the default homepage, `/lubirth-revised`, opening timeline,
IP positioning, or the existing Relief-lite sampling budget.

## Baseline

- Commit: `b680891b3b7293ebfddb1b1135f908f06fa7c559`
- Branch: `codex/lubirth-reference-absorption-spike`
- `pnpm --filter @miralith/lubirth-hero typecheck`: PASS
- `pnpm --filter @miralith/site typecheck`: PASS

## Decision Status

| Track | Status |
| --- | --- |
| Earth material | REJECT |
| Cloud scattering | REJECT |
| Combined | Not eligible |

The combined route is only eligible if both independent tracks pass their
visual, motion, performance, asset, and fallback gates.

## Earth Material Verdict

`REJECT`

The packed Earth material spike preserves the Earth-local motion contract, but
does not meet its independent visual or GPU-timing gates. Per the timebox, the
implementation was not retuned after this result.

### Environment

- macOS 15.6.1
- Apple M4 GPU, 8 cores, Metal 3
- Built-in Liquid Retina display, 2560 x 1664
- Google Chrome 150.0.7871.187, headed System Chrome
- Playwright CLI 1.59.1

### Commands

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=mobile-landscape
```

All final commands passed their technical contracts. The fixed evidence matrix
is stored as `earth-material-*.png`, and the complete measurements are in
`earth-material-telemetry.json`.

### Passed Gates

- Earth silhouette projection drift was `0 px` for every fixed location and
  opening-progress frame.
- The maximum forward/reverse pixel delta was `1.14e-8`, below `1 / 255`.
- Every recorded RGB P99 remained below the `250 / 255` clipping threshold.
- The packed map fallback and asset contracts passed.
- System Chrome GPU timers recorded `120` valid samples and zero disjoint
  resets for both baseline and variant on desktop and mobile-landscape.

### Failed Gates

- Desktop daylight contrast and ocean/land separation miss their required
  `+10%` and `+12%` gains in multiple fixed frames; deep-night city mean changed
  by `8.21%`, above the `<=3%` limit.
- Mobile-landscape has the same visual failures; deep-night city mean changed
  by `6.55%`, above the `<=3%` limit.
- System Chrome timing is valid but misses the absolute performance budgets:
  desktop baseline/variant p95 are `3.170ms` / `3.074ms` against `<=1.5ms`;
  mobile-landscape is `1.519ms` / `1.821ms` against `<=1.0ms`, with a
  `+0.303ms` variant delta above the `+0.25ms` cap.

The A-track rejection does not block the independent B-track experiment. It
does keep `combined-v1` at `not-eligible`.

## Relief Cloud Scattering Verdict

`REJECT`

The six fixed Relief-lite scattering candidates preserved the existing tiered
sampling budget, but none passed the independent alpha/motion and volumetric
lighting gates. The diagnostic frames also remain visibly close to soft,
low-relief cloud patches instead of providing a stable top/side/underside
lighting hierarchy. Per the timebox, no seventh candidate or parameter retune
was attempted.

### Environment

- macOS 15.6.1
- Apple M4 GPU, 8 cores, Metal 3
- Google Chrome 150.0.7871.187, headed System Chrome
- Playwright CLI 1.59.1
- One worker; desktop `1440x960`; mobile-landscape `844x390`

### Commands

```bash
export MIRALITH_REFERENCE_ABSORPTION_EVIDENCE_DIR="$PWD/docs/lubirth-reference-absorption-evidence/2026-08-03"
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop --grep "cloud scattering"
pnpm exec playwright test -c playwright.reference-absorption-system-chrome.config.ts tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=mobile-landscape --grep "cloud scattering"
```

Both commands passed their evidence and budget contracts. The fixed candidate
matrix is in `cloud-scattering-candidates.json`; all measurements are in
`cloud-scattering-telemetry.json`; and the corresponding black-background
`cloud-alpha` and `cloud-lighting` frames are stored as
`cloud-scattering-*.png`.

### Fixed Candidate Matrix

| Candidate | Phase g | Multi-scatter |
| --- | ---: | ---: |
| `g065-ms018` | 0.65 | 0.18 |
| `g065-ms028` | 0.65 | 0.28 |
| `g072-ms018` | 0.72 | 0.18 |
| `g072-ms028` | 0.72 | 0.28 |
| `g078-ms018` | 0.78 | 0.18 |
| `g078-ms028` | 0.78 | 0.28 |

### Passed Gates

- The bounded Relief-lite budget remained unchanged: desktop uses four fragment
  texture reads and three view steps; mobile-landscape uses three reads and two
  view steps; all candidates use one sun step and no temporal jitter.
- The fixed alpha/motion contract now passes for every candidate: desktop
  maximum alpha delta and edge drift are `0`; mobile-landscape remains within
  `0.000845` delta and `0.112px` edge drift, below `0.5/255` and `1px`.
- System Chrome GPU timer data was available for desktop near, oblique, and
  fixed-progress sweep scenarios, with `120` valid samples and zero disjoint
  resets for every recorded query.
- All candidates stayed below the RGB P99 clipping cap, and no candidate added
  a scroll-linked or temporal-jitter mechanism.

### Failed Gates

- No candidate meets the required oblique top/side ratio of `>=1.25`. The best
  desktop result is `0.87846`, and the best mobile-landscape result is
  `0.97621`. Desktop side/underside tops out at `1.09935` versus `>=1.12`;
  internal contrast is `-7.09%` desktop and only `+1.91%` mobile-landscape,
  versus the required `+12%`.
- Desktop System Chrome GPU p95 baseline values are already above the
  `<=3.0ms` absolute limit (approximately `8.68ms` to `11.30ms`). Several
  candidate scenarios also exceed the `+0.20ms` same-run delta cap, including
  the `g065-ms028` oblique frame at `+1.8957ms`.
- The subjective kill applies independently: representative near, oblique, and
  mid frames remain soft/flat relief patches, with lighting changes that do not
  establish a stable top/side/underside volume relationship.

Because this is a mechanism and visual rejection, not a case where all variant
gates pass against an over-budget baseline, the B-track status is `REJECT`
rather than `BLOCKED_BY_BASELINE`.

## Integrity

`checksums.sha256` contains a SHA-256 entry for every evidence file in this
directory except itself, including the `298` fixed PNG frames and both System
Chrome JSON/JUnit reports. `manifest.json` records the implementation-source,
generator, packed-asset, and report hashes used for this final evidence set.

## References

- Three.js WebGPU Volume Fire
- EarthThreeJS
- SnowSystemThreeJS
- Three.js WebGPU Custom Fog Scattering
