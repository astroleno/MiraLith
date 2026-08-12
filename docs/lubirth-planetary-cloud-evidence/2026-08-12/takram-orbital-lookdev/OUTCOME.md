# Takram orbital lookdev outcome

- Clean implementation commit: `8699d4c3553745e1f56e2df4a818704e2962bd28`
- Terminal state: `BOUNDED_ORBITAL_LOOKDEV_FAIL_ROOT_CAUSE_UNRESOLVED`
- Last completed stage: Stage B (coverage selection)
- Authorized next stage: none

Stage 0 passed the normalized legacy/native renderer fingerprint comparison, exact native frame-32 lock, runtime readback, composer allocation, reference-hash, and repeat-noise-floor gates.

Stage A captured `h40`, `h80`, and `h120` at `coverage=0.3`. All three were classified `TOPOLOGY_UNOBSERVABLE`: the output was finite and stable, but no candidate exposed enough cloud signal for a macro-topology judgment. Per the design, all three advanced to Stage B.

Stage B captured all 12 bounded morphology/coverage candidates at the four required opening progress values and two diagnostics. None passed the visual rubric. At `progress=0.06`, changing coverage from `0.3` to `0.55` changed only about `0.023–0.025%` of RGBA channels, with full-frame MAE `0.00292–0.00317`; the full composites did not expose reviewable macro coherence, cloud-ground separation, depth layering, or BSM lighting.

The funnel therefore stopped at the first exhausted stage. Stage C vertical tuning, Stage D optical tuning, Stage E V3 compatibility, and Stage F raw diagnostics/GPU timing were not authorized and were not executed. This terminal failure does not authorize a weather-source replacement without a separate root-cause design.

Evidence:

- `stage-0/checkpoint.json` and `stage-0/manifest.json`
- `stage-a/review.json`, contact sheets, and capture manifest
- `stage-b/review.json`, `stage-b/checkpoint.json`, contact sheets, and capture manifest
