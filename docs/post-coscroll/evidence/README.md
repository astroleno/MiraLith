# Stage 0 durable evidence snapshot

This directory intentionally stores small, reviewable CP0.1 facts outside the ignored editorial-media tree. It contains no master video, proxy clip, contact sheet, PNG frame, or other large media.

| File | Purpose |
| --- | --- |
| `artbreeze-full.identity.json` | Source absolute path and whole-file SHA-256. |
| `artbreeze-full.ffprobe.json` | Unmodified FFprobe stream/container probe. |
| `artbreeze-0000-1853.framemd5` | Source-frame raw `yuv420p` MD5 ledger for `n=0…555`. |
| `artbreeze-0000-1853-source-slice-manifest.json` | Source-order clip boundaries and first/last source-frame hashes. |
| `artbreeze-ring-constraints.json` | Durable geometry / timing evidence, including candidate-status labels. |
| `artbreeze-active-aperture.json` | Observed `1920×810` active-picture bounds within the coded raster and both display-geometry consequences. |
| `ring-color-provenance.json` | BT.709 color signalling, canonical FFmpeg analytic measurement, and explicit noncanonical OpenCV comparison. |
| `coscroll-source-end-measurements.json` | Current “空” capture, source rotation constraints, fallback note, and reference-matte limitation. |
| `checksums.sha256` | Whole-master, durable evidence, and local FFmpeg color-fixture SHA-256 index. |

The equivalent generated evidence and all visual/audio review media remain local-only under `apps/site/.generated/post-coscroll-editorial/`, as required by `.gitignore`. The shot map links both the durable snapshot and the local visual evidence.

Version-control handoff: this directory is intentionally **not ignored** and is included in the CP0.1 documentation commit; the local-only media remain excluded.

## CP0.2 review identity

CP0.2 is `PASS — TECH`; these files do not contain the large local movies and do not signify Editorial GO. CP0.3 is `IN REVIEW — AUTHOR`.

| File | Purpose |
| --- | --- |
| `cp0.2-bridge-variants-manifest.json` | IDs, SHA-256s, durations and limitations for the common capture/bridge, A/B/C linear & scrub media, and A sound comparison. |
| `cp0.2-scrub-interaction-trace.json` | Actual native scroll input trace against the ignored local review surface, proving forward accumulation, reverse withdrawal and resume mapping for all three variants. |
| `cp0.2-v4-real-yaw-bridge-manifest.json` | Historical v4 hashes: real `rotation.y` capture-pose evidence, no-screen-plane rule, blue-particle constraints, and the superseded A/B/C linear & scrub identity. |
| `cp0.2-v8-b-ring-first-complete-manifest.json` | Exact completed-original-B candidate identity: SHA-256, frame mapping, source half-open PTS, media links, and explicit non-GO status. |
| `cp0.2-v8-b-ring-first-complete-boundary-measurements.json` | Durable v8 geometry/phase/color/audio-boundary snapshot for the web → `n=355` and source-endpoint → `n=0` cuts. |
| `cp0.2-v8-b-ring-first-complete-checksums.sha256` | Root-relative SHA-256 index for the master, durable v8 JSON and ignored local review media. |
| `cp0.2-v9-parity-qr-deferred-exposure-manifest.json` | Current controlled A/B/C identity: author-approved QR deferral, shared browser bridge, exact source mapping, file SHA-256s and no-GO status. |
| `cp0.2-v9-parity-qr-deferred-exposure-boundary-measurements.json` | v9 exposure luma trace, QR exclusion, source SSIM, B reorder-audio boundary plus the independent technical audio audit, and C DOM-ring review limitation. |
| `cp0.2-v9-b-audio-audit-method.md` | Reproducible FFmpeg/PCM/RMS/adjacent-sample procedure for the exact v9 B review candidate. |
| `cp0.2-v9-parity-qr-deferred-exposure-checksums.sha256` | Root-relative SHA-256 index for the master, v8 common bridge, durable v9 JSON, ignored v9 linear/scrub media and key proof sheets. |
| `cp0.2-v3-source-direction-bridge-manifest.json` | Historical v3 identity. It preserved the sign but incorrectly flattened the captured glyph into a screen-plane rotation. |
| `cp0.2-v2-continuous-blue-bridge-manifest.json` | Historical v2 identity. It normalized the real negative source yaw to positive screen rotation. |

`cp0.2-bridge-variants-manifest.json` and its native scroll trace describe the historical `cp02-v1` review only; v1 was author-NO-GO because the solid character read as stopping before particleization and its particles warmed too soon. `cp02-v2` reversed the live source sign; `cp02-v3` flattened its real yaw into planar rotation. `cp02-v8` is the targeted B repair that exposed the QR and brightness issues. Current `cp02-v9` restores the controlled A/B/C set after the author chose QR deferral and a four-frame exposure. Its large local media remain under `apps/site/.generated/post-coscroll-editorial/cp02-v9-parity-qr-deferred-exposure/`. The durable current comparison rationale is [CP0.2 v9 parity comparison](../cp0.2-v9-parity-comparison.md).
