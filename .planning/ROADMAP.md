# Roadmap: MiraLith

## Overview

MiraLith now has a narrower and sharper v1.0: make the LuBirth first two screens exceptional before expanding the rest of the personal field site. The first milestone should prove the architecture, taste, and performance discipline: Chinese-primary copy, a lightweight earth-moon visual kernel, and a Theatre.js-controlled Opening -> LuBirth Window transition.

Current visual blocker, recorded 2026-04-29: LuBirth's earth-moon kernel must resolve scroll jank, a fixed/readable starfield, visible rotating code-cloud shells, Karman-line atmosphere glow, and aurora curtain visibility before v1.0 can be considered visually locked. See `../docs/lubirth-earthmoon-visual-gap-review.md`.

## Phases

- [ ] **Phase 1: Foundation and Motion Spine** - Scaffold the app, content model, design tokens, visual-core contracts, and Theatre-ready orchestration.
- [ ] **Phase 2: LuBirth Visual Kernel** - Extract a lightweight earth-moon hero package from LuBirth ideas without importing the full app.
- [ ] **Phase 3: Theatre Opening Experience** - Build the Intro, LuBirth Ritual Field, LuBirth Window, and Theatre-controlled transition.
- [ ] **Phase 4: v1.0 Hardening and Launch** - Add quality tiers, fallback, accessibility, screenshots, budgets, metadata, and deploy readiness.
- [ ] **Phase 5: v1.1 Field-Site Expansion** - Add Radio Gaga, CoScroll, ArtBreeze, constellation, commissions, now building, and contact.

## Phase Details

### Phase 1: Foundation and Motion Spine

**Goal**: The project runs as a real app with the locked v1.0 scope: Chinese-primary LuBirth opening, typed content, and a Theatre-ready motion architecture.  
**Depends on**: Nothing.  
**Requirements**: NARR-01, NARR-02, UX-01, CONT-01, CONT-02, CONT-03, REL-02  
**Success Criteria**:

1. Next.js App Router app runs locally from `apps/site`.
2. pnpm workspace includes `apps/site`, `packages/visual-core`, and `packages/lubirth-hero`.
3. Typed content exists for the v1.0 LuBirth opening and stores future-project placeholders without rendering the full long homepage.
4. Design tokens establish the mineral / lunar / archival tone without one-note color dependence.
5. Theatre.js dependencies and visual-core binding points are present, but no routine hover / idle motion is routed through Theatre.

**Plans**: 3 plans

- [ ] 01-01: Scaffold pnpm workspace and Next app.
- [ ] 01-02: Build Chinese-primary LuBirth content model and homepage section data.
- [ ] 01-03: Establish design tokens, visual-core contracts, and Theatre binding skeleton.

### Phase 2: LuBirth Visual Kernel

**Goal**: `@miralith/lubirth-hero` can render a lightweight static earth-moon scene with field / window presets and animatable scene props.  
**Depends on**: Phase 1.  
**Requirements**: LUB-01, LUB-02, LUB-03  
**Success Criteria**:

1. `EarthMoonHero` and `EarthMoonScene` expose the documented API.
2. Field and window presets render without importing LuBirth `SimpleTest` or unrelated modules.
3. Low-resolution earth / moon placeholder assets are budgeted and load through a manifest.
4. The package exposes animatable props for app-level Theatre binding without requiring Theatre internally.
5. Starfield, code-cloud shells, atmosphere/Karman glow, and aurora each have a visible debug mode and pass screenshot review.

**Plans**: 3 plans

- [ ] 02-01: Define lubirth-hero types, presets, and asset manifest.
- [ ] 02-02: Implement static earth, moon, light, atmosphere, and aurora alpha.
- [ ] 02-03: Implement fallback poster path and reduced-motion controls.

### Phase 3: Theatre Opening Experience

**Goal**: The first two screens feel like MiraLith: immediate intro, ritual field, LuBirth project window, zoom / expanded states, and a tunable Theatre timeline.  
**Depends on**: Phase 2.  
**Requirements**: NARR-03, UX-02, UX-03, UX-04, LUB-04, LUB-05  
**Success Criteria**:

1. Intro shows immediately with CSS/SVG or DOM-only visual affordance.
2. Theatre timeline controls the Opening -> LuBirth Window camera, light, shader, and key transform parameters.
3. Scroll progress binds to Theatre position without per-frame React state updates.
4. Desktop hover zoom and mobile tap expansion work.
5. Expanded state can close through explicit control and Escape.
6. Scroll-driven motion keeps the starfield visually stable while the earth, moon, cloud layer, atmosphere, and aurora remain readable.

**Plans**: 4 plans

- [ ] 03-01: Build intro and first-screen DOM composition.
- [ ] 03-02: Bind scroll progress to Theatre sequence for field -> window transition.
- [ ] 03-03: Add zoom / expanded interactions and accessibility behavior.
- [ ] 03-04: Tune Chinese-primary copy, English secondary lines, and mobile composition.

### Phase 4: v1.0 Hardening and Launch

**Goal**: The LuBirth opening release is performant, accessible, shareable, verifiable, and deployable.  
**Depends on**: Phase 3.  
**Requirements**: UX-05, UX-06, LUB-06, CONT-04, PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, REL-01, REL-03, REL-04  
**Success Criteria**:

1. Quality tiers cover high, medium, low, fallback, and reduced-motion behavior.
2. Mobile first-screen transfer stays below the 3MB hard limit.
3. WebGL failure still leaves complete LuBirth copy and a usable CTA.
4. Playwright screenshots validate desktop, mobile portrait, and mobile landscape.
5. Canvas nonblank checks pass for the key rendered states.
6. Build, lint, typecheck, and Vercel deployment path are documented and working.

**Plans**: 4 plans

- [ ] 04-01: Add quality tiers, DPR clamp, and asset budget reporting.
- [ ] 04-02: Add fallback poster, WebGL failure handling, and reduced-motion experience.
- [ ] 04-03: Add SEO / OG metadata and release surface.
- [ ] 04-04: Add Playwright screenshots, canvas checks, and launch verification.

### Phase 5: v1.1 Field-Site Expansion

**Goal**: Expand the proven LuBirth opening into the full MiraLith field site without compromising the v1.0 foundation.  
**Depends on**: Phase 4.  
**Requirements**: SECT-01..07, GROW-01..06  
**Success Criteria**:

1. Radio Gaga, CoScroll, and ArtBreeze land as lightweight chapters or poster-backed scenes.
2. Experiment constellation groups smaller projects without becoming a generic grid.
3. Selected commissions and now-building sections add credibility without hijacking the tone.
4. About / Contact supports collaboration, client, and hiring intent.
5. Media/demo assets use curated posters, loops, diagrams, and compressed models rather than raw source-project assets.
6. Project detail pages and richer media are added only after the opening remains stable.

**Plans**: 6 plans

- [ ] 05-01: Implement Radio Gaga chapter shell and content.
- [ ] 05-02: Implement CoScroll scene interface or first fallback-backed version.
- [ ] 05-03: Implement ArtBreeze chapter shell and content.
- [ ] 05-04: Implement experiment constellation, selected commissions, and now-building.
- [ ] 05-05: Implement source project media/demo pipeline and representation types.
- [ ] 05-06: Implement about/contact and project detail expansion.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| --- | --- | --- | --- | --- |
| 1. Foundation and Motion Spine | v1.0 | 0/3 | Not started | - |
| 2. LuBirth Visual Kernel | v1.0 | 0/3 | Not started | - |
| 3. Theatre Opening Experience | v1.0 | 0/4 | Not started | - |
| 4. v1.0 Hardening and Launch | v1.0 | 0/4 | Not started | - |
| 5. v1.1 Field-Site Expansion | v1.1 | 0/6 | Deferred | - |

## Long-Term Direction

After v1.0, MiraLith can become a living personal operating surface:

- v1.1 adds Radio Gaga, CoScroll, ArtBreeze, constellation, commissions, now building, and contact.
- v2 deepens project detail pages and shared fixed-canvas portal scenes.
- Later milestones can add notes, case studies, optional analytics, and maybe CMS if content maintenance becomes a real burden.
