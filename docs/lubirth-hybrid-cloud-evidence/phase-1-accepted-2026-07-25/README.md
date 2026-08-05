# LuBirth Hybrid Cloud Phase -1 Acceptance Evidence

This directory captures the accepted query-only Phase -1 implementation state from 2026-07-25.
It is evidence for the feasibility route only; it does not promote `hybrid-splat` to the default
LuBirth homepage or constitute physical iPhone/Pixel performance evidence.

## Environment and gate

- Reference machine: Apple M4, system Chrome using ANGLE Metal.
- Desktop route: 1440×960 viewport, 44 Earth-local lobes.
- Mobile-tier route: 915×412 viewport, 22 Earth-local lobes. This is a configuration-tier
  check running on the reference machine, not a physical mobile-device result.
- Accumulation: executable RGBA16F one-bin target with verified additive blending.
- Acceptance threshold: at least 30 valid total GPU samples, no disjoint reset in the capture,
  and desktop `accumulation + composite` p95 at or below 3 ms.
- Verification runner: system Chrome was executed serially, once per target project. Both the
  desktop and mobile-landscape suites exited cleanly at 5/5. A combined two-worker system-Chrome
  run completed its assertions but did not terminate its local runner, so it is not the source of
  the recorded acceptance result; the repository's default Playwright configuration is unchanged.

## Captured result

| State | GPU p50 / p95 | Samples | Disjoint resets | Spatial / temporal p95 | Hierarchy |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop near | 0.624 / 0.890 ms | 31 | 0 | 2 / 2 | 44 lobes |
| Desktop oblique | 0.517 / 1.224 ms | 31 | 0 | 0 / 0 | same 44 lobes |
| Mobile-tier near | 0.254 / 0.740 ms | 31 | 0 | 0 / 0 | 22 lobes |
| Desktop sweep | 1.097–1.151 / 1.437–1.513 ms | 35–44 | 0 | <=2 / 2 | zero member churn |

The near and oblique desktop captures share candidate hash `5cba55c8` and hierarchy hash
`39bba2d6`. Every sweep frame preserves those identities and reports zero temporal member churn.

## Files

- [Desktop near screenshot](desktop-near.png) and [telemetry](desktop-near.telemetry.json)
- [Desktop oblique screenshot](desktop-oblique.png) and [telemetry](desktop-oblique.telemetry.json)
- [Mobile-tier near screenshot](mobile-landscape-near.png) and [telemetry](mobile-landscape-near.telemetry.json)
- [Desktop sweep clip](desktop-sweep.webm) and [sweep telemetry](desktop-sweep.telemetry.json)
- Sweep stills: [near](sweep-near.png), [middle](sweep-middle.png), and [oblique](sweep-oblique.png)
- [Manifest](manifest.json) and [asset checksums](checksums.sha256)

The route contract and the Phase -1 boundaries are defined in
[the Hybrid Cloud architecture](../../lubirth-hybrid-cloud-architecture.md).
