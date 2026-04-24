# Requirements: MiraLith

**Defined:** 2026-04-24  
**Core Value:** Turn many projects and identities into one memorable field of vision.

## v1 Requirements

### Product Narrative

- [ ] **NARR-01**: Visitor can understand MiraLith as a personal field site, not a conventional resume site.
- [ ] **NARR-02**: Homepage presents a coherent chapter order from LuBirth origin field to contact.
- [ ] **NARR-03**: Project-heavy history is grouped into mainline chapters, experiment constellations, commissions, and current building.
- [ ] **NARR-04**: Contact, collaboration, and job/client intent are present but visually restrained.

### Shopify-Level UX Reference

- [ ] **UX-01**: Homepage uses a layered structure: DOM content layer, fixed visual layer, and orchestration layer.
- [ ] **UX-02**: First screen uses a lightweight intro / visible scene instead of waiting for heavy WebGL assets.
- [ ] **UX-03**: Scroll progress can drive scene state without per-frame React state updates.
- [ ] **UX-04**: Visual scenes support quality tiers and fallback rendering.
- [ ] **UX-05**: Text and controls do not overlap or become unreadable across desktop, mobile portrait, and mobile landscape.

### LuBirth Hero

- [ ] **LUB-01**: Site includes a lightweight `@miralith/lubirth-hero` package.
- [ ] **LUB-02**: `EarthMoonHero` supports `field`, `window`, `zoomed`, and `expanded` modes.
- [ ] **LUB-03**: Opening field renders earth, moon, atmosphere / rim glow, and fixed-date lunar composition without loading the full LuBirth app.
- [ ] **LUB-04**: LuBirth project window supports desktop hover zoom and mobile tap expansion.
- [ ] **LUB-05**: Expanded state can close by explicit control and Escape key.
- [ ] **LUB-06**: LuBirth critical assets fit the first-screen budget.

### Content and Sections

- [ ] **CONT-01**: Homepage includes sections for intro, LuBirth field, LuBirth window, Radio Gaga, CoScroll, ArtBreeze, constellation, selected commissions, now building, and about/contact.
- [ ] **CONT-02**: Project data lives in typed local content and can generate project metadata.
- [ ] **CONT-03**: Each main project has concise bilingual-ready title, subtitle, body, tags, links, and preview data.
- [ ] **CONT-04**: Each project section can remain understandable when its visual scene is disabled.

### Performance and Accessibility

- [ ] **PERF-01**: Mobile first-screen transfer stays below the 3MB hard limit.
- [ ] **PERF-02**: A usable first viewport appears within 3 seconds on target devices.
- [ ] **PERF-03**: WebGL unavailable or failed state still shows complete DOM content and project links.
- [ ] **PERF-04**: `prefers-reduced-motion` disables strong camera flights and scroll-coupled motion.
- [ ] **PERF-05**: Playwright validates desktop, mobile portrait, and mobile landscape screenshots.
- [ ] **PERF-06**: Canvas has nonblank rendering checks for key WebGL states.

### Release Surface

- [ ] **REL-01**: Site has correct title, description, OG metadata, and per-project metadata.
- [ ] **REL-02**: README, docs index, and planning docs describe the project and next steps.
- [ ] **REL-03**: Build, typecheck, lint, and basic browser verification commands run successfully.
- [ ] **REL-04**: v1 can deploy to Vercel as a mostly static site.

## v2 Requirements

### Expanded Interaction

- **V2-01**: Shared fixed canvas hosts multiple R3F portal scenes.
- **V2-02**: Theatre.js controls polished scene transitions and visual parameter timelines.
- **V2-03**: Rive or video-exported micro-animations support Radio Gaga / ArtBreeze UI details.
- **V2-04**: Project detail pages include deeper media, process notes, and source links.
- **V2-05**: Optional analytics track section engagement without undermining privacy.

### Content Growth

- **V2-06**: Add richer bilingual content if the first audience benefits from it.
- **V2-07**: Add CMS only if content updates become frequent enough to justify it.
- **V2-08**: Add case-study pages for selected commissions and client-facing proof.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Full CMS in v1 | Slows launch and adds little before content stabilizes |
| Full LuBirth app embed | Too heavy and brings unrelated UI/audio/debug/test code |
| Full CoScroll app embed | Too much audio, font, model, and timeline complexity for a homepage chapter |
| Shopify pixel clone | The benchmark is interaction quality and engineering maturity, not copying visuals |
| Aggressive lead-gen funnel | Would damage the personal field tone |
| Native app | Web-first is the correct launch surface |

## Traceability

| Requirement | Phase | Status |
| --- | --- | --- |
| NARR-01 | Phase 1 | Pending |
| NARR-02 | Phase 1 | Pending |
| NARR-03 | Phase 1 | Pending |
| NARR-04 | Phase 5 | Pending |
| UX-01 | Phase 1 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 2 | Pending |
| UX-04 | Phase 3 | Pending |
| UX-05 | Phase 3 | Pending |
| LUB-01 | Phase 2 | Pending |
| LUB-02 | Phase 2 | Pending |
| LUB-03 | Phase 2 | Pending |
| LUB-04 | Phase 3 | Pending |
| LUB-05 | Phase 3 | Pending |
| LUB-06 | Phase 3 | Pending |
| CONT-01 | Phase 1 | Pending |
| CONT-02 | Phase 1 | Pending |
| CONT-03 | Phase 1 | Pending |
| CONT-04 | Phase 4 | Pending |
| PERF-01 | Phase 3 | Pending |
| PERF-02 | Phase 3 | Pending |
| PERF-03 | Phase 3 | Pending |
| PERF-04 | Phase 3 | Pending |
| PERF-05 | Phase 5 | Pending |
| PERF-06 | Phase 5 | Pending |
| REL-01 | Phase 5 | Pending |
| REL-02 | Phase 1 | Pending |
| REL-03 | Phase 5 | Pending |
| REL-04 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-24*  
*Last updated: 2026-04-24 after initialization*

