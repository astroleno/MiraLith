# Roadmap: MiraLith

## Overview

MiraLith should ship in layers: first a clean project and content foundation, then a lightweight LuBirth visual kernel, then a polished two-screen opening experience, then the remaining mainline chapters, and finally release hardening. This keeps the Shopify-level ambition without trying to build the full motion system before the site has a stable narrative and asset budget.

## Phases

- [ ] **Phase 1: Foundation and Content Spine** - Create the Next / workspace skeleton, content model, design tokens, and homepage section structure.
- [ ] **Phase 2: LuBirth Visual Kernel** - Extract a lightweight earth-moon hero package from LuBirth ideas without importing the full app.
- [ ] **Phase 3: Opening Experience** - Build intro, LuBirth ritual field, project window, zoom / expanded states, and first performance tier.
- [ ] **Phase 4: Mainline Chapters** - Add Radio Gaga, CoScroll, ArtBreeze, and experiment constellation as lightweight sections.
- [ ] **Phase 5: Release and Credibility Layer** - Add commissions, now building, about/contact, metadata, verification, and deployment polish.

## Phase Details

### Phase 1: Foundation and Content Spine

**Goal**: The project runs as a real app with a stable content and visual architecture.  
**Depends on**: Nothing.  
**Requirements**: NARR-01, NARR-02, NARR-03, UX-01, CONT-01, CONT-02, CONT-03, REL-02  
**Success Criteria**:

1. Next.js App Router app runs locally from `apps/site`.
2. pnpm workspace includes `apps/site`, `packages/visual-core`, and future visual package slots.
3. Homepage sections render meaningful DOM content without WebGL.
4. Typed project data exists for LuBirth, Radio Gaga, CoScroll, ArtBreeze, constellation items, commissions, now building, and contact.
5. Design tokens establish the mineral / lunar / archival tone without one-note color dependence.

**Plans**: 3 plans

- [ ] 01-01: Scaffold pnpm workspace and Next app.
- [ ] 01-02: Build typed content model and homepage section data.
- [ ] 01-03: Establish base layout, tokens, typography, and docs index.

### Phase 2: LuBirth Visual Kernel

**Goal**: `@miralith/lubirth-hero` can render a lightweight static earth-moon scene with field / window presets.  
**Depends on**: Phase 1.  
**Requirements**: UX-03, LUB-01, LUB-02, LUB-03  
**Success Criteria**:

1. `EarthMoonHero` and `EarthMoonScene` expose the documented API.
2. Field and window presets render without importing LuBirth `SimpleTest` or unrelated modules.
3. Low-resolution earth / moon placeholder assets are budgeted and load through a manifest.
4. The scene supports paused / reduced-motion / fallback controls.

**Plans**: 3 plans

- [ ] 02-01: Define visual-core quality / viewport / scroll contracts.
- [ ] 02-02: Implement lubirth-hero types, presets, and component shell.
- [ ] 02-03: Implement static earth, moon, light, atmosphere, and fallback poster path.

### Phase 3: Opening Experience

**Goal**: The first two screens feel like MiraLith: lightweight intro, ritual field, LuBirth project window, zoom, expanded state, mobile-safe layout, and budget checks.  
**Depends on**: Phase 2.  
**Requirements**: UX-02, UX-04, UX-05, LUB-04, LUB-05, LUB-06, PERF-01, PERF-02, PERF-03, PERF-04  
**Success Criteria**:

1. Intro shows immediately with CSS/SVG or DOM-only visual affordance.
2. Scroll moves from opening field into a LuBirth project window without creating a second heavy canvas.
3. Desktop hover zoom and mobile tap expansion work.
4. Reduced-motion and WebGL fallback remain readable.
5. Bundle and asset report show the first-screen budget is being respected.

**Plans**: 4 plans

- [ ] 03-01: Build intro and first-screen DOM composition.
- [ ] 03-02: Connect scroll progress to field / window state.
- [ ] 03-03: Add zoom / expanded interactions and accessibility behavior.
- [ ] 03-04: Add quality tiers, fallback poster, and first budget report.

### Phase 4: Mainline Chapters

**Goal**: The site can continue beyond LuBirth into Radio Gaga, CoScroll, ArtBreeze, and experiment constellation without becoming a project grid.  
**Depends on**: Phase 3.  
**Requirements**: CONT-04, plus v2-ready UX architecture.  
**Success Criteria**:

1. Radio Gaga section translates feeds / script / voice / hardware into a concise visual chapter.
2. CoScroll appears as a lightweight scene package or poster-backed ritual chapter, not a full app embed.
3. ArtBreeze appears as a small daily ritual with browser / waiting / art framing language.
4. Experiment constellation groups smaller projects without flattening the homepage.
5. Each chapter has DOM content, links, and fallback.

**Plans**: 4 plans

- [ ] 04-01: Implement Radio Gaga chapter shell and content.
- [ ] 04-02: Implement CoScroll scene interface or first fallback-backed version.
- [ ] 04-03: Implement ArtBreeze chapter shell and content.
- [ ] 04-04: Implement experiment constellation data and interaction.

### Phase 5: Release and Credibility Layer

**Goal**: The site is credible, contactable, shareable, verifiable, and deployable.  
**Depends on**: Phase 4.  
**Requirements**: NARR-04, PERF-05, PERF-06, REL-01, REL-03, REL-04  
**Success Criteria**:

1. Selected commissions and now-building sections support client / job credibility without hijacking the tone.
2. About and contact provide clear routes for collaboration.
3. SEO metadata and OG images exist for the homepage and core project pages.
4. Playwright screenshots validate desktop, mobile portrait, and mobile landscape.
5. Build, lint, typecheck, and release verification pass.
6. Vercel deployment path is documented and tested.

**Plans**: 3 plans

- [ ] 05-01: Add commissions, now building, about, and contact.
- [ ] 05-02: Add project metadata, OG, and deployment config.
- [ ] 05-03: Add browser verification, screenshots, and release budget checks.

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Foundation and Content Spine | 0/3 | Not started | - |
| 2. LuBirth Visual Kernel | 0/3 | Not started | - |
| 3. Opening Experience | 0/4 | Not started | - |
| 4. Mainline Chapters | 0/4 | Not started | - |
| 5. Release and Credibility Layer | 0/3 | Not started | - |

## Long-Term Direction

After v1, MiraLith can become a living personal operating surface:

- More detailed case studies for selected work.
- A richer experiment constellation with filtering and deep links.
- Shared R3F portal scenes under one fixed canvas.
- Theatre.js timeline editing for polished Shopify-level transitions.
- Optional lightweight analytics to learn what visitors actually explore.
- Optional CMS only after content maintenance becomes a real burden.

