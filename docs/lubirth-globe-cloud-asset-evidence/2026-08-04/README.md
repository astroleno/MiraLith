# LuBirth Globe-Cloud Continuity Evidence — 2026-08-04

## Verdict

The scoped `/lubirth-cloud-asset-opening` route now passes the visual-continuity and frame-addressability contracts for the cloud asset study.

- The opening is a scalar cloud field attached to the real Earth group, never a full-scene image or DOM cloud overlay.
- The normal Relief-lite mesh remains mounted from progress `0` through handoff. It is the same low cloud layer before and after the cut.
- Two temporary, surface-locked detail shells add a dense body (`1.0035–1.0062`) and high wisps (`1.0062–1.0074`) without separating visibly from the globe.
- Detail and the persistent base use the same Relief-lite field UV offset and scroll offset. The v3 field preserves `128×64` regional source structure instead of collapsing clouds into a few broad lobes.
- The shared `TransitionVeil` owns the representation switch. Its solid backplane reaches peak opacity over the cut; its cloud-form child only motivates that concealment.
- On reverse, the released video source is explicitly restored as a DOM attribute before the target-frame seek. The captured reverse probe reached frame 39 with `readyState: 4` and revealed the cloud body again.

Default-home promotion remains **HOLD**. This is intentionally query-only work; it does not claim a physical-device GPU p95 result and does not modify the default homepage.

## Runtime visual probes

All current screenshots below are 1280×720 captures of the real local R3F route after the v3 bake and reverse-rearm fix.

| Progress / state | Evidence | Observation |
| --- | --- | --- |
| `0.000` / cloud frame 0 | `continuity-browser-start.png` | The persistent base and attached body/wisps read as one globe-conforming cloud field. |
| `0.120` / cloud frame 26 | `continuity-browser-frame-026.png` | The regional cloud form changes with scroll while maintaining its Earth attachment. |
| `0.196` / cut under veil | `continuity-browser-cut.png` | The veil is near opaque; representation change is not exposed as a cloud/image dissolve. |
| `0.221` / live Relief-lite | `continuity-browser-live.png` | The video `src` is released and the unchanged live base owns the scene. |
| reverse `0.180` / cloud frame 39 | `continuity-browser-reverse-frame-039.png` | The frame is decoded and the cloud body returns only after rearming succeeds. |

The older `runtime-*` screenshots are retained as pre-v3 historical captures; they are not evidence for this continuity revision.

## Asset contract

- Asset ID: `lubirth-opening-globe-cloud-field-v3-surface-locked-relief-anchor`.
- Provenance: `internal-procedural`; source scene: `packages/lubirth-hero/scripts/opening-globe-cloud-field.html`; license: `internally-generated`.
- Geographic anchor: `earth-cloud-field-nasa-lite-2k.png`, SHA-256 `39c70e34b99ecf550f557327a1b97dcc0d2cae9f3be03242911c067622bb0a1c`.
- Packing: left RGB optical-depth/top-height/morphology and right red concavity; data samples use `NoColorSpace`.
- Desktop: 1536×768 raw / 3072×768 packed, 48 all-I H.264 frames at 30 fps, 2,926,719 bytes, PSNR 48.319518, SSIM 0.992166.
- Mobile: 1024×512 raw / 2048×512 packed, 48 all-I H.264 frames at 30 fps, 1,751,853 bytes, PSNR 45.592882, SSIM 0.988709.

Both variants remain below the 6 MiB / 2 MiB transfer caps and the 16 MiB / 8 MiB decoded-texture caps without reducing the compression fidelity gate.

## Validation

- Scoped unit suite: 18 passed.
- Scoped E2E with a fresh isolated server: 5 passed / 4 intentional fallback duplicates skipped.
- Site and hero typechecks: passed.
- Site lint: passed.
- Production build: passed.
- `git diff --check`: passed.
