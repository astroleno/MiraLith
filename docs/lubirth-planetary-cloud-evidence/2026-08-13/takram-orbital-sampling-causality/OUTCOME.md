# Takram Orbital Sampling Causality A/B

**State:** `ORBITAL_SAMPLING_CAUSALITY_CONFIRMED`

The clean, two-arm exact-frame capture confirms that the inherited orbital `perspectiveStepScale=1.01` is the primary cause of the current no-cloud result. This is a causal sampling verdict, not approval of the treatment as production lookdev.

## Frozen experiment

- Clean commit: `b5913b9ca496b20944d6a0d6fe018f85c9ad99f0`
- Control: `perspectiveStepScale=1.01`
- Treatment: `perspectiveStepScale=1.0001`
- Shared contract: stock `h120 / coverage 0.55 / vertical 1 / optical 1`
- Progress: `0 / 0.06 / 0.12 / 0.18`
- Native frame: `32`
- Browser: headed System Chrome, `1440×960`, DPR `1`

All 16 paired query/runtime/fingerprint/camera setup comparisons passed after removing only the named step value and expected allocation identities. Both progress-0.06 repeats were byte-identical for cloud raw and final output. All 93 artifact hashes and byte lengths match `manifest.json`.

The measured initial step changes from approximately `35.83–71.62 km` to `0.408–0.766 km`, bringing it into the same order of magnitude as the `0.5–1.2 km` stock cloud layers.

| Progress | Native hits control → treatment | Pre-temporal signal control → treatment | Treatment resolved retention | Final full-frame changed pixels |
|---:|---:|---:|---:|---:|
| 0.00 | 239 → 28,392 | 0.716% → 32.861% | 100.9% | 10.13% |
| 0.06 | 220 → 27,746 | 0.692% → 32.113% | 101.2% | 10.07% |
| 0.12 | 222 → 26,439 | 0.605% → 30.601% | 101.6% | 9.92% |
| 0.18 | 191 → 25,305 | 0.561% → 29.288% | 101.9% | 9.78% |

Visual review of the PNGs and the lossless pre-temporal/resolved buffers confirms that treatment restores stable cloud-density bands and clusters at every progress; control remains isolated hits. The structured treatment field survives temporal resolve and remains observable in final output. Therefore all four progress decisions satisfy the pure causal resolver and produce `ORBITAL_SAMPLING_CAUSALITY_CONFIRMED`.

The treatment frame is still dark/rust-colored, visually close to the ground, and lacks an approved orbital cloud finish. This outcome authorizes a separate production-step policy design and a healthy-baseline lookdev pass. It does not promote `1.0001`, unlock the old Stage C–F funnel, or authorize homepage changes.

Authoritative evidence:

- `cloud-raw-contact-sheet.png`
- `sample-count-contact-sheet.png`
- `final-output-contact-sheet.png`
- `manifest.json`
- `metrics.json`
- `review.json`
