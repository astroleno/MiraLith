# V3 morphology scale checkpoint

This evidence set records the corrected 2026-08-09 scale and morphology preflight. It uses the native Takram `CloudsEffect → temporal resolve → AerialPerspective` path, the fixed V3 weather column, `coverage=0.55`, and a 1440×960 DPR 1 headed System Chrome run at commit `f3ac113`.

The four query-only views keep the observed target at the frozen V3 spherical UV `[0.076494140625, 0.73053515625]`. Each near camera is solved backwards along the requested spherical arc, preserves the requested ECEF target altitude, and projects the audited target to the viewport centre. The measured target and ECEF/world contracts remain valid.

The prior checkpoint interpretation was not valid. All three near cameras look substantially along the target's local east direction, so perspective foreshortening makes east screen scale much smaller than north screen scale. The recorded tangent-plane projection Jacobian has condition numbers `13.53`, `4.97`, and `4.02` for near-oblique, aerial-oblique, and near-orbit. Requiring an isotropic physical cloud to occupy the same `16–48 px` / `3–10 px` bands on both raw ENU axes therefore turns camera perspective into a false morphology failure.

The computed checkpoint is now:

```text
VIEW_SPACE_ACCEPTANCE_CONTRACT_FAIL
TASK_3_TO_6_LOCKED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

The current suite stops before candidate replay. `candidate-matrix.json` contains four baseline preflight records, the Jacobian/SVD audit, and an explicit accepted/rejected candidate split. A candidate is accepted only when both its screen-space and physical-wavelength contracts pass; rejected items retain their reasons. The old candidate-prefixed captures remain in the directory only as historical artifacts and are not referenced by the current checkpoint.

Connected-area semantics are also explicit: maximum connected-area dominance is diagnostic only, while a minimum connected mass remains a fragmentation gate. No image-metric winner is computed while the view-space acceptance contract is invalid. The temporal history epoch now covers diagnostic, candidate, view, resource generations, weather identity, coordinate mode, and the complete resolved renderer fingerprint; an in-place candidate/view browser regression proves a fresh immutable `nativeFrameCount=1` capture after both transitions.

The next amendment must define a foreshortening-aware acceptance measure from the stored projection Jacobian/SVD (or another explicit view-plane contract). This evidence does not authorize anisotropic ENU stretching, vertical/profile tuning, temporal cleanup, or performance work.

Files:

- `baseline.json`: current 4 views × 6 baseline diagnostics and same-commit telemetry.
- `scale-audit.json`: on-screen metre-to-pixel audit with the full horizontal projection Jacobian and singular values.
- `candidate-matrix.json`: preflight-only records, candidate acceptance/rejection reasons, and the computed stop checkpoint.
- `checkpoint.json`: authoritative unlock state and stop reason.
- `captures/`: current baseline captures plus historical candidate-prefixed captures that are not part of this checkpoint.

Reproduce the full evidence suite with:

```bash
MIRALITH_TAKRAM_V3_MORPHOLOGY_CAPTURE=1 pnpm exec playwright test \
  -c playwright.takram-parity-system-chrome.config.ts \
  tests/e2e/lubirth-takram-v3-morphology.spec.ts \
  --project=desktop-system-chrome --workers=1
```
