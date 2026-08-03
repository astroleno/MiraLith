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
| Cloud scattering | Pending |
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
- Playwright CLI 1.59.1

### Commands

```bash
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-contract.spec.ts --project=desktop
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=desktop --grep "earth material"
pnpm exec playwright test tests/e2e/lubirth-reference-absorption-spike.spec.ts --project=mobile-landscape --grep "earth material"
```

All three commands passed their technical contracts. The fixed evidence matrix
is stored as `earth-material-*.png`, and the complete measurements are in
`earth-material-telemetry.json`.

### Passed Gates

- Earth silhouette projection drift was `0 px` for every fixed location and
  opening-progress frame.
- The maximum forward/reverse pixel delta was `0.000811`, below `1 / 255`.
- Every recorded RGB P99 remained below the `250 / 255` clipping threshold.
- The packed map fallback and asset contracts passed.

### Failed Gates

- Desktop daylight contrast and ocean/land separation miss their required
  `+10%` and `+12%` gains in multiple fixed frames; deep-night city mean changed
  by `29.08%`, above the `<=3%` limit.
- Mobile-landscape has the same visual failures; deep-night city mean changed
  by `14.20%`, above the `<=3%` limit.
- GPU timer support was unavailable in both runs. Baseline and variant each
  recorded `0` valid samples and `0` disjoint resets, so neither platform can
  satisfy the required p95 or minimum `60`-sample gates.

The A-track rejection does not block the independent B-track experiment. It
does keep `combined-v1` at `not-eligible`.

## References

- Three.js WebGPU Volume Fire
- EarthThreeJS
- SnowSystemThreeJS
- Three.js WebGPU Custom Fog Scattering
