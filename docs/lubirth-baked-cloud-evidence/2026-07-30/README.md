# LuBirth baked-cloud spike evidence — 2026-07-30

## Decision

**REJECT for production promotion.** The branch preserves a query-only, auditable experiment; it does not alter the default homepage policy or route.

The real LuBirth opening route proves the lifecycle mechanics, but its normal-size close shot still reads as a vertically banded deep-impostor plane rather than a materially more convincing cloud volume. The candidate also cannot satisfy the required GPU proof on the tested system: EXT_disjoint_timer_query_webgl2 was unavailable, and one 45-frame rAF p95 capture was 283.3 ms (well outside the 50 ms route-decision observation bound). That number is a development/headless measurement, not a physical-device GPU result, but it is not evidence for promotion.

## Source-bound inputs

| Item | Value |
| --- | --- |
| Dependency baseline | b680891b3b7293ebfddb1b1135f908f06fa7c559 |
| Unit 1 bake commit | a8c5858 |
| Provenance / license | internal-procedural / internally-generated |
| Bake source | high-resolution-internal-procedural-volume, 192×128×128 |
| Source SHA-256 | 5d57becb7cf7cd329a81a4a32f7bf70b79e7e9b66e6e7a8b51ab65579de61ad5 |
| Script SHA-256 | 01515d1bf35ddbfb83ffd5fa198dcb72f3137f76d64b9d11398ed715ae038cf4 |
| Output atlas SHA-256 | 79b15298ff91c3c555982def943fa3bd15fa8dc4dc3d748f013c60d58ada88e7 |
| Desktop transfer / decoded residency | 2,088,158 B / 12,042,240 B (budgets: 12,000,000 B / 20,000,000 B) |
| Mobile transfer / decoded residency | 675,976 B / 3,145,728 B (budgets: 3,000,000 B / 4,000,000 B) |

The manifest at apps/site/public/assets/lubirth/cloud-impostor/manifest.json records the generator, seed, parameter summary, source and output hashes, and the matching global far-footprint drift binding.

## Verified behavior

- The route uses mapOpeningProgress(); at 0.08 the near optical weight is 1, and at 0.82 it is 0.
- The candidate is mounted under the existing Earth group, follows IP/manual/default location lifecycle, and remains hidden while delayed IP resolution is pending.
- Northern, southern, dateline-adjacent, and birth-default locations resolve an Earth-local anchor.
- Desktop/mobile tiers obey their declared transfer and decoded residency budgets; mobile loads its four-view tier only.
- Shared cloud-field drift moves the near anchor, quick reverse before the far-only release does not reallocate, and a stable far handoff releases near textures before a genuine rewind reloads them.
- The two committed telemetry snapshots in this directory were captured from the real route at the same geo input and progress 0.08 / 0.82.

## Visual review

The reproducible capture command below was inspected at 1×. It confirms a readable close cloud mass and a clean far-only state, but the close silhouette has vertical bands and a planar card read above the horizon. That fails the plan's materially-stronger-volume-without-visible-planar-representation gate.

~~~sh
MIRALITH_BAKED_CLOUD_EVIDENCE_DIR=/private/tmp/miralith-baked-cloud-evidence \
  pnpm exec playwright test --project=desktop \
  tests/e2e/lubirth-baked-cloud-spike.spec.ts \
  --grep "uses the real opening timeline"
~~~

## Consequence

No promotion follow-up is authorized from this spike. The Hybrid route remains a comparison control only, as scoped for Unit 3; neither candidate changes production cloud policy. A future proposal must introduce a different close-shot representation and repeat the real-timeline, physical-device GPU, and visual gates from scratch.
