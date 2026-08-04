# LuBirth Globe-Cloud Asset Evidence — 2026-08-04

## Verdict

The scoped `/lubirth-cloud-asset-opening` route passes its representation and interaction contract:

- The asset is a cloud-only globe-UV field, not a baked Earth/Moon/frame plate.
- The opening cloud mesh is attached inside `EarthMoonScene`’s real `earthGroup`, so it inherits Earth rotation, scale and the IP camera rather than floating in screen space.
- The shell spans `1.0005–1.0115` Earth radii and remains below the `1.014` limb atmosphere. Its opening-only opacity, relief lighting scale and low-sun illumination floor make the body readable without changing the post-handoff Relief-lite path.
- The media starts loading from the mounted `<video>` element; the decoded first frame is explicitly uploaded to `VideoTexture`, eliminating the earlier “no cloud until first scroll seek” failure.

Default-home promotion remains **HOLD**. This route is intentionally query-only and no physical-device GPU p95 measurement exists for this revision. The default homepage is untouched.

## Visual review

| Surface | Viewport | Evidence | Result |
| --- | --- | --- | --- |
| Desktop | 1440×960 | `runtime-desktop-contact-sheet.png` | Frame 0 and frame 26 retain the same Moon/scene while the cloud body follows the visible Earth limb and changes with scroll. |
| Mobile portrait | 412×915 | `runtime-mobile-contact-sheet.png` | The mobile field selects the two-view-sample tier; the Earth and clouds remain cropped safely inside the live canvas. |

The two contact sheets show opening progress `0.000` / field frame `0` and progress `0.120` / field frame `26`. They are runtime captures of the real R3F scene, not source-field previews.

## Asset and runtime contract

- Source: internal procedural field at `packages/lubirth-hero/scripts/opening-globe-cloud-field.html`.
- Mapping: `equirectangular-earth-uv`; packing: left RGB optical-depth/top-height/morphology, right red concavity; texture color space: `NoColorSpace`.
- Desktop: 1536×768 raw / 3072×768 packed, 3,524,442 bytes, 48 all-I H.264 frames at 30 fps.
- Mobile: 1024×512 raw / 2048×512 packed, 2,025,944 bytes, 48 all-I H.264 frames at 30 fps.
- Manifest quality gates remain satisfied: desktop PSNR 42.064292 / SSIM 0.987660; mobile PSNR 38.910789 / SSIM 0.981301.
- Local headless desktop telemetry: first frame `13.4 ms`, `textureVersion: 1`, no decode errors. This is a local cache/dev observation only, not a network or GPU-performance claim.

## Validation

- `pnpm --filter @miralith/site lint` — pass
- `pnpm --filter @miralith/site typecheck` — pass
- `pnpm --filter @miralith/lubirth-hero typecheck` — pass
- `pnpm --filter @miralith/site build` — pass
- Globe-field unit suite — 15 passed
- Scoped E2E across desktop, mobile portrait and mobile landscape — 5 passed / 4 intentionally skipped fallback duplicates
- `git diff --check` — pass

`checksums.sha256` records every shipped field/source file and evidence image.

## Limits retained intentionally

The opening is still a normalized cinematic field: it is spatially attached to the real Earth, but it is not a meteorological simulation or a claim that frame-zero cloud placement equals a live weather map. The `≥0.22` handoff still releases decoded presentation resources and returns to the existing real-IP Relief-lite semantics.
