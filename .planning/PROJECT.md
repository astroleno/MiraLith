# MiraLith

## What This Is

MiraLith is a personal field site for Zuobowen Li: a style-forward website that uses LuBirth as an origin scene and then guides visitors through AI, visual systems, browser rituals, client work, current products, and contact. It should feel closer to a Shopify Editions-quality interactive release page than to a resume or grid portfolio.

The site is meant to create a strong first impression, show taste and technical range, and lightly support job, client, and collaboration discovery without becoming a hard-selling landing page.

## Core Value

Turn many projects and identities into one memorable field of vision: visitors should quickly feel the taste, understand the work, and know how to reach out.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Establish a high-memory first viewport using a lightweight LuBirth earth-moon ritual field.
- [ ] Preserve readable, indexable DOM content independent of WebGL.
- [ ] Present the homepage as a continuous narrative, not a conventional portfolio list.
- [ ] Keep LuBirth as the first two-screen anchor: opening field plus zoomable project window.
- [ ] Include Radio Gaga, CoScroll, ArtBreeze, experiment constellation, selected commissions, now building, about, and contact.
- [ ] Use strict performance tiers and fallback paths for mobile, reduced motion, and WebGL failure.
- [ ] Use local typed content and MDX-style project data before introducing any CMS.
- [ ] Make future chapters and projects easy to add without rebuilding the whole visual system.

### Out of Scope

- Full CMS in v1 - typed local content is faster and safer for first release.
- Full LuBirth app embedding - it would bring unnecessary UI, audio, testing, and heavy assets into the homepage.
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
- **Architecture**: homepage should converge toward one fixed WebGL canvas - avoid per-section canvas sprawl.
- **Migration**: source projects are references and extraction targets - do not mutate them or copy full applications into MiraLith.
- **Content**: v1 should be authored locally - project data must be easy to revise before public launch.

## Key Decisions

| Decision | Rationale | Outcome |
| --- | --- | --- |
| Use Next.js App Router for the main site | The site needs routes, metadata, static project pages, content organization, and deployment ergonomics beyond a single Vite demo | Pending |
| Use pnpm workspace | Visual packages should be reusable and isolated from site content | Pending |
| Keep LuBirth as first-screen origin | It best matches MiraLith's "see + engrave" metaphor and creates the strongest first impression | Pending |
| Build a lightweight LuBirth hero instead of embedding the full app | Protects bundle size, removes unrelated UI/audio/testing paths, and gives composition control | Pending |
| Treat Shopify as architecture and quality reference | The goal is similar interaction maturity, not imitation | Pending |
| Defer CMS | Local typed content is enough for v1 and keeps iteration fast | Pending |
| Use Theatre.js after static visual foundation works | Timeline tools help polish, but early adoption can slow Phase 1 | Pending |

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
*Last updated: 2026-04-24 after initialization*

