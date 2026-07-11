# Radio Gaga source audit

- Source repo: `/Users/aitoshuu/Documents/GitHub/radio-gaga`
- Source SHA: `b47453efa2d7f25c0a51468907e906d66fb18fba`
- Source sync: local `HEAD` and `origin/main` matched after `git fetch origin main` on 2026-07-11
- Source worktree note: only `.git.broken-before-recovery-20260521023728/` is untracked; no source files were modified
- Migration mode: static case-study narrative
- Runtime code allowed: none
- Evidence allowed: story facts, local screenshots, radio model, and ESP32 model
- Explicit exclusions: feed API, ListenHub generation or polling, preview/edit/publish calls, Jotai state, KV/D1, MCP, Worker runtime, hardware bridge, audio playback, credentials, accounts, environment variables, unfinished search/settings/history/feedback features

## Candidate snapshot

- Migration branch: `codex/radio-gaga-home-migration`
- Candidate checkpoint: `461575f`
- The checkpoint contains only the confirmed Radio Gaga candidate, its two local proof images, required package metadata, and the migration plan.
- Existing CoScroll and unrelated LuBirth experiments from the original dirty worktree were excluded.

## Knowledge graph status

- Existing report inspected: `/Users/aitoshuu/Documents/GitHub/MiraLith/graphify-out/GRAPH_REPORT.md`
- Existing graph inspected: `/Users/aitoshuu/Documents/GitHub/MiraLith/graphify-out/graph.json`
- `/graphify` query, path, and explain commands are unavailable in this environment (`no such file or directory`).
- Targeted graph JSON inspection and repository reads were used only after the graph report review.

## Baseline verification

- `pnpm verify`: passed.
- `CI=1 pnpm exec playwright test tests/e2e/radio-gaga.spec.ts --workers=1`: 37 passed, 2 intentionally skipped.
- Two pre-existing LuBirth lint violations were corrected with the matching fixes already present in the original worktree; no LuBirth visual experiment was imported.
- The candidate initially resolved two copies of `@react-three/fiber` because its pinned React type peer context differed from the site. Aligning the Radio package type version restored one R3F runtime and made the real Canvas pixel test pass in all three viewport projects.
