# Takram cloud-scale similarity — Stage A checkpoint

Clean-HEAD stock-only public-parameter control at coverage `0.3`, using `S=80/120/160` and opening progress `0.00/0.06/0.12/0.18`.

## Decision

```text
PUBLIC_PARAMETER_SIMILARITY_VISUAL_FAIL_MIP_UNPROVEN
STOCK_PASSING_SCALES=[]
STAGE_B_NOT_RUN
STAGE_C_NOT_RUN
MIP_DISTANCE_PATCH_NOT_AUTHORIZED
TASK_0P_LOCKED
ORIGINAL_TASK_0_TO_8_LOCKED
```

All 12 exact-frame captures have zero runtime contract drift, the explicit official R/G/B/A layer array is active, and the public scale values read back correctly. The final frames show Earth and atmosphere but no readable stock cloud mass at any scale or opening progress. Consequently none of the three scales passes the Stage A visual floor.

This result does **not** prove premature mip selection. It also does not classify V3, because Stage B was not run. Per the approved funnel, the correct state is a public-parameter visual failure with mip causality unproven—not a rejection of the broader scale direction or Takram.

![Stage A stock contact sheet](stage-a-stock-contact-sheet.png)

## Audit

- Harness/base commit: `589e0517bc6c07622cccc78645ccb91a2511e7ec`
- Browser: System Chrome `151.0.7922.109`
- GPU: `ANGLE Metal Renderer: Apple M4`
- Viewport: `1440×960`, DPR `1`
- Population: `12` source PNGs, each native exact frame `32`
- Screenshot SHA-256: `12/12` verified
- Contact-sheet SHA-256: verified
- Renderer/runtime drift: `0` for every population
- Mip patch: inactive
- Physical AerialPerspective parity claim: false; this remains an artistic orbital presentation domain

## Reproduce

```bash
MIRALITH_TAKRAM_CLOUD_SCALE_CAPTURE=1 pnpm exec playwright test -c playwright.takram-parity-system-chrome.config.ts lubirth-takram-cloud-scale.spec.ts --headed --grep "Stage A"
```

The detailed per-scale review is in `stage-a-visual-review.json`; complete runtime contracts, frame/jitter/STBN metadata, GPU identity, and every artifact hash are in `manifest.json`.
