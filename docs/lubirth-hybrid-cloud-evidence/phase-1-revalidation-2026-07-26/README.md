# LuBirth Hybrid Cloud Phase -1 Revalidation

This directory records the current-source, query-only Phase -1 runtime
revalidation. It does not promote Hybrid Cloud to the default LuBirth homepage
and it is not physical iPhone/Pixel performance evidence.

## Reproduction

Reference machine: Apple M4, macOS System Chrome using ANGLE Metal. The runner
is explicit, serial, and headed so its GPU/compositor path matches the visible
browser path:

```sh
pnpm build
pnpm exec playwright install ffmpeg
pnpm --filter @miralith/site exec next start -H 127.0.0.1 -p 3114
MIRALITH_PLAYWRIGHT_PORT=3114 \
MIRALITH_PHASE1_CAPTURE_VIDEO=1 \
MIRALITH_PHASE1_EVIDENCE_DIR=/tmp/miralith-phase1-sweep \
MIRALITH_PHASE1_REPORT_DIR=/tmp/miralith-phase1-desktop \
  pnpm test:lubirth-hybrid-phase1:system-chrome --project=desktop-system-chrome
cp "$(find /tmp/miralith-phase1-sweep/playwright-output \
  -path '*bounded-temporal-overdraw*/video.webm' -print -quit)" \
  /tmp/miralith-phase1-sweep/sweep.webm
MIRALITH_PLAYWRIGHT_PORT=3114 \
  MIRALITH_PHASE1_REPORT_DIR=/tmp/miralith-phase1-mobile \
  pnpm test:lubirth-hybrid-phase1:system-chrome --project=mobile-landscape-system-chrome
```

## Current source status

- Site TypeScript passed. The rotated-carrier metric check passed: a carrier
  compared with itself has union coverage `1`, and duplicating a rotated base
  does not inflate union coverage.
- Current-source System Chrome completed: desktop `7/7` passed; mobile-tier
  `5/5` passed, with two desktop-only visual assertions skipped. The exact
  component, metrics, tests, runner configuration, and asset hashes are in
  `manifest.json`.
- Desktop near/oblique reached GPU p95 `2.584 ms` / `2.487041 ms`, each with
  30 valid samples and zero disjoint resets.
- The strict visual exit gate and physical iPhone/Pixel validation remain in
  progress.

The near, middle, and oblique sweep frames plus `sweep.webm` show the same
current Earth-local cloud system across a continuous camera move.
`sweep-telemetry.json` records the captured identity, hierarchy, real-base
connectivity, carrier containment, source hash, and temporal-overdraw values.
Checksums establish artifact integrity, and the manifest binds this run to the
current worktree source.

## Artifacts

- `desktop-system-chrome.report.json` / `.junit.xml`
- `mobile-landscape-system-chrome.report.json` / `.junit.xml`
- `desktop-near.png`
- `desktop-oblique.png`
- `sweep-near.png` / `sweep-middle.png` / `sweep-oblique.png`
- `sweep.webm`
- `sweep-telemetry.json`
- `manifest.json` — current worktree source hashes, runtime gate values, and
  renderer details
- `checksums.sha256`
