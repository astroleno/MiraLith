# Takram orbital lookdev outcome

- Clean implementation commit: `a9aa865bf0d875b3d19065860f4913999c2e5b5f`
- Strict evidence chain: Stage 0 at `a9aa865bf0d875b3d19065860f4913999c2e5b5f`, Stage A at `fad0cf76463b52378811e434c24627658137e841`, Stage B at `2bb6c767becccc22070d960cdb36067f395deb51`
- Terminal state: `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED`
- Last completed stage: Stage B (coverage selection)
- Authorized next stage: none

Stage 0 passed the normalized legacy/native renderer fingerprint comparison while retaining the complete runtime layers and cloud/shadow render-target formats. It also passed exact native frame-32 lock, mapping/offset-aware runtime drift, reference-hash, repeat-noise-floor, and two same-document legacy-to-explicit-native composer remount checks in which all six allocations changed.

Stage A captured `h40`, `h80`, and `h120` at `coverage=0.3`. All three were classified `TOPOLOGY_UNOBSERVABLE`: the output was finite and stable, but no candidate exposed enough cloud signal for a macro-topology judgment. Per the design, all three advanced to Stage B.

Stage B captured all 12 bounded morphology/coverage candidates at the four required opening progress values and two diagnostics. None passed the visual rubric. At `progress=0.06`, changing coverage from `0.3` to `0.55` changed only about `0.023–0.025%` of RGBA channels, with full-frame MAE `0.00292–0.00317`; the full composites did not expose reviewable macro coherence, cloud-ground separation, depth layering, or BSM lighting.

The funnel therefore stopped at the first exhausted stage. Stage C vertical tuning, Stage D optical tuning, Stage E V3 compatibility, and Stage F raw diagnostics/GPU timing were not authorized and were not executed. This terminal failure does not authorize a weather-source replacement without a separate root-cause design. Stage A and Stage B were republished after the three evidence false-pass gates were closed; their PNGs remained byte-identical, so the visual verdict did not change.

Evidence:

- `stage-0/checkpoint.json` and `stage-0/manifest.json`
- `stage-a/review.json`, contact sheets, and capture manifest
- `stage-b/review.json`, `stage-b/checkpoint.json`, contact sheets, and capture manifest

## 2026-08-13 scope amendment

This outcome completed and validated the bounded evidence funnel, but it did not establish a healthy same-camera orbital cloud baseline or a usable cloud migration. It must not be read as evidence that Takram itself cannot produce orbital clouds.

The subsequent isolated two-arm sampling experiment changed only `perspectiveStepScale` and reached [`ORBITAL_SAMPLING_CAUSALITY_CONFIRMED`](../../2026-08-13/takram-orbital-sampling-causality/OUTCOME.md). It showed that the frozen `1.01` perspective-step policy was too coarse for the thin native layers at orbital distance and caused cloud-sampling signal loss; it did not directly measure per-ray layer crossings. The old Stage C–F sequence remains locked; a separate production-step design is required before lookdev resumes.
