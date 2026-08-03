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
| Earth material | Pending |
| Cloud scattering | Pending |
| Combined | Not eligible |

The combined route is only eligible if both independent tracks pass their
visual, motion, performance, asset, and fallback gates.

## References

- Three.js WebGPU Volume Fire
- EarthThreeJS
- SnowSystemThreeJS
- Three.js WebGPU Custom Fog Scattering
