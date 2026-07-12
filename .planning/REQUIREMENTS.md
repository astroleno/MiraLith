# Requirements: MiraLith

**Defined:** 2026-04-24  
**Updated:** 2026-04-24 after scope/language/motion alignment  
**Core Value:** Turn the LuBirth opening into a memorable field of vision that can later expand into the full MiraLith world.

## v1.0 Requirements: LuBirth Opening Release

### Product Narrative

- [ ] **NARR-01**: Visitor can understand MiraLith as a personal field site from the LuBirth opening, not a conventional resume site.
- [ ] **NARR-02**: Public copy uses Chinese as the primary voice with English secondary lines.
- [ ] **NARR-03**: The first two screens create a clear transition from ritual field to LuBirth project window.

### Shopify-Level UX Reference

- [ ] **UX-01**: Homepage uses a layered structure: DOM content layer, fixed visual layer, and orchestration layer.
- [ ] **UX-02**: First screen uses a lightweight intro / visible scene instead of waiting for heavy WebGL assets.
- [ ] **UX-03**: Theatre.js controls the primary Opening -> LuBirth Window scroll timeline.
- [ ] **UX-04**: Scroll progress drives visual state without per-frame React state updates.
- [ ] **UX-05**: Visual scenes support quality tiers and fallback rendering.
- [ ] **UX-06**: Text and controls do not overlap or become unreadable across desktop, mobile portrait, and mobile landscape.

### LuBirth Hero

- [ ] **LUB-01**: Site includes a lightweight `@miralith/lubirth-hero` package.
- [ ] **LUB-02**: `EarthMoonHero` supports `field`, `window`, `zoomed`, and `expanded` modes.
- [ ] **LUB-03**: Opening field renders earth, moon, atmosphere / rim glow, and fixed-date lunar composition without loading the full LuBirth app.
- [ ] **LUB-04**: LuBirth project window supports desktop hover zoom and mobile tap expansion.
- [ ] **LUB-05**: Expanded state can close by explicit control and Escape key.
- [ ] **LUB-06**: LuBirth critical assets fit the first-screen budget.

### Content

- [ ] **CONT-01**: v1.0 homepage includes Intro, LuBirth Ritual Field, and LuBirth Zoomable Project Window.
- [ ] **CONT-02**: LuBirth section copy exists in Chinese primary form with English secondary lines.
- [ ] **CONT-03**: Project data lives in typed local content and can later expand to other projects.
- [ ] **CONT-04**: LuBirth content remains understandable when the visual scene is disabled.

### Performance and Accessibility

- [ ] **PERF-01**: Mobile first-screen transfer stays below the 3MB hard limit.
- [ ] **PERF-02**: A usable first viewport appears within 3 seconds on target devices.
- [ ] **PERF-03**: WebGL unavailable or failed state still shows complete DOM content and project link / CTA.
- [ ] **PERF-04**: `prefers-reduced-motion` disables strong camera flights and scroll-coupled motion.
- [ ] **PERF-05**: Playwright validates desktop, mobile portrait, and mobile landscape screenshots.
- [ ] **PERF-06**: Canvas has nonblank rendering checks for key WebGL states.

### Release Surface

- [ ] **REL-01**: Site has correct title, description, and OG metadata for the v1.0 LuBirth opening release.
- [ ] **REL-02**: README, docs index, and planning docs describe the locked v1.0 scope.
- [ ] **REL-03**: Build, typecheck, lint, and basic browser verification commands run successfully.
- [ ] **REL-04**: v1.0 can deploy to Vercel as a mostly static site.

## v1.1 Requirements: Full Field-Site Expansion

### Mainline Chapters

- **SECT-01**: Radio Gaga section translates feeds / script / voice / hardware into a concise visual chapter.
- **SECT-02**: CoScroll appears as a lightweight ritual scene or poster-backed chapter, not a full app embed.
- **SECT-03**: ArtBreeze appears as a daily micro-ritual about AI waiting and art viewing.
- **SECT-04**: Experiment constellation groups smaller projects without flattening them into a generic grid.
- **SECT-05**: Selected commissions show real delivery credibility.
- **SECT-06**: Now Building connects current work to the larger MiraLith narrative.
- **SECT-07**: About / Contact supports collaboration, clients, and hiring interest without becoming a hard-sell funnel.

### Content Growth

- **GROW-01**: Project detail pages include deeper media, process notes, source links, and OG metadata.
- **GROW-02**: Mainline sections can be disabled visually while retaining DOM content.
- **GROW-03**: Rive or video-exported micro-animations support Radio Gaga / ArtBreeze UI details if they do not enter the v1.0 critical path.
- **GROW-04**: Content model supports multiple representation types: hero scene, lightweight scene, DOM vignette, case-study flow, poster loop, selected commission, and external artifact.
- **GROW-05**: v1.1 assets are curated through a media/demo pipeline instead of importing source-project raw assets.
- **GROW-06**: Source project runtimes are not imported into MiraLith unless explicitly wrapped as isolated demos with fallback.

## v2 Requirements

### Expanded Interaction

- **V2-01**: Shared fixed canvas hosts multiple R3F portal scenes.
- **V2-02**: Theatre.js expands from LuBirth opening into cross-chapter transitions.
- **V2-03**: Optional analytics track section engagement without undermining privacy.
- **V2-04**: CMS is introduced only if content updates become frequent enough to justify it.
- **V2-05**: MiraLith grows into a living archive / operating surface with case studies, notes, experiments, and updates.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Full long-scroll homepage in v1.0 | The first release should make LuBirth exceptional before broadening |
| Full CMS in v1.0 | Slows launch and adds little before content stabilizes |
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
| NARR-03 | Phase 3 | Pending |
| UX-01 | Phase 1 | Pending |
| UX-02 | Phase 3 | Pending |
| UX-03 | Phase 3 | Pending |
| UX-04 | Phase 3 | Pending |
| UX-05 | Phase 4 | Pending |
| UX-06 | Phase 4 | Pending |
| LUB-01 | Phase 2 | Pending |
| LUB-02 | Phase 2 | Pending |
| LUB-03 | Phase 2 | Pending |
| LUB-04 | Phase 3 | Pending |
| LUB-05 | Phase 3 | Pending |
| LUB-06 | Phase 4 | Pending |
| CONT-01 | Phase 1 | Pending |
| CONT-02 | Phase 1 | Pending |
| CONT-03 | Phase 1 | Pending |
| CONT-04 | Phase 4 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 4 | Pending |
| PERF-05 | Phase 4 | Pending |
| PERF-06 | Phase 4 | Pending |
| REL-01 | Phase 4 | Pending |
| REL-02 | Phase 1 | Pending |
| REL-03 | Phase 4 | Pending |
| REL-04 | Phase 4 | Pending |
| SECT-01..07 | Phase 5 | Deferred to v1.1 |
| GROW-01..06 | Phase 5 | Deferred to v1.1 |

**Coverage:**

- v1.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0
- v1.1 requirements: 13 tracked, deferred

---
*Requirements defined: 2026-04-24*  
*Last updated: 2026-04-24 after scope/language/motion alignment*
