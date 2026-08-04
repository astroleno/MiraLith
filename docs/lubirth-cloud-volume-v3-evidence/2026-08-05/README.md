# LuBirth V3 cloud-volume spike evidence - 2026-08-05

## Decision

**REJECT for product promotion.** This branch preserves a query-only visual
experiment and its failure analysis. It must not change the default LuBirth
route or be treated as a production-quality cloud-volume solution.

The corrected candidate removes the obvious three-layer registration error, but
the remaining result still does not create the strong, believable top, side,
and underside volume requested for the close Earth view. Passing implementation
and screenshot-contract tests is not sufficient evidence of visual acceptance.

## Scope and route

The candidate is isolated behind `cloudVolume=v3` on the cloud-truth spike:

```text
/lubirth-cloud-truth-spike?mode=all&quality=high&progress=0&copy=hidden&profile=nasa&atmo=volumetric&look=reference&cloudVolume=v3
```

It is based on the completed reference-absorption spike and does not alter the
homepage policy.

| Item | Value |
| --- | --- |
| V3 candidate commit | `cfcca3b` |
| Alignment correction | `276aa09` |
| Quality tier | high only |
| Cloud representation | one Earth-aligned shell with shader-side light samples |
| Ground response | controlled V3 cloud shadow |

## What happened

The first V3 attempt used three nearby cloud shells derived from the same 2D
cloud map, with per-shell UV offsets. That was intended to approximate depth,
but the repeated cloud contours appeared as three visibly displaced copies in
the close view. The user's review correctly identified this as a broken visual
registration rather than an acceptable stylized design.

The follow-up retained one geometrically aligned shell and moved the apparent
depth treatment into five sun-direction samples in the cloud shader. This
eliminated the duplicate-contour artifact, but it only improved lighting on a
single alpha surface. It did not supply the density, self-occlusion, or
silhouette variation needed for convincing cloud volume.

## Technical verification

The final corrected state passed the following checks:

```bash
pnpm --filter @miralith/lubirth-hero typecheck
pnpm exec playwright test tests/e2e/lubirth-atmosphere-policy.spec.ts --project=desktop
pnpm exec playwright test tests/e2e/lubirth-cloud-truth-spike.spec.ts --project=desktop
```

The policy suite passed 22 tests and the cloud-truth suite passed 13 tests.
The V3 route test also asserts that the corrected high-reference configuration
has exactly one visible cloud shell. These results prove route wiring, policy,
and regression contracts; they do not prove that the image has acceptable
material volume.

## Reusable lessons

- Do not stack offset copies of one 2D cloud texture to simulate volume. At a
  close, curved-horizon camera angle, duplicated map features read immediately
  as misregistration.
- A single aligned shell with shader-side sun samples is safer than multiple
  offset shells, but it remains surface shading, not volumetric cloud geometry.
- Proxy contrast metrics and pass/fail screenshot tests must be paired with a
  direct human review at the intended camera distance. A metric can pass while
  the visual still reads flat.
- Treat top, side, and underside separation as an image-level acceptance gate,
  not merely a shader parameter target.
- Keep rejected rendering experiments query-only and auditable. Do not promote
  them because their engineering contracts are clean.

## Required direction for a future attempt

A future close-cloud proposal needs a representation with actual depth data:

- a local 3D density field with ray-marched transmittance and self-shadowing;
- artist-authored thickness or multi-channel density data whose features do not
  repeat across depth layers; or
- an offline-rendered close-shot asset with a verified transition to the live
  Earth scene.

Before implementation, the proposal should define reference frames and a
human visual gate for silhouette, top/side/underside hierarchy, and repeated
feature detection. It should not begin from another offset-shell variant.

## Retention

The remote branch `codex/lubirth-reference-absorption-spike` is retained for
audit. Its local worktree and local branch are intentionally removed after this
document is committed and pushed.
