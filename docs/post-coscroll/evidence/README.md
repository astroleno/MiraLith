# CP0.1 durable evidence snapshot

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
