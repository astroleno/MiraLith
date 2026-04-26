# MiraLith

## What This Is

MiraLith is a personal field site for Zuobowen Li: a style-forward website that uses LuBirth as an origin scene and then guides visitors through AI, visual systems, browser rituals, client work, current products, and contact. It should feel closer to a Shopify Editions-quality interactive release page than to a resume or grid portfolio.

The v1.0 release is intentionally narrower: make the first two LuBirth screens exceptional, using Chinese primary copy with English secondary lines and a Theatre.js-controlled opening timeline. Later releases expand the rest of the field site.

## Core Value

Make the LuBirth opening unforgettable first, then let the rest of MiraLith grow from that field without losing coherence.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Establish a high-memory first two-screen LuBirth opening: ritual field plus zoomable project window.
- [ ] Use Chinese as the primary public copy with English secondary lines.
- [ ] Use Theatre.js from the start for the field-to-window scroll timeline.
- [ ] Preserve readable, indexable DOM content independent of WebGL.
- [ ] Keep LuBirth as the first two-screen anchor: opening field plus zoomable project window.
- [ ] Use strict performance tiers and fallback paths for mobile, reduced motion, and WebGL failure.
- [ ] Use local typed content and MDX-style project data before introducing any CMS.
- [ ] Leave clean content and package boundaries so Radio Gaga, CoScroll, ArtBreeze, constellation, commissions, now building, about, and contact can land in v1.1+ without rebuilding the core.

### Out of Scope

- Full CMS in v1 - typed local content is faster and safer for first release.
- Full LuBirth app embedding - it would bring unnecessary UI, audio, testing, and heavy assets into the homepage.
- Full long-scroll homepage in v1.0 - the first release should make LuBirth feel exceptional before expanding the narrative.
- Full CoScroll migration - v1 should preserve the jade anchor / occlusion / ritual essence, not the whole audio app.
- Shopify pixel-level cloning - Shopify is a quality and architecture reference, not a visual template to copy.
- Heavy lead-generation funnel - the site should invite contact while preserving personal-field atmosphere.
- Native mobile app - the first release is web-first with mobile fallback.

## Context

Existing MiraLith docs already define a strong direction: `docs/prd.md`, `docs/tech-stack.md`, `docs/top-plan.md`, `docs/interfaces.md`, `docs/migration-plan.md`, and `docs/coscroll-integration-brief.md`.

Adjacent GitHub projects provide source material:

- `LuBirth` - React 18 / Vite / R3F earth-moon visual system with astronomy and heavy texture assets.
- `CoScroll` - Next 14 / R3F / Zustand / Troika text digital scroll experience with jade models, audio, and 3D lyric occlusion.
- `radio-gaga` - AI podcast system for parents, with Vite frontend and Cloudflare/n8n-oriented architecture docs.
- `ArtBreeze-public` - Chrome extension that turns AI waiting into framed art viewing.
- `SonoScope` - mobile-first audio visualization and plugin system.
- `UGCFlow` and `fv_website` - AI-native production / video systems that belong in the "Now Building" or commercial/product narrative.
- `licharlieshi_portfolio` and `dulwich_animation` - commission credibility examples.

The Shopify reference in `reference/shopify.md` supports a layered architecture: DOM content, fixed WebGL canvas, scroll orchestration, quality tiers, lightweight intro, and aggressive asset budgeting.

## Constraints

- **Performance**: mobile first-screen transfer target 2.4MB, hard limit 3MB - the site must not become a demo reel that only works on high-end desktops.
- **Accessibility**: text, links, and project meaning must exist in HTML - canvas is visual support, not the content source.
- **Motion**: reduced-motion must remain usable and beautiful - scroll-driven camera motion is optional per quality tier.
- **Theatre scope**: Theatre.js is part of v1.0, but only for the opening timeline and tunable visual parameters - not idle rotation, simple hover, or every-frame state.
- **Architecture**: homepage should converge toward one fixed WebGL canvas - avoid per-section canvas sprawl.
- **Migration**: source projects are references and extraction targets - do not mutate them or copy full applications into MiraLith.
- **Content**: v1 should be authored locally - project data must be easy to revise before public launch.

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| Use Next.js App Router for the main site | The site needs routes, metadata, static project pages, content organization, and deployment ergonomics beyond a single Vite demo | Selected |
| Use pnpm workspace | Visual packages should be reusable and isolated from site content | Selected |
| Keep LuBirth as first-screen origin | It best matches MiraLith's "see + engrave" metaphor and creates the strongest first impression | Selected |
| v1.0 focuses on LuBirth first two screens | A smaller release target lets the opening reach Shopify-level polish instead of becoming a broad but shallow homepage | Selected |
| Use Chinese primary copy with English secondary lines | Best matches the current voice while keeping international readability | Selected |
| Build a lightweight LuBirth hero instead of embedding the full app | Protects bundle size, removes unrelated UI/audio/testing paths, and gives composition control | Selected |
| Treat Shopify as architecture and quality reference | The goal is similar interaction maturity, not imitation | Selected |
| Defer CMS | Local typed content is enough for v1 and keeps iteration fast | Selected |
| Use Theatre.js from the start for the opening timeline | The field-to-window transition is the signature interaction and needs timeline-quality tuning | Selected |

## Evolution

This document evolves at phase transitions and milestone boundaries.

After each phase transition:

1. Requirements invalidated? Move to Out of Scope with reason.
2. Requirements validated? Move to Validated with phase reference.
3. New requirements emerged? Add to Active.
4. Decisions to log? Add to Key Decisions.
5. "What This Is" still accurate? Update if drifted.

After each milestone:

1. Full review of all sections.
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state.

---
*Last updated: 2026-04-24 after scope/language/motion alignment*
