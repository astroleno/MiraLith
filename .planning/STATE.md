# MiraLith State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-04-24)

**Core value:** Make the LuBirth opening unforgettable first, then let the rest of MiraLith grow from that field without losing coherence.

## Current Status

The repository now has a working pnpm / Next.js implementation in `apps/site`, shared visual packages, and an independent RadioGaga route on `codex/radio-gaga-route-branch`.

RadioGaga is implemented at `/radio-gaga` as the first v1.1 standalone case-page slice. It includes memory copy, process artifact, transparent radio shell, ESP32 care-core reveal, mobile composition handling, fallback radio silhouette, and Playwright coverage.

User decisions locked on 2026-04-24:

- v1.0 scope: make the LuBirth first two screens exceptional.
- Language: Chinese primary copy with English secondary lines.
- Motion: Theatre.js from the start for the Shopify-style opening timeline.

## Workspace Notes

- Existing docs are strong enough to act as PRD source material.
- Current worktree contains application code, visual packages, and RadioGaga e2e tests.
- Adjacent source projects are available under `/Users/aitoshuu/Documents/GitHub`.
- LuBirth and CoScroll contain valuable visual source material but also heavy assets and unrelated runtime concerns.

## Recommended Next Step

Move the RadioGaga route through PR / integration review, then decide whether to link it from the homepage now or keep it standalone while the LuBirth-first entry remains primary.

## Open Questions

- Should v1.0 include a minimal contact affordance, or should contact wait for v1.1?
- Should v1.0 include project detail pages, or only the LuBirth opening and project-window CTA?
- Should the site track analytics, and if so with Vercel Analytics, Plausible, or no analytics for v1?

## Last Updated

2026-04-29 after RadioGaga standalone route implementation and verification.
